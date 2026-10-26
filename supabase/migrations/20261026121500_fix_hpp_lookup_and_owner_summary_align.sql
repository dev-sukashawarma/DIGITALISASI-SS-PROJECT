-- ============================================================================
-- Migration: 20261026121500_fix_hpp_lookup_and_owner_summary_align.sql
-- Tujuan:
-- 1. get_mitra_item_hpp_by_name:
--    - Mengabaikan kategori 'Voucher Pamulang 10%' (duplikat voucher lokal tak terupdate)
--    - Memprioritaskan menu global (outlet_id IS NULL) & aktif (is_available = true)
--    - Menormalisasi prefix/suffix ojol ('SUKA Shawarma', '(1x)', '- Large', dll.)
-- 2. get_owner_dashboard_summary:
--    - Menyelaraskan opex_agg: sembunyikan joint_expense & [MARCOM: HPP Menu KOL
--      mulai 2026-10-01 (sama persis dengan halaman Profit & Buku Kas)
--    - Menambahkan fallback nama pada items saat menu_item_id IS NULL atau unit_hpp = 0
--    - Mengembalikan SET plan_cache_mode TO 'force_custom_plan'
-- 3. trg_order_items_isi_menu_dari_nama:
--    - Berlaku untuk semua pesanan (bukan hanya sales_source = 'online') saat
--      menu_item_id IS NULL agar pesanan kasir/ojol yang masuk tanpa ID otomatis
--      terpetakan ke menu master.
-- ============================================================================

-- 1. get_mitra_item_hpp_by_name
CREATE OR REPLACE FUNCTION public.get_mitra_item_hpp_by_name(
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

    -- Bersihkan variasi penamaan ojol
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

    RETURN public.get_mitra_item_hpp(v_id, p_channel, p_tanggal);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_mitra_item_hpp_by_name(text, text, date) TO anon, authenticated, service_role;


-- 2. get_owner_dashboard_summary
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
  -- Cegah generic plan yang lambat saat parameter berubah
  SET LOCAL plan_cache_mode TO 'force_custom_plan';

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
      lower(COALESCE(o.channel, 'pos')) AS raw_channel,
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
      ord.raw_channel,
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

  -- 4. HPP dihitung SEKALI per kombinasi (menu, tanggal)
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

  -- 5. Items joined once with pre-calculated HPP & fallback nama bila HPP belum terisi
  items AS (
    SELECT
      ir.order_id,
      ir.quantity,
      ir.subtotal,
      trim(split_part(ir.menu_item_name, '|', 1)) AS menu_name,
      COALESCE(
        NULLIF(
          CASE WHEN ir.is_mitra
               THEN ROUND(mh.unit_hpp * 1.1)
               ELSE mh.unit_hpp
          END, 0
        ),
        CASE WHEN ir.is_mitra
             THEN public.get_mitra_item_hpp_by_name(ir.menu_item_name, ir.raw_channel, ir.local_date)
             ELSE ROUND(public.get_mitra_item_hpp_by_name(ir.menu_item_name, ir.raw_channel, ir.local_date) / 1.1)
        END,
        0
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
      SUM(
        CASE
          WHEN o.src_key IN ('shopeefood', 'grabfood', 'gofood', 'tiktok') THEN
            GREATEST(0::numeric, COALESCE(o.total_amount, 0::numeric) - (
              GREATEST(0::numeric, COALESCE(ot.total_subtotal, 0::numeric) - COALESCE(o.total_amount, 0::numeric)) + COALESCE(o.promo_subsidy, 0)::numeric
            ))
          ELSE
            COALESCE(o.total_amount, 0::numeric)
        END
      ) AS hourly_omzet,
      COUNT(*) AS hourly_order_count
    FROM ord o
    LEFT JOIN order_totals ot ON ot.order_id = o.id
    GROUP BY o.local_hour
  ),

  -- 9. Top menu aggregation
  menu_agg AS (
    SELECT
      it.menu_name,
      SUM(it.quantity) AS total_qty,
      SUM(it.subtotal) AS revenue
    FROM items it
    WHERE it.menu_name IS NOT NULL
      AND it.menu_name <> ''
    GROUP BY it.menu_name
    ORDER BY revenue DESC
    LIMIT 10
  ),

  -- 10. Totals aggregation
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
          AND NOT (e.category IN ('joint_expense', 'joint_expanse') AND e.expense_date >= '2026-10-01')
          AND NOT (e.description ILIKE '[MARCOM: HPP Menu KOL%' AND e.expense_date >= '2026-10-01')
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


-- 3. trg_order_items_isi_menu_dari_nama
CREATE OR REPLACE FUNCTION public.order_items_isi_menu_dari_nama()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nama  text;
  v_clean text;
  v_cocok uuid[];
BEGIN
  IF NEW.menu_item_id IS NOT NULL OR NEW.menu_item_name IS NULL THEN
    RETURN NEW;
  END IF;

  v_nama := lower(btrim(split_part(NEW.menu_item_name, '|', 1)));
  IF v_nama = '' THEN
    RETURN NEW;
  END IF;

  -- 1. Coba pencocokan persis (nama baku)
  SELECT array_agg(m.id) INTO v_cocok
  FROM public.menu_items m
  LEFT JOIN public.categories c ON c.id = m.category_id
  WHERE lower(btrim(m.name)) = v_nama
    AND COALESCE(c.name, '') <> 'Voucher Pamulang 10%';

  IF cardinality(v_cocok) = 1 THEN
    NEW.menu_item_id := v_cocok[1];
    RETURN NEW;
  END IF;

  -- 2. Coba bersihkan variasi nama ojol
  v_clean := regexp_replace(v_nama, '^(suka\s+shawarma|suka)\s+', '', 'i');
  v_clean := regexp_replace(v_clean, '\s*\((1x|2x|3x|4x)\)\s*$', '', 'i');
  v_clean := regexp_replace(v_clean, '\s*-\s*(large|barbar)\s*$', '', 'i');
  v_clean := regexp_replace(v_clean, '\s+shawarma\s*$', '', 'i');
  v_clean := btrim(v_clean);

  IF v_clean <> '' THEN
    SELECT array_agg(m.id) INTO v_cocok
    FROM public.menu_items m
    LEFT JOIN public.categories c ON c.id = m.category_id
    WHERE (
        lower(btrim(m.name)) = v_clean
        OR lower(btrim(m.name)) = ('suka ' || v_clean)
      )
      AND COALESCE(c.name, '') <> 'Voucher Pamulang 10%'
      AND m.outlet_id IS NULL
      AND m.is_available = true;

    IF cardinality(v_cocok) = 1 THEN
      NEW.menu_item_id := v_cocok[1];
    END IF;
  END IF;

  RETURN NEW;
END $$;
