-- Qty & revenue per menu (nama ternormalisasi), dari order completed.
CREATE OR REPLACE VIEW public.menu_sales_spv
WITH (security_barrier = true) AS
SELECT
  o.outlet_id,
  o.sales_source,
  (o.created_at AT TIME ZONE 'Asia/Jakarta')::date     AS sales_date,
  lower(trim(regexp_replace(oi.menu_item_name, '\s+', ' ', 'g'))) AS menu_key,
  max(oi.menu_item_name)                               AS menu_name,
  SUM(oi.quantity)                                     AS qty,
  SUM(oi.subtotal)                                     AS revenue
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
WHERE o.status = 'completed'
GROUP BY o.outlet_id, o.sales_source,
         (o.created_at AT TIME ZONE 'Asia/Jakarta')::date,
         lower(trim(regexp_replace(oi.menu_item_name, '\s+', ' ', 'g')));

GRANT SELECT ON public.menu_sales_spv TO authenticated;
