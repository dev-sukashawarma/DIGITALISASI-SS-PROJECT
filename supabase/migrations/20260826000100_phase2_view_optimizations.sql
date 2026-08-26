-- ==============================================================================
-- PHASE 2: SQL VIEWS & STORED FUNCTIONS OPTIMIZATION
-- ==============================================================================

-- 1. OPTIMIZE SALES DAILY VIEWS (Eliminating 931M row correlated regex scan)
-- ------------------------------------------------------------------------------

-- Drop dependent view first to allow modifying column signature if needed
DROP VIEW IF EXISTS public.sales_daily_scoped;
DROP VIEW IF EXISTS public.sales_daily_spv;

CREATE OR REPLACE VIEW public.sales_daily_spv AS
SELECT 
  o.outlet_id,
  o.sales_source,
  ((o.created_at AT TIME ZONE 'Asia/Jakarta'::text))::date AS sales_date,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'completed'), 0)::numeric AS omzet,
  COALESCE(SUM(COALESCE(o.discount_amount, 0) + COALESCE(o.promo_subsidy, 0)) FILTER (WHERE o.status = 'completed'), 0)::numeric AS total_deductions,
  COUNT(*) FILTER (WHERE o.status = 'completed') AS jumlah_order_completed
FROM public.orders o
WHERE o.status = 'completed'
  AND o.outlet_id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
GROUP BY o.outlet_id, o.sales_source, (((o.created_at AT TIME ZONE 'Asia/Jakarta'::text))::date);

CREATE OR REPLACE VIEW public.sales_daily_scoped AS
SELECT 
  outlet_id,
  sales_source,
  sales_date,
  omzet,
  total_deductions,
  jumlah_order_completed
FROM public.sales_daily_spv
WHERE outlet_id IN (SELECT public.accessible_outlet_ids());


-- 2. OPTIMIZE SALES HOURLY VIEWS
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS public.sales_hourly_scoped;
DROP VIEW IF EXISTS public.sales_hourly_spv;

CREATE OR REPLACE VIEW public.sales_hourly_spv AS
SELECT 
  o.outlet_id,
  o.sales_source,
  ((o.created_at AT TIME ZONE 'Asia/Jakarta'::text))::date AS sales_date,
  (EXTRACT(hour FROM (o.created_at AT TIME ZONE 'Asia/Jakarta'::text)))::integer AS sales_hour,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'completed'), 0)::numeric AS omzet,
  COUNT(*) FILTER (WHERE o.status = 'completed') AS jumlah_order_completed
FROM public.orders o
WHERE o.status = 'completed'
  AND o.outlet_id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
GROUP BY o.outlet_id, o.sales_source, (((o.created_at AT TIME ZONE 'Asia/Jakarta'::text))::date), (EXTRACT(hour FROM (o.created_at AT TIME ZONE 'Asia/Jakarta'::text)));

CREATE OR REPLACE VIEW public.sales_hourly_scoped AS
SELECT 
  outlet_id,
  sales_source,
  sales_date,
  sales_hour,
  omzet,
  jumlah_order_completed
FROM public.sales_hourly_spv
WHERE outlet_id IN (SELECT public.accessible_outlet_ids());


-- 3. OPTIMIZE SALES ITEMS VIEW
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS public.sales_items_spv;

CREATE OR REPLACE VIEW public.sales_items_spv AS
SELECT 
  o.outlet_id,
  o.sales_source,
  oi.menu_item_name,
  ((o.created_at AT TIME ZONE 'Asia/Jakarta'::text))::date AS sales_date,
  COALESCE(SUM(oi.quantity) FILTER (WHERE o.status = 'completed'), 0)::bigint AS total_qty,
  COALESCE(SUM(oi.subtotal) FILTER (WHERE o.status = 'completed'), 0)::numeric AS total_revenue,
  COALESCE(o.is_endorse, false) AS is_endorse
FROM public.orders o
JOIN public.order_items oi ON o.id = oi.order_id
WHERE o.status = 'completed'
  AND o.outlet_id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
GROUP BY o.outlet_id, o.sales_source, oi.menu_item_name, o.is_endorse, (((o.created_at AT TIME ZONE 'Asia/Jakarta'::text))::date)
HAVING (COALESCE(SUM(oi.quantity) FILTER (WHERE o.status = 'completed'), 0)::bigint > 0);


-- 4. OPTIMIZE DAILY TARGET PROGRESS VIEWS (Eliminating N correlated order subqueries)
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS public.daily_target_progress_scoped;
DROP VIEW IF EXISTS public.daily_target_progress_spv;

CREATE OR REPLACE VIEW public.daily_target_progress_spv AS
WITH today_orders AS (
  SELECT 
    ord.outlet_id,
    SUM(ord.total_amount) AS omzet_today
  FROM public.orders ord
  WHERE ord.status IN ('completed', 'selesai', 'paid')
    AND ord.created_at >= (((now() AT TIME ZONE 'Asia/Jakarta')::date)::timestamp AT TIME ZONE 'Asia/Jakarta')
    AND ord.created_at < ((((now() AT TIME ZONE 'Asia/Jakarta')::date + interval '1 day')::timestamp) AT TIME ZONE 'Asia/Jakarta')
    AND ord.outlet_id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
  GROUP BY ord.outlet_id
)
SELECT 
  o.id AS outlet_id,
  o.name AS outlet_name,
  public.resolve_daily_target(o.id, ((now() AT TIME ZONE 'Asia/Jakarta')::date)) AS target_amount,
  COALESCE(t.omzet_today, 0)::numeric AS omzet_today
FROM public.outlets o
LEFT JOIN today_orders t ON t.outlet_id = o.id
WHERE o.id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid;

CREATE OR REPLACE VIEW public.daily_target_progress_scoped AS
SELECT 
  outlet_id,
  outlet_name,
  target_amount,
  omzet_today
FROM public.daily_target_progress_spv
WHERE outlet_id IN (SELECT public.accessible_outlet_ids());
