-- Owner Dashboard: HPP per item diambil dari HPP yang berlaku pada tanggal order (menu_hpp_pada).
-- Aturan HPP TIDAK diubah: hpp_override > 0, selain itu paket = Σ hpp_override komponen, selain itu 0;
-- outlet mitra ROUND(×1,1). channel_hpp tetap TIDAK dipakai di sini (sama seperti sebelumnya).
-- Pasangan (menu, tanggal) dikumpulkan dulu, baru diberi HPP — jangan panggil menu_hpp_pada per baris item.
-- ⚠️ Fungsi yang sama juga didefinisikan 20300116000000 (terurut SETELAH berkas ini). Lihat spec §6.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_owner_dashboard_summary(p_from timestamp with time zone, p_to timestamp with time zone, p_outlet_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'all'::text, p_test_outlet_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
  v_user_role TEXT;
  v_has_full_access BOOLEAN := FALSE;
  v_mitra_outlet_ids UUID[];
BEGIN
  -- 1. Cek hak akses pemanggil secara efisien
  IF auth.uid() IS NULL THEN
    v_has_full_access := TRUE;
  ELSE
    SELECT role INTO v_user_role
    FROM public.outlet_staff
    WHERE id = auth.uid();

    IF v_user_role IN ('admin', 'admin_hr', 'owner', 'spv', 'kitchen') THEN
      v_has_full_access := TRUE;
    END IF;
  END IF;

  -- 2. Ambil daftar ID outlet mitra sekaligus (hanya ~10 baris, hindari repeated join)
  SELECT COALESCE(array_agg(id), '{}') INTO v_mitra_outlet_ids
  FROM public.outlets
  WHERE type = 'mitra';

  WITH
  -- 4. Filtered orders (fast-path inlining untuk deteksi sumber penjualan & index bypass)
  ord AS (
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
      SUM(o.total_amount) AS omzet,
      COUNT(*) AS order_count,
      COALESCE(SUM(ot.total_quantity), 0) AS total_qty,
      SUM(
        CASE
          WHEN ot.total_subtotal IS NULL
            THEN COALESCE(o.discount_amount, 0) + COALESCE(o.promo_subsidy, 0)
          ELSE GREATEST(0, ot.total_subtotal - COALESCE(o.total_amount, 0))
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

  -- 11. OPEX aggregation
  opex_agg AS (
    SELECT
      COALESCE((
        SELECT SUM(e.amount)
        FROM public.expenses e
        WHERE e.expense_date >= (p_from AT TIME ZONE 'Asia/Jakarta')::date
          AND e.expense_date <= (p_to   AT TIME ZONE 'Asia/Jakarta')::date
          AND (v_has_full_access OR e.outlet_id IN (SELECT accessible_outlet_ids()))
          AND (p_test_outlet_id IS NULL OR e.outlet_id <> p_test_outlet_id)
          AND (p_outlet_id IS NULL OR e.outlet_id = p_outlet_id)
      ), 0) +
      COALESCE((
        SELECT SUM(pce.amount)
        FROM public.petty_cash_expenses pce
        WHERE pce.expense_date >= (p_from AT TIME ZONE 'Asia/Jakarta')::date
          AND pce.expense_date <= (p_to   AT TIME ZONE 'Asia/Jakarta')::date
          AND (v_has_full_access OR pce.outlet_id IN (SELECT accessible_outlet_ids()))
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

COMMIT;
