-- =============================================================================
-- Jadwal khusus STAF di outlet + penambal identitas submit_attendance.
--
-- 1. Aturan bernama per outlet ("Masuk Sore" di Outlet X, 15:00–23:00) berisi daftar
--    staf. Staf anggota absen memakai jam aturan itu; staf lain di outlet yang sama
--    tetap memakai jadwal outlet / aturan pusat. Berlaku setiap hari. Toleransi telat
--    dan radius tetap milik outlet. Staf beraturan tidak memilih shift.
--    Satu staf hanya boleh ada di satu aturan per outlet (PK member = staff+outlet).
--
-- 2. Shift penutup: jam pulang terakhir outlet kini ikut memperhitungkan aturan staf
--    di outlet itu. Tanpa ini, crew yang pulang 17:00 di outlet satu shift tetap
--    dianggap penutup dan tertahan laci kasir yang masih dipakai staf shift 15–23.
--    Outlet tanpa aturan staf: perilaku identik dengan sebelumnya.
--
-- 3. submit_attendance dulu tidak memeriksa pemanggil sama sekali (SECURITY DEFINER,
--    EXECUTE terbuka untuk anon): siapa pun dengan anon key bisa mencatat absen staf
--    mana pun. Kini target WAJIB = auth.uid(), kecuali service_role (route web kiosk
--    /api/submit-attendance yang mencocokkan wajah dulu di server). EXECUTE untuk anon
--    dicabut; pemeriksaan `auth_required` di dalam fungsi adalah lapis kedua bila grant
--    itu suatu saat terbuka lagi (sengaja bukan `unauthenticated`: APK lama membuang item
--    antrean offline untuk alasan itu).
--
-- Dasar fungsi = definisi LIVE (pg_get_functiondef, 30 Sep 2026), bukan file repo —
-- 20300235000000 (untracked) berisi versi yang lebih tua dan tersortir sesudah
-- 20260928095531.
-- =============================================================================

-- ---------------------------------------------------------------- Tabel
CREATE TABLE IF NOT EXISTS public.attendance_staff_schedule (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id   uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  nama        text NOT NULL CHECK (length(btrim(nama)) BETWEEN 1 AND 60),
  jam_masuk   time NOT NULL,
  jam_keluar  time NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  CONSTRAINT ass_jam_berbeda CHECK (jam_masuk <> jam_keluar),
  -- Target FK komposit anggota: menjamin outlet_id anggota = outlet_id aturannya.
  CONSTRAINT ass_id_outlet_unik UNIQUE (id, outlet_id)
);
CREATE INDEX IF NOT EXISTS ass_outlet_idx ON public.attendance_staff_schedule (outlet_id);

