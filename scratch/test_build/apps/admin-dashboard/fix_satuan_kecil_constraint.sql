-- Skrip untuk menghapus batasan validasi kaku pada kolom satuan_tengah dan satuan_kecil
-- Silakan *Copy* (Ctrl+C) semua teks ini, lalu *Paste* (Ctrl+V) dan jalankan di menu "SQL Editor" pada Supabase Anda (https://supabase.com/dashboard).

ALTER TABLE public.bahan_baku DROP CONSTRAINT IF EXISTS bahan_baku_satuan_tengah_check;
ALTER TABLE public.bahan_baku DROP CONSTRAINT IF EXISTS bahan_baku_satuan_kecil_check;
