-- 20300204000000_accessible_outlet_ids_include_mitra.sql
--
-- Perbaikan Hak Akses RLS untuk Akun Mitra:
-- Akun mitra tersimpan di tabel `public.mitra_profiles` (dengan relasi user_id = auth.uid()
-- dan kolom outlet_ids uuid[]), bukan di tabel `public.outlet_staff`.
--
-- Tanpa perbaikan ini, pengguna mitra yang login ke portal mitra tidak mendapatkan
-- akses outlet pada query/RPC bertaraf RLS (seperti get_waste_periode, orders, dll),
-- sehingga nilai waste/persediaan mitra berisiko tampil 0 di bulan berjalan.

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
  WHERE me.role IN ('leader', 'korlap', 'area_manager', 'kepala_outlet')
    AND so.staff_id = me.id
  UNION
  -- 3. Outlet primer karyawan (apabila ada kolom outlet_id di outlet_staff untuk role apa pun)
  SELECT me.outlet_id
  FROM me
  WHERE me.outlet_id IS NOT NULL
  UNION
  -- 4. Outlet kemitraan (dari tabel mitra_profiles apabila pengguna login adalah mitra aktif)
  SELECT unnest(mp.outlet_ids)
  FROM public.mitra_profiles mp
  WHERE mp.user_id = auth.uid()
    AND mp.status = 'aktif';
$$;

GRANT EXECUTE ON FUNCTION public.accessible_outlet_ids() TO authenticated;

COMMENT ON FUNCTION public.accessible_outlet_ids() IS
'Mengembalikan daftar outlet_id yang berhak diakses oleh auth.uid(), mencakup staf internal (outlet_staff) dan mitra pemilik outlet (mitra_profiles).';
