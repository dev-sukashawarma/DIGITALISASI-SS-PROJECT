-- 20261121113500_fix_order_items_rls_and_sales_daily_timeout.sql
--
-- Root cause fix for PostgreSQL statement_timeout (8s) on Laba Rugi (Mitra /
-- Internal / Global) for admin_finance and other all-outlet roles:
--
-- 1. order_items RLS regression (from 20261120133000_security_audit_rbac_hardening.sql):
--    `order_items_select_public` evaluated unwrapped `public.is_owner_or_admin()`
--    per row AND excluded non-admin all-outlet roles (`admin_finance`, `finance`,
--    `spv`, `regional_manager`, `admin_hr`, `kitchen`, `purchasing`) that already
--    have full outlet access in `accessible_outlet_ids()`. This forced a
--    correlated `EXISTS (SELECT 1 FROM orders ... IN accessible_outlet_ids())`
--    on every single `order_items` row (~28,000+ rows per page x 20+ pages),
--    causing 4.7s mean / 7.99s+ timeout in production.
--    Fix: introduce `public.has_all_outlets_access()` matching the exact all-outlet
--    role set of `accessible_outlet_ids()`, wrapped in a scalar `(SELECT ...)`
--    InitPlan so it executes once per query. Scoped roles (`mitra`, `leader`,
--    `area_manager`, `korlap`, `kepala_outlet`, `crew`) still fall through to
--    `EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id)`,
--    which enforces `orders_select_scoped` RLS without running
--    `accessible_outlet_ids()` twice.
--
-- 2. sales_daily_spv / sales_daily_scoped performance:
--    - `WITH item_totals AS (SELECT oi.order_id, sum(oi.subtotal) FROM order_items GROUP BY oi.order_id)`
--      scanned all 200,000+ historical `order_items` rows on every 10-day query.
--      Replaced with `LEFT JOIN LATERAL` using `idx_order_items_order_id_full`.
--    - `resolve_sales_source()` has `SET search_path`, preventing SQL inlining
--      (~650ms overhead per 10k orders). Inlined via `CROSS JOIN LATERAL`.
--    - Removed duplicate `accessible_outlet_ids()` filter in `sales_daily_scoped`
--      since `sales_daily_spv` already enforces the exact same scope predicate.

CREATE OR REPLACE FUNCTION public.has_all_outlets_access()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (auth.role() = 'service_role' OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role')
    OR EXISTS (
      SELECT 1
      FROM public.outlet_staff
      WHERE id = auth.uid()
        AND status = 'active'
        AND COALESCE(is_active, true)
        AND role IN (
          'admin', 'admin_hr', 'owner', 'spv', 'regional_manager',
          'kitchen', 'admin_finance', 'finance', 'purchasing', 'developer'
        )
    );
$$;

REVOKE ALL ON FUNCTION public.has_all_outlets_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_all_outlets_access() TO authenticated, service_role;

ALTER POLICY "orders_select_scoped"
  ON public.orders
  TO authenticated
  USING (
    (SELECT public.has_all_outlets_access())
    OR outlet_id IN (SELECT public.accessible_outlet_ids())
  );

ALTER POLICY "order_items_select_public"
  ON public.order_items
  TO authenticated
  USING (
    (SELECT public.has_all_outlets_access())
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
    )
  );

ALTER POLICY "order_items_insert_public"
  ON public.order_items
  TO authenticated
  WITH CHECK (
    (SELECT public.has_all_outlets_access())
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
    )
  );

