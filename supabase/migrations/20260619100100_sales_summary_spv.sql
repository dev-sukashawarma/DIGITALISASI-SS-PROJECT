-- Agregat omzet per outlet × sumber × tanggal (Asia/Jakarta).
-- Definer + security_barrier: owner lihat semua outlet, bypass RLS (pola monitoring_view_spv).
CREATE OR REPLACE VIEW public.sales_summary_spv
WITH (security_barrier = true) AS
SELECT
  o.outlet_id,
  ou.name                                              AS outlet_name,
  o.sales_source,
  (o.created_at AT TIME ZONE 'Asia/Jakarta')::date     AS sales_date,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'completed'), 0) AS omzet,
  COUNT(*) FILTER (WHERE o.status = 'completed')        AS jumlah_order_completed,
  COUNT(*)                                              AS jumlah_order_all
FROM public.orders o
JOIN public.outlets ou ON ou.id = o.outlet_id
GROUP BY o.outlet_id, ou.name, o.sales_source,
         (o.created_at AT TIME ZONE 'Asia/Jakarta')::date;

GRANT SELECT ON public.sales_summary_spv TO authenticated;
