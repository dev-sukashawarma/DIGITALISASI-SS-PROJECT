-- 20300245000000_optimize_waste_reports_indexes.sql
-- Optimasi performa query tabel stok_waste_reports untuk dashboard Manager & Owner
-- 
-- Latar Belakang:
-- 1. Query antrean pending menyaring `status = 'PENDING'` terurut `created_at DESC`
-- 2. Query riwayat menyaring `status IN ('APPROVED', 'REJECTED')` dan range `created_at`
-- 3. Query ringkasan periode menyaring `status = 'APPROVED'` dan range `created_at`
-- 
-- Indeks sebelumnya hanya:
--   idx_waste_reports_outlet_status ON stok_waste_reports(outlet_id, status);
-- Tidak mencakup created_at sehingga PostgreSQL harus melakukan filter sequensial
-- dan in-memory sort ketika rentang data banyak.
--
-- Indeks komposit berikut menghilangkan cost Sort dan mempercepat Index Scan:

CREATE INDEX IF NOT EXISTS idx_waste_reports_status_created
  ON public.stok_waste_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_waste_reports_outlet_status_created
  ON public.stok_waste_reports (outlet_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_waste_reports_created
  ON public.stok_waste_reports (created_at DESC);
