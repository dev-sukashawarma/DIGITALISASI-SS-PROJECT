-- 20260629150000_sales_daily_aggregate.sql
-- Agregat omzet HARIAN per outlet × sumber (Asia/Jakarta) — versi tanpa dimensi
-- jam dari sales_hourly_spv. Untuk halaman yang hanya butuh ringkasan harian
-- (mis. Profit) agar rentang lebar tidak perlu mengirim baris per-jam ke browser.
-- Aditif: VIEW BARU, tidak mengubah objek lain. Angka identik dengan menjumlah
-- sales_hourly_spv (sumber & filter status='completed' sama).
CREATE OR REPLACE VIEW public.sales_daily_spv
WITH (security_barrier = true) AS
SELECT
  o.outlet_id,
  o.sales_source,
  (o.created_at AT TIME ZONE 'Asia/Jakarta')::date              AS sales_date,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'completed'), 0) AS omzet,
  COUNT(*) FILTER (WHERE o.status = 'completed')                AS jumlah_order_completed
FROM public.orders o
GROUP BY o.outlet_id, o.sales_source,
         (o.created_at AT TIME ZONE 'Asia/Jakarta')::date;

GRANT SELECT ON public.sales_daily_spv TO authenticated;

-- Scoped: filter ke outlet yang boleh diakses pemanggil (owner/admin → semua,
-- mitra → satu outlet). Pola sama dengan sales_hourly_scoped.
CREATE OR REPLACE VIEW public.sales_daily_scoped AS
  SELECT * FROM public.sales_daily_spv
  WHERE outlet_id IN (SELECT public.accessible_outlet_ids());

GRANT SELECT ON public.sales_daily_scoped TO authenticated;
