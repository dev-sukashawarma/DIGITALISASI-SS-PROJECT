-- 20300254005700_ceo_operational_and_attendance_warning_triggers.sql
-- Implementasi Trigger & Notifikasi Eksekutif Bot CEO (J.A.R.V.I.S.)
-- Domain: 3. Operasional Cabang, Presensi Kru & HR (SDM)
--         - Kru Kurang (< Kuota Minimum / Hanya 1 Orang)
--         - Anomali Absen Masal di Satu Cabang
--         - Manipulasi Absensi / Fake GPS
--         - Hasil Supervisi AM Kategori Buruk (Food Safety & Mutu)
--         - Cabang Belum Disupervisi AM (Ceklist Bolong 21:00 WIB)
--         - Pengajuan Kasbon Berisiko Tinggi (> Rp 2.5 Jt / Staf Baru)
--         - Anomali Gelombang Resign Kru (Turnover Spike >= 3 Kru/30 Hari)

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────── 1. OPERASIONAL: Cabang Kekurangan Kru (Hanya 1 Orang Hadir)
-- ─────────────────────────────────────────────────────────── 2. HR: Anomali Absen Masal di Satu Cabang
CREATE OR REPLACE FUNCTION public.bot_ceo_cek_kru_dan_absensi()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now_wib timestamp := now() AT TIME ZONE 'Asia/Jakarta';
  v_today date := v_now_wib::date;
  v_jam int := extract(hour FROM v_now_wib);
  v_menit int := extract(minute FROM v_now_wib);
  v_out record;
  v_total_crew int := 0;
  v_present_crew int := 0;
  v_present_names text[];
  v_absent_count int := 0;
  v_ceo record;
