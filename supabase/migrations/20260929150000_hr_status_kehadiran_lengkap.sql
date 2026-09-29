-- Status kehadiran lengkap di rekap harian: hadir/terlambat (dari absen),
-- cuti/sakit/izin (dari pengajuan yang DISETUJUI), dan ALFA.
--
-- Aturan owner (2026-09-29): Minggu & tanggal merah = libur. Hari lain tanpa absen
-- dan tanpa cuti/sakit/izin yang disetujui = Alfa.
--
-- "Pintar" = tidak menghasilkan alfa palsu:
--   * hanya karyawan sungguhan (account_category employee; bukan kiosk/mitra/owner)
--   * hanya sejak tanggal bergabung / akun dibuat, dan tidak setelah resign
--   * hanya sejak karyawan pertama kali absen di sistem (sebelum itu belum memakai app)
--   * hanya hari yang sudah lewat (hari ini belum selesai → belum alfa)
--   * mulai dari tanggal `hr.alfa_mulai_tanggal` (global_settings, default 2026-09-01)
--   * tanggal merah dari tabel `hari_libur` (disinkron dari kalender resmi Google
--     "Hari Libur di Indonesia" oleh app HR; HR bisa menambah / menonaktifkan)
--   * absen yang masuk belakangan (manual/offline) otomatis menggantikan alfa;
--     cuti yang disetujui belakangan otomatis menggantikan alfa (trigger).
--
-- Menggantikan cron lama `mark-alpha` (gagal tiap hari: outlet_id NULL; dan
-- menyisipkan clock-in palsu ke tabel absensi mentah, termasuk hari Minggu).

