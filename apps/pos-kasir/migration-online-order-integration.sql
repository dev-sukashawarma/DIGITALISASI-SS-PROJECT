-- ============================================================
-- Integrasi Order Online -> POS Kasir
-- Tambah kolom untuk menerima order dari order.sukashawarma.com
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_phone   TEXT,
  ADD COLUMN IF NOT EXISTS source           TEXT NOT NULL DEFAULT 'pos' CHECK (source IN ('pos', 'online')),
  ADD COLUMN IF NOT EXISTS external_order_id TEXT;

-- external_order_id wajib unik kalau ada (idempotency saat order-system push ulang)
CREATE UNIQUE INDEX IF NOT EXISTS orders_external_order_id_key
  ON orders (external_order_id)
  WHERE external_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_source_idx ON orders (source);
