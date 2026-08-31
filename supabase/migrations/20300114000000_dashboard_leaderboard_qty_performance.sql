-- ============================================================
-- MIGRATION: FIX DASHBOARD 30-DAY FILTER PERFORMANCE & RPC OPTIMIZATION
-- Mengoptimalkan RPC get_owner_dashboard_summary agar sanggup
-- mengagregasi puluhan ribu pesanan (30 hari / multi-outlet) di bawah 1-2 detik
-- ============================================================

-- 1. Optimized Indexes
CREATE INDEX IF NOT EXISTS idx_orders_completed_created_at 
  ON public.orders (created_at) 
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_order_items_order_id_cover
  ON public.order_items (order_id, menu_item_id, quantity, subtotal);

CREATE INDEX IF NOT EXISTS idx_expenses_date_outlet 
  ON public.expenses (expense_date, outlet_id);

CREATE INDEX IF NOT EXISTS idx_petty_expenses_date_outlet 
  ON public.petty_cash_expenses (expense_date, outlet_id);

-- 2. Fast Aggregation RPC Function
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
  -- 1. Menu HPP lookup (computed once, very small < 200 rows)
  pkg_hpp AS MATERIALIZED (
    SELECT
      mp.package_id,
      SUM(COALESCE(comp.hpp_override, 0) * COALESCE(mp.quantity, 1)) AS total_hpp
    FROM public.menu_packages mp
    JOIN public.menu_items comp ON comp.id = mp.menu_item_id
    GROUP BY mp.package_id
  ),
  menu_hpp AS MATERIALIZED (
    SELECT
      m.id,
      COALESCE(
        CASE WHEN m.hpp_override > 0 THEN m.hpp_override
             WHEN m.is_package THEN ps.total_hpp
             ELSE 0
        END, 0
      ) AS unit_hpp
    FROM public.menu_items m
    LEFT JOIN pkg_hpp ps ON ps.package_id = m.id
  ),

  -- 2. Filtered orders
  ord AS MATERIALIZED (
    SELECT
      o.id,
      o.outlet_id,
      o.total_amount,
      o.discount_amount,
      o.promo_subsidy,
      CASE WHEN o.is_endorse THEN 'endors'
           ELSE lower(COALESCE(o.sales_source, 'pos'))
      END AS src_key,
      (o.created_at AT TIME ZONE 'Asia/Jakarta')::date AS local_date,
      EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Asia/Jakarta'))::int AS local_hour,
      ou.type AS outlet_type
    FROM public.orders o
    JOIN public.outlets ou ON ou.id = o.outlet_id
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

  -- 3. Items joined once with pre-calculated HPP
  items AS MATERIALIZED (
    SELECT
      oi.order_id,
      oi.quantity,
      oi.subtotal,
      trim(split_part(oi.menu_item_name, '|', 1)) AS menu_name,
      COALESCE(
        CASE WHEN ord.outlet_type = 'mitra'
             THEN ROUND(mh.unit_hpp * 1.1)
             ELSE mh.unit_hpp
        END, 0
      ) * COALESCE(oi.quantity, 1) AS item_cogs,
      COALESCE(oi.is_promo_reward, false) AS is_promo_reward
    FROM ord
    JOIN public.order_items oi ON oi.order_id = ord.id
    LEFT JOIN menu_hpp mh ON mh.id = oi.menu_item_id
  ),

  -- 4. Order-level subtotals for deduction & quantity
  order_totals AS (
    SELECT
      it.order_id,
      SUM(it.subtotal) AS total_subtotal,
      SUM(it.quantity) AS total_quantity
    FROM items it
    GROUP BY it.order_id
  ),

  -- 5. KPI aggregation
  kpi_agg AS (
    SELECT
      o.outlet_id,
      o.src_key AS sales_source,
      o.local_date AS sales_date,
      SUM(o.total_amount) AS omzet,
      COUNT(*) AS order_count,
      COALESCE(SUM(ot.total_quantity), 0) AS total_qty,
      SUM(
        CASE
          WHEN (COALESCE(o.discount_amount, 0) + COALESCE(o.promo_subsidy, 0)) > 0
            THEN COALESCE(o.discount_amount, 0) + COALESCE(o.promo_subsidy, 0)
          ELSE GREATEST(0, COALESCE(ot.total_subtotal, 0) - COALESCE(o.total_amount, 0))
        END
      ) AS total_deductions
    FROM ord o
    LEFT JOIN order_totals ot ON ot.order_id = o.id
    GROUP BY o.outlet_id, o.src_key, o.local_date
  ),

  -- 6. Hourly aggregation
  hourly_agg AS (
    SELECT
      o.local_hour AS sales_hour,
      SUM(o.total_amount) AS omzet,
      COUNT(*) AS order_count
    FROM ord o
    GROUP BY o.local_hour
  ),

  -- 7. Menu aggregation
  menu_agg AS (
    SELECT
      it.menu_name,
      SUM(it.quantity) AS qty,
      SUM(it.subtotal) AS revenue
    FROM items it
    WHERE it.menu_name IS NOT NULL AND it.menu_name <> ''
    GROUP BY it.menu_name
  ),

  -- 8. Totals (COGS & BOGO)
  totals_agg AS (
    SELECT
      COALESCE(SUM(it.item_cogs), 0) AS total_cogs,
      COUNT(DISTINCT CASE WHEN it.is_promo_reward THEN it.order_id END) AS bogo_transactions,
      COALESCE(SUM(CASE WHEN it.is_promo_reward THEN it.quantity ELSE 0 END), 0) AS bogo_gift_units
    FROM items it
  ),

  -- 9. OPEX aggregation
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
    'kpi_rows',          COALESCE((SELECT jsonb_agg(row_to_json(k)) FROM kpi_agg k), '[]'::jsonb),
    'hourly_rows',       COALESCE((SELECT jsonb_agg(row_to_json(h) ORDER BY h.sales_hour) FROM hourly_agg h), '[]'::jsonb),
    'menu_rows',         COALESCE((SELECT jsonb_agg(row_to_json(m) ORDER BY m.revenue DESC) FROM menu_agg m), '[]'::jsonb),
    'total_cogs',        (SELECT total_cogs FROM totals_agg),
    'total_opex',        (SELECT total_opex FROM opex_agg),
    'bogo_transactions', (SELECT bogo_transactions FROM totals_agg),
    'bogo_gift_units',   (SELECT bogo_gift_units FROM totals_agg)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_summary TO service_role;
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_summary TO anon;