-- ── 1. Tanggal merah ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hari_libur (
  tanggal       date        PRIMARY KEY,
  nama          text        NOT NULL,
  jenis         text        NOT NULL DEFAULT 'libur_nasional'
                CHECK (jenis IN ('libur_nasional', 'cuti_bersama', 'manual')),
  aktif         boolean     NOT NULL DEFAULT true,   -- dihitung libur (tidak ada alfa)
  tentatif      boolean     NOT NULL DEFAULT false,  -- tanggal belum pasti (kalender resmi)
  sumber        text        NOT NULL DEFAULT 'google' CHECK (sumber IN ('google', 'manual')),
  diubah_manual boolean     NOT NULL DEFAULT false,  -- sinkron tidak menimpa keputusan HR
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.hari_libur IS
  'Tanggal merah & cuti bersama. Disinkron app HR dari kalender Google id.indonesian; tulis hanya via service role.';

ALTER TABLE public.hari_libur ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hari_libur FROM anon, authenticated;
GRANT SELECT ON public.hari_libur TO authenticated;
DROP POLICY IF EXISTS hari_libur_read ON public.hari_libur;
CREATE POLICY hari_libur_read ON public.hari_libur FOR SELECT TO authenticated USING (true);

-- Isi awal 2025–2027 dari kalender resmi Google "Hari Libur di Indonesia" (id.indonesian),
-- hanya entri "Hari libur nasional" (bukan "Perayaan"). Selanjutnya disinkron app HR.
INSERT INTO public.hari_libur (tanggal, nama, jenis, tentatif) VALUES
  ('2025-01-01', 'Hari Tahun Baru', 'libur_nasional', false),
  ('2025-01-27', 'Isra Mikraj Nabi Muhammad', 'libur_nasional', false),
  ('2025-01-28', 'Cuti Bersama Tahun Baru Imlek', 'cuti_bersama', false),
  ('2025-01-29', 'Tahun Baru Imlek', 'libur_nasional', false),
  ('2025-03-28', 'Cuti Bersama Hari Suci Nyepi (Tahun Baru Saka)', 'cuti_bersama', false),
  ('2025-03-29', 'Hari Suci Nyepi (Tahun Baru Saka)', 'libur_nasional', false),
  ('2025-03-31', 'Hari Idul Fitri', 'libur_nasional', false),
  ('2025-04-01', 'Hari Idul Fitri', 'libur_nasional', false),
  ('2025-04-02', 'Cuti Bersama Idul Fitri', 'cuti_bersama', false),
  ('2025-04-03', 'Cuti Bersama Idul Fitri', 'cuti_bersama', false),
  ('2025-04-04', 'Cuti Bersama Idul Fitri', 'cuti_bersama', false),
  ('2025-04-07', 'Cuti Bersama Idul Fitri', 'cuti_bersama', false),
  ('2025-04-18', 'Wafat Isa Almasih', 'libur_nasional', false),
  ('2025-04-20', 'Hari Paskah', 'libur_nasional', false),
  ('2025-05-01', 'Hari Buruh Internasional / Pekerja', 'libur_nasional', false),
  ('2025-05-12', 'Hari Raya Waisak', 'libur_nasional', false),
  ('2025-05-13', 'Cuti Bersama Waisak', 'cuti_bersama', false),
  ('2025-05-29', 'Kenaikan Isa Al Masih', 'libur_nasional', false),
  ('2025-05-30', 'Cuti Bersama Kenaikan Isa Al Masih', 'cuti_bersama', false),
  ('2025-06-01', 'Hari Lahir Pancasila', 'libur_nasional', false),
  ('2025-06-06', 'Idul Adha (Lebaran Haji)', 'libur_nasional', false),
  ('2025-06-09', 'Idul Adha (Lebaran Haji)', 'libur_nasional', false),
  ('2025-06-27', 'Satu Muharam / Tahun Baru Hijriah', 'libur_nasional', false),
  ('2025-08-17', 'Hari Proklamasi Kemerdekaan R.I.', 'libur_nasional', false),
  ('2025-08-18', 'Hari Proklamasi Kemerdekaan R.I. observed', 'libur_nasional', false),
  ('2025-09-05', 'Maulid Nabi Muhammad', 'libur_nasional', false),
  ('2025-12-25', 'Hari Raya Natal', 'libur_nasional', false),
  ('2025-12-26', 'Cuti Bersama Natal (Hari Tinju)', 'cuti_bersama', false),
  ('2026-01-01', 'Hari Tahun Baru', 'libur_nasional', false),
  ('2026-01-16', 'Isra Mikraj Nabi Muhammad', 'libur_nasional', false),
  ('2026-02-16', 'Cuti Bersama Tahun Baru Imlek', 'cuti_bersama', false),
  ('2026-02-17', 'Tahun Baru Imlek', 'libur_nasional', false),
  ('2026-03-18', 'Cuti Bersama Hari Suci Nyepi (Tahun Baru Saka)', 'cuti_bersama', false),
  ('2026-03-19', 'Hari Suci Nyepi (Tahun Baru Saka)', 'libur_nasional', false),
  ('2026-03-20', 'Cuti Bersama Idul Fitri', 'cuti_bersama', false),
  ('2026-03-21', 'Hari Idul Fitri', 'libur_nasional', false),
  ('2026-03-22', 'Hari Idul Fitri', 'libur_nasional', false),
  ('2026-03-23', 'Cuti Bersama Idul Fitri', 'cuti_bersama', false),
  ('2026-03-24', 'Cuti Bersama Idul Fitri', 'cuti_bersama', false),
  ('2026-04-03', 'Wafat Isa Almasih', 'libur_nasional', false),
  ('2026-04-05', 'Hari Paskah', 'libur_nasional', false),
  ('2026-05-01', 'Hari Buruh Internasional / Pekerja', 'libur_nasional', false),
  ('2026-05-14', 'Kenaikan Isa Al Masih', 'libur_nasional', false),
  ('2026-05-15', 'Cuti Bersama Kenaikan Isa Al Masih', 'cuti_bersama', false),
  ('2026-05-27', 'Idul Adha (Lebaran Haji)', 'libur_nasional', false),
  ('2026-05-28', 'Idul Adha (Lebaran Haji)', 'libur_nasional', false),
  ('2026-05-31', 'Hari Raya Waisak', 'libur_nasional', false),
  ('2026-06-01', 'Hari Lahir Pancasila', 'libur_nasional', false),
  ('2026-06-16', 'Hari Kedua Muharram', 'libur_nasional', false),
  ('2026-08-17', 'Hari Proklamasi Kemerdekaan R.I.', 'libur_nasional', false),
  ('2026-08-25', 'Maulid Nabi Muhammad', 'libur_nasional', false),
  ('2026-12-24', 'Cuti Bersama Natal (Malam Natal)', 'cuti_bersama', false),
  ('2026-12-25', 'Hari Raya Natal', 'libur_nasional', false),
  ('2027-01-01', 'Hari Tahun Baru', 'libur_nasional', false),
  ('2027-01-05', 'Isra Mikraj Nabi Muhammad', 'libur_nasional', true),
  ('2027-02-05', 'Cuti Bersama Tahun Baru Imlek', 'cuti_bersama', false),
  ('2027-02-06', 'Tahun Baru Imlek', 'libur_nasional', false),
  ('2027-03-08', 'Hari Suci Nyepi (Tahun Baru Saka)', 'libur_nasional', false),
  ('2027-03-09', 'Cuti Bersama Idul Fitri', 'cuti_bersama', false),
  ('2027-03-10', 'Hari Idul Fitri', 'libur_nasional', true),
  ('2027-03-11', 'Hari Idul Fitri', 'libur_nasional', true),
  ('2027-03-12', 'Cuti Bersama Idul Fitri', 'cuti_bersama', false),
  ('2027-03-15', 'Cuti Bersama Idul Fitri', 'cuti_bersama', false),
  ('2027-03-25', 'Joint Holiday for Good Friday', 'cuti_bersama', false),
  ('2027-03-26', 'Wafat Isa Almasih', 'libur_nasional', false),
  ('2027-05-01', 'Hari Buruh Internasional / Pekerja', 'libur_nasional', false),
  ('2027-05-06', 'Kenaikan Isa Al Masih', 'libur_nasional', false),
  ('2027-05-17', 'Idul Adha (Lebaran Haji)', 'libur_nasional', true),
  ('2027-05-18', 'Idul Adha (Lebaran Haji)', 'libur_nasional', false),
  ('2027-05-19', 'Cuti Bersama Waisak', 'cuti_bersama', false),
  ('2027-05-20', 'Hari Raya Waisak', 'libur_nasional', false),
  ('2027-06-01', 'Hari Lahir Pancasila', 'libur_nasional', false),
  ('2027-06-06', 'Satu Muharam / Tahun Baru Hijriah', 'libur_nasional', true),
  ('2027-08-15', 'Maulid Nabi Muhammad', 'libur_nasional', true),
  ('2027-08-17', 'Hari Proklamasi Kemerdekaan R.I.', 'libur_nasional', false),
  ('2027-12-24', 'Cuti Bersama Natal (Malam Natal)', 'cuti_bersama', false),
  ('2027-12-25', 'Hari Raya Natal', 'libur_nasional', false)
ON CONFLICT (tanggal) DO NOTHING;

-- ── 2. Kolom baru di rekap harian ─────────────────────────────────────────────
ALTER TABLE public.attendance_harian ALTER COLUMN first_id DROP NOT NULL;
ALTER TABLE public.attendance_harian ALTER COLUMN first_ts DROP NOT NULL;
ALTER TABLE public.attendance_harian
  ADD COLUMN IF NOT EXISTS sumber     text NOT NULL DEFAULT 'absen',  -- absen | cuti | alfa
  ADD COLUMN IF NOT EXISTS keterangan text,
  ADD COLUMN IF NOT EXISTS leave_id   uuid;
DO $$ BEGIN
  ALTER TABLE public.attendance_harian
    ADD CONSTRAINT attendance_harian_sumber_check CHECK (sumber IN ('absen', 'cuti', 'alfa'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_attendance_harian_staff_tgl ON public.attendance_harian (staff_id, tgl);

-- ── 3. Helper ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hr_alfa_mulai()
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT (value #>> '{}')::date FROM global_settings WHERE key = 'hr.alfa_mulai_tanggal'),
    DATE '2026-09-01');
$$;

CREATE OR REPLACE FUNCTION public.hr_hari_kerja(p_tgl date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT extract(isodow FROM p_tgl) <> 7
     AND NOT EXISTS (SELECT 1 FROM hari_libur WHERE tanggal = p_tgl AND aktif);
$$;

CREATE OR REPLACE FUNCTION public.hr_jenis_izin(p_leave_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(COALESCE(p_leave_type, ''))
    WHEN 'sick' THEN 'sakit' WHEN 'sakit' THEN 'sakit'
    WHEN 'annual' THEN 'cuti' WHEN 'tahunan' THEN 'cuti' WHEN 'cuti' THEN 'cuti'
    WHEN 'maternity' THEN 'cuti' WHEN 'melahirkan' THEN 'cuti'
    ELSE 'izin'
  END;
$$;

-- ── 4. Hitung status non-absen (cuti/sakit/izin/alfa) untuk satu tanggal ─────
-- p_staff NULL = semua karyawan. Idempoten: hapus baris non-absen lalu tulis ulang.
CREATE OR REPLACE FUNCTION public.hr_hitung_status_nonabsen(p_tgl date, p_staff uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hari_ini date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_n integer;
BEGIN
  DELETE FROM attendance_harian h
  WHERE h.tgl = p_tgl AND h.sumber <> 'absen'
    AND (p_staff IS NULL OR h.staff_id = p_staff);

  -- Minggu / tanggal merah: tidak ada alfa, cuti pun tidak perlu dicatat
  IF NOT hr_hari_kerja(p_tgl) THEN
    RETURN 0;
  END IF;

  INSERT INTO attendance_harian AS h (
    staff_id, outlet_id, tgl, status, sumber, keterangan, leave_id, updated_at
  )
  SELECT s.id, s.outlet_id, p_tgl,
         CASE WHEN l.id IS NOT NULL THEN hr_jenis_izin(l.leave_type) ELSE 'alfa' END,
         CASE WHEN l.id IS NOT NULL THEN 'cuti' ELSE 'alfa' END,
         CASE WHEN l.id IS NOT NULL
              THEN NULLIF(btrim(COALESCE(l.reason, '')), '')
              ELSE 'Tidak hadir tanpa keterangan' END,
         l.id,
         now()
  FROM outlet_staff s
  LEFT JOIN LATERAL (
    SELECT lr.id, lr.leave_type, lr.reason
    FROM leave_requests lr
    WHERE lr.staff_id = s.id AND lr.status = 'approved'
      AND p_tgl BETWEEN lr.start_date AND lr.end_date
    ORDER BY lr.approved_at DESC NULLS LAST, lr.created_at DESC
    LIMIT 1
  ) l ON true
  WHERE (p_staff IS NULL OR s.id = p_staff)
    AND s.outlet_id IS NOT NULL
    AND COALESCE(s.account_category, 'employee') = 'employee'
    AND s.role NOT IN ('kiosk', 'mitra', 'owner')
    -- masih bekerja pada tanggal itu
    AND (s.status = 'active' OR (s.resign_date IS NOT NULL AND p_tgl <= s.resign_date))
    AND (s.resign_date IS NULL OR p_tgl <= s.resign_date)
    AND p_tgl >= GREATEST(
          COALESCE(s.join_date, (s.created_at AT TIME ZONE 'Asia/Jakarta')::date),
          (s.created_at AT TIME ZONE 'Asia/Jakarta')::date)
    -- sudah absen (di outlet mana pun) → bukan urusan fungsi ini
    AND NOT EXISTS (
      SELECT 1 FROM attendance_harian a
      WHERE a.staff_id = s.id AND a.tgl = p_tgl AND a.sumber = 'absen'
    )
    -- cuti/izin/sakit dicatat kapan pun (termasuk yang akan datang);
    -- alfa hanya untuk hari yang sudah lewat, sejak tanggal mulai pelacakan, dan
    -- sejak karyawan PERTAMA KALI memakai absensi (sebelum itu sistem tidak bisa
    -- menilai — mis. staf pusat yang baru mulai absen di app pertengahan bulan)
    AND (l.id IS NOT NULL OR (
          p_tgl < v_hari_ini
          AND p_tgl >= hr_alfa_mulai()
          AND EXISTS (
            SELECT 1 FROM attendance_harian f
            WHERE f.staff_id = s.id AND f.sumber = 'absen' AND f.tgl <= p_tgl
          )))
  ON CONFLICT (staff_id, outlet_id, tgl) DO NOTHING;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_hitung_status_rentang(p_from date, p_to date, p_staff uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE d date; n integer := 0;
BEGIN
  IF p_to < p_from OR p_to - p_from > 800 THEN
    RAISE EXCEPTION 'Rentang tidak valid (maks 800 hari): % s/d %', p_from, p_to;
  END IF;
  FOR d IN SELECT generate_series(p_from, p_to, interval '1 day')::date LOOP
    n := n + hr_hitung_status_nonabsen(d, p_staff);
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_hitung_status_nonabsen(date, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hr_hitung_status_rentang(date, date, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hr_alfa_mulai() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hr_hari_kerja(date) FROM PUBLIC, anon;

-- ── 5. Rekap absen: tandai sumber & sinkronkan status non-absen ──────────────
CREATE OR REPLACE FUNCTION public.attendance_harian_hitung(p_staff uuid, p_outlet uuid, p_tgl date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('attendance_harian:' || p_staff || ':' || p_outlet || ':' || p_tgl, 0));

  WITH raw AS (
    SELECT a.id, a.type, a.ts_server, a.status, a.selfie_url, a.gps_lat, a.gps_lng,
           a.telat_menit, a.is_manual_button
    FROM attendance a
    WHERE a.outlet_staff_id = p_staff
      AND a.outlet_id = p_outlet
      AND a.ts_server >= (p_tgl::timestamp AT TIME ZONE 'Asia/Jakarta')
      AND a.ts_server <  ((p_tgl + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
  ),
  agg AS (
    SELECT
      (array_agg(r.id ORDER BY r.ts_server))[1]                                           AS first_id,
      min(r.ts_server)                                                                     AS first_ts,
      min(r.ts_server) FILTER (WHERE r.type = 'in')                                        AS clock_in,
      max(r.ts_server) FILTER (WHERE r.type = 'out')                                       AS clock_out,
      (array_agg(r.status ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]           AS status_in,
      (array_agg(r.telat_menit ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]      AS telat_in,
      COALESCE(sum(r.telat_menit) FILTER (
        WHERE r.type = 'in' AND (COALESCE(r.telat_menit, 0) > 0 OR r.status IN ('telat', 'terlambat'))
      ), 0)::integer                                                                       AS telat_denda,
      COALESCE((array_agg(r.is_manual_button ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1], false) AS manual_in,
      (array_agg(r.selfie_url ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]       AS selfie_in,
      (array_agg(r.gps_lat ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]          AS lat,
      (array_agg(r.gps_lng ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]          AS lng,
      (array_agg(r.selfie_url ORDER BY r.ts_server DESC) FILTER (WHERE r.type = 'out'))[1] AS selfie_out,
      count(*) AS n
    FROM raw r
  )
  INSERT INTO attendance_harian AS h (
    staff_id, outlet_id, tgl, first_id, first_ts, clock_in, clock_out, status_in, status,
    telat_menit, telat_menit_denda, manual_in, selfie_in, selfie_out, lat, lng,
    sumber, keterangan, leave_id, updated_at
  )
  SELECT p_staff, p_outlet, p_tgl, g.first_id, g.first_ts, g.clock_in, g.clock_out, g.status_in,
    CASE
      WHEN g.status_in IN ('telat', 'terlambat', 'telat_toleransi') THEN 'terlambat'
      WHEN g.status_in IN ('alpha', 'alfa') THEN 'alfa'
      ELSE 'hadir'
    END,
    CASE WHEN g.status_in IN ('telat', 'terlambat', 'telat_toleransi') THEN COALESCE(g.telat_in, 0) ELSE 0 END,
    g.telat_denda, g.manual_in, g.selfie_in, g.selfie_out, g.lat, g.lng,
    'absen', NULL, NULL, now()
  FROM agg g
  WHERE g.n > 0
  ON CONFLICT (staff_id, outlet_id, tgl) DO UPDATE SET
    first_id = EXCLUDED.first_id, first_ts = EXCLUDED.first_ts,
    clock_in = EXCLUDED.clock_in, clock_out = EXCLUDED.clock_out,
    status_in = EXCLUDED.status_in, status = EXCLUDED.status,
    telat_menit = EXCLUDED.telat_menit, telat_menit_denda = EXCLUDED.telat_menit_denda,
    manual_in = EXCLUDED.manual_in, selfie_in = EXCLUDED.selfie_in, selfie_out = EXCLUDED.selfie_out,
    lat = EXCLUDED.lat, lng = EXCLUDED.lng,
    sumber = 'absen', keterangan = NULL, leave_id = NULL, updated_at = now();

  IF NOT FOUND THEN
    DELETE FROM attendance_harian
    WHERE staff_id = p_staff AND outlet_id = p_outlet AND tgl = p_tgl AND sumber = 'absen';
  END IF;

  -- Absen masuk → alfa/cuti hari itu gugur; absen dihapus → alfa/cuti dihitung ulang
  PERFORM hr_hitung_status_nonabsen(p_tgl, p_staff);
END;
$$;

-- ── 6. Trigger: cuti disetujui/dibatalkan, tanggal merah, data karyawan ──────
CREATE OR REPLACE FUNCTION public.trg_leave_status_harian()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE d date;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.start_date IS NOT NULL AND OLD.end_date IS NOT NULL THEN
    FOR d IN SELECT generate_series(OLD.start_date, LEAST(OLD.end_date, OLD.start_date + 400), interval '1 day')::date LOOP
      PERFORM hr_hitung_status_nonabsen(d, OLD.staff_id);
    END LOOP;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
    FOR d IN SELECT generate_series(NEW.start_date, LEAST(NEW.end_date, NEW.start_date + 400), interval '1 day')::date LOOP
      PERFORM hr_hitung_status_nonabsen(d, NEW.staff_id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_leave_status_harian() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_leave_status_harian ON public.leave_requests;
CREATE TRIGGER trg_leave_status_harian
  AFTER INSERT OR DELETE OR UPDATE OF status, start_date, end_date, leave_type, reason, staff_id
  ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_leave_status_harian();

CREATE OR REPLACE FUNCTION public.trg_hari_libur_status_harian()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN PERFORM hr_hitung_status_nonabsen(OLD.tanggal, NULL); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN PERFORM hr_hitung_status_nonabsen(NEW.tanggal, NULL); END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_hari_libur_status_harian() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_hari_libur_status_harian ON public.hari_libur;
CREATE TRIGGER trg_hari_libur_status_harian
  AFTER INSERT OR DELETE OR UPDATE OF tanggal, aktif ON public.hari_libur
  FOR EACH ROW EXECUTE FUNCTION public.trg_hari_libur_status_harian();

-- Data karyawan yang menentukan kelayakan alfa berubah → hitung ulang periode lacak
CREATE OR REPLACE FUNCTION public.trg_staff_status_harian()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM hr_hitung_status_rentang(
    hr_alfa_mulai(),
    GREATEST(hr_alfa_mulai(), (now() AT TIME ZONE 'Asia/Jakarta')::date),
    NEW.id);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_staff_status_harian() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_staff_status_harian ON public.outlet_staff;
CREATE TRIGGER trg_staff_status_harian
  AFTER UPDATE OF status, resign_date, join_date, outlet_id, account_category, role
  ON public.outlet_staff
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
     OR OLD.resign_date IS DISTINCT FROM NEW.resign_date
     OR OLD.join_date IS DISTINCT FROM NEW.join_date
     OR OLD.outlet_id IS DISTINCT FROM NEW.outlet_id
     OR OLD.account_category IS DISTINCT FROM NEW.account_category
     OR OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.trg_staff_status_harian();

-- ── 7. Cron harian: tutup hari kemarin (00:10 WIB) + 7 hari ke belakang ──────
DO $$ BEGIN
  PERFORM cron.unschedule('mark-alpha');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('hr-status-kehadiran-harian');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- pg_cron memakai UTC: 17:10 UTC = 00:10 WIB
SELECT cron.schedule(
  'hr-status-kehadiran-harian',
  '10 17 * * *',
  $cron$SELECT public.hr_hitung_status_rentang(
           ((now() AT TIME ZONE 'Asia/Jakarta')::date - 7),
           ((now() AT TIME ZONE 'Asia/Jakarta')::date - 1));$cron$
);

-- ── 8. RPC halaman: status baru + ringkasan lengkap ──────────────────────────
CREATE OR REPLACE FUNCTION public.hr_absensi_harian(
  p_from           date,
  p_to             date,
  p_outlet         uuid    DEFAULT NULL,
  p_status         text    DEFAULT NULL,
  p_search         text    DEFAULT NULL,
  p_exclude_staff  uuid[]  DEFAULT '{}',
  p_exclude_outlet uuid[]  DEFAULT '{}',
  p_limit          integer DEFAULT 50,
  p_offset         integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status  text := NULLIF(NULLIF(p_status, ''), 'all');
  v_q       text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_staff   uuid[];
  v_ex_s    uuid[] := COALESCE(p_exclude_staff, '{}');
  v_ex_o    uuid[] := COALESCE(p_exclude_outlet, '{}');
  v_limit   integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 5000);
  v_offset  integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_ring    jsonb;
  v_total   bigint;
  v_rows    jsonb;
BEGIN
  IF v_q IS NOT NULL THEN
    v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    SELECT COALESCE(array_agg(s.id), '{}') INTO v_staff
    FROM outlet_staff s
    WHERE s.name ILIKE v_q OR s.username ILIKE v_q;
  END IF;

  SELECT
    jsonb_build_object(
      'hadir',     count(*) FILTER (WHERE h.status = 'hadir'),
      'terlambat', count(*) FILTER (WHERE h.status = 'terlambat'),
      'izin',      count(*) FILTER (WHERE h.status = 'izin'),
      'sakit',     count(*) FILTER (WHERE h.status = 'sakit'),
      'cuti',      count(*) FILTER (WHERE h.status = 'cuti'),
      'alfa',      count(*) FILTER (WHERE h.status = 'alfa')
    ),
    count(*) FILTER (WHERE v_status IS NULL OR h.status = v_status)
  INTO v_ring, v_total
  FROM attendance_harian h
  WHERE h.tgl BETWEEN p_from AND p_to
    AND (p_outlet IS NULL OR h.outlet_id = p_outlet)
    AND NOT (h.staff_id = ANY (v_ex_s))
    AND NOT (h.outlet_id = ANY (v_ex_o))
    AND (v_staff IS NULL OR h.staff_id = ANY (v_staff));

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', COALESCE(p.first_id::text, p.staff_id || ':' || p.tgl),
      'staff_id', p.staff_id,
      'outlet_id', p.outlet_id,
      'date', to_char(p.tgl, 'YYYY-MM-DD'),
      'clock_in', p.clock_in,
      'clock_out', p.clock_out,
      'status', p.status,
      'sumber', p.sumber,
      'late_minutes', p.telat_menit,
      'notes', CASE WHEN p.sumber = 'absen' THEN NULLIF(concat_ws(', ',
          CASE WHEN p.manual_in THEN 'Absen Manual' END,
          CASE WHEN p.status_in = 'telat_toleransi' THEN 'Telat dalam toleransi' END), '')
        ELSE p.keterangan END,
      'selfie_in', p.selfie_in,
      'selfie_out', p.selfie_out,
      'lat', p.lat,
      'lng', p.lng,
      'created_at', p.first_ts,
      'outlet_staff', CASE WHEN s.id IS NULL THEN NULL ELSE
        jsonb_build_object('name', s.name, 'role', s.role, 'username', s.username) END,
      'outlets', CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object('name', o.name) END
    ) ORDER BY p.tgl DESC, p.clock_in DESC NULLS LAST, p.staff_id), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT h.*
    FROM attendance_harian h
    WHERE h.tgl BETWEEN p_from AND p_to
      AND (p_outlet IS NULL OR h.outlet_id = p_outlet)
      AND (v_status IS NULL OR h.status = v_status)
      AND NOT (h.staff_id = ANY (v_ex_s))
      AND NOT (h.outlet_id = ANY (v_ex_o))
      AND (v_staff IS NULL OR h.staff_id = ANY (v_staff))
    ORDER BY h.tgl DESC, h.clock_in DESC NULLS LAST, h.staff_id
    LIMIT v_limit OFFSET v_offset
  ) p
  LEFT JOIN outlet_staff s ON s.id = p.staff_id
  LEFT JOIN outlets o      ON o.id = p.outlet_id;

  RETURN jsonb_build_object('total', v_total, 'ringkasan', v_ring, 'rows', v_rows);
END;
$$;

-- ── 9. Backfill: dari tanggal mulai pelacakan s/d cuti terjauh yang disetujui ─
SELECT public.hr_hitung_status_rentang(
  public.hr_alfa_mulai(),
  GREATEST(
    (now() AT TIME ZONE 'Asia/Jakarta')::date,
    COALESCE((SELECT max(end_date) FROM leave_requests WHERE status = 'approved'), public.hr_alfa_mulai())));
