-- Fix petty_cash_topups Realtime by providing a fast path for finance/admin roles
DROP POLICY IF EXISTS "petty_cash_topups_select" ON public.petty_cash_topups;
CREATE POLICY "petty_cash_topups_select" ON public.petty_cash_topups 
FOR SELECT TO authenticated 
USING (
  public.is_admin() OR 
  public.is_finance() OR 
  outlet_id IN (SELECT public.accessible_outlet_ids())
);

DROP POLICY IF EXISTS "petty_cash_expenses_select" ON public.petty_cash_expenses;
CREATE POLICY "petty_cash_expenses_select" ON public.petty_cash_expenses 
FOR SELECT TO authenticated 
USING (
  public.is_admin() OR 
  public.is_finance() OR 
  outlet_id IN (SELECT public.accessible_outlet_ids())
);