CREATE TABLE IF NOT EXISTS public.attendance_staff_schedule_member (
  staff_id    uuid NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  outlet_id   uuid NOT NULL,
  schedule_id uuid NOT NULL,
  -- Satu staf satu aturan per outlet; sekaligus index pencarian di submit_attendance.
  PRIMARY KEY (staff_id, outlet_id),
  FOREIGN KEY (schedule_id, outlet_id)
    REFERENCES public.attendance_staff_schedule (id, outlet_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS assm_schedule_idx ON public.attendance_staff_schedule_member (schedule_id);

-- Hanya lewat RPC. RLS tanpa policy = tertutup untuk akses tabel langsung.
ALTER TABLE public.attendance_staff_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_staff_schedule_member ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_staff_schedule, public.attendance_staff_schedule_member FROM anon, authenticated;

-- ---------------------------------------------------------------- Helper
-- Menit sejak 00:00 untuk jam pulang; pulang lewat tengah malam (keluar < masuk) = +1440.
CREATE OR REPLACE FUNCTION public.menit_pulang(p_masuk time, p_keluar time)
RETURNS int
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT extract(hour from p_keluar)::int * 60 + extract(minute from p_keluar)::int
         + CASE WHEN p_keluar < p_masuk THEN 1440 ELSE 0 END
$$;

-- Jam pulang PALING AKHIR di outlet — patokan shift penutup. Menggabungkan shift outlet
-- (bila pilihan shift aktif), jam outlet / pusat, dan seluruh aturan staf di outlet itu.
CREATE OR REPLACE FUNCTION public.menit_pulang_penutup_outlet(p_outlet_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH cfg AS (
    SELECT c.jam_masuk, c.jam_keluar, coalesce(c.pilih_shift_aktif, false) AS pilih
      FROM outlet_attendance_config c WHERE c.outlet_id = p_outlet_id
  ), pusat AS (
    SELECT coalesce((value->>'jam_masuk')::time, '09:00') AS jam_masuk,
           coalesce((value->>'jam_keluar')::time, '17:00') AS jam_keluar
      FROM global_settings WHERE key = 'global_attendance_config'
  ), outlet_close AS (
    SELECT CASE
             WHEN (SELECT pilih FROM cfg) THEN
               (SELECT max(menit_pulang(s.jam_masuk, s.jam_keluar))
                  FROM outlet_attendance_shift s WHERE s.outlet_id = p_outlet_id)
           END AS shift_maks,
           coalesce(
             (SELECT menit_pulang(jam_masuk, coalesce(jam_keluar, '17:00')) FROM cfg),
             (SELECT menit_pulang(jam_masuk, jam_keluar) FROM pusat),
             17 * 60) AS jam_outlet
  )
  SELECT greatest(
           coalesce((SELECT shift_maks FROM outlet_close), (SELECT jam_outlet FROM outlet_close)),
           (SELECT max(menit_pulang(a.jam_masuk, a.jam_keluar))
              FROM attendance_staff_schedule a WHERE a.outlet_id = p_outlet_id))
$$;

REVOKE ALL ON FUNCTION public.menit_pulang_penutup_outlet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.menit_pulang_penutup_outlet(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------- RPC pengaturan
CREATE OR REPLACE FUNCTION public.list_jadwal_staf()
RETURNS TABLE(id uuid, outlet_id uuid, outlet_name text, nama text, jam_masuk text, jam_keluar text,
              anggota jsonb, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
#variable_conflict use_column
BEGIN
  PERFORM assert_attendance_settings_admin();
  RETURN QUERY
    SELECT j.id, j.outlet_id, o.name::text, j.nama,
           left(j.jam_masuk::text, 5), left(j.jam_keluar::text, 5),
           coalesce((
             SELECT jsonb_agg(jsonb_build_object(
                      'staff_id', s.id, 'nama', s.name, 'role', s.role, 'status', s.status)
                    ORDER BY s.name)
               FROM attendance_staff_schedule_member m
               JOIN outlet_staff s ON s.id = m.staff_id
              WHERE m.schedule_id = j.id
           ), '[]'::jsonb),
           j.updated_at
      FROM attendance_staff_schedule j
      JOIN outlets o ON o.id = j.outlet_id
     ORDER BY o.name, j.jam_masuk, j.nama;
END;
$$;

-- Staf yang wajar dipilih untuk aturan di outlet ini: outlet utama, penempatan HR, atau
-- izin absen tambahan. Staf "semua outlet" dan peran pengawas tidak ikut didaftar
-- (membanjiri daftar), tapi tetap diterima simpan_jadwal_staf bila dikirim.
CREATE OR REPLACE FUNCTION public.kandidat_jadwal_staf(p_outlet_id uuid)
RETURNS TABLE(staff_id uuid, nama text, role text, jadwal_id uuid, jadwal_nama text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
#variable_conflict use_column
BEGIN
  PERFORM assert_attendance_settings_admin();
  RETURN QUERY
    SELECT s.id, s.name, s.role, m.schedule_id, j.nama
      FROM outlet_staff s
      LEFT JOIN attendance_staff_schedule_member m
             ON m.staff_id = s.id AND m.outlet_id = p_outlet_id
      LEFT JOIN attendance_staff_schedule j ON j.id = m.schedule_id
     WHERE s.status = 'active'
       AND s.role <> 'kiosk'
       AND (s.outlet_id = p_outlet_id
            OR EXISTS (SELECT 1 FROM staff_outlets so WHERE so.staff_id = s.id AND so.outlet_id = p_outlet_id)
            OR EXISTS (SELECT 1 FROM attendance_outlet_access a WHERE a.staff_id = s.id AND a.outlet_id = p_outlet_id)
            OR m.staff_id IS NOT NULL)
     ORDER BY s.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.simpan_jadwal_staf(
  p_id uuid,
  p_outlet_id uuid,
  p_nama text,
  p_jam_masuk text,
  p_jam_keluar text,
  p_staff_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id      uuid := p_id;
  v_nama    text := btrim(coalesce(p_nama, ''));
  v_masuk   time;
  v_keluar  time;
  v_staff   uuid[];
  v_bentrok text;
  v_tanpa   text;
BEGIN
  PERFORM assert_attendance_settings_admin();

  IF p_outlet_id IS NULL OR NOT EXISTS (SELECT 1 FROM outlets WHERE id = p_outlet_id) THEN
    RAISE EXCEPTION 'Outlet tidak ditemukan.' USING errcode = '22023';
  END IF;
  IF length(v_nama) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Nama aturan wajib diisi (maksimal 60 karakter).' USING errcode = '22023';
  END IF;
  BEGIN
    v_masuk  := p_jam_masuk::time;
    v_keluar := p_jam_keluar::time;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Format jam harus HH:MM.' USING errcode = '22023';
  END;
  IF v_masuk IS NULL OR v_keluar IS NULL THEN
    RAISE EXCEPTION 'Jam masuk dan jam pulang wajib diisi.' USING errcode = '22023';
  END IF;
  IF v_masuk = v_keluar THEN
    RAISE EXCEPTION 'Jam masuk dan jam pulang tidak boleh sama.' USING errcode = '22023';
  END IF;

  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO v_staff FROM unnest(p_staff_ids) x WHERE x IS NOT NULL;
  IF cardinality(v_staff) = 0 THEN
    RAISE EXCEPTION 'Pilih minimal satu staf.' USING errcode = '22023';
  END IF;
  IF cardinality(v_staff) > 300 THEN
    RAISE EXCEPTION 'Maksimal 300 staf per aturan.' USING errcode = '22023';
  END IF;

  -- Staf harus ada dan boleh absen di outlet ini (aturan yang sama dengan cek cross_outlet).
  SELECT string_agg(coalesce(s.name, x::text), ', ' ORDER BY s.name) INTO v_tanpa
    FROM unnest(v_staff) x
    LEFT JOIN outlet_staff s ON s.id = x
   WHERE s.id IS NULL
      OR s.role = 'kiosk'
      OR NOT (absen_peran_global(s.role)
              OR s.outlet_id = p_outlet_id
              OR EXISTS (SELECT 1 FROM attendance_outlet_access a WHERE a.staff_id = x AND a.outlet_id = p_outlet_id)
              OR EXISTS (SELECT 1 FROM staff_outlets so WHERE so.staff_id = x AND so.outlet_id = p_outlet_id)
              OR EXISTS (SELECT 1 FROM attendance_any_outlet_staff z WHERE z.staff_id = x));
  IF v_tanpa IS NOT NULL THEN
    RAISE EXCEPTION 'Staf berikut tidak punya akses absen di outlet ini: %', v_tanpa USING errcode = '22023';
  END IF;

  IF v_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM attendance_staff_schedule WHERE id = v_id AND outlet_id = p_outlet_id) THEN
      RAISE EXCEPTION 'Aturan tidak ditemukan, atau outletnya berbeda (outlet aturan tidak bisa diganti — buat aturan baru).'
        USING errcode = '22023';
    END IF;
    -- Kunci baris aturan: dua admin menyimpan aturan yang sama bergantian, bukan bertumpuk.
    PERFORM 1 FROM attendance_staff_schedule WHERE id = v_id FOR UPDATE;
  END IF;

  SELECT string_agg(format('%s (%s)', s.name, j.nama), ', ' ORDER BY s.name) INTO v_bentrok
    FROM attendance_staff_schedule_member m
    JOIN attendance_staff_schedule j ON j.id = m.schedule_id
    JOIN outlet_staff s ON s.id = m.staff_id
   WHERE m.outlet_id = p_outlet_id
     AND m.staff_id = ANY (v_staff)
     AND m.schedule_id IS DISTINCT FROM v_id;
  IF v_bentrok IS NOT NULL THEN
    RAISE EXCEPTION 'Sudah punya jadwal khusus lain di outlet ini: %', v_bentrok USING errcode = '23505';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO attendance_staff_schedule (outlet_id, nama, jam_masuk, jam_keluar, updated_by)
    VALUES (p_outlet_id, v_nama, v_masuk, v_keluar, auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE attendance_staff_schedule
       SET nama = v_nama, jam_masuk = v_masuk, jam_keluar = v_keluar,
           updated_at = now(), updated_by = auth.uid()
     WHERE id = v_id;
    DELETE FROM attendance_staff_schedule_member
     WHERE schedule_id = v_id AND NOT (staff_id = ANY (v_staff));
  END IF;

  INSERT INTO attendance_staff_schedule_member (staff_id, outlet_id, schedule_id)
  SELECT x, p_outlet_id, v_id FROM unnest(v_staff) x
  ON CONFLICT (staff_id, outlet_id) DO NOTHING;

  -- ON CONFLICT DO NOTHING di atas bisa diam-diam melewati staf yang diserobot aturan lain
  -- di antara pengecekan dan insert. Pastikan semuanya benar-benar milik aturan ini.
  IF EXISTS (
    SELECT 1 FROM unnest(v_staff) x
     WHERE NOT EXISTS (SELECT 1 FROM attendance_staff_schedule_member m
                        WHERE m.staff_id = x AND m.outlet_id = p_outlet_id AND m.schedule_id = v_id)
  ) THEN
    RAISE EXCEPTION 'Sebagian staf baru saja dimasukkan ke aturan lain. Muat ulang lalu coba lagi.'
      USING errcode = '23505';
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.hapus_jadwal_staf(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM assert_attendance_settings_admin();
  DELETE FROM attendance_staff_schedule WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_jadwal_staf() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kandidat_jadwal_staf(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simpan_jadwal_staf(uuid, uuid, text, text, text, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hapus_jadwal_staf(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_jadwal_staf() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kandidat_jadwal_staf(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.simpan_jadwal_staf(uuid, uuid, text, text, text, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hapus_jadwal_staf(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------- attendance_shift_config
-- + p_staff_id (default: pemanggil) → field `jadwal_staf` & `menit_pulang_penutup`.
-- Outlet tanpa config tetap NULL KECUALI staf punya aturan di sana: saat itu jam outlet
-- diisi dari aturan pusat supaya APK lama (yang menganggap non-null = config outlet)
-- tetap mendapat jam yang benar.
DROP FUNCTION IF EXISTS public.attendance_shift_config(uuid);
CREATE OR REPLACE FUNCTION public.attendance_shift_config(p_outlet_id uuid, p_staff_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_staff  uuid := coalesce(p_staff_id, auth.uid());
  v_cfg    jsonb;
  v_jadwal jsonb;
  v_global jsonb;
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
           'nama', j.nama,
           'jam_masuk', left(j.jam_masuk::text, 5),
           'jam_keluar', left(j.jam_keluar::text, 5))
    INTO v_jadwal
    FROM attendance_staff_schedule_member m
    JOIN attendance_staff_schedule j ON j.id = m.schedule_id
   WHERE m.staff_id = v_staff AND m.outlet_id = p_outlet_id;

  SELECT jsonb_build_object(
           'jam_masuk', left(c.jam_masuk::text, 5),
           'jam_keluar', left(c.jam_keluar::text, 5),
           'pilih_shift_aktif', coalesce(c.pilih_shift_aktif, false),
           'shift2_jam_masuk', left(c.shift2_jam_masuk::text, 5),
           'shift2_jam_keluar', left(c.shift2_jam_keluar::text, 5),
           'shifts', coalesce((
             SELECT jsonb_agg(jsonb_build_object(
                      'ke', s.urutan, 'nama', s.nama,
                      'jam_masuk', left(s.jam_masuk::text, 5),
                      'jam_keluar', left(s.jam_keluar::text, 5)) ORDER BY s.urutan)
               FROM outlet_attendance_shift s WHERE s.outlet_id = c.outlet_id
           ), '[]'::jsonb))
    INTO v_cfg
    FROM outlet_attendance_config c
   WHERE c.outlet_id = p_outlet_id;

  IF v_cfg IS NULL THEN
    IF v_jadwal IS NULL THEN
      RETURN NULL;
    END IF;
    SELECT value INTO v_global FROM global_settings WHERE key = 'global_attendance_config';
    v_cfg := jsonb_build_object(
      'jam_masuk', coalesce(left(v_global->>'jam_masuk', 5), '09:00'),
      'jam_keluar', coalesce(left(v_global->>'jam_keluar', 5), '17:00'),
      'pilih_shift_aktif', false,
      'shift2_jam_masuk', NULL,
      'shift2_jam_keluar', NULL,
      'shifts', '[]'::jsonb);
  END IF;

  RETURN v_cfg || jsonb_build_object(
    'jadwal_staf', v_jadwal,
    'menit_pulang_penutup', menit_pulang_penutup_outlet(p_outlet_id));
END;
$$;

-- anon tetap boleh memanggil (hasilnya selalu NULL, sama seperti sebelumnya): APK lama yang
-- sesinya dibuka dari snapshot offline memanggil dengan anon key, dan NULL jauh lebih
-- aman bagi mereka daripada 401.
REVOKE ALL ON FUNCTION public.attendance_shift_config(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attendance_shift_config(uuid, uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------- submit_attendance
CREATE OR REPLACE FUNCTION public.submit_attendance(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id               uuid;
  v_target_staff_id  uuid;
  v_outlet_id        uuid;
  v_type             text;
  v_gps_lat          double precision;
  v_gps_lng          double precision;
  v_gps_accuracy     numeric;
  v_is_manual        boolean;
  v_distance_m       numeric;
  v_now_server       timestamptz := now();
  v_now_efektif      timestamptz;
  v_target_staff     record;
  v_target_outlet    record;
  v_status           text;
  v_telat_menit      int;
  v_cfg_found        boolean;
  v_cfg_jam_masuk    time;
  v_cfg_jam_keluar   time;
  v_cfg_toleransi    int;
  v_cfg_window_mode  text;
  v_global_cfg       jsonb;
  v_now_local        timestamp;
  v_now_minutes      int;
  v_in_minutes       int;
  v_out_minutes      int;
  v_deadline_minutes int;
  v_diff_minutes     int;
  v_cfg_pilih_shift  boolean;
  v_opsi_shift       boolean;
  v_shift_ke         int;
  v_shift_masuk      time;
  v_shift_keluar     time;
  v_jam_masuk_ef     time;
  v_jam_keluar_ef    time;
  v_pulang_milik     int;
  v_pulang_maks      int;
  v_penutup          boolean := true;
  v_ts_client        timestamptz;
  v_offline          boolean := false;
  v_jam_diragukan    boolean := false;
  v_status_lama      text;
  v_di_kantor_pusat  boolean := false;
  v_radius_m         numeric;
  v_source           text;
  v_aturan_masuk     time;
  v_aturan_keluar    time;
  v_pulang_aturan    int;
  -- Cadangan bila outlet maupun pusat tidak mengisi radius — sama dengan
  -- GEOFENCE_RADIUS_M di apps/absensi/src/lib/gps.ts.
  DEFAULT_RADIUS_M   CONSTANT numeric := 100;
  MAX_GPS_ACCURACY_M CONSTANT numeric := 150;
  -- Shift khusus driver (09:00–18:00) di luar daftar shift outlet. Klien baru mengirim 99;
  -- APK lama mengirim 3, dipakai hanya bila outlet tidak punya shift urutan 3.
  DRIVER_SHIFT_KE    CONSTANT int := 99;
BEGIN
  v_id              := coalesce((payload->>'id')::uuid, gen_random_uuid());
  v_target_staff_id := (payload->>'outlet_staff_id')::uuid;
  v_outlet_id       := (payload->>'outlet_id')::uuid;
  v_type            := coalesce(payload->>'type', 'in');
  v_gps_lat         := (payload->>'gps_lat')::double precision;
  v_gps_lng         := (payload->>'gps_lng')::double precision;
  v_gps_accuracy    := (payload->>'gps_accuracy')::numeric;
  v_is_manual       := coalesce((payload->>'is_manual_button')::boolean, false);
  v_shift_ke        := (payload->>'shift_ke')::int;
  v_ts_client       := (payload->>'ts_client')::timestamptz;
  -- Native mengirim `is_offline`, route web meneruskan `from_queue` sebagai `sumber_offline`.
  v_offline         := coalesce(
                         (payload->>'sumber_offline')::boolean,
                         (payload->>'is_offline')::boolean,
                         (payload->>'from_queue')::boolean,
                         false);
  v_source          := CASE WHEN payload->>'source' = 'web' THEN 'web' ELSE 'native' END;

  IF v_target_staff_id IS NULL OR v_outlet_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  END IF;

  -- Identitas: hanya untuk diri sendiri, kecuali route server (service_role) yang sudah
  -- mencocokkan wajah staf target — itulah jalur kiosk web.
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'auth_required');
    END IF;
    IF auth.uid() <> v_target_staff_id THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_staff');
    END IF;
  END IF;

  SELECT role, outlet_id, status INTO v_target_staff
    FROM outlet_staff WHERE id = v_target_staff_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'staff_not_found');
  END IF;
  IF v_target_staff.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'staff_inactive');
  END IF;

  -- Izin outlet: peran pengawas, outlet utama, penempatan (staff_outlets), izin tambahan
  -- dan izin semua outlet dari admin/developer. Urutan termurah dulu.
  IF NOT absen_peran_global(v_target_staff.role)
     AND v_target_staff.outlet_id IS DISTINCT FROM v_outlet_id
     AND NOT EXISTS (SELECT 1 FROM attendance_outlet_access
                      WHERE staff_id = v_target_staff_id AND outlet_id = v_outlet_id)
     AND NOT EXISTS (SELECT 1 FROM staff_outlets
                      WHERE staff_id = v_target_staff_id AND outlet_id = v_outlet_id)
     AND NOT EXISTS (SELECT 1 FROM attendance_any_outlet_staff
                      WHERE staff_id = v_target_staff_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cross_outlet');
  END IF;

  SELECT lat, lng, is_active, slug, type, name INTO v_target_outlet
    FROM outlets WHERE id = v_outlet_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'outlet_not_found');
  END IF;
  IF v_target_outlet.is_active = false THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'outlet_inactive');
  END IF;

  -- Deteksi apakah outlet ini adalah Kantor Pusat
  v_di_kantor_pusat := (
    v_outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    OR v_target_outlet.slug = 'kantor-pusat'
    OR (v_target_outlet.type = 'office' AND v_target_outlet.name ILIKE '%kantor%')
  );

  -- Validasi GPS (kecuali bila koordinat outlet null)
  IF v_target_outlet.lat IS NOT NULL AND v_target_outlet.lng IS NOT NULL THEN
    IF coalesce(v_gps_accuracy, 999) > MAX_GPS_ACCURACY_M THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gps_accuracy_low');
    END IF;
    IF v_gps_lat IS NULL OR v_gps_lng IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'location_required');
    END IF;

    -- Radius: jadwal khusus outlet -> pengaturan pusat -> 100 m (urutan route web).
    SELECT nullif(radius_m, 0) INTO v_radius_m
      FROM outlet_attendance_config WHERE outlet_id = v_outlet_id;
    IF coalesce(v_radius_m, 0) <= 0 THEN
      SELECT nullif(value->>'radius_m', '')::numeric INTO v_radius_m
        FROM global_settings WHERE key = 'global_attendance_config';
    END IF;
    IF coalesce(v_radius_m, 0) <= 0 THEN
      v_radius_m := DEFAULT_RADIUS_M;
    END IF;

    v_distance_m := (
      6371000 * 2 * asin(sqrt(
        sin(radians(v_gps_lat - v_target_outlet.lat) / 2)^2 +
        cos(radians(v_target_outlet.lat)) * cos(radians(v_gps_lat)) *
        sin(radians(v_gps_lng - v_target_outlet.lng) / 2)^2
      ))
    );

    IF greatest(0, v_distance_m - v_gps_accuracy) > v_radius_m THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'too_far_from_outlet');
    END IF;
  END IF;

  v_now_efektif := v_now_server;
  IF v_offline AND v_ts_client IS NOT NULL THEN
    IF v_ts_client > v_now_server + interval '10 minutes'
       OR v_ts_client < v_now_server - interval '7 days' THEN
      v_jam_diragukan := true;
    ELSE
      v_now_efektif := v_ts_client;
    END IF;
  END IF;

  SELECT status INTO v_status_lama FROM attendance WHERE id = v_id;
  IF v_status_lama IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'status', v_status_lama, 'ts_server', v_now_server,
                              'attendance_id', v_id, 'duplikat', true);
  END IF;

  IF v_type = 'in' THEN
    IF EXISTS (
      SELECT 1 FROM attendance
      WHERE outlet_staff_id = v_target_staff_id
        AND type = 'in'
        AND status <> 'alpha'
        AND ts_server >= (v_now_efektif - interval '12 hours')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'already_clocked_in');
    END IF;
  END IF;

  SELECT true, jam_masuk, jam_keluar, toleransi_menit, absen_window_mode, pilih_shift_aktif
    INTO v_cfg_found, v_cfg_jam_masuk, v_cfg_jam_keluar, v_cfg_toleransi, v_cfg_window_mode,
         v_cfg_pilih_shift
    FROM outlet_attendance_config WHERE outlet_id = v_outlet_id;

  IF NOT coalesce(v_cfg_found, false) THEN
    SELECT value INTO v_global_cfg FROM global_settings WHERE key = 'global_attendance_config';
    IF v_global_cfg IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'config_missing');
    END IF;
    v_cfg_jam_masuk   := coalesce((v_global_cfg->>'jam_masuk')::time, '09:00');
    v_cfg_jam_keluar  := coalesce((v_global_cfg->>'jam_keluar')::time, '17:00');
    v_cfg_toleransi   := coalesce((v_global_cfg->>'toleransi_menit')::int, 0);
    v_cfg_window_mode := coalesce(v_global_cfg->>'absen_window_mode', 'auto');
    v_cfg_pilih_shift := false;
  END IF;

  v_jam_masuk_ef  := v_cfg_jam_masuk;
  v_jam_keluar_ef := coalesce(v_cfg_jam_keluar, '17:00');

  -- Jadwal khusus staf di outlet ini (satu pencarian PK). Menang atas shift & jam outlet.
  SELECT j.jam_masuk, j.jam_keluar INTO v_aturan_masuk, v_aturan_keluar
    FROM attendance_staff_schedule_member m
    JOIN attendance_staff_schedule j ON j.id = m.schedule_id
   WHERE m.staff_id = v_target_staff_id AND m.outlet_id = v_outlet_id;

  -- Jam pulang aturan staf paling akhir di outlet — ikut menentukan siapa penutup.
  -- Hanya dibutuhkan absen pulang.
  IF v_type = 'out' THEN
    SELECT max(menit_pulang(a.jam_masuk, a.jam_keluar)) INTO v_pulang_aturan
      FROM attendance_staff_schedule a WHERE a.outlet_id = v_outlet_id;
  END IF;

  -- Menit pulang shift (lewat tengah malam = hari berikutnya); max = shift penutup outlet.
  IF coalesce(v_cfg_pilih_shift, false) THEN
    SELECT max(extract(hour from s.jam_keluar)::int * 60 + extract(minute from s.jam_keluar)::int
               + CASE WHEN s.jam_keluar < s.jam_masuk THEN 1440 ELSE 0 END),
           count(*) >= 2
      INTO v_pulang_maks, v_opsi_shift
      FROM outlet_attendance_shift s
     WHERE s.outlet_id = v_outlet_id;
  END IF;
  v_opsi_shift := coalesce(v_opsi_shift, false);

  IF v_aturan_keluar IS NOT NULL THEN
    -- Absen pulang memakai jam yang dibekukan saat absen masuk (aturan bisa berubah di
    -- tengah shift); tanpa jejak, jam aturan saat ini.
    IF v_type = 'out' THEN
      SELECT shift_jam_masuk, shift_jam_keluar INTO v_shift_masuk, v_shift_keluar
        FROM attendance
       WHERE outlet_staff_id = v_target_staff_id
         AND type = 'in'
         AND status <> 'alpha'
         AND ts_server >= (v_now_efektif - interval '20 hours')
       ORDER BY ts_server DESC
       LIMIT 1;
      IF v_shift_masuk IS NULL OR v_shift_keluar IS NULL THEN
        v_shift_masuk := NULL;
        v_shift_keluar := NULL;
      END IF;
    END IF;
    IF v_shift_keluar IS NULL THEN
      v_shift_masuk := v_aturan_masuk;
      v_shift_keluar := v_aturan_keluar;
    END IF;
    v_jam_masuk_ef := v_shift_masuk;
    v_jam_keluar_ef := v_shift_keluar;
    v_pulang_milik := menit_pulang(v_shift_masuk, v_shift_keluar);
    v_penutup := v_pulang_milik >= greatest(
                   coalesce(v_pulang_maks, menit_pulang(v_cfg_jam_masuk, coalesce(v_cfg_jam_keluar, '17:00'))),
                   coalesce(v_pulang_aturan, 0));
  ELSIF v_opsi_shift THEN
    IF v_type = 'out' THEN
      SELECT shift_jam_masuk, shift_jam_keluar INTO v_shift_masuk, v_shift_keluar
        FROM attendance
       WHERE outlet_staff_id = v_target_staff_id
         AND type = 'in'
         AND status <> 'alpha'
         AND ts_server >= (v_now_efektif - interval '20 hours')
       ORDER BY ts_server DESC
       LIMIT 1;
      IF v_shift_masuk IS NULL OR v_shift_keluar IS NULL THEN
        v_shift_masuk := NULL;
        v_shift_keluar := NULL;
      END IF;
    END IF;

    IF v_shift_keluar IS NULL THEN
      IF v_shift_ke IS NOT NULL THEN
        SELECT s.jam_masuk, s.jam_keluar INTO v_shift_masuk, v_shift_keluar
          FROM outlet_attendance_shift s
         WHERE s.outlet_id = v_outlet_id AND s.urutan = v_shift_ke;
      END IF;
      IF v_shift_keluar IS NULL AND v_target_staff.role = 'driver'
         AND v_shift_ke IN (3, DRIVER_SHIFT_KE) THEN
        v_shift_masuk := '09:00:00';
        v_shift_keluar := '18:00:00';
      ELSIF v_shift_keluar IS NULL AND v_type = 'in' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'shift_required');
      END IF;
    END IF;

    IF v_shift_keluar IS NOT NULL THEN
      v_jam_masuk_ef := v_shift_masuk;
      v_jam_keluar_ef := v_shift_keluar;
      v_pulang_milik := extract(hour from v_shift_keluar)::int * 60 + extract(minute from v_shift_keluar)::int
                        + CASE WHEN v_shift_keluar < v_shift_masuk THEN 1440 ELSE 0 END;
      v_penutup := v_pulang_maks IS NULL
                   OR v_pulang_milik >= greatest(v_pulang_maks, coalesce(v_pulang_aturan, 0));
    END IF;
  ELSIF v_pulang_aturan IS NOT NULL THEN
    -- Outlet satu shift yang punya staf berjadwal lebih malam: crew jam outlet bukan
    -- penutup lagi. Tanpa aturan staf di outlet ini cabang ini tidak pernah jalan.
    v_penutup := menit_pulang(v_cfg_jam_masuk, v_jam_keluar_ef) >= v_pulang_aturan;
  END IF;

  -- Gerbang absen pulang (laci kasir & pesanan) — hanya crew shift penutup dan BUKAN di Kantor Pusat.
  -- Kantor Pusat tidak ada operasional kasir / pesanan, sehingga shift kasir & order berjalan dilewati.
  IF v_type = 'out' AND v_penutup AND NOT coalesce(v_di_kantor_pusat, false) THEN
    IF EXISTS (SELECT 1 FROM shifts WHERE outlet_id = v_outlet_id AND status = 'open') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'shift_not_closed');
    END IF;
    IF EXISTS (
      SELECT 1 FROM orders
      WHERE outlet_id = v_outlet_id AND status IN ('pending','preparing','ready')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'unfinished_orders');
    END IF;
  END IF;

  v_now_local   := v_now_efektif AT TIME ZONE 'Asia/Jakarta';
  v_now_minutes := extract(hour from v_now_local)::int * 60 + extract(minute from v_now_local)::int;
  v_in_minutes  := extract(hour from v_jam_masuk_ef)::int * 60 + extract(minute from v_jam_masuk_ef)::int;
  v_out_minutes := extract(hour from v_jam_keluar_ef)::int * 60 + extract(minute from v_jam_keluar_ef)::int;

  IF v_out_minutes < v_in_minutes THEN
    v_out_minutes := v_out_minutes + 1440;
    IF v_now_minutes < v_in_minutes - 180 THEN
      v_now_minutes := v_now_minutes + 1440;
    END IF;
  END IF;

  IF coalesce(v_cfg_window_mode, 'auto') = 'auto' AND v_type = 'out' THEN
    v_deadline_minutes := v_out_minutes - 30;
    IF v_now_minutes < v_deadline_minutes THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'too_early_out');
    END IF;
  END IF;

  IF v_type = 'out' THEN
    v_deadline_minutes := v_out_minutes;
    v_diff_minutes := v_now_minutes - v_deadline_minutes;
    IF v_diff_minutes < 0 THEN
      v_status := 'lebih_awal';
      v_telat_menit := abs(v_diff_minutes);
    ELSIF v_diff_minutes >= 1 THEN
      v_status := 'pulang_telat';
      v_telat_menit := v_diff_minutes;
    ELSE
      v_status := 'tepat';
    END IF;
  ELSE
    v_deadline_minutes := v_in_minutes;
    v_diff_minutes := v_now_minutes - v_deadline_minutes;
    IF v_diff_minutes <= 0 THEN
      v_status := 'tepat';
    ELSIF v_diff_minutes <= coalesce(v_cfg_toleransi, 0) THEN
      v_status := 'telat_toleransi';
      v_telat_menit := v_diff_minutes;
    ELSE
      v_status := 'telat';
      v_telat_menit := v_diff_minutes;
    END IF;
  END IF;

  INSERT INTO attendance (
    id, outlet_staff_id, outlet_id, type, ts_server, ts_client,
    gps_lat, gps_lng, distance_m, match_distance, selfie_url,
    status, telat_menit, is_manual_button, source,
    shift_jam_masuk, shift_jam_keluar,
    sumber_offline, jam_diragukan
  ) VALUES (
    v_id, v_target_staff_id, v_outlet_id, v_type, v_now_server, v_ts_client,
    v_gps_lat, v_gps_lng, v_distance_m, coalesce((payload->>'match_distance')::numeric, 0), payload->>'selfie_path',
    v_status, v_telat_menit, v_is_manual, v_source,
    CASE WHEN v_shift_keluar IS NOT NULL THEN v_shift_masuk END,
    v_shift_keluar,
    v_offline, v_jam_diragukan
  )
  ON CONFLICT (id) DO NOTHING;

  IF v_type = 'in' AND v_target_staff.outlet_id <> v_outlet_id THEN
    UPDATE outlet_staff SET outlet_id = v_outlet_id WHERE id = v_target_staff_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_status, 'ts_server', v_now_server,
                            'attendance_id', v_id, 'jam_diragukan', v_jam_diragukan);
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_attendance(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_attendance(jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
