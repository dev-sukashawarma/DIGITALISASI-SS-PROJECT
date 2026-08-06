-- Migration to filter out test orders and outlets from sales_daily_spv and sales_items_spv
-- V2: This applies the regex to order_items.menu_item_name and orders.notes as well, since testing is often done there.

-- 1. Recreate sales_daily_spv
CREATE OR REPLACE VIEW public.sales_daily_spv
WITH (security_barrier = true) AS
SELECT
  o.outlet_id,
  o.sales_source,
  (o.created_at AT TIME ZONE 'Asia/Jakarta')::date              AS sales_date,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'completed'), 0) AS omzet,
  COUNT(*) FILTER (WHERE o.status = 'completed')                AS jumlah_order_completed
FROM public.orders o
WHERE 
  -- Exclude test customers using word boundaries
  (o.customer_name IS NULL OR o.customer_name !~* '\y(test|tes|tesss|testing)\y')
  -- Exclude test notes
  AND (o.notes IS NULL OR o.notes !~* '\y(test|tes|tesss|testing)\y')
  -- Exclude test outlets
  AND o.outlet_id NOT IN (
    SELECT id FROM public.outlets WHERE name ILIKE '%test%' OR name ILIKE '%tes %'
  )
  -- Exclude orders that have ANY test items
  AND NOT EXISTS (
    SELECT 1 FROM public.order_items oi 
    WHERE oi.order_id = o.id 
    AND oi.menu_item_name ~* '\y(test|tes|tesss|testing)\y'
  )
GROUP BY o.outlet_id, o.sales_source,
         (o.created_at AT TIME ZONE 'Asia/Jakarta')::date;

GRANT SELECT ON public.sales_daily_spv TO authenticated;


-- 2. Recreate sales_items_spv
CREATE OR REPLACE VIEW public.sales_items_spv
WITH (security_barrier = true) AS
SELECT
  o.outlet_id,
  o.sales_source,
  oi.menu_item_name,
  (o.created_at AT TIME ZONE 'Asia/Jakarta')::date AS sales_date,
  COALESCE(SUM(oi.quantity) FILTER (WHERE o.status = 'completed'), 0) AS total_qty,
  COALESCE(SUM(oi.subtotal) FILTER (WHERE o.status = 'completed'), 0) AS total_revenue
FROM public.orders o
JOIN public.order_items oi ON o.id = oi.order_id
WHERE 
  -- Exclude test customers using word boundaries
  (o.customer_name IS NULL OR o.customer_name !~* '\y(test|tes|tesss|testing)\y')
  -- Exclude test notes
  AND (o.notes IS NULL OR o.notes !~* '\y(test|tes|tesss|testing)\y')
  -- Exclude test items directly
  AND (oi.menu_item_name IS NULL OR oi.menu_item_name !~* '\y(test|tes|tesss|testing)\y')
  -- Exclude test outlets
  AND o.outlet_id NOT IN (
    SELECT id FROM public.outlets WHERE name ILIKE '%test%' OR name ILIKE '%tes %'
  )
GROUP BY o.outlet_id, o.sales_source, oi.menu_item_name,
         (o.created_at AT TIME ZONE 'Asia/Jakarta')::date;

GRANT SELECT ON public.sales_items_spv TO authenticated;
