-- Add conversion columns to bahan_baku_sku
ALTER TABLE public.bahan_baku_sku ADD COLUMN IF NOT EXISTS satuan_tengah TEXT;
ALTER TABLE public.bahan_baku_sku ADD COLUMN IF NOT EXISTS faktor_tengah NUMERIC;