BEGIN
  -- Evaluasi hanya berjalan di siang hari (14:30 - 16:30 WIB)
  IF v_jam < 14 OR v_jam > 16 THEN
    RETURN;
  END IF;

  FOR v_out IN
    SELECT o.id, o.name,
           coalesce(o.open_hour, '14:00:00'::time) AS jam_buka
    FROM public.outlets o
    WHERE o.is_active IS TRUE
      AND lower(coalesce(o.type, 'internal')) NOT IN ('office', 'gudang', 'warehouse', 'hq', 'dapur', 'kitchen', 'test', 'marketplace', 'system')
      AND o.name NOT ILIKE '%kantor pusat%'
      AND o.name NOT ILIKE '%gudang%'
      AND o.name NOT ILIKE '%backup%'
      AND o.name NOT ILIKE '%tes%'
    ORDER BY o.name
  LOOP
    -- Hitung total staf aktif bertugas di cabang ini (crew & leader)
    SELECT count(*)
    INTO v_total_crew
    FROM public.outlet_staff s
    WHERE s.outlet_id = v_out.id
      AND s.status = 'active'
      AND s.role IN ('crew', 'leader');

    -- Lewati cabang tanpa kru terdaftar (misal baru setup)
    IF v_total_crew < 2 THEN
      CONTINUE;
    END IF;

    -- Hitung kru yang sudah clock-in masuk hari ini
    SELECT count(DISTINCT a.outlet_staff_id),
           array_agg(DISTINCT s.name)
    INTO v_present_crew, v_present_names
    FROM public.attendance a
    JOIN public.outlet_staff s ON s.id = a.outlet_staff_id
    WHERE a.outlet_id = v_out.id
      AND a.type = 'in'
      AND a.status <> 'alpha'
      AND (a.ts_server AT TIME ZONE 'Asia/Jakarta')::date = v_today;

    v_present_crew := coalesce(v_present_crew, 0);
    v_absent_count := v_total_crew - v_present_crew;

    -- A. ALERT 1: Kritis Hanya 1 Orang Hadir (Evaluasi mulai 14:45 WIB)
    IF (v_jam > 14 OR (v_jam = 14 AND v_menit >= 40)) AND v_present_crew = 1 THEN
      FOR v_ceo IN
        SELECT id FROM public.outlet_staff
        WHERE role IN ('owner', 'admin', 'developer')
          AND status = 'active'
      LOOP
        PERFORM public.bot_ceo_antrekan(
          format('understaffed_ceo:%s:%s', v_out.id::text, v_today::text),
          v_ceo.id,
          '⚠️ [OPERASIONAL WARNING] Cabang Kekurangan Kru (Hanya 1 Orang) — ' || v_out.name,
          format(
            E'Gerai hanya dijaga oleh 1 orang kru pada jam operasional aktif (%s WIB).\nOutlet: %s\nStandar Shift: Minimal 2-3 Kru\nKru Hadir di Lokasi: %s (1 Orang)\nKru Tidak Hadir: %s Orang\n\nPerhatian Direksi: Antrean berisiko terbengkalai & pelayanan lambat parah. Area Manager wajib koordinasikan bantuan kru roving.',
            to_char(v_now_wib, 'HH24:MI'),
            v_out.name,
            coalesce(v_present_names[1], '1 Kru Kitchen'),
            v_absent_count::text
          ),
          'https://manager.sukashawarma.com'
        );
      END LOOP;
    END IF;

    -- B. ALERT 2: Anomali Absen Masal (>= 3 Kru atau >= 50% Staf Absen)
    IF v_total_crew >= 3 AND (v_absent_count >= 3 OR (v_absent_count::numeric / v_total_crew) >= 0.5) THEN
      FOR v_ceo IN
        SELECT id FROM public.outlet_staff
        WHERE role IN ('owner', 'admin', 'developer')
          AND status = 'active'
      LOOP
        PERFORM public.bot_ceo_antrekan(
          format('mass_absent_ceo:%s:%s', v_out.id::text, v_today::text),
          v_ceo.id,
          format('🚨 [HR WARNING] Anomali Absen Masal (%s/%s Kru) — %s', v_absent_count::text, v_total_crew::text, v_out.name),
          format(
            E'Deteksi tingkat ketidakhadiran tidak wajar di satu cabang.\nOutlet: %s\nTotal Kru: %s Orang\nKru Tidak Hadir: %s Orang (%s%% Absen)\nKru Hadir: %s Orang\nWaktu Pengecekan: %s WIB\n\nPerhatian Direksi: Potensi problem kepemimpinan lokal atau aksi mogok kru. HRD Pusat disarankan investigasi mendalam.',
            v_out.name,
            v_total_crew::text,
            v_absent_count::text,
            round((v_absent_count::numeric / v_total_crew) * 100, 0)::text,
            v_present_crew::text,
            to_char(v_now_wib, 'HH24:MI')
          ),
          'https://hr.sukashawarma.com'
        );
      END LOOP;
    END IF;

  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────── 3. AUDIT: Percobaan Manipulasi Absensi / Fake GPS
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_absensi_fraud_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_staff_name text;
  v_ceo record;
