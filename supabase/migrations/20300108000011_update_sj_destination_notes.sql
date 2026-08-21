-- Update catatan on inbound_outbound to display destination outlet for Surat Jalan transfers

DO $$
DECLARE
    v_gudang_id uuid := 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90';
BEGIN
    -- 1. Disable trigger
    ALTER TABLE public.inbound_outbound DISABLE TRIGGER trigger_inbound_outbound;

    -- 2. Update catatan with destination outlet name
    UPDATE public.inbound_outbound io
    SET catatan = CASE 
        WHEN sj.document_number IS NOT NULL AND sj.document_number != '' THEN 
            'Kirim ke ' || o.name || ' (' || sj.document_number || ')'
        ELSE 
            'Kirim ke ' || o.name || ' (SJ #' || UPPER(SUBSTRING(sj.id::text, 1, 8)) || ')'
    END
    FROM public.ledger_stok l
    JOIN public.surat_jalan sj ON sj.id = l.ref_shipment_id
    JOIN public.outlets o ON o.id = sj.outlet_id
    WHERE io.outlet_id = v_gudang_id
      AND l.outlet_id = v_gudang_id
      AND io.bahan_baku_id = l.bahan_baku_id
      AND io.created_at = l.created_at
      AND io.tipe = 'OUT'
      AND l.ref_shipment_id IS NOT NULL;

    -- 3. Re-enable trigger
    ALTER TABLE public.inbound_outbound ENABLE TRIGGER trigger_inbound_outbound;
END $$;
