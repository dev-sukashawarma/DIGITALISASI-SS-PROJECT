-- 20300129000000_sales_source_sadar_channel.sql
--
-- `sales_source` di sales_daily_spv & get_owner_dashboard_summary dibuat
-- SADAR-CHANNEL, supaya TikTok Go tidak lagi menyamar jadi penjualan POS.
--
-- ============================================================================
-- MASALAH
--   Satu channel bisa tersimpan dalam DUA bentuk. Penanda channel yang andal
--   ada di kolom `orders.channel`; `sales_source` kadang ikut, kadang 'pos'.
--   Enumerasi seluruh riwayat (order completed) menunjukkan 19 kombinasi,
--   di antaranya yang "menyamar":
--       channel='tiktokgo'   / sales_source='pos' -> 2.093 order  Rp 100,4 jt
--       channel='shopeefood' / sales_source='pos' -> 3.400 order  Rp 231,8 jt
--       channel='grabfood'   / sales_source='pos' -> 1.232 order  Rp  86,7 jt
--       channel='gofood'     / sales_source='pos' -> 1.026 order  Rp  71,0 jt
--
--   `sales_daily_spv` mengelompokkan HANYA berdasarkan `sales_source`, dan
--   `get_owner_dashboard_summary` memakai
--       src_key = lower(COALESCE(o.sales_source, 'pos'))
--   sehingga semua baris "menyamar" itu masuk kelompok POS/outlet.
--
--   Terukur di MITRA CILEUNGSI, 1-3 September 2026: 117 order TikTok Go senilai
--   Rp 5.819.000 -- SELURUHNYA tersimpan sebagai channel='tiktokgo' /
--   sales_source='pos'. Halaman Laba Rugi dan Ringkasan Bisnis menampilkan
--   TikTok Go = Rp 0 untuk outlet & periode itu, sementara Kemitraan,
--   Rangkuman Penjualan, POS Kasir, dan Dashboard Manager menampilkan
--   Rp 5.819.000 (keempatnya membaca `channel`). Besar kerusakan bergantung
--   outlet & periode -- Cibinong Agustus 52:48, Cileungsi September 0:100.
--
-- PENDEKATAN
--   Diperbaiki DI SUMBER: kolom `sales_source` pada view/RPC kini berisi nilai
--   KANONIK hasil resolusi channel, bukan kolom mentah. Nilai yang dihasilkan
--   persis anggota type `SalesSource` di src/lib/types.ts:
--       pos | online | gofood | grabfood | shopeefood | tiktok |
--       tiktok_shop | shopee_shop | endors
--   Dengan begitu SEMUA konsumen ikut benar tanpa perubahan kode:
--   getChannelGroup (Laba Rugi), groupChannel (Rekap Bulanan), SourceBreakdown,
--   MitraProfitLossMockup, dan filter platform settlement.
--
--   Grain view TIDAK berubah (outlet_id, sales_source, sales_date), jadi
--   paginasi di useSalesDaily (admin & finance) tak perlu disentuh -- penting,
--   karena finance memanggil view ini TANPA paginasi maupun ORDER BY sehingga
--   rawan terpotong di 1.000 baris kalau grain diperlebar.
--
--   `channel` diutamakan TAPI hanya bila spesifik: 'food_apps'/'foodapps'/'pos'
--   generik dan jatuh ke `sales_source` -- tanpa aturan ini, 6.200 order
--   channel='food_apps'/sales_source='grabfood' akan salah jadi 'pos'.
--
-- DAMPAK
--   Total omzet per outlet TIDAK berubah -- hanya perpindahan antar-kelompok
--   channel. Yang berubah: rincian per channel di Laba Rugi & Ringkasan Bisnis,
--   kelompok channel di Rekap Bulanan, dan estimasi komisi di export CSV/PDF
--   Laba Rugi (TikTok 10%, POS 0%).
--
-- LINGKUP: sales_daily_spv/_scoped + get_owner_dashboard_summary. Definisi RPC
--   diambil apa adanya dari fungsi LIVE; HANYA blok src_key yang diubah.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper resolusi channel -> nilai kanonik SalesSource.
-- Satu tempat, dipakai view maupun RPC, supaya tak ada dua salinan aturan.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_sales_source(
    p_channel text,
    p_sales_source text
) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  WITH k AS (
    SELECT CASE
             WHEN lower(btrim(COALESCE(p_channel, ''))) IN ('', 'pos', 'food_apps', 'foodapps')
               THEN lower(btrim(COALESCE(p_sales_source, 'pos')))
             ELSE lower(btrim(p_channel))
           END AS v
  )
  SELECT CASE
           WHEN k.v LIKE '%tiktok%shop%'
                OR k.v = 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5' THEN 'tiktok_shop'
           WHEN k.v LIKE '%tiktok%'
                OR k.v = 'c9b01c9f-0e5b-462f-bba8-9a9b6525c5c8' THEN 'tiktok'
           WHEN k.v LIKE '%shopee%shop%'
                OR k.v = 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584' THEN 'shopee_shop'
           WHEN k.v LIKE '%shopee%'
                OR k.v = '0eaf2746-da9f-492c-a9b4-f091307c98c2' THEN 'shopeefood'
           WHEN k.v LIKE '%grab%'
                OR k.v = '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a' THEN 'grabfood'
           WHEN k.v LIKE '%gofood%' OR k.v LIKE '%go_food%' OR k.v LIKE '%gojek%'
                OR k.v = '1284ac2a-e753-4380-9f32-59219a322459' THEN 'gofood'
           WHEN k.v IN ('website', 'online', 'web') THEN 'online'
           ELSE 'pos'
         END
  FROM k;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_sales_source(text, text) TO authenticated;


