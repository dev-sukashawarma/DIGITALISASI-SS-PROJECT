-- 20300128000000_omzet_kotor_acuan_tunggal.sql
--
-- SATU acuan Omzet Kotor untuk seluruh dashboard.
--
-- ============================================================================
-- MASALAH
--   `orders.total_amount` berubah ARTI di tengah jalan. Sampai 18 Agustus 2026
--   ia bersih (sudah dipotong diskon & subsidi). Sejak commit b41efc7a
--   (19 Agustus) untuk Food Apps ia UTUH -- perubahan yang disengaja dan benar,
--   karena platform membayar merchant harga penuh. Tapi kolom `promo_subsidy`
--   TETAP diisi (komentarnya sendiri: "Hanya untuk laporan").
--
--   Lapisan laporan tidak pernah diberi tahu. Rumus lamanya
--       Omzet = total_amount + discount_amount + promo_subsidy
--   masih memakai aturan lama, sehingga sejak 19 Agustus ia MENAMBAHKAN promo
--   ke angka yang sudah memuat promo -- dihitung dua kali.
--
--   Akibatnya ada TIGA angka berbeda untuk hal yang sama (Agustus 2026,
--   semua outlet):
--     A  1.925.547.612  Ringkasan Bisnis, Rangkuman Penjualan, Laba Rugi, Kemitraan
--     B  1.830.489.209  Penjualan (app finance)
--     C  1.711.789.358  POS Kasir, Dashboard Manager
--   Contoh nyata MITRA KALISARI 3 September 2026: 24 order, nilai menu
--   Rp 1.089.000, uang masuk Rp 1.089.000, tapi 4 dashboard melaporkan
--   Rp 1.216.614 -- selisih Rp 127.614 murni dari subsidi platform.
--
-- ACUAN TUNGGAL (per order)
--     Potongan    = MAX(0, SUM(order_items.subtotal) - total_amount)
--                   discount_amount + promo_subsidy   <- bila order tanpa baris item
--     Omzet Kotor = total_amount + Potongan
--     Net Revenue = total_amount
--
--   Bertumpu pada nilai menu, bukan pada `promo_subsidy`, sehingga kebal
--   terhadap perubahan arti `total_amount` -- yang sudah terjadi sekali dan
--   bisa terjadi lagi. `total_amount` dipakai sebagai jangkar supaya
--   Omzet - Potongan = total_amount secara aljabar: Net Revenue, dan karenanya
--   LABA, mustahil bergeser.
--
--   Subsidi platform tidak masuk omzet maupun potongan -- itu bukan penjualan
--   outlet dan bukan biaya outlet. Tempatnya sebagai kartu informasi sendiri.
--
-- DAMPAK TERUKUR
--   Net Revenue         : 0 rupiah bergeser (diuji di 9 outlet mitra)
--   Laba & bagi hasil   : tidak berubah
--   Juni 2026           : selisih Rp 0
--   Juli 2026           : Rp 106.552 dari Rp 1,64 M (0,007%)
--   19-31 Agustus 2026  : Rp 93.944.190 (10,7%) <- di sinilah koreksinya
--
-- LINGKUP MIGRATION INI: sales_daily_spv/_scoped, get_owner_dashboard_summary,
--   get_mitra_orders_summary. Sisi kode (Rangkuman Penjualan, POS Kasir,
--   Dashboard Manager, app finance) menyusul di commit yang sama.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. sales_daily_spv + sales_daily_scoped  (Laba Rugi, Rekap Bulanan, dll)
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.sales_daily_scoped;
DROP VIEW IF EXISTS public.sales_daily_spv;

CREATE OR REPLACE VIEW public.sales_daily_spv AS
WITH item_totals AS (
  SELECT oi.order_id, SUM(oi.subtotal) AS total_subtotal
  FROM public.order_items oi
  GROUP BY oi.order_id
)
SELECT
  o.outlet_id,
  o.sales_source,
  ((o.created_at AT TIME ZONE 'Asia/Jakarta'::text))::date AS sales_date,
  COALESCE(SUM(o.total_amount), 0)::numeric AS omzet,
  COALESCE(SUM(
    CASE
      WHEN it.total_subtotal IS NULL
        THEN COALESCE(o.discount_amount, 0) + COALESCE(o.promo_subsidy, 0)
      ELSE GREATEST(0, it.total_subtotal - COALESCE(o.total_amount, 0))
    END
  ), 0)::numeric AS total_deductions,
  COUNT(*) AS jumlah_order_completed
