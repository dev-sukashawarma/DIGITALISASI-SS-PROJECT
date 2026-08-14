-- Script untuk menambahkan tingkatan_satuan dan image_url ke variasi SKU
ALTER TABLE public.bahan_baku_sku ADD COLUMN IF NOT EXISTS tingkatan_satuan TEXT;
ALTER TABLE public.bahan_baku_sku ADD COLUMN IF NOT EXISTS image_url TEXT;
