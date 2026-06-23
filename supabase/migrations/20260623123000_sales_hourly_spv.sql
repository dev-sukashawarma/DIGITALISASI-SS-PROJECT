-- Agregat omzet per outlet × sumber × tanggal × jam (Asia/Jakarta).
-- Aditif: VIEW BARU, tidak mengubah objek lain. Definer + security_barrier:
-- owner/admin lihat semua outlet, bypass RLS (pola sales_summary_spv).
CREATE OR REPLACE VIEW public.sales_hourly_spv
WITH (security_barrier = true) AS
SELECT
  o.outlet_id,
  o.sales_source,
  (o.created_at AT TIME ZONE 'Asia/Jakarta')::date              AS sales_date,
  EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Asia/Jakarta'))::int AS sales_hour,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'completed'), 0) AS omzet,
  COUNT(*) FILTER (WHERE o.status = 'completed')                AS jumlah_order_completed
FROM public.orders o
GROUP BY o.outlet_id, o.sales_source,
         (o.created_at AT TIME ZONE 'Asia/Jakarta')::date,
         EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Asia/Jakarta'));

GRANT SELECT ON public.sales_hourly_spv TO authenticated;