FROM public.orders o
LEFT JOIN item_totals it ON it.order_id = o.id
WHERE o.status = 'completed'
  AND o.outlet_id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
GROUP BY o.outlet_id, o.sales_source, (((o.created_at AT TIME ZONE 'Asia/Jakarta'::text))::date);

CREATE OR REPLACE VIEW public.sales_daily_scoped AS
SELECT outlet_id, sales_source, sales_date, omzet, total_deductions, jumlah_order_completed
FROM public.sales_daily_spv
WHERE outlet_id IN (SELECT public.accessible_outlet_ids());

GRANT SELECT ON public.sales_daily_spv TO authenticated;
GRANT SELECT ON public.sales_daily_scoped TO authenticated;


-- ----------------------------------------------------------------------------
-- 2. get_owner_dashboard_summary  (Ringkasan Bisnis)
--    Definisi diambil apa adanya dari fungsi live; HANYA blok total_deductions
--    yang diubah, sisanya tidak disentuh sama sekali.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_owner_dashboard_summary(p_from timestamp with time zone, p_to timestamp with time zone, p_outlet_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'all'::text, p_test_outlet_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- 2. Filtered orders (now pinned to caller's accessible_outlet_ids())
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
      AND o.outlet_id IN (SELECT accessible_outlet_ids())
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
          -- Order tanpa baris item: tidak ada nilai menu untuk dibandingkan,
          -- jatuh ke kolom deduksi yang tercatat.
          WHEN ot.total_subtotal IS NULL
            THEN COALESCE(o.discount_amount, 0) + COALESCE(o.promo_subsidy, 0)
          -- Acuan tunggal: potongan = selisih nilai menu vs uang yang tercatat.
          ELSE GREATEST(0, ot.total_subtotal - COALESCE(o.total_amount, 0))
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

  -- 9. OPEX aggregation (also pinned to caller's accessible_outlet_ids())
  opex_agg AS (
    SELECT
      COALESCE((
        SELECT SUM(e.amount)
        FROM public.expenses e
        WHERE e.expense_date >= (p_from AT TIME ZONE 'Asia/Jakarta')::date
          AND e.expense_date <= (p_to   AT TIME ZONE 'Asia/Jakarta')::date
          AND e.outlet_id IN (SELECT accessible_outlet_ids())
          AND (p_test_outlet_id IS NULL OR e.outlet_id <> p_test_outlet_id)
          AND (p_outlet_id IS NULL OR e.outlet_id = p_outlet_id)
      ), 0) +
      COALESCE((
        SELECT SUM(pce.amount)
        FROM public.petty_cash_expenses pce
        WHERE pce.expense_date >= (p_from AT TIME ZONE 'Asia/Jakarta')::date
          AND pce.expense_date <= (p_to   AT TIME ZONE 'Asia/Jakarta')::date
          AND pce.outlet_id IN (SELECT accessible_outlet_ids())
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
$function$;


-- ----------------------------------------------------------------------------
-- 3. get_mitra_orders_summary  (Kemitraan)
--    Struktur set-based dari 20300126000000 + cadangan HPP lewat nama dari
--    20300127000000 dipertahankan utuh; HANYA `deductions` & `gross_rev` yang
--    beralih ke acuan tunggal.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_mitra_orders_summary(
    p_outlet_ids uuid[],
    p_from timestamptz,
    p_to timestamptz
) RETURNS SETOF mitra_orders_summary_row AS $fn$
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
    order_agg AS (
        SELECT
            oi.order_id,
            SUM(oi.subtotal) AS item_value,
            COALESCE(SUM(
                oi.quantity * COALESCE(
                    NULLIF(public.get_mitra_item_hpp(oi.menu_item_id, of.channel), 0),
                    public.get_mitra_item_hpp_by_name(oi.menu_item_name, of.channel)
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
$fn$ LANGUAGE plpgsql;
