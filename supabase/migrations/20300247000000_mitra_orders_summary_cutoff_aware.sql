-- Migration: get_mitra_orders_summary sadar tanggal mulai kemitraan (cutoff-aware)
-- Mencegah transaksi era internal sebelum tanggal_mulai ikut terhitung ke ringkasan kemitraan

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
            SUM(of.total_amount + CASE
                WHEN oiv.item_value IS NULL THEN of.discount_amount + of.promo_subsidy
                ELSE GREATEST(0, oiv.item_value - of.total_amount)
            END) AS gross_revenue,
            SUM(CASE
                WHEN oiv.item_value IS NULL THEN of.discount_amount + of.promo_subsidy
                ELSE GREATEST(0, oiv.item_value - of.total_amount)
            END) AS deductions,
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

GRANT EXECUTE ON FUNCTION public.get_mitra_orders_summary(uuid[], timestamp with time zone, timestamp with time zone) TO authenticated, service_role, anon;
