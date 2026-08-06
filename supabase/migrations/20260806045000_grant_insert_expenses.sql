-- 20260806045000_grant_insert_expenses.sql
GRANT INSERT ON public.expenses TO authenticated;
GRANT UPDATE ON public.expenses TO authenticated;
GRANT DELETE ON public.expenses TO authenticated;
