-- Migration: 20300254005400_fix_outlet_jam_buka_schedule.sql
-- Description: Perbaikan jadwal jam buka outlet pada bot_manager_cek_outlet_telat_buka
-- Menggunakan kolom outlets.open_hour (default 14:00 WIB untuk outlet ritel) bukan hardcoded 10:00 WIB.

CREATE OR REPLACE FUNCTION public.bot_manager_cek_outlet_telat_buka()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_now_time time := (now() AT TIME ZONE 'Asia/Jakarta')::time;
  r record;
  v_am record;
  v_rm record;
  v_ceo record;
  v_is_late boolean;
  v_is_late_30m boolean;
  v_body text;
  v_url text := 'https://manager.sukashawarma.com';
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-manager-telat-buka')) THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT 
      o.id,
      o.name,
      COALESCE(o.open_hour, '14:00:00'::time) AS jam_buka
    FROM public.outlets o
    WHERE o.is_active IS TRUE
      AND COALESCE(o.type, '') NOT IN ('test', 'marketplace', 'office', 'gudang', 'warehouse', 'kitchen', 'system')
      AND o.name NOT ILIKE '%kantor pusat%'
      AND o.name NOT ILIKE '%gudang%'
      AND o.name NOT ILIKE '%backup%'
      AND o.name NOT ILIKE '%tes%'
      AND o.name NOT ILIKE '%trial%'
      AND o.name NOT ILIKE '%demo%'
      AND COALESCE(o.slug, '') NOT IN ('ss-backup')
  LOOP
    -- Cek jendela waktu: sudah lewat jam buka + 5 menit dan belum lewat jam buka + 3 jam
    v_is_late := (v_now_time >= (r.jam_buka + interval '5 minutes'))
             AND (v_now_time <= (r.jam_buka + interval '3 hours'));
             
    IF NOT v_is_late THEN
      CONTINUE;
    END IF;

    -- Periksa apakah outlet sudah buka shift kasir hari ini
    IF EXISTS (
      SELECT 1 FROM public.shifts sh
      WHERE sh.outlet_id = r.id
        AND (sh.start_time AT TIME ZONE 'Asia/Jakarta')::date = v_today
    ) THEN
      CONTINUE;
    END IF;

    -- Periksa apakah kru sudah ada yang absen masuk (clock-in) hari ini
    IF EXISTS (
      SELECT 1 FROM public.attendance a
      WHERE a.outlet_id = r.id
        AND (a.ts_server AT TIME ZONE 'Asia/Jakarta')::date = v_today
        AND a.status != 'alpha'
    ) THEN
      CONTINUE;
    END IF;

    -- Outlet belum buka shift dan belum ada kru absen (+5 menit lewat jam buka)
    v_body := 'Outlet: ' || r.name
      || E'\nJam Buka Jadwal: ' || to_char(r.jam_buka, 'HH24:MI') || ' WIB'
      || E'\nStatus: Belum open shift kasir & belum ada absensi kru.'
      || E'\nWaktu Deteksi: ' || to_char(v_now_time, 'HH24:MI') || ' WIB'
      || E'\n\nSegera hubungi kru outlet untuk konfirmasi kendala operasional cabang!';

    -- A. Kirim alert ke Area Manager (AM) binaan (+5 Menit)
    FOR v_am IN
      SELECT so.staff_id
      FROM public.staff_outlets so
      JOIN public.outlet_staff st ON st.id = so.staff_id
      WHERE so.outlet_id = r.id
        AND st.role = 'area_manager'
        AND st.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        'telat_buka:' || r.id || ':' || v_today,
        v_am.staff_id,
        '🚨 ALERT: OUTLET TELAT BUKA (+5 Menit)',
        v_body,
        v_url
      );
    END LOOP;

    -- B. Eskalasi ke Regional Manager jika sudah telat >= 30 menit
    v_is_late_30m := (v_now_time >= (r.jam_buka + interval '30 minutes'));
    IF v_is_late_30m THEN
      FOR v_rm IN
        SELECT st.id AS staff_id
        FROM public.outlet_staff st
        WHERE st.role IN ('regional_manager', 'developer')
          AND st.status = 'active'
      LOOP
        PERFORM public.bot_manager_antrekan(
          'telat_buka_rm:' || r.id || ':' || v_today,
          v_rm.staff_id,
          '🚨 [ESKALASI RM] OUTLET TELAT BUKA > 30 MENIT',
          'Perhatian RM: Outlet belum beroperasi setelah 30 menit dari jadwal.'
            || E'\n' || v_body,
          v_url
        );
      END LOOP;

      -- C. Eskalasi ke Bot CEO (Owner / Admin / Developer) jika sudah telat >= 30 menit
      FOR v_ceo IN
        SELECT st.id AS staff_id
        FROM public.outlet_staff st
        WHERE st.role IN ('owner', 'admin', 'developer')
          AND st.status = 'active'
      LOOP
        PERFORM public.bot_ceo_antrekan(
          'telat_buka_ceo:' || r.id || ':' || v_today,
          v_ceo.staff_id,
          '🚨 [ESKALASI CEO] OUTLET TELAT BUKA > 30 MENIT — ' || r.name,
          'Peringatan Eksekutif: Cabang belum beroperasi setelah 30 menit dari jam buka resmi.'
            || E'\nOutlet: ' || r.name
            || E'\nJadwal Buka: ' || to_char(r.jam_buka, 'HH24:MI') || ' WIB'
            || E'\nWaktu Deteksi: ' || to_char(v_now_time, 'HH24:MI') || ' WIB'
            || E'\nStatus: Kasir belum buka shift & belum ada kru absen.'
            || E'\n\nNotifikasi otomatis diteruskan ke jajaran Direksi.',
          'https://admin.sukashawarma.com'
        );
      END LOOP;
    END IF;

  END LOOP;
END;
$function$;

-- Hapus alert false alarm telat buka yang terkirim hari ini akibat kesalahan default 10:00 WIB
-- agar saat jam 14:00 nanti jika ada cabang yang benar-benar telat tetap bisa terdeteksi
DELETE FROM public.bot_manager_alert_outbox
WHERE event_key LIKE 'telat_buka%:' || (now() AT TIME ZONE 'Asia/Jakarta')::date::text;

DELETE FROM public.bot_ceo_alert_outbox
WHERE event_key LIKE 'telat_buka%:' || (now() AT TIME ZONE 'Asia/Jakarta')::date::text;

DELETE FROM public.bot_app_notifications
WHERE event_key LIKE 'telat_buka%:' || (now() AT TIME ZONE 'Asia/Jakarta')::date::text;
