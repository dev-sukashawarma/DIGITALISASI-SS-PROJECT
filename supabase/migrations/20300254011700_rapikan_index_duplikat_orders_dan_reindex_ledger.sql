-- ============================================================================
-- Migrasi 20300254011700:
-- 1. Hapus 6 index non-unik kembar pada public.orders & public.order_items
--    yang 100% telah dicakup oleh kembaran covering/komposit di kolom yang sama
-- 2. Rapatkan ulang (REINDEX) public.idx_ledger_outlet_bahan_created (bloat 156 MB)
-- 3. Segarkan statistik planner (ANALYZE) pada ketiga tabel
-- ============================================================================
-- CATATAN PRODUKSI:
-- `supabase db push` / `supabase db reset` membungkus berkas migrasi dalam blok
-- transaksi sehingga klausa CONCURRENTLY tidak dapat ditulis langsung di sini
-- (lihat 20300104000001_index_orders_fk_referencers.sql). Pada database produksi
-- yang sedang aktif, jalankan masing-masing statement secara terpisah memakai
-- `DROP INDEX CONCURRENTLY IF EXISTS ...` dan `REINDEX INDEX CONCURRENTLY ...`.
--
-- RESEP ROLLBACK INSTAN (tanpa kehilangan data, dapat dijalankan kapan saja):
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_outlet_status_created
--     ON public.orders USING btree (outlet_id, status, created_at DESC);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_created
--     ON public.orders USING btree (status, created_at DESC);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_outlet_created
--     ON public.orders USING btree (outlet_id, created_at DESC);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_completed_composite
--     ON public.orders USING btree (outlet_id, created_at DESC) WHERE (status = 'completed'::text);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_menu
--     ON public.order_items USING btree (order_id, menu_item_id);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_menu_qty
--     ON public.order_items USING btree (order_id, menu_item_id, quantity);
-- ============================================================================

-- 1. public.orders: hapus 4 index non-unik yang sudah diwakili kembaran identik/covering
DROP INDEX IF EXISTS public.idx_orders_outlet_status_created;
DROP INDEX IF EXISTS public.idx_orders_status_created;
DROP INDEX IF EXISTS public.idx_orders_outlet_created;
DROP INDEX IF EXISTS public.idx_orders_completed_composite;

-- 2. public.order_items: hapus 2 index non-unik prefiks ketat dari idx_order_items_order_id_cover
DROP INDEX IF EXISTS public.idx_order_items_order_menu;
DROP INDEX IF EXISTS public.idx_order_items_order_menu_qty;

-- 3. public.ledger_stok: rapatkan ulang index rincian bahan Monitoring (tetap dipertahankan)
REINDEX INDEX public.idx_ledger_outlet_bahan_created;

-- 4. Segarkan statistik planner
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.ledger_stok;
