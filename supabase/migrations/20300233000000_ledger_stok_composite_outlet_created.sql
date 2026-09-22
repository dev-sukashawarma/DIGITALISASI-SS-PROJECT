-- ====================================================================
-- MIGRATION: Composite Index ledger_stok (outlet_id, created_at DESC)
-- Tujuan:
-- 1. Mengoptimalkan kueri pagination & Pull-to-Refresh untuk ledger stok
-- 2. Menghindari full table scan / sorting 858k+ baris pada view ledger_transaksi_ringkas
-- 3. Memastikan filter per-outlet dengan pengurutan waktu terbaru langsung
--    menggunakan index scan efisien (< 5ms)
-- ====================================================================

-- Composite index: outlet_id untuk scoping + created_at DESC untuk pagination
CREATE INDEX IF NOT EXISTS idx_ledger_stok_outlet_created_at
  ON public.ledger_stok (outlet_id, created_at DESC);

-- Verifikasi index
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'ledger_stok' AND indexname = 'idx_ledger_stok_outlet_created_at';
