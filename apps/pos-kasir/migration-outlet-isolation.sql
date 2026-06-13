-- ============================================================
-- MIGRATION: ISOLASI ORDER PER OUTLET (Row Level Security)
-- Jalankan sekali di Supabase SQL Editor.
--
-- Sebelumnya: orders & order_items bisa DIBACA siapa saja (USING true),
-- sehingga kasir cabang A bisa melihat pesanan cabang B.
-- Sesudah: admin melihat semua; kasir & kiosk HANYA outlet-nya sendiri.
--
-- Catatan: checkout (pembuatan order) memakai service role yang bypass RLS,
-- jadi alur pesan pelanggan tidak terpengaruh.
-- ============================================================

-- ---------- ORDERS: SELECT ----------
DROP POLICY IF EXISTS "orders_select_public" ON orders;
DROP POLICY IF EXISTS "orders_select_scoped" ON orders;
CREATE POLICY "orders_select_scoped" ON orders FOR SELECT USING (
  get_user_role() = 'admin'
  OR outlet_id = get_user_outlet_id()
);

-- (orders_insert_public, orders_update_kasir, orders_all_admin tetap seperti semula)

-- ---------- ORDER ITEMS: SELECT mengikuti visibilitas order induk ----------
DROP POLICY IF EXISTS "order_items_select_public" ON order_items;
DROP POLICY IF EXISTS "order_items_select_scoped" ON order_items;
CREATE POLICY "order_items_select_scoped" ON order_items FOR SELECT USING (
  get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
      AND o.outlet_id = get_user_outlet_id()
  )
);

-- ---------- ORDER ITEMS: WRITE (persempit dari "semua kasir" ke per-outlet) ----------
DROP POLICY IF EXISTS "order_items_all_admin_kasir" ON order_items;
DROP POLICY IF EXISTS "order_items_admin_all" ON order_items;
DROP POLICY IF EXISTS "order_items_kasir_scoped" ON order_items;

CREATE POLICY "order_items_admin_all" ON order_items FOR ALL USING (
  get_user_role() = 'admin'
);

CREATE POLICY "order_items_kasir_scoped" ON order_items FOR ALL USING (
  get_user_role() = 'kasir'
  AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
      AND o.outlet_id = get_user_outlet_id()
  )
);

-- (order_items_insert_public tetap; insert riil dilakukan service role saat checkout)

-- SELESAI.
