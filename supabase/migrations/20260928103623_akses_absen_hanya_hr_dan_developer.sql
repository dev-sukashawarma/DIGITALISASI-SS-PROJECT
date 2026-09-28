-- Akses Absen hanya untuk HR (admin_hr) dan developer — bukan admin.
--
-- 28 Sep 2026: pemilik menetapkan layar "Akses Absen" (atur outlet tempat crew boleh absen)
-- hanya untuk dua peran: developer dan HR. Versi 20260928095531 memakai
-- is_admin_or_developer() (admin + developer). Semua penjaga fitur ini dipindah ke satu
-- helper baru, boleh_atur_akses_absen(), supaya daftar perannya hanya ada di satu tempat.
-- is_admin_or_developer() dibiarkan (tak lagi dipakai) — menghapusnya perlu DROP terpisah.
--
-- Isi fungsi selain penjaga peran identik dengan 20260928095531.

CREATE OR REPLACE FUNCTION public.boleh_atur_akses_absen()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = (SELECT auth.uid()) AND role IN ('admin_hr', 'developer') AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.boleh_atur_akses_absen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.boleh_atur_akses_absen() TO authenticated, service_role;

DROP POLICY IF EXISTS attendance_outlet_access_select ON public.attendance_outlet_access;
CREATE POLICY attendance_outlet_access_select ON public.attendance_outlet_access
  FOR SELECT TO authenticated
  USING (staff_id = (SELECT auth.uid()) OR (SELECT public.boleh_atur_akses_absen()));

DROP POLICY IF EXISTS attendance_any_outlet_staff_select ON public.attendance_any_outlet_staff;
CREATE POLICY attendance_any_outlet_staff_select ON public.attendance_any_outlet_staff
  FOR SELECT TO authenticated
  USING (staff_id = (SELECT auth.uid()) OR (SELECT public.boleh_atur_akses_absen()));

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
     AND NOT public.boleh_atur_akses_absen() THEN
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
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT public.boleh_atur_akses_absen() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya HR dan developer yang boleh mengatur akses absen'
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
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT public.boleh_atur_akses_absen() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya HR dan developer yang boleh mengatur akses absen'
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

  -- Kunci baris crew agar dua pengatur yang menyimpan crew sama tidak saling menimpa separuh.
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

COMMENT ON TABLE public.attendance_outlet_access IS
  'Outlet tambahan tempat crew boleh absen masuk/pulang. Diatur HR/developer lewat atur_akses_absen().';
COMMENT ON TABLE public.attendance_any_outlet_staff IS
  'Crew yang boleh absen di outlet aktif mana pun. Diatur HR/developer lewat atur_akses_absen().';
