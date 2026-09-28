-- Absensi: izin absen per crew yang diatur admin/developer + shift outlet dinamis (1–12).
--
-- 1. IZIN ABSEN LINTAS OUTLET
--    Sebelumnya crew hanya boleh absen di outlet utama (`outlet_staff.outlet_id`) dan di
--    `staff_outlets`. Tabel itu TIDAK dipakai untuk fitur ini karena ia sekaligus membuka
--    akses DATA (accessible_outlet_ids() untuk leader/korlap/AM) — memberi leader izin
--    absen di outlet lain tidak boleh ikut membuka laporan/stok outlet tersebut.
--    Flag "semua outlet" juga tidak ditaruh di `outlet_staff`, karena policy
--    `outlet_staff_update_own_outlet` membolehkan leader mem-PATCH baris crew-nya;
--    izin ini hanya boleh diubah admin & developer.
--      * attendance_outlet_access   (staff_id, outlet_id) — outlet tambahan
--      * attendance_any_outlet_staff (staff_id)           — boleh absen di outlet mana pun
--    Keduanya tanpa policy tulis; perubahan hanya lewat RPC `atur_akses_absen`.
--    Peran pengawas (absen_peran_global) tetap bebas absen di mana pun seperti dulu.
--
-- 2. SHIFT DINAMIS
--    Dulu shift = kolom datar (jam_masuk/jam_keluar = Shift 1, shift2_* = Shift 2, driver
--    Shift 3 di-hardcode). Kini `outlet_attendance_shift` (outlet_id, urutan 1..12).
--    Kolom lama DIPERTAHANKAN sebagai cermin yang diisi `simpan_jadwal_outlet`:
--      jam_masuk/jam_keluar = shift urutan 1 (juga jadwal tunggal saat pilihan shift mati)
--      shift2_*             = shift urutan 2
--    sehingga pembaca lama (APK/web sebelum rilis ini, rekap, papan) tetap benar untuk
--    dua shift pertama. Nomor `shift_ke` yang dikirim klien = `urutan`.
--
-- 3. submit_attendance: cek izin absen baru, shift 1..N, penentuan shift penutup generik,
--    `source` dari payload (route web kini memanggil RPC ini — satu sumber aturan),
--    alias penanda antrean offline (`is_offline` dari native, `from_queue` dari web),
--    staff tanpa outlet utama tak lagi lolos cek lintas outlet (`<>` NULL), dan
--    `SET search_path`. Selebihnya identik dengan 20300235000000.
--
-- Rilis: terapkan migrasi ini DULU, baru deploy web dan rilis APK.

-- ─────────────────────────────────────────────────────────── helper peran

-- Satu-satunya daftar peran yang bebas absen di outlet mana pun (dulu disalin di RPC,
-- route web, dan app native).
CREATE OR REPLACE FUNCTION public.absen_peran_global(p_role text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT coalesce(p_role = ANY (ARRAY['spv','owner','admin','admin_hr','regional_manager','area_manager','developer']), false);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_developer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'developer') AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_or_developer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_developer() TO authenticated, service_role;

-- Pengaturan jadwal: developer ikut (dulu ditolak server padahal menu tampil), dan
-- server action web yang sudah memeriksa peran lewat identitas tepercaya memanggil
-- dengan service role.
CREATE OR REPLACE FUNCTION public.assert_attendance_settings_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT auth.role()) = 'service_role' THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM outlet_staff me
    WHERE me.id = auth.uid()
      AND me.status = 'active'
      AND me.role IN ('admin', 'admin_hr', 'regional_manager', 'developer')
  ) THEN
    RAISE EXCEPTION 'Akses ditolak: hanya admin, admin HR, regional manager, dan developer yang boleh mengubah pengaturan absensi'
      USING errcode = '42501';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────── izin absen

CREATE TABLE IF NOT EXISTS public.attendance_outlet_access (
  staff_id   uuid NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  outlet_id  uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_outlet_access_pkey PRIMARY KEY (staff_id, outlet_id)
);
COMMENT ON TABLE public.attendance_outlet_access IS
  'Outlet tambahan tempat crew boleh absen masuk/pulang. Diatur admin/developer lewat atur_akses_absen().';

