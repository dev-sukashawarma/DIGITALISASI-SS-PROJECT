-- =============================================================================
-- Migration: Takeout komponen OPEX (10%) dari HPP Mitra mulai 2026-10-01
-- =============================================================================
-- Aturan bisnis:
--   1. Outlet Internal (`NOT is_mitra`): tetap memakai `base_hpp` (HPP + OPEX).
--   2. Periode historis `< 2026-10-01` ATAU `MITRA CILEUNGSI`
--      (`62a56103-2085-4dd5-9d25-a3c0cffc88ff`):
--      tetap memakai rumus lama `ROUND(base_hpp * 1.10)` (OPEX ikut di-markup).
--   3. Outlet Mitra selain `MITRA CILEUNGSI` mulai `2026-10-01`:
--      OPEX 10% di-takeout sehingga Mitra ditagih `ROUND(hpp_murni * 1.10)`
--      (selaras rumus Excel `O5 = SUM(B4*10%)+B4`), dan margin pasokan bahan
--      baku pusat dicatat sebesar `hpp_mitra - ROUND(hpp_murni, 2)`.
--   4. Catatan transisi 3 minuman (`Ice Tea`, `Orange Juice`, `Aqua`):
--      pada `2026-10-01` s/d `2026-11-01`, `hpp_override` ketiganya di DB
--      masih berupa HPP murni tanpa OPEX (OPEX baru masuk ke DB per
--      `2026-11-02`), sehingga pada rentang tersebut `hpp_murni = base_hpp`
--      dan `hpp_mitra = ROUND(base_hpp * 1.10)`. Mulai `2026-11-02`, seluruh
--      menu sudah memuat OPEX 10% di `base_hpp`, sehingga `hpp_murni = base_hpp / 1.10`
--      dan `hpp_mitra = ROUND(base_hpp)`.
-- =============================================================================

BEGIN;

