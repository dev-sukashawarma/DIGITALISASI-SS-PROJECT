-- Migration: 20300254000900_emergency_crew_assignments.sql
-- Fitur Penugasan Darurat / BKO Sementara untuk Kru Reguler
-- Memungkinkan kru reguler diperbantukan sementara ke cabang lain (1 hari)
-- tanpa mengubah outlet_id permanen di profil karyawan.

-- 1. Buat tabel emergency_crew_assignments
CREATE TABLE IF NOT EXISTS public.emergency_crew_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  origin_outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  target_outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  assignment_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  assigned_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_emergency_staff_date UNIQUE (staff_id, assignment_date)
);

COMMENT ON TABLE public.emergency_crew_assignments IS
  'Pencatatan penugasan darurat / BKO 1 hari kru reguler ke outlet lain tanpa mengubah home outlet profil.';

-- 2. Index untuk query performa tinggi
CREATE INDEX IF NOT EXISTS idx_emergency_date_status 
  ON public.emergency_crew_assignments (assignment_date, status);
CREATE INDEX IF NOT EXISTS idx_emergency_staff 
  ON public.emergency_crew_assignments (staff_id);
CREATE INDEX IF NOT EXISTS idx_emergency_target_outlet
  ON public.emergency_crew_assignments (target_outlet_id, assignment_date);

-- 3. RLS
ALTER TABLE public.emergency_crew_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emergency_crew_assignments_select ON public.emergency_crew_assignments;
CREATE POLICY emergency_crew_assignments_select ON public.emergency_crew_assignments
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS emergency_crew_assignments_admin ON public.emergency_crew_assignments;
CREATE POLICY emergency_crew_assignments_admin ON public.emergency_crew_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'admin_hr', 'developer', 'owner')
    )
  );

-- 4. Perbarui accessible_outlet_ids() agar kru BKO mendapat akses operasional & checklist di outlet darurat
CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Service role bypass
  SELECT o.id
  FROM public.outlets o
  WHERE auth.role() = 'service_role' OR (auth.jwt() ->> 'role') = 'service_role'

  UNION

  -- 1. Role dengan akses ke seluruh outlet
  SELECT o.id
  FROM public.outlets o, (
    SELECT id, role, outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  ) me
  WHERE me.role IN (
    'admin', 'admin_hr', 'owner', 'spv', 'regional_manager',
    'kitchen', 'admin_finance', 'finance', 'purchasing', 'developer'
  )

  UNION

  -- 2. Outlet binaan yang di-assign lewat tabel relasi staff_outlets
  SELECT so.outlet_id
  FROM public.staff_outlets so, (
    SELECT id, role FROM public.outlet_staff WHERE id = auth.uid()
  ) me
  WHERE me.role IN ('leader', 'korlap', 'area_manager', 'kepala_outlet')
    AND so.staff_id = me.id

  UNION

  -- 3. Outlet primer karyawan
  SELECT me.outlet_id
  FROM (
    SELECT outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  ) me
  WHERE me.outlet_id IS NOT NULL

  UNION

  -- 4. Outlet kemitraan
  SELECT unnest(mp.outlet_ids)
  FROM public.mitra_profiles mp
  WHERE mp.user_id = auth.uid()
    AND mp.status = 'aktif'

  UNION

  -- 5. Penugasan darurat (BKO Sementara) untuk hari ini
  SELECT eca.target_outlet_id
  FROM public.emergency_crew_assignments eca
  WHERE eca.staff_id = auth.uid()
    AND eca.status = 'active'
    AND eca.assignment_date = (now() AT TIME ZONE 'Asia/Jakarta')::DATE;
$function$;

GRANT EXECUTE ON FUNCTION public.accessible_outlet_ids() TO authenticated;

-- 5. Perbarui attendance_outlets() agar kru BKO dapat memilih outlet penugasan darurat saat absen
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
      UNION ALL
      SELECT eca.target_outlet_id FROM emergency_crew_assignments eca
       WHERE eca.staff_id = v_staff_id
         AND eca.status = 'active'
         AND eca.assignment_date = (now() AT TIME ZONE 'Asia/Jakarta')::DATE
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

-- 6. Trigger Sinkronisasi Otomatis ke attendance_outlet_access untuk Hari H
CREATE OR REPLACE FUNCTION public.fn_sync_emergency_attendance_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE;
BEGIN
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;

  -- Jika status active dan assignment_date adalah hari ini, tambahkan akses absensi
  IF NEW.status = 'active' AND NEW.assignment_date = v_today THEN
    INSERT INTO public.attendance_outlet_access (staff_id, outlet_id, granted_by)
    VALUES (NEW.staff_id, NEW.target_outlet_id, NEW.assigned_by)
    ON CONFLICT (staff_id, outlet_id) DO NOTHING;
  END IF;

  -- Jika dibatalkan atau selesai, cabut akses absensi sementara bila ada
  IF NEW.status IN ('cancelled', 'completed') THEN
    DELETE FROM public.attendance_outlet_access
    WHERE staff_id = NEW.staff_id AND outlet_id = NEW.target_outlet_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_emergency_attendance_access ON public.emergency_crew_assignments;
CREATE TRIGGER trg_sync_emergency_attendance_access
AFTER INSERT OR UPDATE ON public.emergency_crew_assignments
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_emergency_attendance_access();

-- 7. Helper Housekeeping untuk membersihkan assignment kedaluwarsa
CREATE OR REPLACE FUNCTION public.cleanup_expired_emergency_assignments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;
BEGIN
  -- Tandai penugasan kemarin yang masih aktif sebagai completed
  UPDATE public.emergency_crew_assignments
  SET status = 'completed', updated_at = now()
  WHERE status = 'active' AND assignment_date < v_today;

  -- Cabut akses attendance_outlet_access untuk assignment yang sudah lewat hari atau nonaktif
  DELETE FROM public.attendance_outlet_access aoa
  USING public.emergency_crew_assignments eca
  WHERE aoa.staff_id = eca.staff_id
    AND aoa.outlet_id = eca.target_outlet_id
    AND (eca.status IN ('completed', 'cancelled') OR eca.assignment_date < v_today)
    AND NOT EXISTS (
      SELECT 1 FROM public.emergency_crew_assignments active_eca
      WHERE active_eca.staff_id = aoa.staff_id
        AND active_eca.target_outlet_id = aoa.outlet_id
        AND active_eca.status = 'active'
        AND active_eca.assignment_date = v_today
    );
END;
$$;
