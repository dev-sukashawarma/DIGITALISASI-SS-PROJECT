-- =============================================================================
-- Migration: 20300254006200_am_rm_monitoring_kru_belum_absen.sql
-- Tanggal: 2026-10-23
-- Deskripsi:
--   Implementasi Monitoring Kehadiran & Kru Belum Absen untuk Area Manager (AM)
--   dan Regional Manager (RM):
--
--   1. Fungsi public.bot_manager_cek_kru_belum_absen():
--      - Dijalankan terjadwal setiap pukul 14:45 WIB (45 menit setelah outlet buka).
--      - Memeriksa presensi seluruh kru & leader di outlet binaan masing-masing AM.
--      - Merinci nama kru yang BELUM ABSEN (tanpa keterangan) vs kru yang izin resmi.
--      - Mengirim rekap ke AM via Push HP Native (Superapp) & Bot Telegram Manager.
--      - Mengirim eskalasi ke RM & CEO jika ada outlet yang hanya 1 kru hadir / 0 kru hadir.
--
--   2. Registrasi Cron Job pg_cron:
--      - 'bot-manager-cek-kru-belum-absen' schedule '45 7 * * *' (14:45 WIB setiap hari).
--
--   3. Update trg_fn_bot_ceo_absensi_fraud_alert (Tabel attendance):
--      - Selain mengirim ke CEO, sekarang langsung memberi alert ke Area Manager (AM)
--        pembina outlet jika ada kru yang clock-in jarak > 100m (Fake GPS / Titip Absen).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fungsi Utama: Cek Kru Belum Absen Per Outlet Binaan AM
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_manager_cek_kru_belum_absen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now_wib timestamp := now() AT TIME ZONE 'Asia/Jakarta';
  v_today date := v_now_wib::date;
  v_am record;
  v_out record;
  v_staff record;
  v_total_crew int;
  v_hadir_count int;
  v_missing_names text[];
  v_leave_names text[];
  v_outlet_report text[];
  v_has_missing boolean;
  v_body text;
  v_rm record;
  v_rm_alerts text[] := '{}';
BEGIN
  -- A. Loop per Area Manager aktif
  FOR v_am IN
    SELECT s.id, s.name
    FROM public.outlet_staff s
    WHERE s.role = 'area_manager'
      AND s.status = 'active'
    ORDER BY s.name
  LOOP
    v_outlet_report := '{}';
    v_has_missing := false;

    -- Loop outlet penjualan riil binaan AM ini
    FOR v_out IN
      SELECT o.id, o.name
      FROM public.outlets o
      JOIN public.staff_outlets so ON so.outlet_id = o.id
      WHERE so.staff_id = v_am.id
        AND public.bot_is_sales_outlet(o.id)
        AND NOT public.bot_is_outlet_tutup_sementara(o.id)
      ORDER BY o.name
    LOOP
      v_total_crew := 0;
      v_hadir_count := 0;
      v_missing_names := '{}';
      v_leave_names := '{}';

      -- Hitung total kru aktif terdaftar di outlet
      SELECT count(*) INTO v_total_crew
      FROM public.outlet_staff s
      WHERE s.outlet_id = v_out.id
        AND s.status = 'active'
        AND s.role IN ('crew', 'leader');

      IF v_total_crew = 0 THEN
        CONTINUE;
      END IF;

      -- Hitung kru yang sudah clock-in masuk hari ini
      SELECT count(DISTINCT a.outlet_staff_id) INTO v_hadir_count
      FROM public.attendance a
      JOIN public.outlet_staff s ON s.id = a.outlet_staff_id
      WHERE a.outlet_id = v_out.id
        AND a.type = 'in'
        AND a.status <> 'alpha'
        AND (a.ts_server AT TIME ZONE 'Asia/Jakarta')::date = v_today;

      v_hadir_count := coalesce(v_hadir_count, 0);

      -- Cari staf yang BELUM clock-in masuk hari ini
      FOR v_staff IN
        SELECT 
          s.id,
          s.name,
          s.role,
          lr.reason AS leave_reason
        FROM public.outlet_staff s
        LEFT JOIN public.leave_requests lr ON lr.staff_id = s.id
          AND lr.status = 'approved'
          AND v_today BETWEEN lr.start_date AND lr.end_date
        WHERE s.outlet_id = v_out.id
          AND s.status = 'active'
          AND s.role IN ('crew', 'leader')
          AND NOT EXISTS (
            SELECT 1 FROM public.attendance a
            WHERE a.outlet_staff_id = s.id
              AND a.type = 'in'
              AND a.status <> 'alpha'
              AND (a.ts_server AT TIME ZONE 'Asia/Jakarta')::date = v_today
          )
        ORDER BY s.role DESC, s.name ASC
      LOOP
        IF v_staff.leave_reason IS NOT NULL THEN
          v_leave_names := array_append(
            v_leave_names, 
            format('• %s (%s) — Izin: %s', v_staff.name, initcap(v_staff.role), v_staff.leave_reason)
          );
        ELSE
          v_missing_names := array_append(
            v_missing_names, 
            format('• %s (%s)', v_staff.name, initcap(v_staff.role))
          );
        END IF;
      END LOOP;

      -- Jika ada kru yang belum absen atau izin, rangkum ke laporan outlet
      IF array_length(v_missing_names, 1) > 0 OR array_length(v_leave_names, 1) > 0 THEN
        v_has_missing := true;

        v_body := format(
          E'📍 %s (%s/%s Hadir)',
          v_out.name,
          v_hadir_count::text,
          v_total_crew::text
        );

        IF array_length(v_missing_names, 1) > 0 THEN
          v_body := v_body || E'\n⚠️ Belum Absen:\n' || array_to_string(v_missing_names, E'\n');
        END IF;

        IF array_length(v_leave_names, 1) > 0 THEN
          v_body := v_body || E'\nℹ️ Izin Resmi:\n' || array_to_string(v_leave_names, E'\n');
        END IF;

        v_outlet_report := array_append(v_outlet_report, v_body);
      END IF;

      -- Catat kondisi kritis untuk eskalasi ke RM jika hadir <= 1 orang
      IF v_hadir_count <= 1 AND v_total_crew >= 2 THEN
        v_rm_alerts := array_append(
          v_rm_alerts,
          format(
            E'• %s (AM: %s): Hanya %s/%s kru hadir di jam %s WIB',
            v_out.name,
            v_am.name,
            v_hadir_count::text,
            v_total_crew::text,
            to_char(v_now_wib, 'HH24:MI')
          )
        );
      END IF;
    END LOOP;

    -- Kirim ke AM hanya jika ada kru yang belum hadir di gerai binaannya
    IF v_has_missing AND array_length(v_outlet_report, 1) > 0 THEN
      PERFORM public.bot_manager_antrekan(
        format('belum_absen_am:%s:%s', v_today::text, v_am.id::text),
        v_am.id,
        '👥 [MONITORING ABSENSI] Kru Belum Absen — ' || to_char(v_now_wib, 'HH24:MI') || ' WIB',
        format(
          E'Pemeriksaan kehadiran kru shift siang di cabang binaan Anda:\n\n%s\n\nSegera hubungi kru/leader terkait untuk konfirmasi kehadiran atau plotting kru pengganti.',
          array_to_string(v_outlet_report, E'\n\n')
        ),
        'bot'
      );
    END IF;
  END LOOP;

  -- B. Eskalasi ke Regional Manager (RM) & Developer jika ada outlet kritis (kru hadir <= 1)
  IF array_length(v_rm_alerts, 1) > 0 THEN
    FOR v_rm IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('regional_manager', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        format('kritis_kru_rm:%s:%s', v_today::text, v_rm.id::text),
        v_rm.id,
        '🚨 [ESKALASI RM] Cabang Kritis Kekurangan Kru — ' || to_char(v_now_wib, 'HH24:MI') || ' WIB',
        format(
          E'Deteksi gerai beroperasi kekurangan kru (hanya dijaga <= 1 orang):\n\n%s\n\nMohon instruksikan Area Manager terkait segera kirim bantuan kru roving.',
          array_to_string(v_rm_alerts, E'\n')
        ),
        'bot'
      );
    END LOOP;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Registrasi Cron Job di pg_cron
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Hapus job lama jika sudah ada agar idempoten
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-manager-cek-kru-belum-absen') THEN
    PERFORM cron.unschedule('bot-manager-cek-kru-belum-absen');
  END IF;

  -- Jadwalkan jam 14:45 WIB setiap hari (07:45 UTC)
  PERFORM cron.schedule(
    'bot-manager-cek-kru-belum-absen',
    '45 7 * * *',
    'SELECT public.bot_manager_cek_kru_belum_absen();'
  );
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Update trg_fn_bot_ceo_absensi_fraud_alert (Audit Fake GPS / Titip Absen)
--    Menambahkan alert seketika ke Area Manager (AM) pembina outlet
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_absensi_fraud_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_outlet_name text;
  v_staff_name text;
  v_ceo record;
  v_am record;
