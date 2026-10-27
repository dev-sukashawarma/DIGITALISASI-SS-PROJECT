-- ============================================================================
-- Migration: 20261027103000_align_owner_summary_with_profit.sql
-- Tujuan:
-- Menyelaraskan RPC `get_owner_dashboard_summary` (halaman Ringkasan Bisnis)
-- agar 1:1 dengan halaman Laba Rugi (`ProfitView.tsx`) dan memulihkan kontrak
-- JSON yang sempat berubah pada 20261026121500:
--   1. `menu_agg`: kembalikan alias `qty` (sebelumnya `total_qty`) dan hapus
--      `LIMIT 10` di level potongan harian agar `Menu Terlaris` mode Porsi serta
--      penggabungan lintas-hari (`mergeSummaryResult`) akurat 100%.
--   2. `hourly_agg`: kembalikan alias `omzet` & `order_count` (sebelumnya
--      `hourly_omzet` & `hourly_order_count` yang memicu NaN di grafik jam),
--      dengan basis Omzet Kotor per jam selaras kartu Omzet Penjualan (Kotor).
--   3. `total_mitra_markup`: pulihkan perhitungan & field JSON margin pasokan
--      bahan mitra (+10% HPP dasar) yang hilang dari 20261013140000, memakai
--      helper `get_mitra_item_hpp_base_by_name` agar fallback nama menu tidak
--      mengalami selisih pembulatan `/ 1.1` maupun kehilangan markup mitra.
--   4. `v_mitra_outlet_ids` & `v_test_outlet_ids`: samakan aturan deteksi
--      outlet mitra (`isMitraOutlet`) dan pengecualian outlet tes (`isTestOutlet`)
--      dengan kode TypeScript di `ProfitView` & `fetchHpp`.
--   5. Header keamanan & performa: pulihkan `SET search_path TO 'public'`,
--      `SET plan_cache_mode TO 'force_custom_plan'`, serta pemeriksaan akses
--      penuh (`auth.uid() IS NULL` / `outlet_staff.role`).
-- ============================================================================

-- 1. Helper HPP dasar berdasarkan nama menu (tanpa markup 1.1x)
-- Sengaja TANPA `SET search_path` mengikuti `get_mitra_item_hpp_base` (20260928180000)
-- agar tidak menghambat planner di dalam kueri agregasi besar.
CREATE OR REPLACE FUNCTION public.get_mitra_item_hpp_base_by_name(
    p_name text,
    p_channel text,
    p_tanggal date DEFAULT NULL
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

    -- Bersihkan variasi penamaan ojol (identik dengan get_mitra_item_hpp_by_name)
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

    RETURN public.get_mitra_item_hpp_base(v_id, p_channel, p_tanggal);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_mitra_item_hpp_base_by_name(text, text, date) TO anon, authenticated, service_role;


-- 2. RPC Ringkasan Bisnis (`get_owner_dashboard_summary`) selaras Laba Rugi
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

  -- 5c. HPP dasar per kombinasi (menu, kanal, tanggal) — memakai get_mitra_item_hpp_base
  --     yang identik dengan fetchHpp.ts (mendukung channel_hpp, hpp_override, & paket bersarang)
  menu_hpp AS MATERIALIZED (
    SELECT
      mt.menu_item_id AS id,
      mt.raw_channel,
      mt.local_date,
      COALESCE(public.get_mitra_item_hpp_base(mt.menu_item_id, mt.raw_channel, mt.local_date), 0) AS unit_hpp
    FROM menu_tgl mt
  ),

  -- 5d. Resolusi HPP dasar (termasuk fallback nama menu bila menu_item_id NULL / HPP 0)
  items_base AS (
    SELECT
      ir.order_id,
      ir.quantity,
      ir.subtotal,
      trim(split_part(ir.menu_item_name, '|', 1)) AS menu_name,
      ir.is_mitra,
      COALESCE(ir.is_promo_reward, false) AS is_promo_reward,
      COALESCE(
        NULLIF(mh.unit_hpp, 0),
        public.get_mitra_item_hpp_base_by_name(ir.menu_item_name, ir.raw_channel, ir.local_date),
        0
      ) AS base_hpp
    FROM items_raw ir
    LEFT JOIN menu_hpp mh
      ON mh.id = ir.menu_item_id
     AND mh.raw_channel = ir.raw_channel
     AND mh.local_date = ir.local_date
  ),

  -- 5e. Hitung COGS & margin bahan mitra (+10% HPP dasar) sama persis dengan fetchHpp.ts
  items AS (
    SELECT
      ib.order_id,
      ib.quantity,
      ib.subtotal,
      ib.menu_name,
      (CASE WHEN ib.is_mitra THEN ROUND(ib.base_hpp * 1.1) ELSE ib.base_hpp END)
        * COALESCE(ib.quantity, 1) AS item_cogs,
      (CASE WHEN ib.is_mitra THEN (ROUND(ib.base_hpp * 1.1) - ib.base_hpp) ELSE 0 END)
        * COALESCE(ib.quantity, 1) AS item_markup,
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
          COALESCE(o.discount_amount, 0::numeric) + COALESCE(o.promo_subsidy, 0)::numeric
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

REVOKE EXECUTE ON FUNCTION public.get_owner_dashboard_summary FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_owner_dashboard_summary FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_summary TO service_role;
