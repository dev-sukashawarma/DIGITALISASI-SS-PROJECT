-- 20260722164500_fix_cash_location_rls_read.sql
-- Allow authenticated users to read cash_location and cash_balance for treasury dropdowns

DROP POLICY IF EXISTS cash_location_read ON public.cash_location;
CREATE POLICY cash_location_read ON public.cash_location FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cash_balance_read ON public.cash_balance;
CREATE POLICY cash_balance_read ON public.cash_balance FOR SELECT TO authenticated USING (true);

-- Ensure is_finance() is robust for authenticated users
CREATE OR REPLACE FUNCTION public.is_finance() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NOT NULL);
$$;
