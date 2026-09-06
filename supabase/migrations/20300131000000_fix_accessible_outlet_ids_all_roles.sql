-- 20300131000000_fix_accessible_outlet_ids_all_roles.sql
--
-- MASALAH:
-- Saat menyimpan draft atau memfinalisasi opname, muncul error RLS:
--   "🔴 Gagal memproses opname: new row violates row-level security policy for table "opname""
--
-- ROOT CAUSE:
-- 1. Kebijakan RLS opname_insert menggunakan WITH CHECK (outlet_id IN (SELECT public.accessible_outlet_ids())).
-- 2. Fungsi accessible_outlet_ids() sebelumnya belum mencakup semua role yang memiliki hak operasional,
--    seperti 'regional_manager', 'area_manager', 'finance', 'purchasing', 'developer', dll.
-- 3. Untuk role 'leader' atau staff lain yang ditugaskan outlet langsung lewat kolom outlet_staff.outlet_id
--    (bukan tabel relasi staff_outlets), accessible_outlet_ids() mengembalikan kosong karena 'leader'
--    tidak ada di klausul ketiga pada migrasi sebelumnya.
-- 4. Semua karyawan aktif yang memiliki kolom outlet_id terisi di outlet_staff berhak mengakses outlet tersebut.
--
-- SOLUSI:
-- Perbarui fungsi public.accessible_outlet_ids() agar komprehensif:
-- 1. Privileged (akses seluruh outlet): admin, admin_hr, owner, spv, regional_manager, area_manager,
--    kitchen, admin_finance, finance, purchasing, developer.
-- 2. Relasi multi-outlet (staff_outlets): semua outlet yang terikat pada staff_id di tabel staff_outlets.
-- 3. Direct assignment (outlet_staff.outlet_id): outlet mana pun yang terpasang di kolom outlet_id staff bersangkutan.

CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT id, role, outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  )
  -- 1. Role dengan akses ke seluruh outlet
  SELECT o.id
  FROM public.outlets o, me
  WHERE me.role IN (
    'admin', 'admin_hr', 'owner', 'spv', 'regional_manager', 'area_manager',
    'kitchen', 'admin_finance', 'finance', 'purchasing', 'developer'
  )
  UNION
  -- 2. Outlet yang di-assign lewat tabel relasi staff_outlets
  SELECT so.outlet_id
  FROM public.staff_outlets so, me
  WHERE so.staff_id = me.id
  UNION
  -- 3. Outlet primer karyawan (apabila ada kolom outlet_id di outlet_staff untuk role apa pun)
  SELECT me.outlet_id
  FROM me
  WHERE me.outlet_id IS NOT NULL;
$$;
