-- 20300254003200_manager_telegram_alerts.sql
-- Sistem Notifikasi Telegram untuk Area Manager (AM) dan Regional Manager (RM)
-- Tahap 1:
-- 1. Alert Keterlambatan Buka Outlet (+5 Menit lewat jam operasional)
-- 2. Alert Selisih Kas Closing Shift Kasir (AM: > Rp 20.000, RM Eskalasi: > Rp 100.000)

-- ─────────────────────────────────────────────────────────── 1. Outbox Table
CREATE TABLE IF NOT EXISTS public.bot_manager_alert_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key text NOT NULL,
  staff_id uuid NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id bigint,
  attempted_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','delivered','skipped','failed')),
  UNIQUE (event_key, staff_id)
);

ALTER TABLE public.bot_manager_alert_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_manager_alert_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.bot_manager_alert_outbox TO service_role;
CREATE INDEX IF NOT EXISTS idx_bot_manager_alert_pending 
  ON public.bot_manager_alert_outbox(created_at) WHERE outcome = 'pending';

-- ─────────────────────────────────────────────────────────── 2. Antrekan Helper
CREATE OR REPLACE FUNCTION public.bot_manager_antrekan(
  p_key text,
  p_staff_id uuid,
  p_title text,
  p_body text,
  p_url text DEFAULT NULL
)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.bot_manager_alert_outbox(event_key, staff_id, title, body, url)
  SELECT p_key, s.id, left(p_title, 180), left(p_body, 1200), p_url
  FROM public.outlet_staff s
  JOIN public.bot_telegram_links l ON l.staff_id = s.id
  WHERE s.id = p_staff_id
    AND s.status = 'active'
    AND s.role IN ('area_manager', 'regional_manager', 'developer')
    AND l.chat_id IS NOT NULL
  ON CONFLICT (event_key, staff_id) DO NOTHING;
$$;

-- ─────────────────────────────────────────────────────────── 3. Alert Selisih Kas Closing
CREATE OR REPLACE FUNCTION public.bot_manager_alert_selisih_kas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_laci_var numeric;
  v_petty_var numeric;
  v_max_var numeric;
  v_outlet_name text;
  v_staff_name text;
  v_title text;
  v_body text;
  v_url text;
  v_am record;
  v_rm record;
BEGIN
  IF OLD.status <> 'open' OR NEW.status <> 'closed' THEN
    RETURN NEW;
  END IF;

  v_laci_var := COALESCE(NEW.variance, 0);
  v_petty_var := COALESCE(NEW.petty_cash_variance, 0);
  v_max_var := GREATEST(ABS(v_laci_var), ABS(v_petty_var));

  -- Ambang batas minimal selisih kas Rp 20.000
  IF v_max_var <= 20000 THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;
  SELECT name INTO v_staff_name FROM public.outlet_staff WHERE id = COALESCE(NEW.closed_by, NEW.staff_id);

  v_title := CASE 
    WHEN v_max_var > 100000 THEN '🚨 Alert Selisih Kas Kritis (> Rp 100rb)'
    ELSE '⚠️ Peringatan Selisih Kas Closing'
  END;

  v_body := 'Outlet: ' || COALESCE(v_outlet_name, 'Outlet')
    || E'\nKasir: ' || COALESCE(v_staff_name, '-')
    || E'\nWaktu Closing: ' || to_char(COALESCE(NEW.end_time, now()) AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') || ' WIB'
    || E'\nSelisih Laci: ' || CASE WHEN v_laci_var >= 0 THEN '+' ELSE '' END || to_char(v_laci_var, 'FM999,999,999')
    || (CASE WHEN NEW.petty_cash_variance IS NOT NULL 
        THEN E'\nSelisih Petty Cash: ' || CASE WHEN v_petty_var >= 0 THEN '+' ELSE '' END || to_char(v_petty_var, 'FM999,999,999')
        ELSE '' END)
    || (CASE WHEN NEW.notes IS NOT NULL AND btrim(NEW.notes) <> '' 
        THEN E'\nCatatan: ' || left(btrim(NEW.notes), 200)
        ELSE '' END);

  v_url := 'https://manager.sukashawarma.com/transactions';

  -- Kirim ke Area Manager (AM) pengawas outlet terkait
  FOR v_am IN 
    SELECT so.staff_id 
    FROM public.staff_outlets so
    JOIN public.outlet_staff s ON s.id = so.staff_id
    WHERE so.outlet_id = NEW.outlet_id 
      AND s.role = 'area_manager' 
      AND s.status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      'selisih_kas:' || NEW.id,
      v_am.staff_id,
      v_title,
      v_body,
      v_url
    );
  END LOOP;

  -- Jika selisih kas > Rp 100.000, eskalasi ke seluruh Regional Manager aktif
  IF v_max_var > 100000 THEN
    FOR v_rm IN 
      SELECT s.id AS staff_id 
      FROM public.outlet_staff s
      WHERE s.role = 'regional_manager' 
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        'selisih_kas_rm:' || NEW.id,
        v_rm.staff_id,
        '🚨 [ESKALASI REGIONAL] ' || v_title,
        v_body || E'\n\nPerhatian RM: Selisih kas melewati batas toleransi Rp 100.000.',
        v_url
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal memproses alert selisih kas manager: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_manager_selisih_kas ON public.shifts;
CREATE TRIGGER trg_bot_manager_selisih_kas
  AFTER UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.bot_manager_alert_selisih_kas();

