-- ============================================================
-- Fitur: Input Order Manual dari Channel Eksternal
-- (GoFood, ShopeeFood, GrabFood, TikTok Go, dll)
--
-- Kasir membuat order manual untuk pesanan yang datang dari aplikasi
-- pihak ketiga. Order langsung masuk status 'preparing' (Diproses).
-- ============================================================

-- 1. Tambah kolom channel (nama channel eksternal, mis. 'gofood')
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS channel TEXT;

-- 2. Perluas CHECK constraint source agar menerima 'manual'
--    (sebelumnya hanya 'pos' | 'online')
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_source_check CHECK (source IN ('pos', 'online', 'manual'));

-- 3. Index untuk filter/laporan per channel
CREATE INDEX IF NOT EXISTS orders_channel_idx ON orders (channel);
