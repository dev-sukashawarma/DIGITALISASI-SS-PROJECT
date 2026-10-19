-- 20300254004300_hrd_leave_and_cash_advance_alerts.sql
-- Alert Telegram Bot HRD: Pengajuan Cuti/Izin Baru, Pengajuan Kasbon Baru,
-- dan penambahan hitungan kasbon pending pada Rekap Harian 09:00 WIB.

SET lock_timeout = '10s';

-- 1. Trigger Alert Pengajuan Cuti/Izin Baru
CREATE OR REPLACE FUNCTION public.bot_hrd_alert_cuti()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_outlet text;
  v_jenis text;
  v_periode text;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' THEN RETURN NEW; END IF;

  SELECT s.name, coalesce(o.name, 'Kantor Pusat') INTO v_name, v_outlet
  FROM public.outlet_staff s
  LEFT JOIN public.outlets o ON o.id = s.outlet_id
  WHERE s.id = NEW.staff_id AND s.status = 'active'
    AND coalesce(s.account_category, 'employee') = 'employee'
    AND s.role NOT IN ('owner', 'developer', 'kiosk', 'mitra');

  IF v_name IS NULL THEN RETURN NEW; END IF;

  v_jenis := CASE NEW.leave_type
    WHEN 'annual' THEN 'Cuti Tahunan'
    WHEN 'sick' THEN 'Sakit'
    WHEN 'personal' THEN 'Izin Pribadi'
    WHEN 'maternity' THEN 'Cuti Melahirkan'
    ELSE coalesce(initcap(NEW.leave_type), 'Izin/Cuti')
  END;

  v_periode := to_char(NEW.start_date, 'DD-MM-YYYY')
    || (CASE WHEN NEW.start_date <> NEW.end_date THEN ' s.d. ' || to_char(NEW.end_date, 'DD-MM-YYYY') ELSE '' END)
    || ' (' || coalesce(NEW.days, 1) || ' hari)';

  PERFORM public.bot_hrd_antrekan(
    'cuti:' || NEW.id,
    '📝 Pengajuan Cuti/Izin Baru',
    'Karyawan: ' || left(v_name, 120)
      || E'\nOutlet: ' || left(v_outlet, 100)
      || E'\nJenis: ' || v_jenis
      || E'\nPeriode: ' || v_periode
      || (CASE WHEN coalesce(NEW.reason, '') <> '' THEN E'\nAlasan: ' || left(NEW.reason, 200) ELSE '' END)
      || E'\nTindak lanjut HRD: buka menu Perizinan untuk meninjau dan memberi persetujuan.'
      || E'\nhttps://hr.sukashawarma.com/perizinan/izin'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal mengantrekan alert cuti HRD: %', SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_hrd_cuti ON public.leave_requests;
CREATE TRIGGER trg_bot_hrd_cuti
  AFTER INSERT OR UPDATE OF status ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.bot_hrd_alert_cuti();


-- 2. Trigger Alert Pengajuan Kasbon Baru
CREATE OR REPLACE FUNCTION public.bot_hrd_alert_kasbon()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_outlet text;
  v_nominal text;
  v_months int;
BEGIN
  IF coalesce(NEW.status_hr, 'pending') <> 'pending' OR NEW.status = 'paid_off' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status_hr = 'pending' THEN RETURN NEW; END IF;

  SELECT s.name, coalesce(o.name, 'Kantor Pusat') INTO v_name, v_outlet
  FROM public.outlet_staff s
  LEFT JOIN public.outlets o ON o.id = s.outlet_id
  WHERE s.id = NEW.staff_id AND s.status = 'active'
    AND coalesce(s.account_category, 'employee') = 'employee'
    AND s.role NOT IN ('owner', 'developer', 'kiosk', 'mitra');

  IF v_name IS NULL THEN RETURN NEW; END IF;

  v_nominal := 'Rp ' || replace(to_char(coalesce(NEW.amount_requested, NEW.amount, 0), 'FM999,999,999,999'), ',', '.');
  v_months := coalesce(NEW.installment_months, 1);

  PERFORM public.bot_hrd_antrekan(
    'kasbon:' || NEW.id,
    '💰 Pengajuan Kasbon Baru',
    'Karyawan: ' || left(v_name, 120)
      || E'\nOutlet: ' || left(v_outlet, 100)
      || E'\nNominal: ' || v_nominal
      || (CASE WHEN v_months > 1 THEN E'\nTenor Cicilan: ' || v_months || ' bulan' ELSE '' END)
      || (CASE WHEN coalesce(NEW.reason, '') <> '' THEN E'\nAlasan: ' || left(NEW.reason, 200) ELSE '' END)
      || E'\nTindak lanjut HRD: periksa riwayat kasbon dan konfirmasi persetujuan di HR.'
      || E'\nhttps://hr.sukashawarma.com/perizinan/kasbon'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal mengantrekan alert kasbon HRD: %', SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_hrd_kasbon ON public.cash_advances;
CREATE TRIGGER trg_bot_hrd_kasbon
  AFTER INSERT OR UPDATE OF status_hr, status ON public.cash_advances
  FOR EACH ROW EXECUTE FUNCTION public.bot_hrd_alert_kasbon();


-- 3. Update Rekap Harian HRD untuk memasukkan kasbon pending
CREATE OR REPLACE FUNCTION public.bot_hrd_rekap_harian()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_incomplete integer;
  v_alpha integer;
  v_leave integer;
  v_kasbon integer;
  v_contract integer;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-hrd-daily')) THEN RETURN; END IF;

  PERFORM public.hr_hitung_status_nonabsen(v_today - 1);

  SELECT count(*) FILTER (WHERE h.sumber = 'absen' AND (h.clock_in IS NULL OR h.clock_out IS NULL)),
         count(*) FILTER (WHERE h.status = 'alfa')
    INTO v_incomplete, v_alpha
  FROM public.attendance_harian h
  JOIN public.outlet_staff s ON s.id = h.staff_id
  JOIN public.outlets o ON o.id = h.outlet_id
  WHERE h.tgl = v_today - 1 AND s.status = 'active'
    AND coalesce(s.account_category, 'employee') = 'employee'
    AND s.role NOT IN ('owner', 'developer', 'kiosk', 'mitra')
    AND o.is_active IS TRUE AND coalesce(o.type, '') NOT IN ('test', 'marketplace');

  SELECT count(*) INTO v_leave
  FROM public.leave_requests l
  JOIN public.outlet_staff s ON s.id = l.staff_id
  WHERE l.status = 'pending' AND l.created_at < now() - interval '24 hours'
    AND s.status = 'active' AND coalesce(s.account_category, 'employee') = 'employee'
    AND s.role NOT IN ('owner', 'developer', 'kiosk', 'mitra');

  SELECT count(*) INTO v_kasbon
  FROM public.cash_advances ca
  JOIN public.outlet_staff s ON s.id = ca.staff_id
  WHERE coalesce(ca.status_hr, 'pending') = 'pending' AND ca.status <> 'paid_off'
    AND s.status = 'active' AND coalesce(s.account_category, 'employee') = 'employee'
    AND s.role NOT IN ('owner', 'developer', 'kiosk', 'mitra');

  SELECT count(*) INTO v_contract
  FROM public.outlet_staff s
  WHERE s.status = 'active' AND coalesce(s.account_category, 'employee') = 'employee'
    AND s.role NOT IN ('owner', 'developer', 'kiosk', 'mitra')
    AND s.contract_type = 'contract' AND s.resign_date BETWEEN v_today AND v_today + 60;

  IF v_incomplete + v_alpha + v_leave + v_kasbon + v_contract = 0 THEN RETURN; END IF;

  PERFORM public.bot_hrd_antrekan(
    'rekap:' || v_today,
    '📋 Pemeriksaan harian HRD',
    'Absensi ' || to_char(v_today - 1, 'DD-MM-YYYY') || E':\n• Tidak lengkap: ' || v_incomplete
      || E'\n• Alfa tercatat: ' || v_alpha
      || E'\nPengajuan izin/cuti tertunda >24 jam: ' || v_leave
      || E'\nPengajuan kasbon pending: ' || v_kasbon
      || E'\nKontrak berakhir dalam 60 hari: ' || v_contract
      || E'\nPeriksa absensi: https://hr.sukashawarma.com/attendance'
      || E'\nIzin/cuti: https://hr.sukashawarma.com/perizinan/izin'
      || E'\nKasbon: https://hr.sukashawarma.com/perizinan/kasbon'
      || E'\nKontrak: https://hr.sukashawarma.com/contracts'
      || E'\nKonfirmasi temuan sebelum mengoreksi data atau menghubungi karyawan.'
  );
END;
$$;


-- 4. Update Worker Pengiriman Antrean HRD (Dukungan URL action button & skip check cuti/kasbon)
CREATE OR REPLACE FUNCTION public.bot_hrd_kirim_antrean()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_url text;
  v_secret text;
  v_request bigint;
  r record;
  v_response record;
  v_action_url text;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-hrd-delivery')) THEN RETURN; END IF;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name='telegram_hrd_send_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='telegram_hrd_send_secret' LIMIT 1;
  IF coalesce(v_url, '') = '' OR coalesce(v_secret, '') = '' THEN RETURN; END IF;

  FOR r IN SELECT * FROM public.bot_hrd_alert_outbox WHERE outcome = 'pending'
    AND (attempts = 0 OR request_id IS NOT NULL OR attempted_at <= now() - interval '15 minutes')
    ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED LOOP

    -- Keterlambatan: periksa apakah masih telat
    IF r.event_key LIKE 'telat:%' AND NOT EXISTS (
      SELECT 1 FROM public.attendance_harian h
      WHERE h.staff_id = split_part(r.event_key, ':', 2)::uuid
        AND h.outlet_id = split_part(r.event_key, ':', 3)::uuid
        AND h.tgl = split_part(r.event_key, ':', 4)::date
        AND h.sumber = 'absen' AND h.clock_in IS NOT NULL AND h.telat_menit > 15
    ) THEN
      UPDATE public.bot_hrd_alert_outbox SET outcome = 'skipped' WHERE id = r.id;
      CONTINUE;
    END IF;

    -- Cuti: periksa apakah masih berstatus pending
    IF r.event_key LIKE 'cuti:%' AND NOT EXISTS (
      SELECT 1 FROM public.leave_requests l
      WHERE l.id = split_part(r.event_key, ':', 2)::uuid
        AND l.status = 'pending'
    ) THEN
      UPDATE public.bot_hrd_alert_outbox SET outcome = 'skipped' WHERE id = r.id;
      CONTINUE;
    END IF;

    -- Kasbon: periksa apakah masih berstatus pending
    IF r.event_key LIKE 'kasbon:%' AND NOT EXISTS (
      SELECT 1 FROM public.cash_advances ca
      WHERE ca.id = split_part(r.event_key, ':', 2)::uuid
        AND coalesce(ca.status_hr, 'pending') = 'pending' AND ca.status <> 'paid_off'
    ) THEN
      UPDATE public.bot_hrd_alert_outbox SET outcome = 'skipped' WHERE id = r.id;
      CONTINUE;
    END IF;

    -- Otorisasi penerima
    IF NOT EXISTS (
      SELECT 1 FROM public.outlet_staff s
      JOIN public.hermes_bot_user_access a ON a.staff_id = s.id AND a.bot_slug = 'hrd'
      JOIN public.bot_telegram_links l ON l.staff_id = s.id
      WHERE s.id = r.staff_id AND s.role IN ('admin_hr', 'developer') AND s.status = 'active' AND l.chat_id IS NOT NULL
    ) THEN
      UPDATE public.bot_hrd_alert_outbox SET outcome = 'skipped' WHERE id = r.id;
      CONTINUE;
    END IF;

    IF r.request_id IS NOT NULL THEN
      SELECT status_code, content INTO v_response FROM net._http_response WHERE id = r.request_id;
      IF FOUND THEN
        IF v_response.status_code = 200 AND v_response.content IS JSON OBJECT
          AND v_response.content::jsonb->>'delivered' = 'true' THEN
          UPDATE public.bot_hrd_alert_outbox SET outcome = 'delivered' WHERE id = r.id;
          CONTINUE;
        ELSIF v_response.status_code = 200 AND v_response.content IS JSON OBJECT
          AND v_response.content::jsonb->>'reason' = 'not_eligible' THEN
          UPDATE public.bot_hrd_alert_outbox SET outcome = 'skipped' WHERE id = r.id;
          CONTINUE;
        END IF;
        UPDATE public.bot_hrd_alert_outbox SET request_id = NULL WHERE id = r.id;
      ELSIF r.attempted_at > now() - interval '2 minutes' THEN CONTINUE;
      END IF;
    END IF;

    IF r.attempts >= 3 THEN
      UPDATE public.bot_hrd_alert_outbox SET outcome = 'failed' WHERE id = r.id;
      CONTINUE;
    END IF;

    IF r.attempted_at > now() - interval '15 minutes' THEN CONTINUE; END IF;

    v_action_url := CASE
      WHEN r.event_key LIKE 'cuti:%' THEN 'https://hr.sukashawarma.com/perizinan/izin'
      WHEN r.event_key LIKE 'kasbon:%' THEN 'https://hr.sukashawarma.com/perizinan/kasbon'
      ELSE 'https://hr.sukashawarma.com/attendance'
    END;

    BEGIN
      v_request := net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Accept', 'application/json',
          'User-Agent', 'SukaShawarma-HRD-Alerts/1.0',
          'Authorization', 'Bearer ' || v_secret
        ),
        body := jsonb_build_object(
          'user_id', r.staff_id,
          'title', r.title,
          'body', r.body,
          'url', v_action_url
        ),
        timeout_milliseconds := 15000
      );
      UPDATE public.bot_hrd_alert_outbox
        SET request_id = v_request, attempted_at = now(), attempts = attempts + 1
        WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.bot_hrd_alert_outbox
        SET request_id = NULL, attempted_at = now(), attempts = attempts + 1
        WHERE id = r.id;
    END;
  END LOOP;

  DELETE FROM public.bot_hrd_alert_outbox
    WHERE created_at < now() - interval '90 days' AND outcome <> 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.bot_hrd_alert_cuti(), public.bot_hrd_alert_kasbon() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_hrd_rekap_harian(), public.bot_hrd_kirim_antrean() TO service_role;


