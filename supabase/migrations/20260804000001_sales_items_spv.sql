CREATE OR REPLACE VIEW public.sales_items_spv
WITH (security_barrier = true) AS
SELECT
  o.outlet_id,
  oi.menu_item_name,
  (o.created_at AT TIME ZONE 'Asia/Jakarta')::date AS sales_date,
  COALESCE(SUM(oi.quantity) FILTER (WHERE o.status = 'completed'), 0) AS total_qty,
  COALESCE(SUM(oi.subtotal) FILTER (WHERE o.status = 'completed'), 0) AS total_revenue
FROM public.orders o
JOIN public.order_items oi ON o.id = oi.order_id
GROUP BY o.outlet_id, oi.menu_item_name,
         (o.created_at AT TIME ZONE 'Asia/Jakarta')::date;

GRANT SELECT ON public.sales_items_spv TO authenticated;