-- PK sudah melayani pencarian per staff; FK lain butuh indeks sendiri untuk cascade.
CREATE INDEX IF NOT EXISTS idx_attendance_outlet_access_outlet
  ON public.attendance_outlet_access (outlet_id);
CREATE INDEX IF NOT EXISTS idx_attendance_outlet_access_granted_by
  ON public.attendance_outlet_access (granted_by) WHERE granted_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_any_outlet_staff (
  staff_id   uuid PRIMARY KEY REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.attendance_any_outlet_staff IS
  'Crew yang boleh absen di outlet aktif mana pun. Diatur admin/developer lewat atur_akses_absen().';

CREATE INDEX IF NOT EXISTS idx_attendance_any_outlet_staff_granted_by
  ON public.attendance_any_outlet_staff (granted_by) WHERE granted_by IS NOT NULL;

ALTER TABLE public.attendance_outlet_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_any_outlet_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_outlet_access_select ON public.attendance_outlet_access;
CREATE POLICY attendance_outlet_access_select ON public.attendance_outlet_access
  FOR SELECT TO authenticated
  USING (staff_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_developer()));

DROP POLICY IF EXISTS attendance_any_outlet_staff_select ON public.attendance_any_outlet_staff;
CREATE POLICY attendance_any_outlet_staff_select ON public.attendance_any_outlet_staff
  FOR SELECT TO authenticated
  USING (staff_id = (SELECT auth.uid()) OR (SELECT public.is_admin_or_developer()));

