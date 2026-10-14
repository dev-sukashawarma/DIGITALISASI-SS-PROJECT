-- Optimasi indeks database untuk halaman Rangkuman Penjualan (/dashboard/reports/pos)
-- 100% aditif (CREATE INDEX IF NOT EXISTS), tidak mengubah skema atau data yang ada.

-- 1. Indeks rentang tanggal semua status order untuk fetchRangeRaw & getEarliestSalesDate
--    (indeks lama idx_orders_completed_created_at hanya mencakup status = 'completed',
--    padahal laporan POS juga memuat status 'cancelled' untuk rasio pembatalan).
CREATE INDEX IF NOT EXISTS idx_orders_created_at_id_desc
  ON public.orders (created_at DESC, id DESC);

-- 2. Indeks rentang tanggal penjualan SS Online (ecommerce_sales)
--    Mencegah Sequential Scan per hari saat memuat rentang tanggal laporan.
CREATE INDEX IF NOT EXISTS idx_ecommerce_sales_order_date_id_desc
  ON public.ecommerce_sales (order_date DESC, id DESC);

-- 3. Indeks parsial shift tutup kasir berdasarkan end_time DESC
--    Mempercepat query varians laci kasir pada rentang laporan tanpa sort di memori.
CREATE INDEX IF NOT EXISTS idx_shifts_closed_end_time_desc
  ON public.shifts (end_time DESC)
  WHERE status = 'closed';

-- 4. Indeks komposit tanggal + id untuk paginasi deterministik platform_settlements
CREATE INDEX IF NOT EXISTS idx_platform_settlements_tanggal_id
  ON public.platform_settlements (tanggal ASC, id ASC);
