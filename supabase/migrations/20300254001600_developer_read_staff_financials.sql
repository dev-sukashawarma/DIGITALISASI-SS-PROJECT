-- Developer is the suite's technical superuser and can access all app features.
-- Allow read-only visibility of salary data in the HR employee master page.
DROP POLICY IF EXISTS "Developer can read staff financials"
  ON public.staff_financials;

CREATE POLICY "Developer can read staff financials"
  ON public.staff_financials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.outlet_staff
      WHERE id = auth.uid()
        AND role = 'developer'
        AND status = 'active'
    )
  );
