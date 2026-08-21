-- Backfill historical stock movements from ledger_stok for GUDANG PUSAT starting from 2026-07-01

DO $$
DECLARE
    v_gudang_id uuid := 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90';
BEGIN
    -- 1. Temporarily disable trigger so we do not double-mutate stok_balance / ledger_stok
    ALTER TABLE public.inbound_outbound DISABLE TRIGGER trigger_inbound_outbound;

    -- 2. Insert records from ledger_stok
    INSERT INTO public.inbound_outbound (
        outlet_id,
        bahan_baku_id,
        tipe,
        kategori,
        qty,
        harga_satuan,
        catatan,
        created_by,
        created_at
    )
    SELECT 
        l.outlet_id,
        l.bahan_baku_id,
        CASE 
            WHEN l.tipe IN ('pembelian_supplier', 'terima_kiriman') OR (l.tipe IN ('adjustment', 'opname_selisih') AND l.qty > 0) THEN 'IN'
            ELSE 'OUT'
        END AS tipe,
        CASE 
            WHEN l.tipe = 'pembelian_supplier' THEN 'Pembelian'
            WHEN l.tipe = 'terima_kiriman' THEN 'Transfer Masuk'
            WHEN l.tipe = 'transfer_keluar' THEN 'Transfer Keluar'
            WHEN l.tipe = 'waste' THEN 'Rusak/Waste'
            WHEN l.tipe = 'pemakaian' THEN 'Pemakaian'
            WHEN l.tipe = 'rejected_kiriman' THEN 'Retur/Reject'
            WHEN l.tipe = 'opname_selisih' AND l.qty > 0 THEN 'Opname (Surplus)'
            WHEN l.tipe = 'opname_selisih' AND l.qty < 0 THEN 'Opname (Selisih Kurang)'
            WHEN l.tipe = 'adjustment' AND l.qty > 0 THEN 'Adjustment (Masuk)'
            WHEN l.tipe = 'adjustment' AND l.qty < 0 THEN 'Adjustment (Keluar)'
            ELSE 'Lainnya'
        END AS kategori,
        ABS(l.qty) AS qty,
        COALESCE(h.harga_beli_display, h.harga_beli) AS harga_satuan,
        l.catatan,
        l.created_by,
        l.created_at
    FROM public.ledger_stok l
    LEFT JOIN public.bahan_baku_harga h ON h.bahan_baku_id = l.bahan_baku_id
    WHERE l.outlet_id = v_gudang_id
      AND l.created_at >= '2026-07-01 00:00:00+00'
      AND ABS(l.qty) > 0
    ORDER BY l.created_at ASC;

    -- 3. Re-enable trigger
    ALTER TABLE public.inbound_outbound ENABLE TRIGGER trigger_inbound_outbound;
END $$;
