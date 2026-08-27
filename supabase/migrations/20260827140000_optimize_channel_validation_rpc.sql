-- 20260827140000_optimize_channel_validation_rpc.sql
-- Optimasi Database PostgreSQL untuk Validasi Penjualan Channel & E-Commerce
-- 1. Mengagregasi SUM(quantity) & SUM(subtotal) langsung di level PostgreSQL engine
-- 2. Menghilangkan bottleneck PostgREST embedded resource limit (1.000 baris) dan transmisi data berlebih
-- 3. Mendukung multi-channel alias resolusi & pengecekan komprehensif channel + sales_source
-- 4. Menambahkan Covering & Composite Index untuk eksekusi sub-millisecond

-- 1. Create Stored Procedure RPC untuk Aggregasi Penjualan Per Menu Per Channel & Outlet
CREATE OR REPLACE FUNCTION public.get_channel_validation_db_qty(
  p_outlet_id uuid,
  p_channel text,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  name text,
  qty bigint,
  omzet numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH channel_patterns AS (
    SELECT 
      CASE 
        WHEN lower(p_channel) IN ('tiktok_seller', 'tiktokseller', 'tiktokshop', 'tiktok_shop') 
          THEN ARRAY['tiktokseller', 'tiktok_seller', 'tiktokshop', 'tiktok_shop', 'tiktok']
        WHEN lower(p_channel) IN ('tiktok_go', 'tiktokgo') 
          THEN ARRAY['tiktokgo', 'tiktok_go', 'tiktok']
        WHEN lower(p_channel) IN ('gofood', 'go_food') 
          THEN ARRAY['gofood', 'go_food']
        WHEN lower(p_channel) IN ('grabfood', 'grab_food') 
          THEN ARRAY['grabfood', 'grab_food']
        WHEN lower(p_channel) IN ('shopeefood', 'shopee_food') 
          THEN ARRAY['shopeefood', 'shopee_food']
        ELSE 
          ARRAY[lower(p_channel)]
      END AS valid_channels
  )
  SELECT
    lower(trim(split_part(oi.menu_item_name, '|', 1))) AS name,
    COALESCE(SUM(oi.quantity), 0)::bigint AS qty,
    COALESCE(SUM(oi.subtotal), 0)::numeric AS omzet
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  CROSS JOIN channel_patterns cp
  WHERE (p_outlet_id IS NULL OR o.outlet_id = p_outlet_id)
    AND o.status IN ('completed', 'fulfilled', 'selesai', 'paid')
    AND (
      lower(COALESCE(o.channel, '')) = ANY(cp.valid_channels)
      OR lower(COALESCE(o.sales_source, '')) = ANY(cp.valid_channels)
    )
    AND o.created_at >= p_from
    AND o.created_at <= p_to
    AND oi.menu_item_name IS NOT NULL
    AND trim(oi.menu_item_name) != ''
  GROUP BY lower(trim(split_part(oi.menu_item_name, '|', 1)))
  HAVING COALESCE(SUM(oi.quantity), 0) > 0;
$$;

GRANT EXECUTE ON FUNCTION public.get_channel_validation_db_qty(uuid, text, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_channel_validation_db_qty(uuid, text, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_channel_validation_db_qty(uuid, text, timestamptz, timestamptz) TO anon;

-- 2. Covering & Composite Indexes
CREATE INDEX IF NOT EXISTS idx_orders_outlet_channel_status_created
  ON public.orders (outlet_id, channel, status, created_at)
  INCLUDE (sales_source, total_amount);

CREATE INDEX IF NOT EXISTS idx_orders_outlet_source_status_created
  ON public.orders (outlet_id, sales_source, status, created_at)
  INCLUDE (channel, total_amount);

CREATE INDEX IF NOT EXISTS idx_ecommerce_sales_order_id
  ON public.ecommerce_sales (order_id);

CREATE INDEX IF NOT EXISTS idx_ecommerce_sales_entity_channel_date
  ON public.ecommerce_sales (entity_id, channel_id, order_date);

-- 3. Update Optimizer Statistics
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.ecommerce_sales;
ANALYZE public.ecommerce_sale_items;
