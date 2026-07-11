-- 20260711140000_update_is_finance_checker.sql
-- Update is_finance_checker to include admin_finance role

CREATE OR REPLACE FUNCTION public.is_finance_checker() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role IN ('owner','admin','admin_finance'));
$$;
