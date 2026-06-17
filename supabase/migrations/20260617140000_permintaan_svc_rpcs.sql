-- Migration: RPC versi service-role untuk permintaan
-- Dipanggil dari server actions (service role key) sehingga auth.uid() = null.
-- Validasi role dilakukan di application layer (middleware + page isKitchen guard).
-- Fungsi ini dibuat SECURITY DEFINER agar bisa memanggil existing helpers.

-- ============================================================
-- 1. buat_permintaan_svc — crew buat permintaan (tanpa cek accessible_outlet_ids)
--    p_dibuat_oleh: auth UID dari user session (dikirim dari server action)
-- ============================================================
CREATE OR REPLACE FUNCTION buat_permintaan_svc(
  p_outlet_id    UUID,
  p_items        JSONB,
  p_dibuat_oleh  UUID
)
RETURNS permintaan_bahan
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_p    permintaan_bahan;
  v_item JSONB;
BEGIN
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'permintaan harus berisi minimal 1 item';
  END IF;

  INSERT INTO permintaan_bahan (outlet_id, dibuat_oleh)
  VALUES (p_outlet_id, p_dibuat_oleh)
  RETURNING * INTO v_p;

  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    INSERT INTO permintaan_bahan_item (permintaan_id, bahan_baku_id, qty_diminta)
    VALUES (v_p.id, (v_item->>'bahan_baku_id')::UUID, (v_item->>'qty_diminta')::NUMERIC);
  END LOOP;

  RETURN v_p;
END;
$$;

-- ============================================================
-- 2. approve_permintaan_svc — setujui permintaan (tanpa cek is_kitchen_staff)
-- ============================================================
CREATE OR REPLACE FUNCTION approve_permintaan_svc(
  p_permintaan_id UUID,
  p_items         JSONB
)
RETURNS permintaan_bahan
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_p       permintaan_bahan;
  v_item    JSONB;
  v_sj      surat_jalan;
  v_sj_items JSONB := '[]'::jsonb;
  v_bahan   UUID;
  v_qty     NUMERIC;
BEGIN
  SELECT * INTO v_p FROM permintaan_bahan WHERE id = p_permintaan_id FOR UPDATE;
  IF v_p.id IS NULL THEN
    RAISE EXCEPTION 'permintaan % tidak ditemukan', p_permintaan_id;
  END IF;
  IF v_p.status != 'menunggu' THEN
    RAISE EXCEPTION 'permintaan % berstatus %, harus menunggu', p_permintaan_id, v_p.status;
  END IF;

  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_bahan := (v_item->>'bahan_baku_id')::UUID;
    v_qty   := (v_item->>'qty_disetujui')::NUMERIC;

    UPDATE permintaan_bahan_item
    SET qty_disetujui = v_qty
    WHERE permintaan_id = p_permintaan_id AND bahan_baku_id = v_bahan;

    IF NOT FOUND THEN
      INSERT INTO permintaan_bahan_item (permintaan_id, bahan_baku_id, qty_diminta, qty_disetujui)
      VALUES (p_permintaan_id, v_bahan, v_qty, v_qty);
    END IF;

    IF v_qty > 0 THEN
      v_sj_items := v_sj_items || jsonb_build_object('bahan_baku_id', v_bahan, 'qty_dikirim', v_qty);
    END IF;
  END LOOP;

  UPDATE permintaan_bahan_item
  SET qty_disetujui = 0
  WHERE permintaan_id = p_permintaan_id AND qty_disetujui IS NULL;

  IF jsonb_array_length(v_sj_items) = 0 THEN
    RAISE EXCEPTION 'tidak ada item disetujui (qty > 0); gunakan tolak_permintaan_svc';
  END IF;

  v_sj := create_surat_jalan(v_p.outlet_id, v_sj_items);

  UPDATE permintaan_bahan
  SET status = 'disetujui', surat_jalan_id = v_sj.id, updated_at = NOW()
  WHERE id = p_permintaan_id
  RETURNING * INTO v_p;

  RETURN v_p;
END;
$$;

-- ============================================================
-- 3. tolak_permintaan_svc — tolak permintaan (tanpa cek is_kitchen_staff)
-- ============================================================
CREATE OR REPLACE FUNCTION tolak_permintaan_svc(
  p_permintaan_id UUID,
  p_alasan        TEXT
)
RETURNS permintaan_bahan
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_p permintaan_bahan;
BEGIN
  SELECT * INTO v_p FROM permintaan_bahan WHERE id = p_permintaan_id FOR UPDATE;
  IF v_p.id IS NULL THEN
    RAISE EXCEPTION 'permintaan % tidak ditemukan', p_permintaan_id;
  END IF;
  IF v_p.status != 'menunggu' THEN
    RAISE EXCEPTION 'permintaan % berstatus %, harus menunggu', p_permintaan_id, v_p.status;
  END IF;

  UPDATE permintaan_bahan
  SET status = 'ditolak', catatan_kitchen = p_alasan, updated_at = NOW()
  WHERE id = p_permintaan_id
  RETURNING * INTO v_p;

  RETURN v_p;
END;
$$;
