-- 20300254003500_manager_sales_broadcast_alerts.sql
-- Sistem Notifikasi Telegram untuk Area Manager (AM) dan Regional Manager (RM)
-- Tahap 4: Otomasi Laporan Omzet Terjadwal (Interval ~4 jam):
-- 1. Siang / Pasca Lunch Rush (15:00 WIB)
-- 2. Puncak Dinner Rush (19:30 WIB)
-- 3. Final Closing Harian (22:30 WIB)

CREATE OR REPLACE FUNCTION public.bot_manager_broadcast_omzet(p_sesi text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_sesi_label text;
  v_am record;
  v_rm record;
  v_outlet record;
  v_area_item record;
  v_am_omzet numeric;
  v_am_pcs bigint;
  v_am_target numeric;
  v_am_pct numeric;
  v_am_lines text[];
  v_reg_omzet numeric := 0;
  v_reg_pcs bigint := 0;
  v_reg_target numeric := 0;
  v_reg_pct numeric := 0;
  v_reg_lines text[];
  v_title text;
  v_body text;
  v_url text := 'https://manager.sukashawarma.com';
BEGIN
  IF p_sesi NOT IN ('siang', 'dinner', 'closing') THEN
    RAISE EXCEPTION 'Sesi omzet tidak valid: % (pilihan: siang, dinner, closing)', p_sesi;
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtext('bot-manager-omzet-' || p_sesi)) THEN
    RETURN;
  END IF;

  v_sesi_label := CASE p_sesi
    WHEN 'siang' THEN 'SIANG (15:00 WIB)'
    WHEN 'dinner' THEN 'DINNER RUSH (19:30 WIB)'
    WHEN 'closing' THEN 'FINAL CLOSING (22:30 WIB)'
  END;

  -- ─────────────────────────────────────────────────────────── 1. Laporan per Area (ke AM)
  FOR v_am IN
    SELECT s.id, s.name
    FROM public.outlet_staff s
    WHERE s.role = 'area_manager' AND s.status = 'active'
  LOOP
    v_am_omzet := 0;
    v_am_pcs := 0;
    v_am_target := 0;
    v_am_lines := '{}';

    FOR v_outlet IN
      SELECT 
        o.id,
        o.name,
        COALESCE(s.omzet, 0) AS outlet_omzet,
        COALESCE(s.total_pcs, 0) AS outlet_pcs,
        COALESCE(t.target_amount, 0) AS outlet_target,
        CASE WHEN COALESCE(t.target_amount, 0) > 0 
          THEN ROUND((COALESCE(s.omzet, 0) / t.target_amount) * 100, 1) 
          ELSE 0 END AS outlet_pct
      FROM public.staff_outlets so
      JOIN public.outlets o ON o.id = so.outlet_id
      CROSS JOIN LATERAL (
        SELECT
          COALESCE(SUM(ord.total_amount), 0) AS omzet,
          COALESCE(SUM(oi.quantity), 0) AS total_pcs
        FROM public.orders ord
        LEFT JOIN public.order_items oi ON oi.order_id = ord.id
        WHERE ord.outlet_id = o.id
          AND (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
          AND ord.status IN ('completed', 'selesai', 'paid')
      ) s
      CROSS JOIN LATERAL (
        SELECT COALESCE(
          (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id = o.id AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
          (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id IS NULL AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
          0
        ) AS target_amount
      ) t
      WHERE so.staff_id = v_am.id
        AND o.is_active IS TRUE
        AND COALESCE(o.type, '') NOT IN ('test', 'marketplace', 'system')
        AND o.name NOT ILIKE '%kantor pusat%'
        AND o.name NOT ILIKE '%gudang%'
      ORDER BY s.omzet DESC, o.name
    LOOP
      v_am_omzet := v_am_omzet + v_outlet.outlet_omzet;
      v_am_pcs := v_am_pcs + v_outlet.outlet_pcs;
      v_am_target := v_am_target + v_outlet.outlet_target;

      v_am_lines := array_append(
        v_am_lines,
        '• ' || v_outlet.name || ': Rp ' || to_char(v_outlet.outlet_omzet, 'FM999,999,999')
          || ' (' || v_outlet.outlet_pcs || ' pcs)'
          || CASE WHEN v_outlet.outlet_target > 0 THEN ' [' || v_outlet.outlet_pct || '%]' ELSE '' END
      );
    END LOOP;

    -- Jika AM memiliki cabang aktif
    IF COALESCE(cardinality(v_am_lines), 0) > 0 THEN
      v_am_pct := CASE WHEN v_am_target > 0 THEN ROUND((v_am_omzet / v_am_target) * 100, 1) ELSE 0 END;

      v_title := '📊 LAPORAN OMZET ' || v_sesi_label;
      v_body := 'Area: ' || v_am.name
        || E'\nTanggal: ' || to_char(v_today, 'DD-MM-YYYY')
        || E'\nTotal Omzet: Rp ' || to_char(v_am_omzet, 'FM999,999,999') || ' (' || v_am_pcs || ' pcs)'
        || (CASE WHEN v_am_target > 0 THEN E'\nCapaian Target: ' || v_am_pct || '% dari Rp ' || to_char(v_am_target, 'FM999,999,999') ELSE '' END)
        || E'\n\nPerforma Cabang Binaan:'
        || E'\n' || array_to_string(v_am_lines, E'\n')
        || (CASE 
            WHEN p_sesi = 'siang' AND v_am_pct < 40 THEN E'\n\n⚠️ Perhatian AM: Capaian siang masih di bawah 40%, mohon evaluasi jam operasional & stok cabang.'
            WHEN p_sesi = 'dinner' AND v_am_pct < 80 THEN E'\n\n⏳ Info AM: Masih butuh dorongan penjualan sebelum closing untuk mencapai target 100%.'
            WHEN p_sesi = 'closing' AND v_am_pct >= 100 THEN E'\n\n🎉 Selamat! Target area hari ini berhasil tercapai 100%.'
            ELSE '' END);

      PERFORM public.bot_manager_antrekan(
        'omzet_am:' || p_sesi || ':' || v_am.id || ':' || v_today,
        v_am.id,
        v_title,
        v_body,
        v_url
      );
    END IF;
  END LOOP;

  -- ─────────────────────────────────────────────────────────── 2. Laporan Eksekutif Regional (ke RM)
  v_reg_lines := '{}';

  FOR v_area_item IN
    SELECT 
      am.name AS am_name,
      COALESCE(SUM(s.omzet), 0) AS area_omzet,
      COALESCE(SUM(s.total_pcs), 0) AS area_pcs,
      COALESCE(SUM(t.target_amount), 0) AS area_target,
      CASE WHEN COALESCE(SUM(t.target_amount), 0) > 0 
        THEN ROUND((COALESCE(SUM(s.omzet), 0) / SUM(t.target_amount)) * 100, 1) 
        ELSE 0 END AS area_pct
    FROM public.outlet_staff am
    JOIN public.staff_outlets so ON so.staff_id = am.id
    JOIN public.outlets o ON o.id = so.outlet_id
    CROSS JOIN LATERAL (
      SELECT
        COALESCE(SUM(ord.total_amount), 0) AS omzet,
        COALESCE(SUM(oi.quantity), 0) AS total_pcs
      FROM public.orders ord
      LEFT JOIN public.order_items oi ON oi.order_id = ord.id
      WHERE ord.outlet_id = o.id
        AND (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
        AND ord.status IN ('completed', 'selesai', 'paid')
    ) s
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id = o.id AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
        (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id IS NULL AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
        0
      ) AS target_amount
    ) t
    WHERE am.role = 'area_manager' AND am.status = 'active'
      AND o.is_active IS TRUE
      AND COALESCE(o.type, '') NOT IN ('test', 'marketplace', 'system')
      AND o.name NOT ILIKE '%kantor pusat%'
      AND o.name NOT ILIKE '%gudang%'
    GROUP BY am.id, am.name
    ORDER BY area_omzet DESC
  LOOP
    v_reg_omzet := v_reg_omzet + v_area_item.area_omzet;
    v_reg_pcs := v_reg_pcs + v_area_item.area_pcs;
    v_reg_target := v_reg_target + v_area_item.area_target;

    v_reg_lines := array_append(
      v_reg_lines,
      '• Area ' || v_area_item.am_name || ': Rp ' || to_char(v_area_item.area_omzet, 'FM999,999,999')
        || ' (' || v_area_item.area_pcs || ' pcs)'
        || CASE WHEN v_area_item.area_target > 0 THEN ' [' || v_area_item.area_pct || '%]' ELSE '' END
    );
  END LOOP;

  IF COALESCE(cardinality(v_reg_lines), 0) > 0 THEN
    v_reg_pct := CASE WHEN v_reg_target > 0 THEN ROUND((v_reg_omzet / v_reg_target) * 100, 1) ELSE 0 END;

    v_title := '📈 EXECUTIVE SUMMARY REGIONAL ' || v_sesi_label;
    v_body := 'Wilayah: Seluruh Regional Operasional'
      || E'\nTanggal: ' || to_char(v_today, 'DD-MM-YYYY')
      || E'\nTotal Omzet: Rp ' || to_char(v_reg_omzet, 'FM999,999,999') || ' (' || v_reg_pcs || ' pcs)'
      || (CASE WHEN v_reg_target > 0 THEN E'\nCapaian Target: ' || v_reg_pct || '% dari Rp ' || to_char(v_reg_target, 'FM999,999,999') ELSE '' END)
      || E'\n\nPerforma Antar Area:'
      || E'\n' || array_to_string(v_reg_lines, E'\n');

    FOR v_rm IN
      SELECT s.id, s.name
      FROM public.outlet_staff s
      WHERE s.role = 'regional_manager' AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        'omzet_rm:' || p_sesi || ':' || v_rm.id || ':' || v_today,
        v_rm.id,
        v_title,
        v_body,
        v_url
      );
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_manager_broadcast_omzet(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_manager_broadcast_omzet(text) TO service_role;

-- ─────────────────────────────────────────────────────────── 3. Schedules (pg_cron)
-- pg_cron berjalan dalam UTC (WIB = UTC+7)
-- 1. Siang: 15:00 WIB = 08:00 UTC
SELECT cron.schedule('bot-manager-omzet-siang', '0 8 * * *', $$SELECT public.bot_manager_broadcast_omzet('siang');$$);
-- 2. Dinner Rush: 19:30 WIB = 12:30 UTC
SELECT cron.schedule('bot-manager-omzet-dinner', '30 12 * * *', $$SELECT public.bot_manager_broadcast_omzet('dinner');$$);
-- 3. Final Closing: 22:30 WIB = 15:30 UTC
SELECT cron.schedule('bot-manager-omzet-closing', '30 15 * * *', $$SELECT public.bot_manager_broadcast_omzet('closing');$$);
