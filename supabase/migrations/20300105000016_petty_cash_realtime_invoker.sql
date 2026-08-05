-- Fix petty_cash realtime by using SECURITY INVOKER policies directly
-- Realtime will NOT broadcast if the RLS policy contains a SECURITY DEFINER function.
-- So we avoid is_admin(), is_finance(), and accessible_outlet_ids().

DROP POLICY IF EXISTS "petty_cash_topups_select" ON public.petty_cash_topups;
CREATE POLICY "petty_cash_topups_select" ON public.petty_cash_topups 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.outlet_staff 
    WHERE id = auth.uid() 
      AND role IN ('admin', 'admin_finance', 'finance', 'owner', 'regional_manager')
  )
  OR outlet_id IN (
    SELECT outlet_id FROM public.staff_outlets WHERE staff_id = auth.uid()
  )
  OR outlet_id IN (
    SELECT outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "petty_cash_expenses_select" ON public.petty_cash_expenses;
CREATE POLICY "petty_cash_expenses_select" ON public.petty_cash_expenses 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.outlet_staff 
    WHERE id = auth.uid() 
      AND role IN ('admin', 'admin_finance', 'finance', 'owner', 'regional_manager')
  )
  OR outlet_id IN (
    SELECT outlet_id FROM public.staff_outlets WHERE staff_id = auth.uid()
  )
  OR outlet_id IN (
    SELECT outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  )
);
