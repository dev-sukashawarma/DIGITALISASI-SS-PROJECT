-- 20300222000000_fix_accessible_outlet_ids_area_manager_scope.sql
--
-- Koreksi Scope Outlet untuk Role area_manager:
-- Pada migrasi 20300204000000_accessible_outlet_ids_include_mitra.sql, 'area_manager'
-- secara keliru dimasukkan ke dalam klausa role seluruh outlet.
-- Padahal sesuai arsitektur dan dokumentasi (20300105000007), role area_manager
-- adalah multi-outlet yang cakupannya dibatasi oleh tabel relasi staff_outlets (outlet binaan),
-- bukan seluruh outlet seperti regional_manager dan admin.
--
-- Perbaikan ini menghapus 'area_manager' dari daftar seluruh outlet (Branch 1),
-- dan memastikannya tetap berada di Branch 2 (staff_outlets).

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
  -- Catatan: 'area_manager' SENGAJA TIDAK ADA DI SINI. Area Manager hanya mengakses
  -- outlet binaannya yang tercatat di tabel staff_outlets.
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

  -- 3. Outlet primer karyawan (apabila ada kolom outlet_id di outlet_staff untuk role apa pun)
  SELECT me.outlet_id
  FROM (
    SELECT outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  ) me
  WHERE me.outlet_id IS NOT NULL

  UNION

  -- 4. Outlet kemitraan (dari tabel mitra_profiles apabila pengguna login adalah mitra aktif)
  SELECT unnest(mp.outlet_ids)
  FROM public.mitra_profiles mp
  WHERE mp.user_id = auth.uid()
    AND mp.status = 'aktif';
$function$;

GRANT EXECUTE ON FUNCTION public.accessible_outlet_ids() TO authenticated;

COMMENT ON FUNCTION public.accessible_outlet_ids() IS
'Mengembalikan daftar outlet_id yang berhak diakses oleh auth.uid(). Role area_manager dibatasi ke outlet binaan pada staff_outlets, sedangkan regional_manager dan admin memegang seluruh outlet.';
