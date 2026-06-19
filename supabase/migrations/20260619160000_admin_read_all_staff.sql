-- Admin (role='admin') boleh membaca SEMUA outlet_staff lintas outlet.
-- Helper SECURITY DEFINER untuk hindari rekursi RLS (policy lain self-referencing outlet_staff).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- Read: admin lihat semua staff
DROP POLICY IF EXISTS outlet_staff_admin_read_all ON public.outlet_staff;
CREATE POLICY outlet_staff_admin_read_all ON public.outlet_staff
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Read: admin lihat semua pemetaan staff_outlets (untuk render outlet binaan kepala_outlet)
DROP POLICY IF EXISTS staff_outlets_admin_read_all ON public.staff_outlets;
CREATE POLICY staff_outlets_admin_read_all ON public.staff_outlets
  FOR SELECT TO authenticated
  USING (public.is_admin());
