-- 20260819100001_permintaan_budget_outlet_rpcs.sql
-- RPC budget outlet + approve_permintaan_svc kini snapshot harga_beli saat approve.
-- Lihat docs/superpowers/specs/2026-08-18-permintaan-budget-outlet-design.md §4.3, §4.4, §6.
-- Aditif. approve_permintaan_svc di-CREATE OR REPLACE berdasarkan definisi live
-- terverifikasi via pg_get_functiondef (RPC ini tidak punya migration tracked
-- sebelumnya di repo -- lihat CLAUDE.md temuan sesi 2026-07-20).

CREATE OR REPLACE FUNCTION get_outlet_budget_status(p_outlet_id UUID)
RETURNS TABLE (
  nominal      NUMERIC,
  period_type  TEXT,
  period_start DATE,
  period_end   DATE,
  terpakai     NUMERIC,
  sisa         NUMERIC,
  has_config   BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg          outlet_budget_config;
  v_today        DATE := (NOW() AT TIME ZONE 'Asia/Jakarta')::date;
  v_start        DATE;
  v_end          DATE;
  v_days_since   INT;
  v_period_index INT;
  v_terpakai     NUMERIC;
BEGIN
  SELECT * INTO v_cfg FROM outlet_budget_config WHERE outlet_budget_config.outlet_id = p_outlet_id;

  IF v_cfg.outlet_id IS NULL THEN
    RETURN QUERY SELECT 0::NUMERIC, NULL::TEXT, NULL::DATE, NULL::DATE, 0::NUMERIC, 0::NUMERIC, false;
    RETURN;
  END IF;

  IF v_cfg.period_type = 'harian' THEN
    v_start := v_today;
    v_end := v_today;
  ELSIF v_cfg.period_type = 'mingguan' THEN
    v_days_since := v_today - v_cfg.effective_from;
    v_period_index := FLOOR(v_days_since / 7.0);
    v_start := v_cfg.effective_from + (v_period_index * 7);
    v_end := v_start + 6;
  ELSE -- bulanan
    v_start := DATE_TRUNC('month', v_today)::date;
    v_end := (DATE_TRUNC('month', v_today) + INTERVAL '1 month' - INTERVAL '1 day')::date;
  END IF;

  SELECT COALESCE(SUM(pbi.qty_disetujui * COALESCE(pbi.harga_snapshot, 0)), 0)
  INTO v_terpakai
  FROM permintaan_bahan pb
  JOIN permintaan_bahan_item pbi ON pbi.permintaan_id = pb.id
  WHERE pb.outlet_id = p_outlet_id
    AND pb.status = 'disetujui'
    AND (pb.updated_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_start AND v_end;

  RETURN QUERY SELECT v_cfg.nominal, v_cfg.period_type, v_start, v_end, v_terpakai, (v_cfg.nominal - v_terpakai), true;
END;
$$;

CREATE OR REPLACE FUNCTION estimate_permintaan_value(p_items JSONB)
RETURNS TABLE (total_nilai NUMERIC, item_tanpa_harga UUID[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item    JSONB;
  v_bahan   UUID;
  v_qty     NUMERIC;
  v_harga   NUMERIC;
  v_total   NUMERIC := 0;
  v_missing UUID[] := ARRAY[]::UUID[];
BEGIN
  FOR v_item IN SELECT jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_bahan := (v_item->>'bahan_baku_id')::UUID;
    v_qty := (v_item->>'qty')::NUMERIC;
    SELECT harga_beli INTO v_harga FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan;
    IF v_harga IS NULL OR v_harga = 0 THEN
      v_missing := array_append(v_missing, v_bahan);
      v_harga := 0;
    END IF;
    v_total := v_total + (v_qty * v_harga);
  END LOOP;
  RETURN QUERY SELECT v_total, v_missing;
END;
$$;

-- approve_permintaan_svc: CREATE OR REPLACE berbasis definisi live terverifikasi
-- (2026-08-18) + tambahan v_harga/harga_snapshot. Perilaku lain PERSIS sama.
CREATE OR REPLACE FUNCTION public.approve_permintaan_svc(p_permintaan_id uuid, p_items jsonb)
 RETURNS permintaan_bahan
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_p       permintaan_bahan;
  v_item    JSONB;
  v_sj      surat_jalan;
  v_sj_items JSONB := '[]'::jsonb;
  v_bahan   UUID;
  v_qty     NUMERIC;
  v_harga   NUMERIC;
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
    v_harga := COALESCE((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan), 0);

    UPDATE permintaan_bahan_item
    SET qty_disetujui = v_qty,
        harga_snapshot = v_harga
    WHERE permintaan_id = p_permintaan_id AND bahan_baku_id = v_bahan;

    IF NOT FOUND THEN
      INSERT INTO permintaan_bahan_item (permintaan_id, bahan_baku_id, qty_diminta, qty_disetujui, harga_snapshot)
      VALUES (p_permintaan_id, v_bahan, v_qty, v_qty, v_harga);
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
$function$;

-- Batasi EXECUTE: kedua RPC baru di atas SECURITY DEFINER dan membaca
-- bahan_baku_harga (RLS admin-only). Default privilege Supabase membuat
-- fungsi public callable oleh authenticated/anon lewat PostgREST -- tanpa
-- REVOKE/GRANT ini, crew mana pun bisa panggil langsung & bypass gerbang
-- otorisasi app/actions/budget.ts (lihat CLAUDE.md "Server Action authz gap").
-- Hanya dipanggil dari service-role client (makeServiceClient()).
-- approve_permintaan_svc SENGAJA tidak disentuh -- fungsi lama yang sudah
-- callable authenticated & dipakai di tempat lain.
REVOKE EXECUTE ON FUNCTION get_outlet_budget_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION get_outlet_budget_status(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION estimate_permintaan_value(jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION estimate_permintaan_value(jsonb) TO service_role;

-- DOWN: tidak ada rollback aman untuk CREATE OR REPLACE (akan menghapus fitur
-- snapshot). Kalau perlu revert, restore definisi lama dari histori git file ini.