CREATE OR REPLACE VIEW public.sales_daily_spv AS
WITH resolved AS (
  SELECT
    o.outlet_id,
    o.total_amount,
    o.discount_amount,
    o.promo_subsidy,
    it.total_subtotal,
    (o.created_at AT TIME ZONE 'Asia/Jakarta'::text)::date AS sales_date,
    CASE
      WHEN o.is_endorse
        OR (lower(COALESCE(o.channel, ''::text)) = ANY (ARRAY['endors'::text, 'endorse'::text]))
        OR (lower(COALESCE(o.sales_source, ''::text)) = ANY (ARRAY['endors'::text, 'endorse'::text]))
      THEN 'endors'::text
      ELSE CASE
        WHEN k.v LIKE '%tiktok%shop%'
          OR k.v = 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5'::text THEN 'tiktok_shop'::text
        WHEN k.v LIKE '%tiktok%'
          OR k.v = 'c9b01c9f-0e5b-462f-bba8-9a9b6525c5c8'::text THEN 'tiktok'::text
        WHEN k.v LIKE '%shopee%shop%'
          OR k.v = 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584'::text THEN 'shopee_shop'::text
        WHEN k.v LIKE '%shopee%'
          OR k.v = '0eaf2746-da9f-492c-a9b4-f091307c98c2'::text THEN 'shopeefood'::text
        WHEN k.v LIKE '%grab%'
          OR k.v = '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a'::text THEN 'grabfood'::text
        WHEN k.v LIKE '%gofood%' OR k.v LIKE '%go_food%' OR k.v LIKE '%gojek%'
          OR k.v = '1284ac2a-e753-4380-9f32-59219a322459'::text THEN 'gofood'::text
        WHEN k.v = ANY (ARRAY['website'::text, 'online'::text, 'web'::text]) THEN 'online'::text
        ELSE 'pos'::text
      END
    END AS sales_source
  FROM public.orders o
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN lower(btrim(COALESCE(o.channel, ''::text))) = ANY (ARRAY[''::text, 'pos'::text, 'food_apps'::text, 'foodapps'::text])
        THEN lower(btrim(COALESCE(o.sales_source, 'pos'::text)))
      ELSE lower(btrim(o.channel))
    END AS v
  ) k
  LEFT JOIN LATERAL (
    SELECT sum(oi.subtotal) AS total_subtotal
    FROM public.order_items oi
    WHERE oi.order_id = o.id
  ) it ON TRUE
  WHERE o.status = 'completed'::text
    AND o.outlet_id <> 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
    AND (
      (SELECT public.has_all_outlets_access())
      OR o.outlet_id IN (SELECT public.accessible_outlet_ids() AS accessible_outlet_ids)
    )
), order_calc AS (
  SELECT
    r.outlet_id,
    r.sales_source,
    r.sales_date,
    CASE
      WHEN r.sales_source = ANY (ARRAY['shopeefood'::text, 'grabfood'::text, 'gofood'::text, 'tiktok'::text]) THEN
        GREATEST(0::numeric, COALESCE(r.total_amount, 0::numeric) - (
          GREATEST(0::numeric, COALESCE(r.total_subtotal, 0::numeric) - COALESCE(r.total_amount, 0::numeric)) + COALESCE(r.promo_subsidy, 0)::numeric
        ))
      ELSE
        COALESCE(r.total_amount, 0::numeric)
    END AS net_omzet,
    CASE
      WHEN r.sales_source = ANY (ARRAY['shopeefood'::text, 'grabfood'::text, 'gofood'::text, 'tiktok'::text]) THEN
        GREATEST(0::numeric, COALESCE(r.total_subtotal, 0::numeric) - COALESCE(r.total_amount, 0::numeric)) + COALESCE(r.promo_subsidy, 0)::numeric
      WHEN r.total_subtotal IS NULL THEN
        COALESCE(r.discount_amount, 0::numeric) + COALESCE(r.promo_subsidy, 0)::numeric
      ELSE
        GREATEST(0::numeric, r.total_subtotal - COALESCE(r.total_amount, 0::numeric))
    END AS deduction
  FROM resolved r
)
SELECT
  outlet_id,
  sales_source,
  sales_date,
  COALESCE(sum(net_omzet), 0::numeric) AS omzet,
  COALESCE(sum(deduction), 0::numeric) AS total_deductions,
  count(*) AS jumlah_order_completed
FROM order_calc
GROUP BY outlet_id, sales_source, sales_date;

CREATE OR REPLACE VIEW public.sales_daily_scoped AS
SELECT outlet_id, sales_source, sales_date, omzet, total_deductions, jumlah_order_completed
FROM public.sales_daily_spv;

GRANT SELECT ON public.sales_daily_spv TO authenticated;
GRANT SELECT ON public.sales_daily_scoped TO authenticated;
REVOKE ALL ON public.sales_daily_spv FROM anon;
REVOKE ALL ON public.sales_daily_scoped FROM anon;
