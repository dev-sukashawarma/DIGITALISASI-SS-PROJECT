-- Performance indexes for hot query paths across apps.
-- All idempotent (IF NOT EXISTS) so they are safe to re-apply even when remote
-- migration history is diverged (see CLAUDE.md "riwayat migration").
--
-- NOTE produksi: untuk tabel yang sudah besar, jalankan tiap statement dengan
-- CREATE INDEX CONCURRENTLY di luar transaksi agar tidak mengunci tabel. Tabel
-- saat ini masih kecil sehingga CREATE INDEX biasa cukup cepat.

-- 1. ledger_stok: fetchItemDetail / fetchOutletItemsDetail memfilter
--    (outlet_id, bahan_baku_id) lalu ORDER BY created_at DESC.
--    Index lama hanya (outlet_id, created_at) ATAU (bahan_baku_id) terpisah.
CREATE INDEX IF NOT EXISTS idx_ledger_outlet_bahan_created
  ON public.ledger_stok (outlet_id, bahan_baku_id, created_at DESC);

-- 2. expenses: belum punya index apa pun selain PK. owner-dashboard memfilter
--    outlet_id + rentang expense_date.
CREATE INDEX IF NOT EXISTS idx_expenses_outlet_date
  ON public.expenses (outlet_id, expense_date);

-- 3. orders: belum punya index selain PK. Dashboard kasir/admin memfilter
--    outlet_id + status + rentang created_at.
CREATE INDEX IF NOT EXISTS idx_orders_outlet_status_created
  ON public.orders (outlet_id, status, created_at DESC);

-- 4. order_items: FK tanpa index → join lambat & cascade delete lambat.
--    order_id dipakai untuk join detail pesanan; menu_item_id dipakai
--    rekomendasi (.in('menu_item_id', ...)).
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item
  ON public.order_items (menu_item_id);
