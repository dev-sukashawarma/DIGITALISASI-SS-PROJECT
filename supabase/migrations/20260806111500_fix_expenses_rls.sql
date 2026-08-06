-- 20260806111500_fix_expenses_rls.sql
DROP POLICY IF EXISTS "expenses_insert_scoped" ON public.expenses;
CREATE POLICY "expenses_insert_scoped" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    outlet_id IN (SELECT public.accessible_outlet_ids())
    OR 
    (outlet_id IS NULL AND public.get_user_role() IN ('admin', 'owner'))
  );
