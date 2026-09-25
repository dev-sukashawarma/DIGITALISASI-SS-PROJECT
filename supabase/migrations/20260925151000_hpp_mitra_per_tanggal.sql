-- HPP mitra membaca HPP yang berlaku pada tanggal order (menu_hpp_pada).
-- Aturan HPP TIDAK diubah: channel_hpp → hpp_override > 0 → paket rekursif (komponen tanpa kanal).
-- ⚠️ Fungsi yang sama juga didefinisikan 20300125000000 (terurut SETELAH berkas ini): replay dari nol
-- akan memulihkan versi tanpa tanggal. Produksi aman (sudah terstempel). Lihat spec §6.
BEGIN;

DROP FUNCTION public.get_mitra_item_hpp_by_name(text, text);
DROP FUNCTION public.get_mitra_item_hpp(uuid, text);
DROP FUNCTION public.get_mitra_item_hpp_base(uuid, text);

CREATE FUNCTION public.get_mitra_item_hpp_base(p_menu_item_id uuid, p_channel text, p_tanggal date DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql STABLE AS $function$
  DECLARE
      v_base_hpp numeric := 0;
      v_is_package boolean;
      v_hpp_override numeric;
      v_channel_hpp jsonb;
      v_norm_ch text := lower(p_channel);
      v_ch_val numeric;
      v_pkg RECORD;
  BEGIN
      SELECT is_package INTO v_is_package FROM public.menu_items WHERE id = p_menu_item_id;
      IF NOT FOUND THEN
          RETURN 0;
      END IF;

      -- Nilai HPP yang berlaku pada tanggal order (NULL = hari ini)
      SELECT h.hpp_override, h.channel_hpp INTO v_hpp_override, v_channel_hpp
      FROM public.menu_hpp_pada(p_menu_item_id, p_tanggal) h;

      IF v_channel_hpp IS NOT NULL AND v_norm_ch IS NOT NULL THEN
          IF v_norm_ch IN ('ss-online', 'ss_online',
                           'f3305089-b9e4-4b92-95da-14bf6e7fb6d5',
                           'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584')
             OR v_norm_ch LIKE '%tiktok%' OR v_norm_ch LIKE '%shopee%' THEN
              v_ch_val := COALESCE(
                  (v_channel_hpp->>'ss_online')::numeric,
                  (v_channel_hpp->>'tiktok_shop')::numeric,
                  (v_channel_hpp->>'shopee_shop')::numeric,
                  (v_channel_hpp->>v_norm_ch)::numeric
              );
          ELSE
              v_ch_val := (v_channel_hpp->>v_norm_ch)::numeric;
          END IF;
      END IF;

      IF v_ch_val IS NOT NULL AND v_ch_val > 0 THEN
          v_base_hpp := v_ch_val;
      ELSIF v_hpp_override IS NOT NULL AND v_hpp_override > 0 THEN
          v_base_hpp := v_hpp_override;
      ELSIF v_is_package THEN
          -- Komponen paket selalu dihitung dari hpp_override bahan dasar (NULL channel)
          -- agar identik dengan useHpp.ts di Admin Dashboard (ProfitView)
          FOR v_pkg IN (
              SELECT menu_item_id, quantity
              FROM public.menu_packages
              WHERE package_id = p_menu_item_id
          ) LOOP
              v_base_hpp := v_base_hpp
                  + public.get_mitra_item_hpp_base(v_pkg.menu_item_id, NULL, p_tanggal)
                    * COALESCE(v_pkg.quantity, 1);
          END LOOP;
      END IF;

      RETURN v_base_hpp;
  END;
$function$;

CREATE FUNCTION public.get_mitra_item_hpp(p_menu_item_id uuid, p_channel text, p_tanggal date DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql STABLE AS $function$
DECLARE
    v_base numeric;
BEGIN
    v_base := public.get_mitra_item_hpp_base(p_menu_item_id, p_channel, p_tanggal);
    IF v_base > 0 THEN
        RETURN round(v_base * 1.10);
    END IF;
    RETURN 0;
END;
$function$;

CREATE FUNCTION public.get_mitra_item_hpp_by_name(p_name text, p_channel text, p_tanggal date DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql STABLE AS $function$
DECLARE
    v_id uuid;
    v_key text;
BEGIN
    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RETURN 0;
    END IF;

    v_key := lower(btrim(split_part(p_name, '|', 1)));
    IF v_key = '' THEN
        RETURN 0;
    END IF;

    SELECT m.id INTO v_id
    FROM public.menu_items m
    WHERE lower(btrim(split_part(m.name, '|', 1))) = v_key
    ORDER BY m.id
    LIMIT 1;

    IF v_id IS NULL THEN
        RETURN 0;
    END IF;

    RETURN public.get_mitra_item_hpp(v_id, p_channel, p_tanggal);
END;
$function$;

-- Grant disamakan dengan fungsi lama (termasuk anon — celah pre-existing, di luar cakupan; lihat spec §6)
GRANT EXECUTE ON FUNCTION public.get_mitra_item_hpp_base(uuid, text, date)  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_mitra_item_hpp(uuid, text, date)       TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_mitra_item_hpp_by_name(text, text, date) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_mitra_orders_summary(p_outlet_ids uuid[], p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS SETOF mitra_orders_summary_row
 LANGUAGE plpgsql
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
            lower(COALESCE(o.sales_source, o.channel, 'pos'))  AS src,
            (o.created_at AT TIME ZONE 'Asia/Jakarta')::date   AS tgl
        FROM public.orders o
        WHERE o.status = 'completed'
          AND o.outlet_id = ANY(p_outlet_ids)
          AND o.outlet_id != '00000000-0000-0000-0000-000000000000'
          AND o.created_at >= p_from
          AND o.created_at <= p_to
    ),
    order_agg AS (
        SELECT
            oi.order_id,
            SUM(oi.subtotal) AS item_value,
            COALESCE(SUM(
                oi.quantity * COALESCE(
                    NULLIF(public.get_mitra_item_hpp(oi.menu_item_id, of.channel, of.tgl), 0),
                    public.get_mitra_item_hpp_by_name(oi.menu_item_name, of.channel, of.tgl)
                )
            ), 0) AS order_cogs
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
            COALESCE(oa.order_cogs, 0) AS order_cogs,
            -- Acuan tunggal Omzet Kotor
            CASE
                WHEN oa.item_value IS NULL
                    THEN of.discount_amount + of.promo_subsidy
                ELSE GREATEST(0, oa.item_value - of.total_amount)
            END AS deductions,
            of.total_amount + CASE
                WHEN oa.item_value IS NULL
                    THEN of.discount_amount + of.promo_subsidy
                ELSE GREATEST(0, oa.item_value - of.total_amount)
            END AS gross_rev,
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
        LEFT JOIN order_agg oa ON of.order_id = oa.order_id
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
$function$;

COMMIT;
