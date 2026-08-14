-- Skrip untuk menghapus batasan validasi kaku pada kolom satuan
-- Jalankan ini di SQL Editor Supabase Anda

ALTER TABLE public.bahan_baku DROP CONSTRAINT IF EXISTS bahan_baku_satuan_check;