DROP VIEW IF EXISTS public.sales_daily_scoped;
DROP VIEW IF EXISTS public.sales_daily_spv;

CREATE OR REPLACE VIEW public.sales_daily_spv AS
WITH item_totals AS (
  SELECT oi.order_id, SUM(oi.subtotal) AS total_subtotal
  FROM public.order_items oi
  GROUP BY oi.order_id
),
resolved AS (
  SELECT
    o.outlet_id,
    o.total_amount,
    o.discount_amount,
    o.promo_subsidy,
    it.total_subtotal,
    ((o.created_at AT TIME ZONE 'Asia/Jakarta'::text))::date AS sales_date,
    CASE
      WHEN o.is_endorse
           OR lower(COALESCE(o.channel, '')) IN ('endors', 'endorse')
           OR lower(COALESCE(o.sales_source, '')) IN ('endors', 'endorse')
        THEN 'endors'
      ELSE public.resolve_sales_source(o.channel, o.sales_source)
    END AS sales_source
  FROM public.orders o
  LEFT JOIN item_totals it ON it.order_id = o.id
  WHERE o.status = 'completed'
    AND o.outlet_id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
)
SELECT
  r.outlet_id,
  r.sales_source,
  r.sales_date,
  COALESCE(SUM(r.total_amount), 0)::numeric AS omzet,
  COALESCE(SUM(
    CASE
      WHEN r.total_subtotal IS NULL
        THEN COALESCE(r.discount_amount, 0) + COALESCE(r.promo_subsidy, 0)
      ELSE GREATEST(0, r.total_subtotal - COALESCE(r.total_amount, 0))
    END
  ), 0)::numeric AS total_deductions,
  COUNT(*) AS jumlah_order_completed
FROM resolved r
GROUP BY r.outlet_id, r.sales_source, r.sales_date;

CREATE OR REPLACE VIEW public.sales_daily_scoped AS
SELECT outlet_id, sales_source, sales_date, omzet, total_deductions, jumlah_order_completed
FROM public.sales_daily_spv
WHERE outlet_id IN (SELECT public.accessible_outlet_ids());

GRANT SELECT ON public.sales_daily_spv TO authenticated;
GRANT SELECT ON public.sales_daily_scoped TO authenticated;


-- ----------------------------------------------------------------------------
-- get_owner_dashboard_summary: src_key ikut resolusi yang sama.
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
      CASE
        WHEN o.is_endorse
             OR lower(COALESCE(o.channel, '')) IN ('endors', 'endorse')
             OR lower(COALESCE(o.sales_source, '')) IN ('endors', 'endorse')
          THEN 'endors'
        ELSE public.resolve_sales_source(o.channel, o.sales_source)
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
        OR CASE
             WHEN o.is_endorse
                  OR lower(COALESCE(o.channel, '')) IN ('endors', 'endorse')
                  OR lower(COALESCE(o.sales_source, '')) IN ('endors', 'endorse')
               THEN 'endors'
             ELSE public.resolve_sales_source(o.channel, o.sales_source)
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
