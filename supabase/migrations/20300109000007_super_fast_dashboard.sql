CREATE OR REPLACE FUNCTION public.get_owner_dashboard_summary(
  p_from           TIMESTAMPTZ,
  p_to             TIMESTAMPTZ,
  p_outlet_id      UUID    DEFAULT NULL,
  p_source         TEXT    DEFAULT 'all',
  p_test_outlet_id UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH

  -- 1. Filter orders dalam rentang waktu (MATERIALIZED untuk hindari multi-scan)
  filtered_orders AS MATERIALIZED (
    SELECT
      o.id,
      o.outlet_id,
      o.total_amount,
      o.discount_amount,
      o.promo_subsidy,
      o.sales_source,
      o.is_endorse,
      CASE WHEN o.is_endorse THEN 'endors'
           ELSE lower(COALESCE(o.sales_source, 'pos'))
      END AS src_key,
      (o.created_at AT TIME ZONE 'Asia/Jakarta')::date AS local_date,
      EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Asia/Jakarta'))::int AS local_hour
    FROM public.orders o
    WHERE o.status = 'completed'
      AND o.created_at >= p_from
      AND o.created_at <= p_to
      AND (p_test_outlet_id IS NULL OR o.outlet_id <> p_test_outlet_id)
      AND (p_outlet_id IS NULL OR o.outlet_id = p_outlet_id)
      AND (
        p_source = 'all'
        OR CASE WHEN o.is_endorse THEN 'endors'
                ELSE lower(COALESCE(o.sales_source, 'pos'))
           END = p_source
      )
  ),

  -- 2. Pre-aggregate order items subtotal to avoid correlated subquery
  order_item_totals AS MATERIALIZED (
    SELECT oi.order_id, SUM(oi.subtotal) AS total_subtotal
    FROM public.order_items oi
    JOIN filtered_orders fo ON fo.id = oi.order_id
    GROUP BY oi.order_id
  ),

  -- 3. Deduction per order
  order_deductions AS (
    SELECT
      fo.id AS order_id,
      CASE
        WHEN (COALESCE(fo.discount_amount, 0) + COALESCE(fo.promo_subsidy, 0)) > 0
          THEN COALESCE(fo.discount_amount, 0) + COALESCE(fo.promo_subsidy, 0)
        ELSE GREATEST(0, COALESCE(oit.total_subtotal, 0) - COALESCE(fo.total_amount, 0))
      END AS deduction
    FROM filtered_orders fo
    LEFT JOIN order_item_totals oit ON oit.order_id = fo.id
  ),

  -- 4. KPI per outlet x sumber x tanggal
  kpi_agg AS (
    SELECT
      fo.outlet_id,
      fo.src_key        AS sales_source,
      fo.local_date     AS sales_date,
      SUM(fo.total_amount)  AS omzet,
      COUNT(*)              AS order_count,
      SUM(od.deduction)     AS total_deductions
    FROM filtered_orders fo
    JOIN order_deductions od ON od.order_id = fo.id
    GROUP BY fo.outlet_id, fo.src_key, fo.local_date
  ),

  -- 5. Hourly per jam (0-23)
  hourly_agg AS (
    SELECT
      fo.local_hour AS sales_hour,
      SUM(fo.total_amount) AS omzet,
      COUNT(*)             AS order_count
    FROM filtered_orders fo
    GROUP BY fo.local_hour
  ),

  -- 6. Pre-compute package HPP to avoid correlated subqueries
  package_hpp AS MATERIALIZED (
    SELECT
      mp.package_id,
      SUM(COALESCE(comp.hpp_override, 0) * COALESCE(mp.quantity, 1)) AS total_hpp
    FROM public.menu_packages mp
    JOIN public.menu_items comp ON comp.id = mp.menu_item_id
    GROUP BY mp.package_id
  ),

  -- 7. COGS (HPP)
  cogs_agg AS (
    SELECT COALESCE(SUM(
      COALESCE(oi.quantity, 1) *
      CASE
        WHEN COALESCE(mi.hpp_override, 0) > 0 THEN
          CASE WHEN ou.type = 'mitra'
               THEN ROUND(mi.hpp_override * 1.1)
               ELSE mi.hpp_override
          END
        WHEN mi.is_package THEN
          CASE WHEN ou.type = 'mitra'
               THEN ROUND(COALESCE(ph.total_hpp, 0) * 1.1)
               ELSE COALESCE(ph.total_hpp, 0)
          END
        ELSE 0
      END
    ), 0) AS total_cogs
    FROM filtered_orders fo
    JOIN public.order_items oi ON oi.order_id = fo.id
    LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
    LEFT JOIN package_hpp ph ON ph.package_id = mi.id
    JOIN public.outlets ou ON ou.id = fo.outlet_id
  ),

  -- 8. Menu sales
  menu_agg AS (
    SELECT
      trim(split_part(oi.menu_item_name, '|', 1)) AS menu_name,
      SUM(oi.quantity)  AS qty,
      SUM(oi.subtotal)  AS revenue
    FROM filtered_orders fo
    JOIN public.order_items oi ON oi.order_id = fo.id
    WHERE oi.menu_item_name IS NOT NULL
      AND trim(oi.menu_item_name) <> ''
    GROUP BY trim(split_part(oi.menu_item_name, '|', 1))
  ),

  -- 9. OPEX
  opex_agg AS (
    SELECT
      COALESCE((
        SELECT SUM(e.amount)
        FROM public.expenses e
        WHERE e.expense_date >= (p_from AT TIME ZONE 'Asia/Jakarta')::date
          AND e.expense_date <= (p_to   AT TIME ZONE 'Asia/Jakarta')::date
          AND (p_test_outlet_id IS NULL OR e.outlet_id <> p_test_outlet_id)
          AND (p_outlet_id IS NULL OR e.outlet_id = p_outlet_id)
      ), 0) +
      COALESCE((
        SELECT SUM(pce.amount)
        FROM public.petty_cash_expenses pce
        WHERE pce.expense_date >= (p_from AT TIME ZONE 'Asia/Jakarta')::date
          AND pce.expense_date <= (p_to   AT TIME ZONE 'Asia/Jakarta')::date
          AND (p_test_outlet_id IS NULL OR pce.outlet_id <> p_test_outlet_id)
          AND (p_outlet_id IS NULL OR pce.outlet_id = p_outlet_id)
      ), 0) AS total_opex
  )

  SELECT jsonb_build_object(
    'kpi_rows',    COALESCE((SELECT jsonb_agg(row_to_json(k)) FROM kpi_agg k), '[]'::jsonb),
    'hourly_rows', COALESCE((SELECT jsonb_agg(row_to_json(h) ORDER BY h.sales_hour) FROM hourly_agg h), '[]'::jsonb),
    'menu_rows',   COALESCE((SELECT jsonb_agg(row_to_json(m) ORDER BY m.revenue DESC) FROM menu_agg m), '[]'::jsonb),
    'total_cogs',  (SELECT total_cogs FROM cogs_agg),
    'total_opex',  (SELECT total_opex FROM opex_agg)
  ) INTO v_result;

  RETURN v_result;
END;
$$;