-- staff_outlets.outlet_id belum punya FK di produksi (hanya di file migrasi lama), sehingga
-- embed `outlets!staff_outlets_outlet_id_fkey` selalu gagal dan klien jatuh ke dua query.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_outlets_outlet_id_fkey' AND conrelid = 'public.staff_outlets'::regclass
  ) THEN
    ALTER TABLE public.staff_outlets
      ADD CONSTRAINT staff_outlets_outlet_id_fkey
      FOREIGN KEY (outlet_id) REFERENCES public.outlets(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.staff_outlets VALIDATE CONSTRAINT staff_outlets_outlet_id_fkey;
  END IF;
END;
$$;

-- Outlet tempat seorang staff boleh absen — dipakai picker outlet app native dan
-- route web /api/staff-outlets. Aturannya sama persis dengan cek di submit_attendance:
--   * izin "semua outlet"                 → seluruh outlet aktif
--   * peran pengawas, penempatan <= 1     → seluruh outlet aktif
--   * selain itu                          → outlet utama + staff_outlets + izin tambahan
-- Outlet virtual (marketplace/system) hanya muncul bila memang didaftarkan.
CREATE OR REPLACE FUNCTION public.attendance_outlets(p_staff_id uuid DEFAULT NULL)
RETURNS TABLE (id uuid, name text, lat numeric, lng numeric, type text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id  uuid := coalesce(p_staff_id, auth.uid());
  v_me        record;
  v_bebas     boolean;
  v_terdaftar uuid[];
BEGIN
  IF v_staff_id IS NULL THEN
    RETURN;
  END IF;
  IF v_staff_id IS DISTINCT FROM auth.uid()
     AND coalesce(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin_or_developer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING errcode = '42501';
  END IF;

  SELECT s.role, s.outlet_id INTO v_me
    FROM outlet_staff s
   WHERE s.id = v_staff_id AND s.status = 'active';
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT array_agg(DISTINCT t.outlet_id) INTO v_terdaftar
    FROM (
      SELECT v_me.outlet_id AS outlet_id WHERE v_me.outlet_id IS NOT NULL
      UNION ALL
      SELECT so.outlet_id FROM staff_outlets so WHERE so.staff_id = v_staff_id
      UNION ALL
      SELECT a.outlet_id FROM attendance_outlet_access a WHERE a.staff_id = v_staff_id
    ) t;

  v_bebas := EXISTS (SELECT 1 FROM attendance_any_outlet_staff WHERE staff_id = v_staff_id)
             OR (public.absen_peran_global(v_me.role) AND coalesce(cardinality(v_terdaftar), 0) <= 1);

  RETURN QUERY
    SELECT o.id, o.name, o.lat, o.lng, o.type
      FROM outlets o
     WHERE o.is_active IS NOT FALSE
       AND (
         o.id = ANY (coalesce(v_terdaftar, '{}'))
         OR (v_bebas AND coalesce(o.type, '') NOT IN ('marketplace', 'system'))
       )
     ORDER BY (o.id = v_me.outlet_id) DESC, o.name;
END;
$$;

REVOKE ALL ON FUNCTION public.attendance_outlets(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_outlets(uuid) TO authenticated, service_role;

-- Daftar crew untuk layar "Akses Absen" (admin/developer). Peran pengawas tidak ikut:
-- mereka sudah bebas absen di mana pun, jadi tidak ada yang bisa diatur.
CREATE OR REPLACE FUNCTION public.daftar_akses_absen()
RETURNS TABLE (
  staff_id     uuid,
  nama         text,
  role         text,
  outlet_id    uuid,
  semua_outlet boolean,
  penempatan   uuid[],
  akses        uuid[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT public.is_admin_or_developer() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya admin dan developer yang boleh mengatur akses absen'
      USING errcode = '42501';
  END IF;

  RETURN QUERY
    SELECT s.id,
           s.name,
           s.role,
           s.outlet_id,
           EXISTS (SELECT 1 FROM attendance_any_outlet_staff x WHERE x.staff_id = s.id),
           coalesce((SELECT array_agg(so.outlet_id) FROM staff_outlets so WHERE so.staff_id = s.id), '{}'),
           coalesce((SELECT array_agg(a.outlet_id) FROM attendance_outlet_access a WHERE a.staff_id = s.id), '{}')
      FROM outlet_staff s
     WHERE s.status = 'active'
       AND s.role <> 'kiosk'
       AND NOT public.absen_peran_global(s.role)
     ORDER BY s.name;
END;
$$;

REVOKE ALL ON FUNCTION public.daftar_akses_absen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.daftar_akses_absen() TO authenticated, service_role;

-- Atur izin absen untuk satu atau banyak crew sekaligus.
--   p_mode 'ganti'  : outlet tambahan tiap crew = p_outlet_ids (kosong = kembali ke default)
--   p_mode 'tambah' : p_outlet_ids ditambahkan, izin lama tetap
--   p_semua_outlet  : NULL = tidak diubah
-- Outlet utama crew SAAT INI ikut disimpan bila ada outlet tambahan: submit_attendance
-- memindahkan outlet utama ke outlet tempat absen masuk, dan tanpa baris ini outlet asal
-- justru jadi terlarang keesokan harinya.
CREATE OR REPLACE FUNCTION public.atur_akses_absen(
  p_staff_ids    uuid[],
  p_outlet_ids   uuid[] DEFAULT '{}',
  p_semua_outlet boolean DEFAULT NULL,
  p_mode         text DEFAULT 'ganti'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pemberi uuid := auth.uid();
  v_outlets uuid[] := coalesce(p_outlet_ids, '{}');
  v_target  uuid[];
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT public.is_admin_or_developer() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya admin dan developer yang boleh mengatur akses absen'
      USING errcode = '42501';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('ganti', 'tambah') THEN
    RAISE EXCEPTION 'Mode tidak dikenal: %', p_mode USING errcode = '22023';
  END IF;
  IF coalesce(cardinality(p_staff_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Pilih minimal satu crew' USING errcode = '22023';
  END IF;
  IF cardinality(p_staff_ids) > 500 OR cardinality(v_outlets) > 100 THEN
    RAISE EXCEPTION 'Terlalu banyak data dalam satu permintaan' USING errcode = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_outlets) u(id)
    LEFT JOIN outlets o ON o.id = u.id
    WHERE o.id IS NULL OR o.is_active IS FALSE
  ) THEN
    RAISE EXCEPTION 'Ada outlet yang tidak ditemukan atau sudah nonaktif' USING errcode = '22023';
  END IF;

  -- Kunci baris crew agar dua admin yang menyimpan crew sama tidak saling menimpa separuh.
  SELECT array_agg(s.id ORDER BY s.id) INTO v_target
    FROM (
      SELECT s.id FROM outlet_staff s
       WHERE s.id = ANY (p_staff_ids)
         AND s.status = 'active'
         AND s.role <> 'kiosk'
         AND NOT public.absen_peran_global(s.role)
       ORDER BY s.id
         FOR NO KEY UPDATE  -- tidak menghalangi FK check insert absen (FOR KEY SHARE)
    ) s;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Tidak ada crew yang bisa diatur — peran pengawas sudah bebas absen di semua outlet'
      USING errcode = '22023';
  END IF;

  IF p_semua_outlet IS TRUE THEN
    INSERT INTO attendance_any_outlet_staff (staff_id, granted_by)
    SELECT unnest(v_target), v_pemberi
    ON CONFLICT (staff_id) DO NOTHING;
  ELSIF p_semua_outlet IS FALSE THEN
    DELETE FROM attendance_any_outlet_staff WHERE staff_id = ANY (v_target);
  END IF;

  IF p_mode = 'ganti' THEN
    DELETE FROM attendance_outlet_access a
     WHERE a.staff_id = ANY (v_target)
       AND NOT (a.outlet_id = ANY (v_outlets));
  END IF;

  IF cardinality(v_outlets) > 0 THEN
    INSERT INTO attendance_outlet_access (staff_id, outlet_id, granted_by)
    SELECT s.id, x.outlet_id, v_pemberi
      FROM outlet_staff s
      CROSS JOIN LATERAL (
        SELECT unnest(v_outlets) AS outlet_id
        UNION
        SELECT s.outlet_id WHERE s.outlet_id IS NOT NULL
      ) x
     WHERE s.id = ANY (v_target)
    ON CONFLICT (staff_id, outlet_id) DO NOTHING;
  END IF;

  RETURN cardinality(v_target);
END;
$$;

REVOKE ALL ON FUNCTION public.atur_akses_absen(uuid[], uuid[], boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atur_akses_absen(uuid[], uuid[], boolean, text) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────── shift dinamis

CREATE TABLE IF NOT EXISTS public.outlet_attendance_shift (
  outlet_id  uuid NOT NULL REFERENCES public.outlet_attendance_config(outlet_id) ON DELETE CASCADE,
  urutan     smallint NOT NULL,
  nama       text,
  jam_masuk  time NOT NULL,
  jam_keluar time NOT NULL,
  CONSTRAINT outlet_attendance_shift_pkey PRIMARY KEY (outlet_id, urutan),
  CONSTRAINT outlet_attendance_shift_urutan_check CHECK (urutan BETWEEN 1 AND 12),
  CONSTRAINT outlet_attendance_shift_nama_check CHECK (nama IS NULL OR char_length(nama) BETWEEN 1 AND 40),
  CONSTRAINT outlet_attendance_shift_jam_check CHECK (jam_masuk <> jam_keluar)
);
COMMENT ON TABLE public.outlet_attendance_shift IS
  'Shift jadwal khusus outlet. urutan = nomor shift_ke yang dikirim klien. Urutan 1 & 2 dicerminkan ke kolom lama outlet_attendance_config. Ditulis hanya lewat simpan_jadwal_outlet().';

ALTER TABLE public.outlet_attendance_shift ENABLE ROW LEVEL SECURITY;

-- Sama dengan policy baca outlet_attendance_config; tanpa policy tulis.
DROP POLICY IF EXISTS outlet_attendance_shift_select ON public.outlet_attendance_shift;
CREATE POLICY outlet_attendance_shift_select ON public.outlet_attendance_shift
  FOR SELECT TO authenticated
  USING (public.can_read_attendance_config(outlet_id));

-- Salin shift yang sudah ada. Shift 2 ikut walau pilihannya sedang mati (dulu jamnya
-- memang disimpan supaya tak perlu diketik ulang).
INSERT INTO public.outlet_attendance_shift (outlet_id, urutan, jam_masuk, jam_keluar)
SELECT c.outlet_id, 1, c.jam_masuk, c.jam_keluar
  FROM public.outlet_attendance_config c
 WHERE c.jam_masuk IS NOT NULL AND c.jam_keluar IS NOT NULL AND c.jam_masuk <> c.jam_keluar
ON CONFLICT DO NOTHING;

INSERT INTO public.outlet_attendance_shift (outlet_id, urutan, jam_masuk, jam_keluar)
SELECT c.outlet_id, 2, c.shift2_jam_masuk, c.shift2_jam_keluar
  FROM public.outlet_attendance_config c
 WHERE c.shift2_jam_masuk IS NOT NULL AND c.shift2_jam_keluar IS NOT NULL
   AND c.shift2_jam_masuk <> c.shift2_jam_keluar
   AND EXISTS (SELECT 1 FROM public.outlet_attendance_shift s WHERE s.outlet_id = c.outlet_id AND s.urutan = 1)
ON CONFLICT DO NOTHING;

-- Simpan jadwal khusus satu outlet beserta seluruh shift-nya dalam satu transaksi.
-- p_shifts = [{"nama": "Pagi"|null, "jam_masuk": "08:00", "jam_keluar": "17:00"}, ...];
-- urutan mengikuti posisi di array.
CREATE OR REPLACE FUNCTION public.simpan_jadwal_outlet(
  p_outlet_id         uuid,
  p_toleransi_menit   integer,
  p_radius_m          integer,
  p_absen_window_mode text,
  p_pilih_shift_aktif boolean,
  p_shifts            jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jumlah     int;
  v_unik       int;
  v_jam_kosong boolean;
  v_jam_sama   boolean;
  v_nama_lebar boolean;
  v_s1_masuk   time;
  v_s1_keluar  time;
  v_s2_masuk   time;
  v_s2_keluar  time;
BEGIN
  PERFORM assert_attendance_settings_admin();

  IF p_outlet_id IS NULL THEN
    RAISE EXCEPTION 'Outlet wajib dipilih' USING errcode = '22023';
  END IF;
  IF coalesce(p_absen_window_mode, 'auto') NOT IN ('auto', 'manual') THEN
    RAISE EXCEPTION 'Mode absensi tidak valid' USING errcode = '22023';
  END IF;
  IF p_toleransi_menit IS NULL OR p_toleransi_menit < 0 OR p_toleransi_menit > 600 THEN
    RAISE EXCEPTION 'Toleransi harus 0–600 menit' USING errcode = '22023';
  END IF;
  IF p_radius_m IS NULL OR p_radius_m <= 0 OR p_radius_m > 10000 THEN
    RAISE EXCEPTION 'Radius harus 1–10000 meter' USING errcode = '22023';
  END IF;
  IF p_shifts IS NULL OR jsonb_typeof(p_shifts) <> 'array' THEN
    RAISE EXCEPTION 'Daftar shift tidak valid' USING errcode = '22023';
  END IF;

  BEGIN
    SELECT count(*),
           count(DISTINCT (t.jam_masuk, t.jam_keluar)),
           coalesce(bool_or(t.jam_masuk IS NULL OR t.jam_keluar IS NULL), false),
           coalesce(bool_or(t.jam_masuk = t.jam_keluar), false),
           coalesce(bool_or(char_length(t.nama) > 40), false)
      INTO v_jumlah, v_unik, v_jam_kosong, v_jam_sama, v_nama_lebar
      FROM (
        SELECT nullif(btrim(e->>'nama'), '') AS nama,
               (e->>'jam_masuk')::time AS jam_masuk,
               (e->>'jam_keluar')::time AS jam_keluar
          FROM jsonb_array_elements(p_shifts) e
      ) t;
    v_s1_masuk  := (p_shifts->0->>'jam_masuk')::time;
    v_s1_keluar := (p_shifts->0->>'jam_keluar')::time;
    v_s2_masuk  := (p_shifts->1->>'jam_masuk')::time;
    v_s2_keluar := (p_shifts->1->>'jam_keluar')::time;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation THEN
    RAISE EXCEPTION 'Format jam shift tidak valid (pakai HH:MM)' USING errcode = '22023';
  END;

  IF v_jumlah < 1 OR v_jumlah > 12 THEN
    RAISE EXCEPTION 'Jumlah shift harus 1–12' USING errcode = '22023';
  END IF;
  IF v_jam_kosong THEN
    RAISE EXCEPTION 'Isi jam masuk dan jam pulang setiap shift' USING errcode = '22023';
  END IF;
  IF v_jam_sama THEN
    RAISE EXCEPTION 'Jam masuk dan jam pulang shift tidak boleh sama' USING errcode = '22023';
  END IF;
  IF v_nama_lebar THEN
    RAISE EXCEPTION 'Nama shift maksimal 40 karakter' USING errcode = '22023';
  END IF;
  IF v_unik < v_jumlah THEN
    RAISE EXCEPTION 'Ada dua shift dengan jam yang sama persis' USING errcode = '22023';
  END IF;
  IF coalesce(p_pilih_shift_aktif, false) AND v_jumlah < 2 THEN
    RAISE EXCEPTION 'Tambahkan minimal 2 shift untuk mengaktifkan pilihan shift' USING errcode = '22023';
  END IF;

  -- Upsert config lebih dulu: kunci baris ini menyerialkan dua admin yang menyimpan
  -- outlet sama, sehingga hapus+sisip shift di bawah tidak saling bertabrakan.
  INSERT INTO outlet_attendance_config (
    outlet_id, jam_masuk, jam_keluar, toleransi_menit, radius_m, absen_window_mode,
    pilih_shift_aktif, shift2_jam_masuk, shift2_jam_keluar, updated_at
  ) VALUES (
    p_outlet_id, v_s1_masuk, v_s1_keluar, p_toleransi_menit, p_radius_m,
    coalesce(p_absen_window_mode, 'auto'), coalesce(p_pilih_shift_aktif, false),
    v_s2_masuk, v_s2_keluar, now()
  )
  ON CONFLICT (outlet_id) DO UPDATE SET
    jam_masuk         = excluded.jam_masuk,
    jam_keluar        = excluded.jam_keluar,
    toleransi_menit   = excluded.toleransi_menit,
    radius_m          = excluded.radius_m,
    absen_window_mode = excluded.absen_window_mode,
    pilih_shift_aktif = excluded.pilih_shift_aktif,
    shift2_jam_masuk  = excluded.shift2_jam_masuk,
    shift2_jam_keluar = excluded.shift2_jam_keluar,
    updated_at        = excluded.updated_at;

  DELETE FROM outlet_attendance_shift WHERE outlet_id = p_outlet_id;
  INSERT INTO outlet_attendance_shift (outlet_id, urutan, nama, jam_masuk, jam_keluar)
  SELECT p_outlet_id, e.ord::smallint, nullif(btrim(e.val->>'nama'), ''),
         (e.val->>'jam_masuk')::time, (e.val->>'jam_keluar')::time
    FROM jsonb_array_elements(p_shifts) WITH ORDINALITY AS e(val, ord);
END;
$$;

REVOKE ALL ON FUNCTION public.simpan_jadwal_outlet(uuid, integer, integer, text, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simpan_jadwal_outlet(uuid, integer, integer, text, boolean, jsonb) TO authenticated, service_role;

-- Versi lama (APK sebelum rilis ini) tetap jalan untuk outlet ≤ 2 shift, lewat jalur
-- yang sama supaya tabel shift dan kolom cerminnya tidak pernah menyimpang.
CREATE OR REPLACE FUNCTION public.save_outlet_attendance_config(
  p_outlet_id uuid,
  p_jam_masuk text,
  p_jam_keluar text,
  p_toleransi_menit integer,
  p_radius_m integer,
  p_absen_window_mode text DEFAULT 'auto'::text,
  p_pilih_shift_aktif boolean DEFAULT NULL::boolean,
  p_shift2_jam_masuk text DEFAULT NULL::text,
  p_shift2_jam_keluar text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pilih  boolean;
  v_shifts jsonb := jsonb_build_array(jsonb_build_object('jam_masuk', p_jam_masuk, 'jam_keluar', p_jam_keluar));
BEGIN
  PERFORM assert_attendance_settings_admin();

  IF (SELECT count(*) FROM outlet_attendance_shift WHERE outlet_id = p_outlet_id) > 2 THEN
    RAISE EXCEPTION 'Outlet ini memakai lebih dari 2 shift. Perbarui aplikasi untuk mengubah jadwalnya.'
      USING errcode = '22023';
  END IF;

  IF nullif(p_shift2_jam_masuk, '') IS NOT NULL AND nullif(p_shift2_jam_keluar, '') IS NOT NULL
     AND NOT (p_shift2_jam_masuk::time = p_jam_masuk::time AND p_shift2_jam_keluar::time = p_jam_keluar::time) THEN
    v_shifts := v_shifts || jsonb_build_array(
      jsonb_build_object('jam_masuk', p_shift2_jam_masuk, 'jam_keluar', p_shift2_jam_keluar));
  END IF;

  v_pilih := coalesce(
    p_pilih_shift_aktif,
    (SELECT pilih_shift_aktif FROM outlet_attendance_config WHERE outlet_id = p_outlet_id),
    false
  );

  PERFORM simpan_jadwal_outlet(p_outlet_id, p_toleransi_menit, p_radius_m, p_absen_window_mode, v_pilih, v_shifts);
END;
$$;

-- Tipe kembalian bertambah kolom `shifts`, jadi harus DROP lalu CREATE.
DROP FUNCTION IF EXISTS public.list_outlet_attendance_config();
CREATE FUNCTION public.list_outlet_attendance_config()
RETURNS TABLE (
  outlet_id uuid, outlet_name text, jam_masuk text, jam_keluar text, toleransi_menit integer,
  radius_m integer, absen_window_mode text, pilih_shift_aktif boolean,
  shift2_jam_masuk text, shift2_jam_keluar text, shifts jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_attendance_settings_admin();
  RETURN QUERY
    SELECT c.outlet_id,
           o.name::text,
           left(c.jam_masuk::text, 5),
           left(c.jam_keluar::text, 5),
           c.toleransi_menit,
           c.radius_m,
           coalesce(c.absen_window_mode, 'auto'),
           coalesce(c.pilih_shift_aktif, false),
           left(c.shift2_jam_masuk::text, 5),
           left(c.shift2_jam_keluar::text, 5),
           coalesce((
             SELECT jsonb_agg(jsonb_build_object(
                      'ke', s.urutan, 'nama', s.nama,
                      'jam_masuk', left(s.jam_masuk::text, 5),
                      'jam_keluar', left(s.jam_keluar::text, 5)) ORDER BY s.urutan)
               FROM outlet_attendance_shift s WHERE s.outlet_id = c.outlet_id
           ), '[]'::jsonb)
      FROM outlet_attendance_config c
      JOIN outlets o ON o.id = c.outlet_id
     ORDER BY o.name;
END;
$$;

REVOKE ALL ON FUNCTION public.list_outlet_attendance_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_outlet_attendance_config() TO authenticated, service_role;

-- Pilihan shift untuk layar absen. Field lama tetap ada untuk APK/web sebelum rilis ini.
CREATE OR REPLACE FUNCTION public.attendance_shift_config(p_outlet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN NULL;
  END IF;
  RETURN (
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
      ), '[]'::jsonb)
    )
    FROM outlet_attendance_config c
    WHERE c.outlet_id = p_outlet_id
  );
END;
$$;

-- ─────────────────────────────────────────────────────────── submit_attendance

CREATE OR REPLACE FUNCTION public.submit_attendance(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
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

  IF v_opsi_shift THEN
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
      v_penutup := v_pulang_maks IS NULL OR v_pulang_milik >= v_pulang_maks;
    END IF;
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

NOTIFY pgrst, 'reload schema';