-- 5. Daftarkan ke Single Source of Truth Katalog Trigger (bot_trigger_catalog)
INSERT INTO public.bot_trigger_catalog (id, target_role, bot_slug, judul, deskripsi, jadwal_atau_trigger, is_realtime, sudah_tertaut_telegram, urutan, is_active)
VALUES
  ('tg_hr_telat_15m', 'admin_hr', 'hrd',
   'Alert Keterlambatan Masuk Shift (> 15 Menit)',
   'Notifikasi otomatis ke HR saat kru operasional check-in terlambat melebihi batas 15 menit.',
   'Trigger Absensi Masuk (telat_menit > 15)', true, true, 1, true),
  ('tg_hr_cuti_pending', 'admin_hr', 'hrd',
   'Notifikasi Pengajuan Cuti / Izin Karyawan Baru',
   'Pemberitahuan real-time saat staf mengajukan cuti tahunan, izin sakit, atau izin pribadi untuk ditinjau.',
   'Trigger Pengajuan Cuti (leave_requests -> pending)', true, true, 2, true),
  ('tg_hr_kasbon_pending', 'admin_hr', 'hrd',
   'Notifikasi Pengajuan Kasbon / Pinjaman Karyawan',
   'Pemberitahuan real-time saat staf mengajukan kasbon baru lengkap dengan nominal dan tenor cicilan.',
   'Trigger Pengajuan Kasbon (cash_advances -> pending)', true, true, 3, true),
  ('tg_hr_rekap_0900', 'admin_hr', 'hrd',
   'Rekap Audit Absensi, Izin, Kasbon & Kontrak (09:00 WIB)',
   'Pemeriksaan rutin setiap pagi jam 09:00 WIB memuat absensi tidak lengkap kemarin, alfa, cuti menggantung >24h, kasbon pending, dan kontrak H-60.',
   'Cron Pemeriksaan Pagi (09:00 WIB)', false, true, 4, true)
ON CONFLICT (id) DO UPDATE SET
  target_role = EXCLUDED.target_role,
  bot_slug = EXCLUDED.bot_slug,
  judul = EXCLUDED.judul,
  deskripsi = EXCLUDED.deskripsi,
  jadwal_atau_trigger = EXCLUDED.jadwal_atau_trigger,
  is_realtime = EXCLUDED.is_realtime,
  sudah_tertaut_telegram = EXCLUDED.sudah_tertaut_telegram,
  urutan = EXCLUDED.urutan,
  is_active = EXCLUDED.is_active,
  updated_at = now();
