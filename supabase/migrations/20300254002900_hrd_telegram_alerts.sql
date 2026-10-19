-- HRD alerts: advisory only; never change attendance, leave decisions or payroll.
-- Canonical HR role is admin_hr (called admin_hrd in the product discussion).
CREATE TABLE public.bot_hrd_alert_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key text NOT NULL,
  staff_id uuid NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id bigint,
  attempted_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','delivered','skipped','failed')),
  UNIQUE (event_key, staff_id)
);
ALTER TABLE public.bot_hrd_alert_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_hrd_alert_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.bot_hrd_alert_outbox TO service_role;
CREATE INDEX bot_hrd_alert_pending ON public.bot_hrd_alert_outbox(created_at) WHERE outcome = 'pending';

CREATE FUNCTION public.bot_hrd_antrekan(p_key text, p_title text, p_body text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.bot_hrd_alert_outbox(event_key,staff_id,title,body)
  SELECT p_key,s.id,left(p_title,180),left(p_body,1200)
  FROM public.outlet_staff s
  JOIN public.hermes_bot_user_access a ON a.staff_id=s.id AND a.bot_slug='hrd'
  JOIN public.bot_telegram_links l ON l.staff_id=s.id
  WHERE s.role='admin_hr' AND s.status='active' AND l.chat_id IS NOT NULL
  ON CONFLICT (event_key,staff_id) DO NOTHING;
$$;

CREATE FUNCTION public.bot_hrd_alert_telat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_outlet text;
BEGIN
  -- Current-day events only: installing the feature or correcting old records
  -- must not notify HR about a historical backlog. Use canonical shift-aware
  -- lateness, including telat_toleransi if the outlet tolerance exceeds 15.
  IF NEW.sumber <> 'absen' OR NEW.clock_in IS NULL OR NEW.telat_menit <= 15
    OR NEW.tgl <> (now() AT TIME ZONE 'Asia/Jakarta')::date THEN RETURN NEW; END IF;
  SELECT s.name,o.name INTO v_name,v_outlet
  FROM public.outlet_staff s JOIN public.outlets o ON o.id=NEW.outlet_id
  WHERE s.id=NEW.staff_id AND s.status='active'
    AND coalesce(s.account_category,'employee')='employee'
    AND s.role NOT IN ('owner','developer','kiosk','mitra')
    AND o.is_active IS TRUE AND coalesce(o.type,'') NOT IN ('test','marketplace');
  IF v_name IS NULL THEN RETURN NEW; END IF;
  PERFORM public.bot_hrd_antrekan(
    'telat:'||NEW.staff_id||':'||NEW.outlet_id||':'||NEW.tgl,
    '⚠️ Keterlambatan lebih dari 15 menit',
    'Karyawan: '||left(v_name,120)||E'\nOutlet: '||left(v_outlet,100)
      ||E'\nTanggal: '||to_char(NEW.tgl,'DD-MM-YYYY')
      ||E'\nCheck-in: '||to_char(NEW.clock_in AT TIME ZONE 'Asia/Jakarta','HH24:MI')||' WIB'
      ||E'\nKeterlambatan: '||NEW.telat_menit||' menit'
      ||E'\nTindak lanjut HRD: konfirmasi alasan keterlambatan dan catat hasilnya di HR.');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal mengantrekan alert HRD: %', SQLSTATE;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_bot_hrd_telat AFTER INSERT OR UPDATE ON public.attendance_harian
  FOR EACH ROW EXECUTE FUNCTION public.bot_hrd_alert_telat();

CREATE FUNCTION public.bot_hrd_rekap_harian()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_incomplete integer; v_alpha integer; v_leave integer; v_contract integer;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-hrd-daily')) THEN RETURN; END IF;
  -- Derive absence from the existing HR engine, which excludes holidays,
  -- approved leave and dates before employment; never infer it from missing rows.
  PERFORM public.hr_hitung_status_nonabsen(v_today-1);
  SELECT count(*) FILTER (WHERE h.sumber='absen' AND (h.clock_in IS NULL OR h.clock_out IS NULL)),
         count(*) FILTER (WHERE h.status='alfa')
    INTO v_incomplete,v_alpha
  FROM public.attendance_harian h
  JOIN public.outlet_staff s ON s.id=h.staff_id
  JOIN public.outlets o ON o.id=h.outlet_id
  WHERE h.tgl=v_today-1 AND s.status='active'
    AND coalesce(s.account_category,'employee')='employee'
    AND s.role NOT IN ('owner','developer','kiosk','mitra')
    AND o.is_active IS TRUE AND coalesce(o.type,'') NOT IN ('test','marketplace');
  SELECT count(*) INTO v_leave FROM public.leave_requests l
  JOIN public.outlet_staff s ON s.id=l.staff_id
  WHERE l.status='pending' AND l.created_at < now()-interval '24 hours'
    AND s.status='active' AND coalesce(s.account_category,'employee')='employee'
    AND s.role NOT IN ('owner','developer','kiosk','mitra');
  -- HR's contract screen currently uses resign_date as contract end_date.
  SELECT count(*) INTO v_contract FROM public.outlet_staff s
  WHERE s.status='active' AND coalesce(s.account_category,'employee')='employee'
    AND s.role NOT IN ('owner','developer','kiosk','mitra')
    AND s.contract_type='contract' AND s.resign_date BETWEEN v_today AND v_today+60;
  IF v_incomplete+v_alpha+v_leave+v_contract=0 THEN RETURN; END IF;
  PERFORM public.bot_hrd_antrekan('rekap:'||v_today,'📋 Pemeriksaan harian HRD',
    'Absensi '||to_char(v_today-1,'DD-MM-YYYY')||E':\n• Tidak lengkap: '||v_incomplete
      ||E'\n• Alfa tercatat: '||v_alpha
      ||E'\nPengajuan izin/cuti tertunda >24 jam: '||v_leave
      ||E'\nKontrak berakhir dalam 60 hari: '||v_contract
      ||E'\nPeriksa absensi: https://hr.sukashawarma.com/attendance'
      ||E'\nIzin/cuti: https://hr.sukashawarma.com/leave'
      ||E'\nKontrak: https://hr.sukashawarma.com/contracts'
      ||E'\nKonfirmasi temuan sebelum mengoreksi data atau menghubungi karyawan.');
END;
$$;

CREATE FUNCTION public.bot_hrd_kirim_antrean()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_url text; v_secret text; v_request bigint; r record; v_response record;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-hrd-delivery')) THEN RETURN; END IF;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name='telegram_hrd_send_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='telegram_hrd_send_secret' LIMIT 1;
  IF coalesce(v_url,'')='' OR coalesce(v_secret,'')='' THEN RETURN; END IF;
  FOR r IN SELECT * FROM public.bot_hrd_alert_outbox WHERE outcome='pending'
    AND (attempts=0 OR request_id IS NOT NULL OR attempted_at<=now()-interval '15 minutes')
    ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED LOOP
    -- A correction may resolve lateness while delivery is waiting. Check the
    -- latest daily row before sending the original snapshot to HR.
    IF r.event_key LIKE 'telat:%' AND NOT EXISTS (
      SELECT 1 FROM public.attendance_harian h
      WHERE h.staff_id=split_part(r.event_key,':',2)::uuid
        AND h.outlet_id=split_part(r.event_key,':',3)::uuid
        AND h.tgl=split_part(r.event_key,':',4)::date
        AND h.sumber='absen' AND h.clock_in IS NOT NULL AND h.telat_menit>15
    ) THEN
      UPDATE public.bot_hrd_alert_outbox SET outcome='skipped' WHERE id=r.id;
      CONTINUE;
    END IF;
    -- Recheck authorization at send time; revoked access must take effect even
    -- when the alert was queued earlier. The endpoint checks it once more.
    IF NOT EXISTS (
      SELECT 1 FROM public.outlet_staff s
      JOIN public.hermes_bot_user_access a ON a.staff_id=s.id AND a.bot_slug='hrd'
      JOIN public.bot_telegram_links l ON l.staff_id=s.id
      WHERE s.id=r.staff_id AND s.role='admin_hr' AND s.status='active' AND l.chat_id IS NOT NULL
    ) THEN
      UPDATE public.bot_hrd_alert_outbox SET outcome='skipped' WHERE id=r.id;
      CONTINUE;
    END IF;
    IF r.request_id IS NOT NULL THEN
      SELECT status_code,content INTO v_response FROM net._http_response WHERE id=r.request_id;
      IF FOUND THEN
        IF v_response.status_code=200 AND v_response.content IS JSON OBJECT
          AND v_response.content::jsonb->>'delivered'='true' THEN
          UPDATE public.bot_hrd_alert_outbox SET outcome='delivered' WHERE id=r.id;
          CONTINUE;
        ELSIF v_response.status_code=200 AND v_response.content IS JSON OBJECT
          AND v_response.content::jsonb->>'reason'='not_eligible' THEN
          UPDATE public.bot_hrd_alert_outbox SET outcome='skipped' WHERE id=r.id;
          CONTINUE;
        END IF;
        UPDATE public.bot_hrd_alert_outbox SET request_id=NULL WHERE id=r.id;
      ELSIF r.attempted_at > now()-interval '2 minutes' THEN CONTINUE;
      END IF;
    END IF;
    IF r.attempts>=3 THEN
      UPDATE public.bot_hrd_alert_outbox SET outcome='failed' WHERE id=r.id;
      CONTINUE;
    END IF;
    IF r.attempted_at > now()-interval '15 minutes' THEN CONTINUE; END IF;
    BEGIN
      v_request := net.http_post(url:=v_url,
        headers:=jsonb_build_object('Content-Type','application/json','Accept','application/json',
          'User-Agent','SukaShawarma-HRD-Alerts/1.0','Authorization','Bearer '||v_secret),
        body:=jsonb_build_object('user_id',r.staff_id,'title',r.title,'body',r.body),
        timeout_milliseconds:=15000);
      UPDATE public.bot_hrd_alert_outbox SET request_id=v_request,attempted_at=now(),attempts=attempts+1 WHERE id=r.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.bot_hrd_alert_outbox SET request_id=NULL,attempted_at=now(),attempts=attempts+1 WHERE id=r.id;
    END;
  END LOOP;
  -- Retain recent delivery evidence; cap growth without exposing HR messages.
  DELETE FROM public.bot_hrd_alert_outbox WHERE created_at < now()-interval '90 days' AND outcome<>'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.bot_hrd_antrekan(text,text,text), public.bot_hrd_alert_telat(),
  public.bot_hrd_rekap_harian(), public.bot_hrd_kirim_antrean() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_hrd_rekap_harian(), public.bot_hrd_kirim_antrean() TO service_role;

-- pg_cron runs in UTC: 02:00 UTC = 09:00 WIB (operational timezone).
SELECT cron.schedule('bot-hrd-daily','0 2 * * *','SELECT public.bot_hrd_rekap_harian()');
SELECT cron.schedule('bot-hrd-delivery','* * * * *','SELECT public.bot_hrd_kirim_antrean()');
