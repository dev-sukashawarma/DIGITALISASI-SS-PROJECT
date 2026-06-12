-- 1. create_surat_jalan(outlet_id UUID, items JSONB[])
CREATE OR REPLACE FUNCTION create_surat_jalan(
  p_outlet_id UUID,
  p_items JSONB
)
RETURNS surat_jalan
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sj surat_jalan;
  v_item JSONB;
BEGIN
  -- Validate outlet exists
  IF NOT EXISTS (SELECT 1 FROM outlets WHERE id = p_outlet_id) THEN
    RAISE EXCEPTION 'outlet % not found', p_outlet_id;
  END IF;

  -- Insert master record
  INSERT INTO surat_jalan (outlet_id, created_by)
  VALUES (p_outlet_id, auth.uid())
  RETURNING * INTO v_sj;

  -- Insert items (p_items is array of {bahan_baku_id, qty_dikirim})
  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    INSERT INTO surat_jalan_item (surat_jalan_id, bahan_baku_id, qty_dikirim)
    VALUES (v_sj.id, (v_item->>'bahan_baku_id')::UUID, (v_item->>'qty_dikirim')::NUMERIC);
  END LOOP;

  RETURN v_sj;
END;
$$;

-- 2. send_surat_jalan(surat_jalan_id UUID, signatures JSONB[])
CREATE OR REPLACE FUNCTION send_surat_jalan(
  p_surat_jalan_id UUID,
  p_signatures JSONB
)
RETURNS surat_jalan
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sj surat_jalan;
BEGIN
  SELECT * INTO v_sj FROM surat_jalan WHERE id = p_surat_jalan_id FOR UPDATE;

  IF v_sj.id IS NULL THEN
    RAISE EXCEPTION 'surat_jalan % not found', p_surat_jalan_id;
  END IF;
  IF v_sj.status != 'draft' THEN
    RAISE EXCEPTION 'surat_jalan % status is %, must be draft', p_surat_jalan_id, v_sj.status;
  END IF;

  -- Validate creator is auth user
  IF v_sj.created_by != auth.uid() THEN
    RAISE EXCEPTION 'only creator can send surat_jalan';
  END IF;

  UPDATE surat_jalan
  SET status = 'dikirim', signatures = p_signatures, updated_at = NOW()
  WHERE id = p_surat_jalan_id
  RETURNING * INTO v_sj;

  RETURN v_sj;
END;
$$;

-- 3. verify_surat_jalan_item(...)
CREATE OR REPLACE FUNCTION verify_surat_jalan_item(
  p_surat_jalan_id UUID,
  p_item_id UUID,
  p_qty_terima NUMERIC,
  p_kondisi TEXT,
  p_foto_path TEXT DEFAULT NULL
)
RETURNS surat_jalan_item
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item surat_jalan_item;
  v_sj surat_jalan;
  v_flagged BOOLEAN;
  v_crew_outlet UUID;
BEGIN
  -- Load item & parent surat_jalan
  SELECT * INTO v_item FROM surat_jalan_item WHERE id = p_item_id AND surat_jalan_id = p_surat_jalan_id;
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'item % not found in surat_jalan %', p_item_id, p_surat_jalan_id;
  END IF;

  SELECT * INTO v_sj FROM surat_jalan WHERE id = p_surat_jalan_id;
  IF v_sj.status != 'dikirim' THEN
    RAISE EXCEPTION 'surat_jalan % status is %, must be dikirim', p_surat_jalan_id, v_sj.status;
  END IF;

  -- Validate crew belongs to outlet
  SELECT outlet_id INTO v_crew_outlet FROM outlet_staff WHERE id = auth.uid();
  IF v_crew_outlet != v_sj.outlet_id THEN
    RAISE EXCEPTION 'crew does not belong to this outlet';
  END IF;

  -- Calculate flagged
  v_flagged := (p_qty_terima != v_item.qty_dikirim) OR (p_kondisi != 'baik');

  -- If flagged, foto is required
  IF v_flagged AND p_foto_path IS NULL THEN
    RAISE EXCEPTION 'foto required for flagged item';
  END IF;

  -- Update item
  UPDATE surat_jalan_item
  SET
    qty_terima = p_qty_terima,
    kondisi = p_kondisi,
    flagged = v_flagged,
    foto_path = p_foto_path,
    verified_by = auth.uid(),
    verified_at = NOW()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

-- 4. finalize_surat_jalan(surat_jalan_id UUID)
CREATE OR REPLACE FUNCTION finalize_surat_jalan(
  p_surat_jalan_id UUID
)
RETURNS surat_jalan
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sj surat_jalan;
  v_outlet_id UUID;
  v_final_status TEXT;
  v_any_flagged BOOLEAN;
  r RECORD;
BEGIN
  SELECT * INTO v_sj FROM surat_jalan WHERE id = p_surat_jalan_id FOR UPDATE;

  IF v_sj.id IS NULL THEN
    RAISE EXCEPTION 'surat_jalan % not found', p_surat_jalan_id;
  END IF;
  IF v_sj.status != 'dikirim' THEN
    RAISE EXCEPTION 'surat_jalan % status is %, must be dikirim', p_surat_jalan_id, v_sj.status;
  END IF;

  -- Validate crew belongs to outlet
  IF NOT EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND outlet_id = v_sj.outlet_id) THEN
    RAISE EXCEPTION 'crew does not belong to this outlet';
  END IF;

  -- Check all items verified
  IF EXISTS (SELECT 1 FROM surat_jalan_item WHERE surat_jalan_id = p_surat_jalan_id AND qty_terima IS NULL) THEN
    RAISE EXCEPTION 'masih ada barang belum dicek';
  END IF;

  -- Determine final status
  SELECT EXISTS(SELECT 1 FROM surat_jalan_item WHERE surat_jalan_id = p_surat_jalan_id AND flagged = true)
  INTO v_any_flagged;
  v_final_status := CASE WHEN v_any_flagged THEN 'diterima_sebagian' ELSE 'diterima_lengkap' END;

  -- Update surat_jalan
  UPDATE surat_jalan
  SET status = v_final_status, updated_at = NOW()
  WHERE id = p_surat_jalan_id
  RETURNING * INTO v_sj;

  -- Create ledger entries for all verified items
  FOR r IN
    SELECT bahan_baku_id, qty_terima
    FROM surat_jalan_item
    WHERE surat_jalan_id = p_surat_jalan_id AND qty_terima IS NOT NULL
  LOOP
    INSERT INTO ledger_stok (
      outlet_id, bahan_baku_id, tipe, qty, ref_surat_jalan_id, created_by, catatan
    )
    VALUES (
      v_sj.outlet_id, r.bahan_baku_id, 'terima_kiriman', r.qty_terima, p_surat_jalan_id, auth.uid(),
      'Auto dari verifikasi kiriman'
    );
  END LOOP;

  RETURN v_sj;
END;
$$;
