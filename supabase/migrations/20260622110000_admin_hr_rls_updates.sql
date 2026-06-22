-- 1. Update public.is_admin() to include admin_hr and owner roles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role IN ('admin', 'admin_hr', 'owner')
  )
$$;

-- 2. Update outlet_staff_admin_all policy to respect is_admin() (supporting admin_hr and owner)
DROP POLICY IF EXISTS "outlet_staff_admin_all" ON public.outlet_staff;
CREATE POLICY "outlet_staff_admin_all" ON public.outlet_staff
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
