-- 20260814110000_supplier_rls_purchasing.sql
-- Allow purchasing, purchase, admin_finance, finance, owner, admin, kitchen to manage supplier table

ALTER TABLE public.supplier ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_select ON public.supplier;
DROP POLICY IF EXISTS supplier_write ON public.supplier;

CREATE POLICY supplier_select ON public.supplier
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role IN ('admin', 'kitchen', 'purchase', 'purchasing', 'admin_finance', 'finance', 'owner', 'developer')
  ));

CREATE POLICY supplier_write ON public.supplier
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role IN ('admin', 'kitchen', 'purchase', 'purchasing', 'admin_finance', 'finance', 'owner', 'developer')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role IN ('admin', 'kitchen', 'purchase', 'purchasing', 'admin_finance', 'finance', 'owner', 'developer')
  ));
