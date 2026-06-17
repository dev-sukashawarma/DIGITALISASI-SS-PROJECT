-- Migration: Fix finalize_surat_jalan_and_ledger to support partial receipts and dynamic status updates.
-- Handles:
-- 1. Inserting terima_kiriman entry with qty_terima (if qty_terima > 0).
-- 2. Inserting rejected_kiriman entry with qty = 0 for the discrepancy (if qty_terima < qty_dikirim or kondisi is not baik).
-- 3. Setting status of surat_jalan dynamically to 'diterima_sebagian' or 'diterima_lengkap'.

CREATE OR REPLACE FUNCTION finalize_surat_jalan_and_ledger(
  p_surat_jalan_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_id UUID;
  v_status TEXT;
  v_item RECORD;
  v_any_flagged BOOLEAN := false;
  v_final_status TEXT;
BEGIN
  -- Get surat jalan outlet_id & status
  SELECT outlet_id, status INTO v_outlet_id, v_status
  FROM surat_jalan
  WHERE id = p_surat_jalan_id;

  IF v_outlet_id IS NULL THEN
    RAISE EXCEPTION 'Surat jalan not found';
  END IF;

  -- Idempotency: jika sudah diterima, return early (prevent dobel-ledger)
  IF v_status IN ('diterima_lengkap', 'diterima_sebagian') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Surat jalan sudah diverifikasi sebelumnya'
    );
  END IF;

  -- Create ledger entries for each verified item
  FOR v_item IN
    SELECT
      sji.id,
      sji.bahan_baku_id,
      sji.qty_terima,
      sji.qty_dikirim,
      sji.kondisi,
      sji.catatan
    FROM surat_jalan_item sji
    WHERE sji.surat_jalan_id = p_surat_jalan_id
      AND sji.qty_terima IS NOT NULL
  LOOP
    -- 1. Bagian yang diterima (jika ada yang diterima > 0)
    IF v_item.qty_terima > 0 THEN
      INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, ref_shipment_id, catatan, created_at)
      VALUES (v_outlet_id, v_item.bahan_baku_id, 'terima_kiriman', v_item.qty_terima,
              p_surat_jalan_id, 'Auto-entry from surat jalan verification', NOW());
    END IF;

    -- 2. Bagian yang ditolak/rusak (jika ada selisih kurang atau kondisi rusak/hilang)
    IF v_item.qty_terima < v_item.qty_dikirim OR v_item.kondisi IN ('rusak', 'hilang_qty') THEN
      DECLARE
        v_qty_tolak NUMERIC := v_item.qty_dikirim - COALESCE(v_item.qty_terima, 0);
      BEGIN
        INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, ref_shipment_id, catatan, created_at)
        VALUES (v_outlet_id, v_item.bahan_baku_id, 'rejected_kiriman', 0,
                p_surat_jalan_id,
                'Ditolak ' || v_qty_tolak::text || ' unit rusak/hilang'
                  || CASE WHEN v_item.catatan IS NOT NULL THEN ': ' || v_item.catatan ELSE '' END,
                NOW());
      END;
    END IF;
  END LOOP;

  -- Check if there are any flagged/damaged/discrepant items
  SELECT EXISTS(
    SELECT 1
    FROM surat_jalan_item
    WHERE surat_jalan_id = p_surat_jalan_id
      AND (qty_terima < qty_dikirim OR kondisi IN ('rusak', 'hilang_qty') OR flagged = true)
  ) INTO v_any_flagged;

  v_final_status := CASE WHEN v_any_flagged THEN 'diterima_sebagian' ELSE 'diterima_lengkap' END;

  -- Update surat jalan status dynamically
  UPDATE surat_jalan
  SET status = v_final_status, updated_at = NOW()
  WHERE id = p_surat_jalan_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Verifikasi selesai, status: ' || v_final_status,
    'status', v_final_status
  );
END;
$$;
