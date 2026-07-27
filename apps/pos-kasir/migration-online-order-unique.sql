-- Migration: Cegah Duplikasi Orderan Online (Unique Index)
-- Menjamin 1 external_order_id dari website/kiosk online hanya bisa masuk 1x ke database POS Kasir.

CREATE UNIQUE INDEX IF NOT EXISTS orders_external_order_id_unique_idx
  ON orders (external_order_id)
  WHERE external_order_id IS NOT NULL;
