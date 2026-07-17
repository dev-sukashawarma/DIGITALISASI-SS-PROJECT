ALTER TABLE mutasi_antar_outlet
ADD COLUMN received_by UUID REFERENCES outlet_staff(id),
ADD COLUMN received_at TIMESTAMPTZ;

-- Update terima_mutasi
CREATE OR REPLACE FUNCTION terima_mutasi(
  p_mutasi_id UUID,
  p_items_diterima JSONB -- Array of { item_id, qty_diterima, kondisi_diterima, foto_bukti_terima }
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mutasi mutasi_antar_outlet%ROWTYPE;
  v_item JSONB;
  v_mutasi_item mutasi_antar_outlet_item%ROWTYPE;
BEGIN
  SELECT * INTO v_mutasi FROM mutasi_antar_outlet WHERE id = p_mutasi_id;
  IF v_mutasi.id IS NULL THEN
    RAISE EXCEPTION 'Mutasi not found';
  END IF;
  
  IF auth_outlet_id() != v_mutasi.outlet_tujuan_id AND NOT auth_is_supervisor() THEN
    RAISE EXCEPTION 'Not authorized to receive this mutasi';
  END IF;

  IF v_mutasi.status != 'dikirim' THEN
    RAISE EXCEPTION 'Invalid status for receiving';
  END IF;

  UPDATE mutasi_antar_outlet
  SET status = 'selesai', 
      received_by = auth.uid(),
      received_at = NOW(),
      updated_at = NOW()
  WHERE id = p_mutasi_id;

  -- Update items with actual received qty and create ledger entries
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_diterima)
  LOOP
    UPDATE mutasi_antar_outlet_item 
    SET 
      qty_diterima = (v_item->>'qty_diterima')::NUMERIC,
      kondisi_diterima = v_item->>'kondisi_diterima',
      foto_bukti_terima = v_item->>'foto_bukti_terima'
    WHERE id = (v_item->>'item_id')::UUID AND mutasi_id = p_mutasi_id
    RETURNING * INTO v_mutasi_item;

    -- Create Ledger Entry for Outlet B (Add stock, qty > 0)
    IF v_mutasi_item.qty_diterima > 0 THEN
      INSERT INTO ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty, catatan, created_by, ref_transfer_id
      ) VALUES (
        v_mutasi.outlet_tujuan_id, v_mutasi_item.bahan_baku_id, 'transfer_masuk',
        v_mutasi_item.qty_diterima, 'Transfer masuk dari outlet ' || v_mutasi.outlet_asal_id,
        auth.uid(), p_mutasi_id
      );
    END IF;
  END LOOP;
END;
$$;
