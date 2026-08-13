-- Update roles allowed to create/manage PO
CREATE OR REPLACE FUNCTION public.can_manage_po()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role IN ('admin','kitchen','purchase','purchasing','admin_finance','finance','owner'));
$$;
