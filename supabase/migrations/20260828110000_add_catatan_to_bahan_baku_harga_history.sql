-- 20260828110000_add_catatan_to_bahan_baku_harga_history.sql
-- Menambahkan kolom catatan ke tabel bahan_baku_harga_history untuk audit log keterangan/PO saat terjadi perubahan harga master

ALTER TABLE public.bahan_baku_harga_history
ADD COLUMN IF NOT EXISTS catatan TEXT;
