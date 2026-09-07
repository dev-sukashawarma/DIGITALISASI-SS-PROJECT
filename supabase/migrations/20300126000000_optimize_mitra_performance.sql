-- 20300126000000_optimize_mitra_performance.sql
-- Optimasi query performa tinggi untuk ekosistem Kemitraan (Mitra P&L & BEP Tracker)

-- 1. Index covering untuk expenses agar mendukung filter 'expense' dan 'out' secara instan
CREATE INDEX IF NOT EXISTS idx_expenses_outlet_type_date 
ON public.expenses (outlet_id, type, expense_date DESC);

-- 2. Index covering untuk order_items agar join HPP tidak perlu heap scan
CREATE INDEX IF NOT EXISTS idx_order_items_order_menu_qty
ON public.order_items (order_id, menu_item_id, quantity);

-- 3. Optimasi get_mitra_orders_summary:
-- Mengubah correlated scalar subquery per-order menjadi set-based Hash Join (order_cogs_agg)
-- Mencegah eksekusi subquery berulang hingga puluhan ribu kali.
CREATE OR REPLACE FUNCTION public.get_mitra_orders_summary(
    p_outlet_ids uuid[],
    p_from timestamptz,
    p_to timestamptz
) RETURNS SETOF mitra_orders_summary_row AS $$
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
            lower(COALESCE(o.sales_source, o.channel, 'pos'))  AS src
        FROM public.orders o
        WHERE o.status = 'completed'
          AND o.outlet_id = ANY(p_outlet_ids)
          AND o.outlet_id != '00000000-0000-0000-0000-000000000000'
          AND o.created_at >= p_from
          AND o.created_at <= p_to
    ),
    order_cogs_agg AS (
        SELECT
            oi.order_id,
            COALESCE(SUM(oi.quantity * public.get_mitra_item_hpp(oi.menu_item_id, of.channel)), 0) AS order_cogs
        FROM public.order_items oi
        JOIN orders_filtered of ON oi.order_id = of.order_id
        GROUP BY oi.order_id
    ),
    calculated AS (
        SELECT
            of.outlet_id,
            of.total_amount,
            of.channel,
            of.src,
            COALESCE(oca.order_cogs, 0)                         AS order_cogs,
            of.discount_amount + of.promo_subsidy               AS deductions,
            of.total_amount + of.discount_amount + of.promo_subsidy AS gross_rev,
            CASE
                WHEN of.src LIKE '%tiktok%' OR of.channel LIKE '%tiktok%'
                     OR of.channel = 'c9b01c9f-0e5b-462f-bba8-9a9b6525c5c8'
                     OR of.channel = 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5' THEN 'tiktok'
                WHEN of.src LIKE '%grab%' OR of.src LIKE '%gofood%' OR of.src LIKE '%go_food%'
                     OR of.src LIKE '%gojek%' OR of.src LIKE '%shopee%'
                     OR of.src IN ('food_delivery', 'food_apps', 'foodapps')
                     OR of.channel LIKE '%grab%' OR of.channel LIKE '%gofood%'
                     OR of.channel LIKE '%go_food%' OR of.channel LIKE '%gojek%'
                     OR of.channel LIKE '%shopee%'
                     OR of.channel IN ('food_delivery', 'food_apps', 'foodapps')
                     OR of.channel IN ('1284ac2a-e753-4380-9f32-59219a322459',
                                    '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a',
                                    '0eaf2746-da9f-492c-a9b4-f091307c98c2') THEN 'foodApps'
                ELSE 'pos'
            END AS channel_group,
            CASE WHEN (of.src LIKE '%grab%' OR of.channel LIKE '%grab%'
                       OR of.channel = '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a')
                      AND of.src NOT LIKE '%tiktok%' AND of.channel NOT LIKE '%tiktok%'
                 THEN of.total_amount ELSE 0 END AS grab_rev_val,
            CASE WHEN (of.src LIKE '%gofood%' OR of.src LIKE '%go_food%' OR of.src LIKE '%gojek%'
                       OR of.channel LIKE '%gofood%' OR of.channel LIKE '%go_food%'
                       OR of.channel LIKE '%gojek%'
                       OR of.channel = '1284ac2a-e753-4380-9f32-59219a322459')
                      AND of.src NOT LIKE '%tiktok%' AND of.channel NOT LIKE '%tiktok%'
                 THEN of.total_amount ELSE 0 END AS gofood_rev_val,
            CASE WHEN (of.src LIKE '%shopee%' OR of.channel LIKE '%shopee%'
                       OR of.channel = '0eaf2746-da9f-492c-a9b4-f091307c98c2')
                      AND of.src NOT LIKE '%tiktok%' AND of.channel NOT LIKE '%tiktok%'
                 THEN of.total_amount ELSE 0 END AS shopee_rev_val
        FROM orders_filtered of
        LEFT JOIN order_cogs_agg oca ON of.order_id = oca.order_id
    )
    SELECT
        c.outlet_id,
        c.channel_group,
        SUM(c.gross_rev)        AS gross_revenue,
        SUM(c.deductions)       AS deductions,
        SUM(c.order_cogs)       AS cogs,
        COUNT(*)::integer       AS order_count,
        SUM(c.grab_rev_val)     AS grab_rev,
        SUM(c.gofood_rev_val)   AS gofood_rev,
        SUM(c.shopee_rev_val)   AS shopee_rev
    FROM calculated c
    GROUP BY c.outlet_id, c.channel_group;
END;
$$ LANGUAGE plpgsql;
