-- Migrasi Skema Database: Tambah dukungan multiple images untuk Bahan Baku
-- Jalankan script ini di menu "SQL Editor" pada dashboard Supabase Anda.

ALTER TABLE public.bahan_baku
ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}'::TEXT[];
