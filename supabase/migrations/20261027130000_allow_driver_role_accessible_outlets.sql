-- =============================================================================
-- Migration: 20261027130000_allow_driver_role_accessible_outlets.sql
-- Tujuan: Memberikan hak akses seluruh outlet pada fungsi accessible_outlet_ids()
--         kepada role 'driver' agar driver dapat melihat seluruh surat jalan 
--         pengiriman / distribusi lintas outlet.
-- =============================================================================

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

  -- 1. Role dengan akses ke seluruh outlet (termasuk driver untuk distribusi & pengantaran)
  SELECT o.id
  FROM public.outlets o, (
    SELECT id, role, outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  ) me
  WHERE me.role IN (
    'admin', 'admin_hr', 'owner', 'spv', 'regional_manager',
    'kitchen', 'admin_finance', 'finance', 'purchasing', 'developer', 'driver'
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