BEGIN
  IF NEW.type <> 'in' THEN
    RETURN NEW;
  END IF;

  -- Ambang batas kecurangan: jarak lokasi clock-in > 100 meter dari outlet
  IF coalesce(NEW.distance_m, 0) > 100 THEN
    SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
    FROM public.outlets WHERE id = NEW.outlet_id;

    SELECT coalesce(name, 'Kru Outlet') INTO v_staff_name
    FROM public.outlet_staff WHERE id = NEW.outlet_staff_id;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('absensi_fraud_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '🚨 [AUDIT WARNING] Percobaan Titip Absen / Fake GPS — ' || v_outlet_name,
        format(
          E'Deteksi presensi clock-in di luar radius batas toleransi aman toko.\nOutlet: %s\nNama Staf: %s\nJarak Terdeteksi: %s meter dari koordinat outlet (Batas SOP: 20m)\nWaktu Absen: %s WIB\n\nPerhatian Direksi: Indikasi manipulasi lokasi/fake GPS. Disarankan audit tunjangan kehadiran kru terkait.',
          v_outlet_name,
          v_staff_name,
          round(NEW.distance_m, 0)::text,
          to_char(coalesce(NEW.ts_client, NEW.ts_server) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
        ),
        'https://hr.sukashawarma.com/attendance'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_absensi_fraud_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_ceo_absensi_fraud_alert ON public.attendance;
CREATE TRIGGER trg_bot_ceo_absensi_fraud_alert
  AFTER INSERT ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_bot_ceo_absensi_fraud_alert();

-- ─────────────────────────────────────────────────────────── 4. FOOD SAFETY & SOP: Hasil Supervisi AM Kategori Buruk
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_ceklist_buruk()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_buruk_total int := 0;
  v_buruk_kritis int := 0;
  v_buruk_list text[];
  v_ceo record;
BEGIN
  SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
  FROM public.outlets WHERE id = NEW.outlet_id;

  -- Agregasi item yang bernilai buruk dari ceklist_harian_item
  SELECT count(*),
         count(*) FILTER (WHERE kategori IN ('kebersihan', 'rasa')),
         array_agg(kategori || coalesce(' (' || sub_item || ')', '')) FILTER (WHERE nilai = 'buruk')
  INTO v_buruk_total, v_buruk_kritis, v_buruk_list
  FROM public.ceklist_harian_item
  WHERE ceklist_id = NEW.id
    AND nilai = 'buruk';

  v_buruk_total := coalesce(v_buruk_total, 0);
  v_buruk_kritis := coalesce(v_buruk_kritis, 0);

  -- Pemicu: minimal 1 nilai buruk pada kebersihan/rasa ATAU total buruk >= 2
  IF v_buruk_kritis >= 1 OR v_buruk_total >= 2 THEN
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('ceklist_buruk_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '🚨 [FOOD SAFETY WARNING] Hasil Supervisi AM Kategori BURUK — ' || v_outlet_name,
        format(
          E'Hasil kunjungan Area Manager (%s) menemukan standar mutu bernilai BURUK.\nOutlet: %s\nTanggal Cek: %s\nItem Buruk (%s):\n• %s\n\nCatatan/Temuan AM:\n%s\n\nPerhatian Direksi: Potensi pelanggaran higienitas SOP & penurunan konsistensi rasa produk.',
          coalesce(NEW.nama_am, 'Area Manager'),
          v_outlet_name,
          to_char(NEW.tanggal, 'DD-MM-YYYY'),
          v_buruk_total::text,
          coalesce(array_to_string(v_buruk_list, E'\n• '), '-'),
          coalesce(array_to_string(NEW.temuan, E'\n• '), coalesce(NEW.catatan, 'Tidak ada catatan tambahan'))
        ),
        'https://manager.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_ceklist_buruk gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_ceo_ceklist_buruk ON public.ceklist_harian;
CREATE CONSTRAINT TRIGGER trg_bot_ceo_ceklist_buruk
  AFTER INSERT OR UPDATE ON public.ceklist_harian
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_bot_ceo_ceklist_buruk();

-- ─────────────────────────────────────────────────────────── 5. SUPERVISI: Outlet Belum Disupervisi AM Hari Ini (21:00 WIB)
CREATE OR REPLACE FUNCTION public.bot_ceo_cek_checklist_missing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_out record;
  v_missing text[] := '{}';
  v_missing_count int := 0;
  v_ceo record;
BEGIN
  FOR v_out IN
    SELECT o.id, o.name,
           coalesce(st.name, 'Tanpa AM') AS nama_am
    FROM public.outlets o
    LEFT JOIN public.staff_outlets so ON so.outlet_id = o.id
    LEFT JOIN public.outlet_staff st ON st.id = so.staff_id AND st.role = 'area_manager' AND st.status = 'active'
    WHERE o.is_active IS TRUE
      AND lower(coalesce(o.type, 'internal')) NOT IN ('office', 'gudang', 'warehouse', 'hq', 'dapur', 'kitchen', 'test', 'marketplace', 'system')
      AND o.name NOT ILIKE '%kantor pusat%'
      AND o.name NOT ILIKE '%gudang%'
      AND o.name NOT ILIKE '%backup%'
      AND o.name NOT ILIKE '%tes%'
      AND NOT EXISTS (
        SELECT 1 FROM public.ceklist_harian ch
        WHERE ch.outlet_id = o.id
          AND ch.tanggal = v_today
      )
    ORDER BY o.name
  LOOP
    v_missing := array_append(v_missing, v_out.name || ' (AM: ' || v_out.nama_am || ')');
  END LOOP;

  v_missing_count := coalesce(cardinality(v_missing), 0);

  -- Pemicu: Jika terdapat >= 2 cabang yang terlewat supervisi hari ini
  IF v_missing_count >= 2 THEN
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('ceklist_missing_ceo:%s', v_today::text),
        v_ceo.id,
        format('⚠️ [SUPERVISI WARNING] %s Cabang Belum Disupervisi AM (21:00 WIB)', v_missing_count::text),
        format(
          E'Peringatan Malam: Terdapat cabang operasional yang belum dikunjungi dan disupervisi oleh Area Manager hari ini.\nTanggal: %s\nCabang Terlewat (%s Outlet):\n• %s\n\nPerhatian Direksi: Disiplin kontrol operasional lapangan melemah. Evaluasi aktivitas Area Manager.',
          to_char(v_today, 'DD-MM-YYYY'),
          v_missing_count::text,
          array_to_string(v_missing, E'\n• ')
        ),
        'https://manager.sukashawarma.com'
      );
    END LOOP;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────── 6. KASBON: Pengajuan Kasbon Berisiko Tinggi (> Rp 2.5 Jt / Masa Kerja < 90 Hari)
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_kasbon_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_name text;
  v_staff_created timestamptz;
  v_outlet_name text;
  v_total_kasbon numeric := 0;
  v_nominal_pengajuan numeric := 0;
  v_masa_kerja_hari int := 0;
  v_is_risky boolean := false;
  v_alasan_risiko text := '';
  v_ceo record;
BEGIN
  IF coalesce(NEW.status_hr, 'pending') <> 'pending' OR NEW.status = 'paid_off' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status_hr = 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT s.name, s.created_at, coalesce(o.name, 'Kantor Pusat')
  INTO v_staff_name, v_staff_created, v_outlet_name
  FROM public.outlet_staff s
  LEFT JOIN public.outlets o ON o.id = s.outlet_id
  WHERE s.id = NEW.staff_id;

  v_nominal_pengajuan := coalesce(NEW.amount_requested, NEW.amount, 0);
  v_masa_kerja_hari := extract(day FROM (now() - coalesce(v_staff_created, now())));

  -- Hitung akumulasi kasbon belum lunas staf ini
  SELECT coalesce(sum(coalesce(amount_requested, amount, 0)), 0)
  INTO v_total_kasbon
  FROM public.cash_advances
  WHERE staff_id = NEW.staff_id
    AND status <> 'paid_off'
    AND coalesce(status_hr, 'pending') IN ('pending', 'approved');

  -- Evaluasi risiko:
  -- A. Akumulasi pinjaman >= Rp 2.500.000
  IF v_total_kasbon >= 2500000 THEN
    v_is_risky := true;
    v_alasan_risiko := 'Akumulasi kasbon aktif mencapai Rp ' || to_char(v_total_kasbon, 'FM999,999,999');
  -- B. Masa kerja < 90 hari dan pengajuan >= Rp 1.000.000
  ELSIF v_masa_kerja_hari < 90 AND v_nominal_pengajuan >= 1000000 THEN
    v_is_risky := true;
    v_alasan_risiko := 'Masa kerja baru ' || v_masa_kerja_hari || ' hari (Masih Probation)';
  END IF;

  IF v_is_risky THEN
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('kasbon_risiko_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        format('⚠️ [HR WARNING] Pengajuan Kasbon Berisiko Tinggi (Rp %s)', to_char(v_nominal_pengajuan, 'FM999,999,999')),
        format(
          E'Pengajuan pinjaman karyawan membutuhkan tinjauan kehati-hatian Direksi.\nKaryawan: %s (%s)\nNominal Diajukan: Rp %s\nTotal Akumulasi Kasbon: Rp %s\nAlasan Risiko: %s\nCatatan Staf: %s\n\nPerhatian Direksi: Mitigasi risiko piutang macet / flight risk sebelum disetujui HRD.',
          coalesce(v_staff_name, 'Karyawan'),
          coalesce(v_outlet_name, 'Outlet'),
          to_char(v_nominal_pengajuan, 'FM999,999,999'),
          to_char(v_total_kasbon, 'FM999,999,999'),
          v_alasan_risiko,
          coalesce(NEW.reason, '-')
        ),
        'https://hr.sukashawarma.com/perizinan/kasbon'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_kasbon_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_ceo_kasbon_alert ON public.cash_advances;
CREATE TRIGGER trg_bot_ceo_kasbon_alert
  AFTER INSERT OR UPDATE OF status_hr, status ON public.cash_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_bot_ceo_kasbon_alert();

-- ─────────────────────────────────────────────────────────── 7. SDM: Gelombang Resign Kru di Satu Cabang (Turnover Spike)
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_turnover_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_resigned_count int := 0;
  v_resigned_names text[];
  v_tgl_bulan text := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM');
  v_ceo record;
BEGIN
  IF NEW.status <> 'inactive' OR OLD.status = 'inactive' OR NEW.outlet_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Hitung staf yang non-aktif/resign dalam 30 hari terakhir di outlet yang sama
  SELECT count(*),
         array_agg(name)
  INTO v_resigned_count, v_resigned_names
  FROM public.outlet_staff
  WHERE outlet_id = NEW.outlet_id
    AND status = 'inactive'
    AND updated_at >= (now() - interval '30 days');

  v_resigned_count := coalesce(v_resigned_count, 0);

  -- Pemicu: >= 3 staf keluar dalam 30 hari di 1 cabang
  IF v_resigned_count >= 3 THEN
    SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
    FROM public.outlets WHERE id = NEW.outlet_id;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('turnover_ceo:%s:%s', v_tgl_bulan, NEW.outlet_id::text),
        v_ceo.id,
        '⚠️ [HR WARNING] Anomali Gelombang Resign Kru (Turnover Tinggi) — ' || v_outlet_name,
        format(
          E'Terdeteksi pergantian kru abnormally tinggi di satu gerai dalam 30 hari terakhir.\nOutlet: %s\nJumlah Staf Keluar: %s Orang (30 Hari Terakhir)\nNama Staf: %s\n\nPerhatian Direksi: Perputaran staf terlalu cepat merusak konsistensi rasa & SOP. HRD Pusat wajib lakukan exit interview independen.',
          v_outlet_name,
          v_resigned_count::text,
          coalesce(array_to_string(v_resigned_names, ', '), '-')
        ),
        'https://hr.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_turnover_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_ceo_turnover_alert ON public.outlet_staff;
CREATE TRIGGER trg_bot_ceo_turnover_alert
  AFTER UPDATE OF status ON public.outlet_staff
  FOR EACH ROW
  WHEN (NEW.status = 'inactive' AND OLD.status = 'active')
  EXECUTE FUNCTION public.trg_fn_bot_ceo_turnover_alert();

-- ─────────────────────────────────────────────────────────── 8. Penjadwalan pg_cron untuk Cron Operasional & Supervisi
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Pengecekan Kesiapan Kru & Absen Masal: 14:45 WIB & 15:30 WIB (07:45 & 08:30 UTC)
    PERFORM cron.unschedule('bot-ceo-kru-absensi') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'bot-ceo-kru-absensi'
    );
    PERFORM cron.schedule(
      'bot-ceo-kru-absensi',
      '45 7,8 * * *',
      'SELECT public.bot_ceo_cek_kru_dan_absensi();'
    );

    -- Pengecekan Ceklist Supervisi AM Terlewat: 21:00 WIB (14:00 UTC)
    PERFORM cron.unschedule('bot-ceo-checklist-missing') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'bot-ceo-checklist-missing'
    );
    PERFORM cron.schedule(
      'bot-ceo-checklist-missing',
      '0 14 * * *',
      'SELECT public.bot_ceo_cek_checklist_missing();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Pendaftaran pg_cron operasional ceo baru dilewati: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────── 9. Registrasi ke bot_trigger_catalog (Owner & Admin)
INSERT INTO public.bot_trigger_catalog (
  id, target_role, bot_slug, judul, deskripsi, jadwal_atau_trigger, is_realtime, sudah_tertaut_telegram, urutan, is_active
) VALUES
  -- ── OWNER (CEO) ──
  ('tg_ceo_ops_understaffed_shift', 'owner', 'ceo',
   'Cabang Kritis Kekurangan Kru (Hanya 1 Orang Hadir)',
   'Peringatan otomatis saat gerai hanya dijaga 1 orang kru pada jam buka aktif, antrean pelayanan berisiko bottleneck parah.',
   'Cron Siang 14:45 WIB', false, true, 25, true),

  ('tg_ceo_hr_mass_absenteeism', 'owner', 'ceo',
   'Anomali Absen Masal di Satu Cabang (>= 50% Kru Tidak Hadir)',
   'Deteksi ketidakhadiran abnormal di satu gerai (>= 3 kru atau >= 50% kru absen) untuk mengantisipasi konflik internal atau kendala operasional berat.',
   'Cron Siang 15:30 WIB', false, true, 26, true),

  ('tg_ceo_absensi_fraud_attempt', 'owner', 'ceo',
   'Percobaan Titip Absen / Fake GPS di Luar Radius (> 100m)',
   'Deteksi presensi clock-in dengan jarak terdeteksi di luar radius aman toko (> 100 meter) untuk mencegah kecurangan kehadiran.',
   'Trigger Real-Time attendance -> insert', true, true, 27, true),

  ('tg_ceo_ops_checklist_buruk', 'owner', 'ceo',
   'Hasil Supervisi Area Manager Kategori BURUK (Food Safety / Rasa)',
   'Eskalasi darurat saat kunjungan Area Manager menemukan standar higienitas/rasa produk bernilai buruk agar Direksi segera intervensi.',
   'Trigger Real-Time ceklist_harian -> insert/update', true, true, 28, true),

  ('tg_ceo_ops_checklist_missing', 'owner', 'ceo',
   'Cabang Belum Disupervisi Area Manager Hari Ini (21:00 WIB)',
   'Peringatan pengawasan malam saat ada cabang operasional yang terlewat tanpa kunjungan/supervisi checklist Area Manager.',
   'Cron Malam 21:00 WIB', false, true, 29, true),

  ('tg_ceo_hr_excessive_kasbon', 'owner', 'ceo',
   'Pengajuan Kasbon Karyawan Berisiko Tinggi (> Rp 2.5 Jt / Probation)',
   'Peringatan saat staf mengajukan pinjaman dengan akumulasi > Rp 2.500.000 atau diajukan staf baru (< 90 hari kerja) untuk memitigasi flight risk.',
   'Trigger Real-Time cash_advances -> pending', true, true, 30, true),

  ('tg_ceo_hr_turnover_spike', 'owner', 'ceo',
   'Anomali Gelombang Resign Kru di Satu Gerai (>= 3 Kru / 30 Hari)',
   'Deteksi perputaran staf (turnover) tinggi dalam 30 hari di cabang yang sama untuk mengevaluasi iklim kerja dan kepemimpinan lokal.',
   'Trigger Real-Time outlet_staff -> inactive', true, true, 31, true),

  -- ── ADMIN ──
  ('tg_admin_ops_understaffed_shift', 'admin', 'ceo',
   'Cabang Kritis Kekurangan Kru (Hanya 1 Orang Hadir)',
   'Peringatan otomatis saat gerai hanya dijaga 1 orang kru pada jam buka aktif, antrean pelayanan berisiko bottleneck parah.',
   'Cron Siang 14:45 WIB', false, true, 25, true),

  ('tg_admin_hr_mass_absenteeism', 'admin', 'ceo',
   'Anomali Absen Masal di Satu Cabang (>= 50% Kru Tidak Hadir)',
   'Deteksi ketidakhadiran abnormal di satu gerai (>= 3 kru atau >= 50% kru absen) untuk mengantisipasi konflik internal atau kendala operasional berat.',
   'Cron Siang 15:30 WIB', false, true, 26, true),

  ('tg_admin_absensi_fraud_attempt', 'admin', 'ceo',
   'Percobaan Titip Absen / Fake GPS di Luar Radius (> 100m)',
   'Deteksi presensi clock-in dengan jarak terdeteksi di luar radius aman toko (> 100 meter) untuk mencegah kecurangan kehadiran.',
   'Trigger Real-Time attendance -> insert', true, true, 27, true),

  ('tg_admin_ops_checklist_buruk', 'admin', 'ceo',
   'Hasil Supervisi Area Manager Kategori BURUK (Food Safety / Rasa)',
   'Eskalasi darurat saat kunjungan Area Manager menemukan standar higienitas/rasa produk bernilai buruk agar Direksi segera intervensi.',
   'Trigger Real-Time ceklist_harian -> insert/update', true, true, 28, true),

  ('tg_admin_ops_checklist_missing', 'admin', 'ceo',
   'Cabang Belum Disupervisi Area Manager Hari Ini (21:00 WIB)',
   'Peringatan pengawasan malam saat ada cabang operasional yang terlewat tanpa kunjungan/supervisi checklist Area Manager.',
   'Cron Malam 21:00 WIB', false, true, 29, true),

  ('tg_admin_hr_excessive_kasbon', 'admin', 'ceo',
   'Pengajuan Kasbon Karyawan Berisiko Tinggi (> Rp 2.5 Jt / Probation)',
   'Peringatan saat staf mengajukan pinjaman dengan akumulasi > Rp 2.500.000 atau diajukan staf baru (< 90 hari kerja) untuk memitigasi flight risk.',
   'Trigger Real-Time cash_advances -> pending', true, true, 30, true),

  ('tg_admin_hr_turnover_spike', 'admin', 'ceo',
   'Anomali Gelombang Resign Kru di Satu Gerai (>= 3 Kru / 30 Hari)',
   'Deteksi perputaran staf (turnover) tinggi dalam 30 hari di cabang yang sama untuk mengevaluasi iklim kerja dan kepemimpinan lokal.',
   'Trigger Real-Time outlet_staff -> inactive', true, true, 31, true)

ON CONFLICT (id) DO UPDATE SET
  judul = EXCLUDED.judul,
  deskripsi = EXCLUDED.deskripsi,
  jadwal_atau_trigger = EXCLUDED.jadwal_atau_trigger,
  is_realtime = EXCLUDED.is_realtime,
  sudah_tertaut_telegram = EXCLUDED.sudah_tertaut_telegram,
  urutan = EXCLUDED.urutan,
  is_active = EXCLUDED.is_active,
  updated_at = now();
