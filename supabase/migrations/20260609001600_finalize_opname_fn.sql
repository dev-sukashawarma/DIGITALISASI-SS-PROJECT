CREATE OR REPLACE FUNCTION finalize_opname(p_opname_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet UUID;
  v_status TEXT;
  v_caller UUID := auth.uid();
  r RECORD;
BEGIN
  SELECT outlet_id, status INTO v_outlet, v_status
    FROM opname WHERE id = p_opname_id FOR UPDATE;

  IF v_outlet IS NULL THEN
    RAISE EXCEPTION 'opname % not found', p_opname_id;
  END IF;
  IF v_status = 'finalized' THEN
    RAISE EXCEPTION 'opname % already finalized', p_opname_id;
  END IF;

  IF v_caller IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM outlet_staff WHERE id = v_caller AND outlet_id = v_outlet
  ) THEN
    RAISE EXCEPTION 'not authorized for this outlet';
  END IF;

  FOR r IN
    SELECT bahan_baku_id, selisih
    FROM opname_item
    WHERE opname_id = p_opname_id
      AND qty_fisik IS NOT NULL
      AND selisih <> 0
  LOOP
    INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, ref_opname_id, created_by, catatan)
    VALUES (v_outlet, r.bahan_baku_id, 'opname_selisih', r.selisih, p_opname_id, v_caller, 'Auto dari finalize opname');
  END LOOP;

  UPDATE opname SET status = 'finalized', updated_at = NOW() WHERE id = p_opname_id;
END;
$$;