BEGIN
  IF NEW.type <> 'in' OR NOT public.bot_is_sales_outlet(NEW.outlet_id) THEN
    RETURN NEW;
  END IF;

  -- Ambang batas kecurangan: jarak lokasi clock-in > 100 meter dari outlet
  IF coalesce(NEW.distance_m, 0) > 100 THEN
    SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
    FROM public.outlets WHERE id = NEW.outlet_id;

    SELECT coalesce(name, 'Kru Outlet') INTO v_staff_name
    FROM public.outlet_staff WHERE id = NEW.outlet_staff_id;

    -- A. Kirim ke Area Manager (AM) pembina cabang (Push HP Native + Telegram Bot)
    FOR v_am IN
      SELECT DISTINCT s.id
      FROM public.outlet_staff s
      JOIN public.staff_outlets so ON so.staff_id = s.id
      WHERE so.outlet_id = NEW.outlet_id
        AND s.role = 'area_manager'
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        format('absensi_fraud_am:%s:%s', NEW.id::text, v_am.id::text),
        v_am.id,
        '🚨 [AUDIT ABSENSI] Fake GPS / Luar Radius — ' || v_outlet_name,
        format(
          E'Deteksi presensi clock-in di luar radius batas aman toko di cabang binaan Anda.\nOutlet: %s\nNama Staf: %s\nJarak Terdeteksi: %s meter dari koordinat outlet (Batas SOP: 20m)\nWaktu Absen: %s WIB\n\nSegera kroscek apakah staf benar-benar ada di gerai atau menggunakan Fake GPS / titip absen.',
          v_outlet_name,
          v_staff_name,
          round(NEW.distance_m, 0)::text,
          to_char(coalesce(NEW.ts_client, NEW.ts_server) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
        ),
        'bot'
      );
    END LOOP;

    -- B. Kirim ke Bot CEO (Owner / Admin / Developer)
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Catat migration ke schema_migrations
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '20300254006200',
  'am_rm_monitoring_kru_belum_absen',
  ARRAY[
    'CREATE OR REPLACE FUNCTION public.bot_manager_cek_kru_belum_absen()',
    'CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_absensi_fraud_alert()',
    'cron.schedule: bot-manager-cek-kru-belum-absen'
  ]
)
ON CONFLICT (version) DO UPDATE
  SET name       = EXCLUDED.name,
      statements = EXCLUDED.statements;