-- ─────────────────────────────────────────────────────────── 4. Alert Outlet Telat Buka (+5 Menit)
CREATE OR REPLACE FUNCTION public.bot_manager_cek_outlet_telat_buka()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_now_time time := (now() AT TIME ZONE 'Asia/Jakarta')::time;
  r record;
  v_am record;
  v_rm record;
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
      COALESCE(s.jam_masuk, c.jam_masuk, '10:00:00'::time) AS jam_buka
    FROM public.outlets o
    LEFT JOIN public.outlet_attendance_shift s ON s.outlet_id = o.id AND s.urutan = 1
    LEFT JOIN public.outlet_attendance_config c ON c.outlet_id = o.id
    WHERE o.is_active IS TRUE
      AND COALESCE(o.type, '') NOT IN ('test', 'marketplace', 'system')
      AND o.name NOT ILIKE '%kantor pusat%'
      AND o.name NOT ILIKE '%gudang%'
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

    -- Jika sampai di sini, outlet belum buka shift dan belum ada kru absen (+5 menit lewat jam buka)
    v_body := 'Outlet: ' || r.name
      || E'\nJam Buka Jadwal: ' || to_char(r.jam_buka, 'HH24:MI') || ' WIB'
      || E'\nStatus: Belum open shift kasir & belum ada absensi kru.'
      || E'\nWaktu Deteksi: ' || to_char(v_now_time, 'HH24:MI') || ' WIB'
      || E'\n\nSegera hubungi kru outlet untuk konfirmasi kendala operasional cabang!';

    -- Kirim alert ke Area Manager (AM) binaan
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

    -- Eskalasi ke Regional Manager jika sudah telat >= 30 menit
    v_is_late_30m := (v_now_time >= (r.jam_buka + interval '30 minutes'));
    IF v_is_late_30m THEN
      FOR v_rm IN
        SELECT st.id AS staff_id
        FROM public.outlet_staff st
        WHERE st.role = 'regional_manager'
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
    END IF;

  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────── 5. Delivery Dispatcher
