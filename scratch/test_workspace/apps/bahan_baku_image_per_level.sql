-- Script untuk menambahkan kolom image URL per tingkatan satuan
ALTER TABLE public.bahan_baku ADD COLUMN IF NOT EXISTS image_url_tengah TEXT;
ALTER TABLE public.bahan_baku ADD COLUMN IF NOT EXISTS image_url_kecil TEXT;
