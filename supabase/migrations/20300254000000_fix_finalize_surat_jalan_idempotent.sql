-- 20300254000000_fix_finalize_surat_jalan_idempotent.sql
-- Fix: Make finalize_surat_jalan_and_ledger completely idempotent and safe against:
-- 1. Multiple items with same bahan_baku_id in surat_jalan_item (group by bahan_baku_id)
-- 2. Duplicate key violation on idx_ledger_shipment_item (add ON CONFLICT DO NOTHING)
-- 3. Double-clicks / re-verifying already completed surat jalan (return success: true)

CREATE OR REPLACE FUNCTION public.finalize_surat_jalan_and_ledger(p_surat_jalan_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_outlet_id UUID;
  v_status TEXT;
  v_item RECORD;
  v_any_flagged BOOLEAN := false;
  v_final_status TEXT;
BEGIN
  SELECT outlet_id, status INTO v_outlet_id, v_status
  FROM surat_jalan
  WHERE id = p_surat_jalan_id;

  IF v_outlet_id IS NULL THEN
    RAISE EXCEPTION 'Surat jalan not found';
  END IF;

  -- Jika sudah pernah diverifikasi, kembalikan status sukses (idempotent)
  IF v_status IN ('diterima_lengkap', 'diterima_sebagian') THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Surat jalan sudah diverifikasi sebelumnya',
      'status', v_status
    );
  END IF;

  -- Agregasi per bahan_baku_id: satu SJ bisa punya >1 baris item utk bahan sama
  -- (beda vendor/batch). Unique index idx_ledger_shipment_item hanya izinkan 1 baris
  -- ledger per (shipment, bahan) utk tipe terima_kiriman.
  FOR v_item IN
    SELECT
      sji.bahan_baku_id,
      SUM(sji.qty_terima)  AS qty_terima,
      SUM(sji.qty_dikirim) AS qty_dikirim,
      bool_or(sji.kondisi IN ('rusak', 'hilang_qty')) AS ada_rusak,
      string_agg(sji.catatan, '; ') FILTER (WHERE sji.catatan IS NOT NULL) AS catatan
    FROM surat_jalan_item sji
    WHERE sji.surat_jalan_id = p_surat_jalan_id
      AND sji.qty_terima IS NOT NULL
    GROUP BY sji.bahan_baku_id
  LOOP
    IF v_item.qty_terima > 0 THEN
      INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, ref_shipment_id, catatan, created_at)
      VALUES (v_outlet_id, v_item.bahan_baku_id, 'terima_kiriman',
              to_ledger_scale(v_outlet_id, v_item.bahan_baku_id, v_item.qty_terima),
              p_surat_jalan_id, 'Auto-entry from surat jalan verification', NOW())
      ON CONFLICT (ref_shipment_id, bahan_baku_id) WHERE ref_shipment_id IS NOT NULL AND tipe = 'terima_kiriman'
      DO NOTHING;
    END IF;

    -- Bagian ditolak/rusak: qty selalu 0 (murni catatan), skala tidak relevan.
    IF v_item.qty_terima < v_item.qty_dikirim OR v_item.ada_rusak THEN
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

  SELECT EXISTS(
    SELECT 1
    FROM surat_jalan_item
    WHERE surat_jalan_id = p_surat_jalan_id
      AND (qty_terima < qty_dikirim OR kondisi IN ('rusak', 'hilang_qty') OR flagged = true)
  ) INTO v_any_flagged;

  v_final_status := CASE WHEN v_any_flagged THEN 'diterima_sebagian' ELSE 'diterima_lengkap' END;

  UPDATE surat_jalan
  SET status = v_final_status, updated_at = NOW()
  WHERE id = p_surat_jalan_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Verifikasi selesai, status: ' || v_final_status,
    'status', v_final_status
  );
END;
$function$;
