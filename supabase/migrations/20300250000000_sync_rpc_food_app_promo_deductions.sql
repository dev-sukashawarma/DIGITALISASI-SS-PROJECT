-- 20300250000000_sync_rpc_food_app_promo_deductions.sql
--
-- Sinkronisasi potongan/diskon merchant Food Apps (ShopeeFood, GrabFood, GoFood, TikTok Go)
-- pada RPC `get_owner_dashboard_summary` (Ringkasan Bisnis) dan `get_mitra_orders_summary` (Kemitraan).

-- ----------------------------------------------------------------------------
-- 1. get_owner_dashboard_summary
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_owner_dashboard_summary(
    p_from timestamp with time zone,
    p_to timestamp with time zone,
    p_outlet_id uuid DEFAULT NULL::uuid,
    p_source text DEFAULT 'all'::text,
    p_test_outlet_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result jsonb;
  v_has_full_access boolean;
  v_mitra_outlet_ids uuid[];
BEGIN
  -- 1. Snapshot access & role status ONCE at start
  v_has_full_access := (
    coalesce(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'OWNER'
    OR coalesce(current_setting('request.jwt.claims', true)::jsonb->'user_metadata'->>'role', '') = 'OWNER'
  );

  SELECT array_agg(id) INTO v_mitra_outlet_ids
  FROM public.outlets
  WHERE type = 'mitra';

  -- 2. Single-pass CTE pipeline
  WITH ord AS (
    SELECT
      o.id,
      o.outlet_id,
      o.total_amount,
      o.discount_amount,
      o.promo_subsidy,
      CASE
        WHEN o.is_endorse THEN 'endors'
        WHEN o.channel IS NULL OR o.channel = '' THEN lower(COALESCE(o.sales_source, 'pos'))
        WHEN o.channel = 'endorse' OR o.channel = 'endors' THEN 'endors'
        WHEN o.channel = 'shopeefood' THEN 'shopeefood'
        WHEN o.channel = 'tiktokgo' THEN 'tiktok'
        WHEN o.channel = 'grabfood' THEN 'grabfood'
        WHEN o.channel = 'gofood' THEN 'gofood'
        WHEN o.channel IN ('website', 'online', 'web') THEN 'online'
        ELSE public.resolve_sales_source(o.channel, o.sales_source)
      END AS src_key,
      (o.created_at AT TIME ZONE 'Asia/Jakarta')::date AS local_date,
      EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Asia/Jakarta'))::int AS local_hour,
      (o.outlet_id = ANY(v_mitra_outlet_ids)) AS is_mitra
    FROM public.orders o
    WHERE o.status = 'completed'
      AND o.created_at >= p_from
      AND o.created_at <= p_to
      AND (v_has_full_access OR o.outlet_id IN (SELECT accessible_outlet_ids()))
      AND (p_test_outlet_id IS NULL OR o.outlet_id <> p_test_outlet_id)
      AND (p_outlet_id IS NULL OR o.outlet_id = p_outlet_id)
      AND (
        p_source = 'all'
        OR CASE
             WHEN o.is_endorse THEN 'endors'
             WHEN o.channel IS NULL OR o.channel = '' THEN lower(COALESCE(o.sales_source, 'pos'))
             WHEN o.channel = 'endorse' OR o.channel = 'endors' THEN 'endors'
             WHEN o.channel = 'shopeefood' THEN 'shopeefood'
             WHEN o.channel = 'tiktokgo' THEN 'tiktok'
             WHEN o.channel = 'grabfood' THEN 'grabfood'
             WHEN o.channel = 'gofood' THEN 'gofood'
             WHEN o.channel IN ('website', 'online', 'web') THEN 'online'
             ELSE public.resolve_sales_source(o.channel, o.sales_source)
           END = p_source
      )
  ),

  -- 5a. Item terjual, dibaca SEKALI
  items_raw AS MATERIALIZED (
    SELECT
      oi.order_id,
      oi.menu_item_id,
      oi.quantity,
      oi.subtotal,
      oi.menu_item_name,
      oi.is_promo_reward,
      ord.is_mitra,
      ord.local_date
    FROM ord
    JOIN public.order_items oi ON oi.order_id = ord.id
  ),

  -- 3. HPP per (menu, tanggal) yang benar-benar terjual — dari riwayat, bukan angka hari ini
  menu_tgl AS (
    SELECT DISTINCT ir.menu_item_id, ir.local_date
    FROM items_raw ir
    WHERE ir.menu_item_id IS NOT NULL
  ),
  menu_hpp AS MATERIALIZED (
    SELECT
      mt.menu_item_id AS id,
      mt.local_date,
      COALESCE(
        CASE WHEN h.hpp_override > 0 THEN h.hpp_override
             WHEN m.is_package THEN (
               SELECT SUM(COALESCE(hc.hpp_override, 0) * COALESCE(mp.quantity, 1))
               FROM public.menu_packages mp
               JOIN public.menu_items comp ON comp.id = mp.menu_item_id
               CROSS JOIN LATERAL public.menu_hpp_pada(mp.menu_item_id, mt.local_date) hc
               WHERE mp.package_id = m.id
             )
             ELSE 0
        END, 0
      ) AS unit_hpp
    FROM menu_tgl mt
    JOIN public.menu_items m ON m.id = mt.menu_item_id
    CROSS JOIN LATERAL public.menu_hpp_pada(mt.menu_item_id, mt.local_date) h
  ),

  -- 5. Items joined once with pre-calculated HPP
  items AS (
    SELECT
      ir.order_id,
      ir.quantity,
      ir.subtotal,
      trim(split_part(ir.menu_item_name, '|', 1)) AS menu_name,
      COALESCE(
        CASE WHEN ir.is_mitra
             THEN ROUND(mh.unit_hpp * 1.1)
             ELSE mh.unit_hpp
        END, 0
      ) * COALESCE(ir.quantity, 1) AS item_cogs,
      COALESCE(ir.is_promo_reward, false) AS is_promo_reward
    FROM items_raw ir
    LEFT JOIN menu_hpp mh ON mh.id = ir.menu_item_id AND mh.local_date = ir.local_date
  ),

  -- 6. Order-level subtotals for deduction & quantity
  order_totals AS (
    SELECT
      it.order_id,
      SUM(it.subtotal) AS total_subtotal,
      SUM(it.quantity) AS total_quantity
    FROM items it
    GROUP BY it.order_id
  ),

  -- 7. KPI aggregation
  kpi_agg AS (
    SELECT
      o.outlet_id,
      o.src_key AS sales_source,
      o.local_date AS sales_date,
      SUM(
        CASE
          WHEN o.src_key IN ('shopeefood', 'grabfood', 'gofood', 'tiktok') THEN
            GREATEST(0::numeric, COALESCE(o.total_amount, 0::numeric) - (
              GREATEST(0::numeric, COALESCE(ot.total_subtotal, 0::numeric) - COALESCE(o.total_amount, 0::numeric)) + COALESCE(o.promo_subsidy, 0)::numeric
            ))
          ELSE
            COALESCE(o.total_amount, 0::numeric)
        END
      ) AS omzet,
      COUNT(*) AS order_count,
      COALESCE(SUM(ot.total_quantity), 0) AS total_qty,
      SUM(
        CASE
          WHEN o.src_key IN ('shopeefood', 'grabfood', 'gofood', 'tiktok') THEN
            GREATEST(0::numeric, COALESCE(ot.total_subtotal, 0::numeric) - COALESCE(o.total_amount, 0::numeric)) + COALESCE(o.promo_subsidy, 0)::numeric
          WHEN ot.total_subtotal IS NULL THEN
            COALESCE(o.discount_amount, 0::numeric) + COALESCE(o.promo_subsidy, 0)::numeric
          ELSE
            GREATEST(0::numeric, ot.total_subtotal - COALESCE(o.total_amount, 0::numeric))
        END
      ) AS total_deductions
    FROM ord o
    LEFT JOIN order_totals ot ON ot.order_id = o.id
    GROUP BY o.outlet_id, o.src_key, o.local_date
  ),

  -- 8. Hourly aggregation
  hourly_agg AS (
    SELECT
      o.local_hour AS sales_hour,
      SUM(o.total_amount) AS omzet,
      COUNT(*) AS order_count
    FROM ord o
    GROUP BY o.local_hour
  ),

  -- 9. Menu aggregation
  menu_agg AS (
    SELECT
      it.menu_name,
      SUM(it.quantity) AS qty,
      SUM(it.subtotal) AS revenue
    FROM items it
    WHERE it.menu_name IS NOT NULL AND it.menu_name <> ''
    GROUP BY it.menu_name
  ),

  -- 10. Totals (COGS & BOGO)
  totals_agg AS (
    SELECT
      COALESCE(SUM(it.item_cogs), 0) AS total_cogs,
      COUNT(DISTINCT CASE WHEN it.is_promo_reward THEN it.order_id END) AS bogo_transactions,
      COALESCE(SUM(CASE WHEN it.is_promo_reward THEN it.quantity ELSE 0 END), 0) AS bogo_gift_units
    FROM items it
  ),

  -- 11. OPEX aggregation — aturan sama dengan halaman Profit (useExpenses)
  opex_agg AS (
    SELECT
      COALESCE((
        SELECT SUM(e.amount)
        FROM public.expenses e
        WHERE e.expense_date >= (p_from AT TIME ZONE 'Asia/Jakarta')::date
          AND e.expense_date <= (p_to   AT TIME ZONE 'Asia/Jakarta')::date
          AND e.type = 'expense'
          AND (v_has_full_access OR e.outlet_id IN (SELECT accessible_outlet_ids()))
          AND (p_test_outlet_id IS NULL OR e.outlet_id IS DISTINCT FROM p_test_outlet_id)
          AND (p_outlet_id IS NULL OR e.outlet_id = p_outlet_id)
      ), 0) +
      COALESCE((
        SELECT SUM(pce.amount)
        FROM public.petty_cash_expenses pce
        WHERE pce.expense_date >= (p_from AT TIME ZONE 'Asia/Jakarta')::date
          AND pce.expense_date <= (p_to   AT TIME ZONE 'Asia/Jakarta')::date
          AND pce.deleted_at IS NULL
          AND (v_has_full_access OR pce.outlet_id IN (SELECT accessible_outlet_ids()))
          AND (p_test_outlet_id IS NULL OR pce.outlet_id <> p_test_outlet_id)
          AND (p_outlet_id IS NULL OR pce.outlet_id = p_outlet_id)
          AND NOT EXISTS (
            SELECT 1 FROM public.expenses r
            WHERE r.outlet_id = pce.outlet_id
              AND r.type = 'expense'
              AND date_trunc('month', r.expense_date) = date_trunc('month', pce.expense_date)
              AND r.description ~* '^\s*OPEX\s+\S+\s+\d{4}\s+-\s'
          )
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
$function$;

REVOKE EXECUTE ON FUNCTION public.get_owner_dashboard_summary FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_owner_dashboard_summary FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_summary TO service_role;


-- ----------------------------------------------------------------------------
-- 2. get_mitra_orders_summary
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_mitra_orders_summary(
    p_outlet_ids uuid[],
    p_from timestamp with time zone,
    p_to timestamp with time zone
)
RETURNS SETOF mitra_orders_summary_row
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    WITH orders_filtered AS (
        SELECT
            o.id AS order_id,
            o.outlet_id,
            COALESCE(o.total_amount, 0)     AS total_amount,
            COALESCE(o.discount_amount, 0)  AS discount_amount,
            COALESCE(o.promo_subsidy, 0)    AS promo_subsidy,
            lower(COALESCE(o.channel, 'pos'))                  AS channel,
            (o.created_at AT TIME ZONE 'Asia/Jakarta')::date   AS tgl,
            CASE
                WHEN (lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%tiktok%' OR lower(COALESCE(o.channel, 'pos')) LIKE '%tiktok%'
                     OR o.channel = 'c9b01c9f-0e5b-462f-bba8-9a9b6525c5c8'
                     OR o.channel = 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5') THEN 'tiktok'
                WHEN (lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%grab%' OR lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%gofood%' OR lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%go_food%'
                     OR lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%gojek%' OR lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%shopee%'
                     OR lower(COALESCE(o.sales_source, o.channel, 'pos')) IN ('food_delivery', 'food_apps', 'foodapps')
                     OR lower(COALESCE(o.channel, 'pos')) LIKE '%grab%' OR lower(COALESCE(o.channel, 'pos')) LIKE '%gofood%'
                     OR lower(COALESCE(o.channel, 'pos')) LIKE '%go_food%' OR lower(COALESCE(o.channel, 'pos')) LIKE '%gojek%'
                     OR lower(COALESCE(o.channel, 'pos')) LIKE '%shopee%'
                     OR lower(COALESCE(o.channel, 'pos')) IN ('food_delivery', 'food_apps', 'foodapps')
                     OR o.channel IN ('1284ac2a-e753-4380-9f32-59219a322459',
                                    '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a',
                                    '0eaf2746-da9f-492c-a9b4-f091307c98c2')) THEN 'foodApps'
                ELSE 'pos'
            END AS channel_group,
            CASE WHEN (lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%grab%' OR lower(COALESCE(o.channel, 'pos')) LIKE '%grab%'
                       OR o.channel = '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a')
                      AND lower(COALESCE(o.sales_source, o.channel, 'pos')) NOT LIKE '%tiktok%' AND lower(COALESCE(o.channel, 'pos')) NOT LIKE '%tiktok%'
                 THEN COALESCE(o.total_amount, 0) ELSE 0 END AS grab_rev_val,
            CASE WHEN (lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%gofood%' OR lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%go_food%' OR lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%gojek%'
                       OR lower(COALESCE(o.channel, 'pos')) LIKE '%gofood%' OR lower(COALESCE(o.channel, 'pos')) LIKE '%go_food%'
                       OR lower(COALESCE(o.channel, 'pos')) LIKE '%gojek%'
                       OR o.channel = '1284ac2a-e753-4380-9f32-59219a322459')
                      AND lower(COALESCE(o.sales_source, o.channel, 'pos')) NOT LIKE '%tiktok%' AND lower(COALESCE(o.channel, 'pos')) NOT LIKE '%tiktok%'
                 THEN COALESCE(o.total_amount, 0) ELSE 0 END AS gofood_rev_val,
            CASE WHEN (lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%shopee%' OR lower(COALESCE(o.channel, 'pos')) LIKE '%shopee%'
                       OR o.channel = '0eaf2746-da9f-492c-a9b4-f091307c98c2')
                      AND lower(COALESCE(o.sales_source, o.channel, 'pos')) NOT LIKE '%tiktok%' AND lower(COALESCE(o.channel, 'pos')) NOT LIKE '%tiktok%'
                 THEN COALESCE(o.total_amount, 0) ELSE 0 END AS shopee_rev_val
        FROM public.orders o
        LEFT JOIN public.mitra_investments mi ON mi.outlet_id = o.outlet_id
        WHERE o.status = 'completed'
          AND o.outlet_id = ANY(p_outlet_ids)
          AND o.outlet_id != '00000000-0000-0000-0000-000000000000'
          AND o.created_at >= GREATEST(
              p_from,
              COALESCE((mi.tanggal_mulai::text || ' 00:00:00+07')::timestamptz, p_from)
          )
          AND o.created_at <= p_to
    ),
    order_items_val AS (
        SELECT oi.order_id, SUM(oi.subtotal) AS item_value
        FROM public.order_items oi
        JOIN orders_filtered of ON oi.order_id = of.order_id
        GROUP BY oi.order_id
    ),
    rev_by_group AS (
        SELECT
            of.outlet_id,
            of.channel_group,
            COUNT(*)::integer AS order_count,
            SUM(
                CASE
                    WHEN of.channel_group = 'foodApps' OR of.channel_group = 'tiktok' THEN
                        GREATEST(COALESCE(oiv.item_value, 0), of.total_amount)
                    ELSE
                        of.total_amount + CASE
                            WHEN oiv.item_value IS NULL THEN of.discount_amount + of.promo_subsidy
                            ELSE GREATEST(0, oiv.item_value - of.total_amount)
                        END
                END
            ) AS gross_revenue,
            SUM(
                CASE
                    WHEN of.channel_group = 'foodApps' OR of.channel_group = 'tiktok' THEN
                        GREATEST(0, COALESCE(oiv.item_value, 0) - of.total_amount) + of.promo_subsidy
                    WHEN oiv.item_value IS NULL THEN of.discount_amount + of.promo_subsidy
                    ELSE GREATEST(0, oiv.item_value - of.total_amount)
                END
            ) AS deductions,
            SUM(of.grab_rev_val)   AS grab_rev,
            SUM(of.gofood_rev_val) AS gofood_rev,
            SUM(of.shopee_rev_val) AS shopee_rev
        FROM orders_filtered of
        LEFT JOIN order_items_val oiv ON of.order_id = oiv.order_id
        GROUP BY of.outlet_id, of.channel_group
    ),
    active_channels AS (
        SELECT DISTINCT channel FROM orders_filtered
    ),
    period_check AS (
        SELECT EXISTS (
            SELECT 1 FROM public.menu_hpp_riwayat
            WHERE berlaku_mulai > (p_from AT TIME ZONE 'Asia/Jakarta')::date
              AND berlaku_mulai <= (p_to AT TIME ZONE 'Asia/Jakarta')::date
        ) AS has_price_change
    ),
    item_hpp_lookup AS (
        SELECT
            m.id AS menu_item_id,
            ac.channel,
            public.get_mitra_item_hpp(m.id, ac.channel, (p_to AT TIME ZONE 'Asia/Jakarta')::date) AS hpp
        FROM public.menu_items m
        CROSS JOIN active_channels ac
    ),
    cogs_by_group AS (
        SELECT
            of.outlet_id,
            of.channel_group,
            SUM(oi.quantity * CASE
                WHEN pc.has_price_change THEN
                    COALESCE(
                        NULLIF(public.get_mitra_item_hpp(oi.menu_item_id, of.channel, of.tgl), 0),
                        public.get_mitra_item_hpp_by_name(oi.menu_item_name, of.channel, of.tgl),
                        0
                    )
                ELSE
                    COALESCE(
                        NULLIF(lk.hpp, 0),
                        public.get_mitra_item_hpp_by_name(oi.menu_item_name, of.channel, of.tgl),
                        0
                    )
            END) AS cogs
        FROM public.order_items oi
        JOIN orders_filtered of ON oi.order_id = of.order_id
        CROSS JOIN period_check pc
        LEFT JOIN item_hpp_lookup lk ON oi.menu_item_id = lk.menu_item_id AND of.channel = lk.channel
        GROUP BY of.outlet_id, of.channel_group
    )
    SELECT
        r.outlet_id,
        r.channel_group,
        r.gross_revenue,
        r.deductions,
        COALESCE(c.cogs, 0) AS cogs,
        r.order_count,
        r.grab_rev,
        r.gofood_rev,
        r.shopee_rev
    FROM rev_by_group r
    LEFT JOIN cogs_by_group c ON r.outlet_id = c.outlet_id AND r.channel_group = c.channel_group;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_mitra_orders_summary(uuid[], timestamp with time zone, timestamp with time zone) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_mitra_orders_summary(uuid[], timestamp with time zone, timestamp with time zone) FROM anon, PUBLIC;