CREATE OR REPLACE FUNCTION public.bot_manager_kirim_antrean()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_url text;
  v_secret text;
  v_request bigint;
  r record;
  v_response record;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-manager-delivery')) THEN
    RETURN;
  END IF;

  -- Cari endpoint telegram_manager_send_url, fallback ke telegram_stokist_send_url
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'telegram_manager_send_url' LIMIT 1;
  IF coalesce(v_url, '') = '' THEN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'telegram_stokist_send_url' LIMIT 1;
    IF coalesce(v_url, '') <> '' THEN
      v_url := regexp_replace(v_url, '/api/telegram/send.*', '/api/telegram/manager/send');
    END IF;
  END IF;

  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'telegram_manager_send_secret' LIMIT 1;
  IF coalesce(v_secret, '') = '' THEN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'telegram_stokist_send_secret' LIMIT 1;
  END IF;

  IF coalesce(v_url, '') = '' OR coalesce(v_secret, '') = '' THEN
    RETURN;
  END IF;

  FOR r IN 
    SELECT * FROM public.bot_manager_alert_outbox 
    WHERE outcome = 'pending'
      AND (attempts = 0 OR request_id IS NOT NULL OR attempted_at <= now() - interval '15 minutes')
    ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED 
  LOOP
    -- Cek otorisasi staf saat pengiriman (jika status dinonaktifkan, skip)
    IF NOT EXISTS (
      SELECT 1 FROM public.outlet_staff s
      JOIN public.bot_telegram_links l ON l.staff_id = s.id
      WHERE s.id = r.staff_id 
        AND s.role IN ('area_manager', 'regional_manager', 'developer') 
        AND s.status = 'active' 
        AND l.chat_id IS NOT NULL
    ) THEN
      UPDATE public.bot_manager_alert_outbox SET outcome = 'skipped' WHERE id = r.id;
      CONTINUE;
    END IF;

    -- Evaluasi respons HTTP sebelumnya jika ada request_id
    IF r.request_id IS NOT NULL THEN
      SELECT status_code, content INTO v_response FROM net._http_response WHERE id = r.request_id;
      IF FOUND THEN
        IF v_response.status_code = 200 AND v_response.content IS JSON OBJECT
          AND v_response.content::jsonb->>'delivered' = 'true' THEN
          UPDATE public.bot_manager_alert_outbox SET outcome = 'delivered' WHERE id = r.id;
          CONTINUE;
        ELSIF v_response.status_code = 200 AND v_response.content IS JSON OBJECT
          AND v_response.content::jsonb->>'reason' = 'not_eligible' THEN
          UPDATE public.bot_manager_alert_outbox SET outcome = 'skipped' WHERE id = r.id;
          CONTINUE;
        END IF;
        UPDATE public.bot_manager_alert_outbox SET request_id = NULL WHERE id = r.id;
      ELSIF r.attempted_at > now() - interval '2 minutes' THEN
        CONTINUE;
      END IF;
    END IF;

    IF r.attempts >= 3 THEN
      UPDATE public.bot_manager_alert_outbox SET outcome = 'failed' WHERE id = r.id;
      CONTINUE;
    END IF;

    IF r.attempted_at > now() - interval '15 minutes' THEN 
      CONTINUE; 
    END IF;

    BEGIN
      v_request := net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Accept', 'application/json',
          'User-Agent', 'SukaShawarma-Manager-Alerts/1.0',
          'Authorization', 'Bearer ' || v_secret
        ),
        body := jsonb_build_object(
          'user_id', r.staff_id,
          'title', r.title,
          'body', r.body,
          'url', r.url
        ),
        timeout_milliseconds := 15000
      );
      UPDATE public.bot_manager_alert_outbox 
      SET request_id = v_request, attempted_at = now(), attempts = attempts + 1 
      WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.bot_manager_alert_outbox 
      SET request_id = NULL, attempted_at = now(), attempts = attempts + 1 
      WHERE id = r.id;
    END;
  END LOOP;

  -- Bersihkan log pengiriman lama setelah 90 hari
  DELETE FROM public.bot_manager_alert_outbox 
  WHERE created_at < now() - interval '90 days' AND outcome <> 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.bot_manager_antrekan(text, uuid, text, text, text),
  public.bot_manager_alert_selisih_kas(),
  public.bot_manager_cek_outlet_telat_buka(),
  public.bot_manager_kirim_antrean() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bot_manager_cek_outlet_telat_buka(),
  public.bot_manager_kirim_antrean() TO service_role;

-- ─────────────────────────────────────────────────────────── 6. Schedules (pg_cron)
-- pg_cron berjalan dalam UTC.
-- bot-manager-cek-telat-buka: cek tiap 5 menit pada jam 01:00-06:00 UTC (08:00-13:00 WIB)
SELECT cron.schedule('bot-manager-cek-telat-buka', '*/5 1-6 * * *', 'SELECT public.bot_manager_cek_outlet_telat_buka();');
-- bot-manager-delivery: proses antrean pesan tiap menit
SELECT cron.schedule('bot-manager-delivery', '* * * * *', 'SELECT public.bot_manager_kirim_antrean();');
