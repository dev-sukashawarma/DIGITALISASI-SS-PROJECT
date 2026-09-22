-- 20260921153000_staff_outlets_allow_manager_read.sql
-- Mengizinkan Regional Manager dan jajaran manajemen membaca data pemetaan staff_outlets dan outlet_staff.
-- Hal ini memungkinkan dashboard Regional Manager di APK Native dan Web untuk menampilkan pemetaan
-- cabang ke Area Manager secara 100% dinamis langsung dari database (tanpa mengandalkan hardcode cadangan).

-- 1. Helper function: memeriksa apakah user yang sedang login adalah peran manajemen atau pimpinan
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND role IN ('admin', 'admin_hr', 'owner', 'regional_manager', 'spv', 'developer')
      AND is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;

-- 2. Policy SELECT pada tabel staff_outlets untuk role manajemen
DROP POLICY IF EXISTS staff_outlets_manager_read_all ON public.staff_outlets;
CREATE POLICY staff_outlets_manager_read_all ON public.staff_outlets
  FOR SELECT TO authenticated
  USING (public.is_manager_or_admin());

-- 3. Policy SELECT pada tabel outlet_staff untuk role manajemen (agar join staff_outlets -> outlet_staff dapat dibaca)
DROP POLICY IF EXISTS outlet_staff_manager_read_all ON public.outlet_staff;
CREATE POLICY outlet_staff_manager_read_all ON public.outlet_staff
  FOR SELECT TO authenticated
  USING (public.is_manager_or_admin());