-- 1. Helper internal: nilai mentah HPP Mitra (belum dibulatkan) untuk tanggal >= 2026-10-01
--    (proconfig = NULL dipertahankan agar perencana query tetap ringan)
CREATE OR REPLACE FUNCTION public._get_mitra_item_hpp_raw(
  p_menu_item_id uuid,
  p_channel text,
  p_tanggal date DEFAULT NULL::date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_tgl date := COALESCE(p_tanggal, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_raw numeric := 0;
  v_is_package boolean;
  v_hpp_override numeric;
  v_channel_hpp jsonb;
  v_norm_ch text := lower(btrim(p_channel));
  v_ch_val numeric;
  v_leaf numeric := 0;
  v_pkg RECORD;
BEGIN
  SELECT is_package INTO v_is_package FROM public.menu_items WHERE id = p_menu_item_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT h.hpp_override, h.channel_hpp INTO v_hpp_override, v_channel_hpp
  FROM public.menu_hpp_pada(p_menu_item_id, v_tgl) h;

  IF v_channel_hpp IS NOT NULL AND v_norm_ch IS NOT NULL THEN
    IF v_norm_ch IN (
      'ss-online', 'ss_online', 'shopee_shop', 'tiktok_shop',
      'f3305089-b9e4-4b92-95da-14bf6e7fb6d5',
      'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584'
    ) THEN
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
    v_leaf := v_ch_val;
  ELSIF v_hpp_override IS NOT NULL AND v_hpp_override > 0 THEN
    v_leaf := v_hpp_override;
  END IF;

  IF v_leaf > 0 THEN
    IF v_tgl >= DATE '2026-10-01'
       AND v_tgl < DATE '2026-11-02'
       AND p_menu_item_id IN (
         '08a57f8f-f212-4205-a3eb-fb88066ae1b8'::uuid, -- Ice Tea
         'c543b78e-3341-44e0-b3ef-53349e71e3d3'::uuid, -- Orange Juice
         'c8427af3-0a41-48dd-9a08-6b93cd913ec6'::uuid  -- Aqua
       )
    THEN
      RETURN v_leaf * 1.10;
    END IF;
    RETURN v_leaf;
  ELSIF v_is_package THEN
    FOR v_pkg IN (
      SELECT menu_item_id, quantity
      FROM public.menu_packages
      WHERE package_id = p_menu_item_id
    ) LOOP
      v_raw := v_raw
        + public._get_mitra_item_hpp_raw(v_pkg.menu_item_id, NULL, v_tgl)
          * COALESCE(v_pkg.quantity, 1);
    END LOOP;
  END IF;

  RETURN v_raw;
END;
$function$;

-- 2. Helper internal: nilai mentah HPP Murni tanpa OPEX (belum dibulatkan)
CREATE OR REPLACE FUNCTION public._get_mitra_item_hpp_murni_raw(
  p_menu_item_id uuid,
  p_channel text,
  p_tanggal date DEFAULT NULL::date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_tgl date := COALESCE(p_tanggal, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_raw numeric := 0;
  v_is_package boolean;
  v_hpp_override numeric;
  v_channel_hpp jsonb;
  v_norm_ch text := lower(btrim(p_channel));
  v_ch_val numeric;
  v_leaf numeric := 0;
  v_pkg RECORD;
BEGIN
  SELECT is_package INTO v_is_package FROM public.menu_items WHERE id = p_menu_item_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT h.hpp_override, h.channel_hpp INTO v_hpp_override, v_channel_hpp
  FROM public.menu_hpp_pada(p_menu_item_id, v_tgl) h;

  IF v_channel_hpp IS NOT NULL AND v_norm_ch IS NOT NULL THEN
    IF v_norm_ch IN (
      'ss-online', 'ss_online', 'shopee_shop', 'tiktok_shop',
      'f3305089-b9e4-4b92-95da-14bf6e7fb6d5',
      'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584'
    ) THEN
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
    v_leaf := v_ch_val;
  ELSIF v_hpp_override IS NOT NULL AND v_hpp_override > 0 THEN
    v_leaf := v_hpp_override;
  END IF;

  IF v_leaf > 0 THEN
    IF v_tgl >= DATE '2026-10-01'
       AND v_tgl < DATE '2026-11-02'
       AND p_menu_item_id IN (
         '08a57f8f-f212-4205-a3eb-fb88066ae1b8'::uuid, -- Ice Tea
         'c543b78e-3341-44e0-b3ef-53349e71e3d3'::uuid, -- Orange Juice
         'c8427af3-0a41-48dd-9a08-6b93cd913ec6'::uuid  -- Aqua
       )
    THEN
      RETURN v_leaf;
    END IF;
    RETURN v_leaf / 1.10;
  ELSIF v_is_package THEN
    FOR v_pkg IN (
      SELECT menu_item_id, quantity
      FROM public.menu_packages
      WHERE package_id = p_menu_item_id
    ) LOOP
      v_raw := v_raw
        + public._get_mitra_item_hpp_murni_raw(v_pkg.menu_item_id, NULL, v_tgl)
          * COALESCE(v_pkg.quantity, 1);
    END LOOP;
  END IF;

  RETURN v_raw;
END;
$function$;

-- 3. HPP Murni (modal bahan pusat untuk pasokan mitra) per ID & per Nama
CREATE OR REPLACE FUNCTION public.get_mitra_item_hpp_murni(
  p_menu_item_id uuid,
  p_channel text,
  p_tanggal date DEFAULT NULL::date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_tgl date := COALESCE(p_tanggal, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_raw numeric;
BEGIN
  IF v_tgl < DATE '2026-10-01' THEN
    RETURN public.get_mitra_item_hpp_base(p_menu_item_id, p_channel, v_tgl);
  END IF;

  v_raw := public._get_mitra_item_hpp_murni_raw(p_menu_item_id, p_channel, v_tgl);
  IF v_raw > 0 THEN
    RETURN round(v_raw, 2);
  END IF;
  RETURN 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_mitra_item_hpp_murni_by_name(
  p_name text,
  p_channel text,
  p_tanggal date DEFAULT NULL::date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_id uuid;
  v_key text;
  v_clean text;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RETURN 0;
  END IF;

  v_key := lower(btrim(split_part(p_name, '|', 1)));
  IF v_key = '' THEN
    RETURN 0;
  END IF;

  v_clean := regexp_replace(v_key, '^(suka\s+shawarma|suka)\s+', '', 'i');
  v_clean := regexp_replace(v_clean, '\s*\((1x|2x|3x|4x)\)\s*$', '', 'i');
  v_clean := regexp_replace(v_clean, '\s*-\s*(large|barbar)\s*$', '', 'i');
  v_clean := regexp_replace(v_clean, '\s+shawarma\s*$', '', 'i');
  v_clean := btrim(v_clean);

  SELECT m.id INTO v_id
  FROM public.menu_items m
  LEFT JOIN public.categories c ON c.id = m.category_id
  WHERE (
      lower(btrim(split_part(m.name, '|', 1))) = v_key
      OR lower(btrim(split_part(m.name, '|', 1))) = v_clean
      OR lower(btrim(split_part(m.name, '|', 1))) = ('suka ' || v_clean)
    )
    AND COALESCE(c.name, '') <> 'Voucher Pamulang 10%'
  ORDER BY (m.outlet_id IS NULL) DESC, COALESCE(m.is_available, true) DESC, m.id
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN 0;
  END IF;

  RETURN public.get_mitra_item_hpp_murni(v_id, p_channel, p_tanggal);
END;
$function$;

-- 4. Ganti get_mitra_item_hpp & get_mitra_item_hpp_by_name (hapus 3-arg lama agar tidak ambiguous)
DROP FUNCTION IF EXISTS public.get_mitra_item_hpp(uuid, text, date);
DROP FUNCTION IF EXISTS public.get_mitra_item_hpp_by_name(text, text, date);

CREATE OR REPLACE FUNCTION public.get_mitra_item_hpp(
  p_menu_item_id uuid,
  p_channel text,
  p_tanggal date DEFAULT NULL::date,
  p_outlet_id uuid DEFAULT NULL::uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_tgl date := COALESCE(p_tanggal, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_base numeric;
  v_raw numeric;
BEGIN
  IF v_tgl < DATE '2026-10-01'
     OR p_outlet_id = '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::uuid
  THEN
    v_base := public.get_mitra_item_hpp_base(p_menu_item_id, p_channel, v_tgl);
    IF v_base > 0 THEN
      RETURN round(v_base * 1.10);
    END IF;
    RETURN 0;
  END IF;

  v_raw := public._get_mitra_item_hpp_raw(p_menu_item_id, p_channel, v_tgl);
  IF v_raw > 0 THEN
    RETURN round(v_raw);
  END IF;
  RETURN 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_mitra_item_hpp_by_name(
  p_name text,
  p_channel text,
  p_tanggal date DEFAULT NULL::date,
  p_outlet_id uuid DEFAULT NULL::uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_id uuid;
  v_key text;
  v_clean text;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RETURN 0;
  END IF;

  v_key := lower(btrim(split_part(p_name, '|', 1)));
  IF v_key = '' THEN
    RETURN 0;
  END IF;

  v_clean := regexp_replace(v_key, '^(suka\s+shawarma|suka)\s+', '', 'i');
  v_clean := regexp_replace(v_clean, '\s*\((1x|2x|3x|4x)\)\s*$', '', 'i');
  v_clean := regexp_replace(v_clean, '\s*-\s*(large|barbar)\s*$', '', 'i');
  v_clean := regexp_replace(v_clean, '\s+shawarma\s*$', '', 'i');
  v_clean := btrim(v_clean);

  SELECT m.id INTO v_id
  FROM public.menu_items m
  LEFT JOIN public.categories c ON c.id = m.category_id
  WHERE (
      lower(btrim(split_part(m.name, '|', 1))) = v_key
      OR lower(btrim(split_part(m.name, '|', 1))) = v_clean
      OR lower(btrim(split_part(m.name, '|', 1))) = ('suka ' || v_clean)
    )
    AND COALESCE(c.name, '') <> 'Voucher Pamulang 10%'
  ORDER BY (m.outlet_id IS NULL) DESC, COALESCE(m.is_available, true) DESC, m.id
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN 0;
  END IF;

  RETURN public.get_mitra_item_hpp(v_id, p_channel, p_tanggal, p_outlet_id);
END;
$function$;

-- 5. Perbarui get_mitra_orders_summary agar meneruskan outlet_id (pengecualian MITRA CILEUNGSI)
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
    SELECT (
      EXISTS (
        SELECT 1 FROM public.menu_hpp_riwayat
        WHERE berlaku_mulai > (p_from AT TIME ZONE 'Asia/Jakarta')::date
          AND berlaku_mulai <= (p_to AT TIME ZONE 'Asia/Jakarta')::date
      )
      OR (
        (p_from AT TIME ZONE 'Asia/Jakarta')::date < DATE '2026-10-01'
        AND (p_to AT TIME ZONE 'Asia/Jakarta')::date >= DATE '2026-10-01'
      )
      OR (
        (p_from AT TIME ZONE 'Asia/Jakarta')::date < DATE '2026-11-02'
        AND (p_to AT TIME ZONE 'Asia/Jakarta')::date >= DATE '2026-11-02'
      )
    ) AS has_price_change
  ),
  item_hpp_lookup AS (
    SELECT
      m.id AS menu_item_id,
      ac.channel,
      public.get_mitra_item_hpp(m.id, ac.channel, (p_to AT TIME ZONE 'Asia/Jakarta')::date, NULL) AS hpp_std,
      public.get_mitra_item_hpp(m.id, ac.channel, (p_to AT TIME ZONE 'Asia/Jakarta')::date, '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::uuid) AS hpp_cileungsi
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
            NULLIF(public.get_mitra_item_hpp(oi.menu_item_id, of.channel, of.tgl, of.outlet_id), 0),
            public.get_mitra_item_hpp_by_name(oi.menu_item_name, of.channel, of.tgl, of.outlet_id),
            0
          )
        ELSE
          COALESCE(
            NULLIF(
              CASE
                WHEN of.outlet_id = '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::uuid THEN lk.hpp_cileungsi
                ELSE lk.hpp_std
              END,
              0
            ),
            public.get_mitra_item_hpp_by_name(oi.menu_item_name, of.channel, of.tgl, of.outlet_id),
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

REVOKE EXECUTE ON FUNCTION public.get_mitra_orders_summary(uuid[], timestamp with time zone, timestamp with time zone) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mitra_orders_summary(uuid[], timestamp with time zone, timestamp with time zone) TO authenticated, service_role;

-- 6. Perbarui get_owner_dashboard_summary agar COGS & total_mitra_markup mengikuti aturan takeout OPEX
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
SET search_path TO 'public'
SET plan_cache_mode TO 'force_custom_plan'
AS $function$
DECLARE
  v_result jsonb;
  v_user_role text;
  v_has_full_access boolean := false;
  v_test_outlet_ids uuid[];
  v_mitra_outlet_ids uuid[];
BEGIN
  -- 1. Snapshot hak akses pemanggil sekali di awal (aman untuk service_role & sesi user)
  IF auth.uid() IS NULL THEN
    v_has_full_access := true;
  ELSIF coalesce(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'OWNER'
     OR coalesce(current_setting('request.jwt.claims', true)::jsonb->'user_metadata'->>'role', '') = 'OWNER' THEN
    v_has_full_access := true;
  ELSE
    SELECT os.role INTO v_user_role
    FROM public.outlet_staff os
    WHERE os.id = auth.uid();

    IF v_user_role IN (
      'admin', 'admin_hr', 'owner', 'spv', 'kitchen',
      'admin_finance', 'regional_manager', 'developer', 'purchasing'
    ) THEN
      v_has_full_access := true;
    END IF;
  END IF;

  -- 2. Daftar outlet pengetesan (identik dengan isTestOutlet di src/lib/outletFilters.ts)
  SELECT COALESCE(array_agg(o.id), ARRAY[]::uuid[]) INTO v_test_outlet_ids
  FROM public.outlets o
  WHERE o.id = COALESCE(p_test_outlet_id, 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid)
     OR COALESCE(o.name, '') ~* '(tes|test|trial|demo)'
     OR COALESCE(o.slug, '') ~* '(tes|test|trial|demo)';

  -- 3. Daftar outlet mitra (identik dengan isMitraOutlet di src/lib/outletOwnership.ts)
  SELECT COALESCE(array_agg(o.id), ARRAY[]::uuid[]) INTO v_mitra_outlet_ids
  FROM public.outlets o
  WHERE (
      o.type = 'mitra'
      OR EXISTS (SELECT 1 FROM public.mitra_investments mi WHERE mi.outlet_id = o.id)
      OR COALESCE(o.name, '') ILIKE '%mitra%'
    )
    AND NOT (o.id = ANY(v_test_outlet_ids));

  -- 4. Single-pass CTE pipeline
  WITH ord AS (
    SELECT
      o.id,
      o.outlet_id,
      o.total_amount,
      o.discount_amount,
      o.promo_subsidy,
      lower(COALESCE(NULLIF(btrim(o.channel), ''), NULLIF(btrim(o.sales_source), ''), 'pos')) AS raw_channel,
      CASE
        WHEN o.is_endorse THEN 'endors'
        WHEN lower(COALESCE(o.channel, '')) IN ('endorse', 'endors')
          OR lower(COALESCE(o.sales_source, '')) IN ('endorse', 'endors') THEN 'endors'
        WHEN lower(COALESCE(o.channel, '')) IN ('app', 'aplikasi', 'suka_app', 'sukashawarma_app')
          OR (COALESCE(o.channel, '') = '' AND lower(COALESCE(o.sales_source, '')) IN ('app', 'aplikasi', 'suka_app', 'sukashawarma_app')) THEN 'app'
        WHEN o.channel IS NULL OR o.channel = '' THEN lower(COALESCE(o.sales_source, 'pos'))
        WHEN lower(o.channel) = 'shopeefood' THEN 'shopeefood'
        WHEN lower(o.channel) = 'tiktokgo' THEN 'tiktok'
        WHEN lower(o.channel) = 'grabfood' THEN 'grabfood'
        WHEN lower(o.channel) = 'gofood' THEN 'gofood'
        WHEN lower(o.channel) IN ('website', 'online', 'web') THEN 'online'
        ELSE public.resolve_sales_source(o.channel, o.sales_source)
      END AS src_key,
      (o.created_at AT TIME ZONE 'Asia/Jakarta')::date AS local_date,
      EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Asia/Jakarta'))::int AS local_hour,
      (o.outlet_id = ANY(v_mitra_outlet_ids)) AS is_mitra
    FROM public.orders o
    WHERE o.status = 'completed'
      AND o.created_at >= p_from
      AND o.created_at <= p_to
      AND (v_has_full_access OR o.outlet_id IN (SELECT public.accessible_outlet_ids()))
      AND NOT (o.outlet_id = ANY(v_test_outlet_ids))
      AND (p_outlet_id IS NULL OR o.outlet_id = p_outlet_id)
      AND (
        p_source = 'all'
        OR CASE
             WHEN o.is_endorse THEN 'endors'
             WHEN lower(COALESCE(o.channel, '')) IN ('endorse', 'endors')
               OR lower(COALESCE(o.sales_source, '')) IN ('endorse', 'endors') THEN 'endors'
             WHEN lower(COALESCE(o.channel, '')) IN ('app', 'aplikasi', 'suka_app', 'sukashawarma_app')
               OR (COALESCE(o.channel, '') = '' AND lower(COALESCE(o.sales_source, '')) IN ('app', 'aplikasi', 'suka_app', 'sukashawarma_app')) THEN 'app'
             WHEN o.channel IS NULL OR o.channel = '' THEN lower(COALESCE(o.sales_source, 'pos'))
             WHEN lower(o.channel) = 'shopeefood' THEN 'shopeefood'
             WHEN lower(o.channel) = 'tiktokgo' THEN 'tiktok'
             WHEN lower(o.channel) = 'grabfood' THEN 'grabfood'
             WHEN lower(o.channel) = 'gofood' THEN 'gofood'
             WHEN lower(o.channel) IN ('website', 'online', 'web') THEN 'online'
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
      ord.outlet_id,
      ord.is_mitra,
      ord.raw_channel,
      ord.local_date
    FROM ord
    JOIN public.order_items oi ON oi.order_id = ord.id
  ),

  -- 5b. Kombinasi unik (menu, kanal, tanggal) yang benar-benar terjual
  menu_tgl AS (
    SELECT DISTINCT ir.menu_item_id, ir.raw_channel, ir.local_date
    FROM items_raw ir
    WHERE ir.menu_item_id IS NOT NULL
  ),

  -- 5c. HPP dasar & HPP mitra takeout OPEX per kombinasi (menu, kanal, tanggal)
  menu_hpp AS MATERIALIZED (
    SELECT
      mt.menu_item_id AS id,
      mt.raw_channel,
      mt.local_date,
      COALESCE(public.get_mitra_item_hpp_base(mt.menu_item_id, mt.raw_channel, mt.local_date), 0) AS unit_hpp,
      CASE
        WHEN mt.local_date >= DATE '2026-10-01'
          THEN COALESCE(public.get_mitra_item_hpp(mt.menu_item_id, mt.raw_channel, mt.local_date, NULL), 0)
        ELSE 0
      END AS unit_mitra_std,
      CASE
        WHEN mt.local_date >= DATE '2026-10-01'
          THEN COALESCE(public.get_mitra_item_hpp_murni(mt.menu_item_id, mt.raw_channel, mt.local_date), 0)
        ELSE 0
      END AS unit_murni
    FROM menu_tgl mt
  ),

  -- 5d. Resolusi HPP dasar & mitra (termasuk fallback nama menu bila menu_item_id NULL / HPP 0)
  items_base AS (
    SELECT
      ir.order_id,
      ir.quantity,
      ir.subtotal,
      trim(split_part(ir.menu_item_name, '|', 1)) AS menu_name,
      ir.outlet_id,
      ir.is_mitra,
      ir.local_date,
      COALESCE(ir.is_promo_reward, false) AS is_promo_reward,
      COALESCE(
        NULLIF(mh.unit_hpp, 0),
        public.get_mitra_item_hpp_base_by_name(ir.menu_item_name, ir.raw_channel, ir.local_date),
        0
      ) AS base_hpp,
      CASE
        WHEN ir.is_mitra
         AND ir.local_date >= DATE '2026-10-01'
         AND ir.outlet_id <> '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::uuid
        THEN COALESCE(
          NULLIF(mh.unit_mitra_std, 0),
          public.get_mitra_item_hpp_by_name(ir.menu_item_name, ir.raw_channel, ir.local_date, ir.outlet_id),
          0
        )
        ELSE 0
      END AS mitra_std_hpp,
      CASE
        WHEN ir.is_mitra
         AND ir.local_date >= DATE '2026-10-01'
         AND ir.outlet_id <> '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::uuid
        THEN COALESCE(
          NULLIF(mh.unit_murni, 0),
          public.get_mitra_item_hpp_murni_by_name(ir.menu_item_name, ir.raw_channel, ir.local_date),
          0
        )
        ELSE 0
      END AS mitra_murni_hpp
    FROM items_raw ir
    LEFT JOIN menu_hpp mh
      ON mh.id = ir.menu_item_id
     AND mh.raw_channel = ir.raw_channel
     AND mh.local_date = ir.local_date
  ),

  -- 5e. Hitung COGS & margin bahan mitra identik dengan fetchHpp.ts
  items AS (
    SELECT
      ib.order_id,
      ib.quantity,
      ib.subtotal,
      ib.menu_name,
      (CASE
        WHEN NOT ib.is_mitra THEN ib.base_hpp
        WHEN ib.local_date < DATE '2026-10-01'
          OR ib.outlet_id = '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::uuid
          THEN ROUND(ib.base_hpp * 1.1)
        ELSE ib.mitra_std_hpp
      END) * COALESCE(ib.quantity, 1) AS item_cogs,
      (CASE
        WHEN NOT ib.is_mitra THEN 0
        WHEN ib.local_date < DATE '2026-10-01'
          OR ib.outlet_id = '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::uuid
          THEN (ROUND(ib.base_hpp * 1.1) - ib.base_hpp)
        ELSE (ib.mitra_std_hpp - ib.mitra_murni_hpp)
      END) * COALESCE(ib.quantity, 1) AS item_markup,
      ib.is_promo_reward
    FROM items_base ib
  ),

  -- 6. Subtotal & kuantitas per order
  order_totals AS (
    SELECT
      it.order_id,
      SUM(it.subtotal) AS total_subtotal,
      SUM(it.quantity) AS total_quantity
    FROM items it
    GROUP BY it.order_id
  ),

  -- 6b. Perhitungan net & potongan per order (satu definisi dipakai kpi_agg & hourly_agg)
  order_calc AS (
    SELECT
      o.outlet_id,
      o.src_key,
      o.local_date,
      o.local_hour,
      COALESCE(ot.total_quantity, 0) AS total_quantity,
      CASE
        WHEN o.src_key IN ('shopeefood', 'grabfood', 'gofood', 'tiktok') THEN
          GREATEST(0::numeric, COALESCE(o.total_amount, 0::numeric) - (
            GREATEST(0::numeric, COALESCE(ot.total_subtotal, 0::numeric) - COALESCE(o.total_amount, 0::numeric)) + COALESCE(o.promo_subsidy, 0)::numeric
          ))
        ELSE
          COALESCE(o.total_amount, 0::numeric)
      END AS net_omzet,
      CASE
        WHEN o.src_key IN ('shopeefood', 'grabfood', 'gofood', 'tiktok') THEN
          GREATEST(0::numeric, COALESCE(ot.total_subtotal, 0::numeric) - COALESCE(o.total_amount, 0::numeric)) + COALESCE(o.promo_subsidy, 0)::numeric
        WHEN ot.total_subtotal IS NULL THEN
          COALESCE(o.discount_amount, 0::numeric) + COALESCE(o.promo_subsidy, 0::numeric)
        ELSE
          GREATEST(0::numeric, ot.total_subtotal - COALESCE(o.total_amount, 0::numeric))
      END AS deduction
    FROM ord o
    LEFT JOIN order_totals ot ON ot.order_id = o.id
  ),

  -- 7. KPI aggregation (selaras dengan sales_daily_spv)
  kpi_agg AS (
    SELECT
      oc.outlet_id,
      oc.src_key AS sales_source,
      oc.local_date AS sales_date,
      COALESCE(SUM(oc.net_omzet), 0::numeric) AS omzet,
      COUNT(*) AS order_count,
      COALESCE(SUM(oc.total_quantity), 0) AS total_qty,
      COALESCE(SUM(oc.deduction), 0::numeric) AS total_deductions
    FROM order_calc oc
    GROUP BY oc.outlet_id, oc.src_key, oc.local_date
  ),

  -- 8. Hourly aggregation (kontrak kunci `omzet` & `order_count`, basis Omzet Kotor)
  hourly_agg AS (
    SELECT
      oc.local_hour AS sales_hour,
      COALESCE(SUM(oc.net_omzet + oc.deduction), 0::numeric) AS omzet,
      COUNT(*) AS order_count
    FROM order_calc oc
    GROUP BY oc.local_hour
  ),

  -- 9. Menu aggregation (kontrak kunci `qty`, TANPA LIMIT 10 agar sum multi-hari utuh)
  menu_agg AS (
    SELECT
      it.menu_name,
      SUM(it.quantity) AS qty,
      SUM(it.subtotal) AS revenue
    FROM items it
    WHERE it.menu_name IS NOT NULL
      AND it.menu_name <> ''
    GROUP BY it.menu_name
    ORDER BY revenue DESC
  ),

  -- 10. Totals aggregation (termasuk total_mitra_markup untuk Laba Rugi Global)
  totals_agg AS (
    SELECT
      COALESCE(SUM(it.item_cogs), 0) AS total_cogs,
      COALESCE(SUM(it.item_markup), 0) AS total_mitra_markup,
      COUNT(DISTINCT CASE WHEN it.is_promo_reward THEN it.order_id END) AS bogo_transactions,
      COALESCE(SUM(CASE WHEN it.is_promo_reward THEN it.quantity ELSE 0 END), 0) AS bogo_gift_units
    FROM items it
  ),

  -- 11. OPEX aggregation fallback (saat di luar jendela hitungOpexLabaRugi)
  opex_agg AS (
    SELECT
      COALESCE((
        SELECT SUM(e.amount)
        FROM public.expenses e
        WHERE e.expense_date >= (p_from AT TIME ZONE 'Asia/Jakarta')::date
          AND e.expense_date <= (p_to   AT TIME ZONE 'Asia/Jakarta')::date
          AND e.type = 'expense'
          AND (v_has_full_access OR e.outlet_id IN (SELECT public.accessible_outlet_ids()))
          AND (e.outlet_id IS NULL OR NOT (e.outlet_id = ANY(v_test_outlet_ids)))
          AND (p_outlet_id IS NULL OR e.outlet_id = p_outlet_id)
          AND NOT (e.category IN ('joint_expense', 'joint_expanse') AND e.expense_date >= '2026-10-01')
          AND NOT (e.description ILIKE '[MARCOM: HPP Menu KOL%' AND e.expense_date >= '2026-10-01')
      ), 0) +
      COALESCE((
        SELECT SUM(pce.amount)
        FROM public.petty_cash_expenses pce
        WHERE pce.expense_date >= (p_from AT TIME ZONE 'Asia/Jakarta')::date
          AND pce.expense_date <= (p_to   AT TIME ZONE 'Asia/Jakarta')::date
          AND pce.deleted_at IS NULL
          AND (v_has_full_access OR pce.outlet_id IN (SELECT public.accessible_outlet_ids()))
          AND NOT (pce.outlet_id = ANY(v_test_outlet_ids))
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
    'kpi_rows',           COALESCE((SELECT jsonb_agg(row_to_json(k)) FROM kpi_agg k), '[]'::jsonb),
    'hourly_rows',        COALESCE((SELECT jsonb_agg(row_to_json(h) ORDER BY h.sales_hour) FROM hourly_agg h), '[]'::jsonb),
    'menu_rows',          COALESCE((SELECT jsonb_agg(row_to_json(m) ORDER BY m.revenue DESC) FROM menu_agg m), '[]'::jsonb),
    'total_cogs',         (SELECT total_cogs FROM totals_agg),
    'total_mitra_markup', (SELECT total_mitra_markup FROM totals_agg),
    'total_opex',         (SELECT total_opex FROM opex_agg),
    'bogo_transactions',  (SELECT bogo_transactions FROM totals_agg),
    'bogo_gift_units',    (SELECT bogo_gift_units FROM totals_agg)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_owner_dashboard_summary(timestamp with time zone, timestamp with time zone, uuid, text, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_summary(timestamp with time zone, timestamp with time zone, uuid, text, uuid) TO authenticated, service_role;

COMMIT;
