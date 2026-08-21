-- Migration: Sync NULL harga_satuan in inbound_outbound with latest bahan_baku_harga

-- Temporarily disable trigger to avoid modifying stok_balance
ALTER TABLE public.inbound_outbound DISABLE TRIGGER trigger_inbound_outbound;

UPDATE public.inbound_outbound io
SET harga_satuan = COALESCE(h.harga_beli_display, h.harga_beli)
FROM public.bahan_baku_harga h
WHERE h.bahan_baku_id = io.bahan_baku_id
  AND io.harga_satuan IS NULL
  AND (h.harga_beli_display IS NOT NULL OR h.harga_beli IS NOT NULL);

-- Re-enable trigger
ALTER TABLE public.inbound_outbound ENABLE TRIGGER trigger_inbound_outbound;
