-- Developer monitoring needs a read scope over all outlets so the monitoring
-- app can request a short-lived camera lease for any outlet.
--
-- IMPORTANT: accessible_outlet_ids() is shared by POS, petty cash, inventory,
-- and monitoring. Do not replace the canonical role matrix with a
-- monitoring-only matrix here: open_shift() and the RLS policies use this
-- function as their authorization source.
CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT id, role, outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  )
  SELECT o.id
  FROM public.outlets o, me
  WHERE me.role IN (
    'admin', 'admin_hr', 'owner', 'spv', 'regional_manager', 'kitchen',
    'admin_finance', 'developer'
  )
  UNION
  SELECT so.outlet_id
  FROM public.staff_outlets so, me
  WHERE me.role IN ('leader', 'korlap', 'area_manager', 'kepala_outlet')
    AND so.staff_id = me.id
  UNION
  SELECT me.outlet_id
  FROM me
  WHERE me.outlet_id IS NOT NULL
    AND me.role IN ('leader', 'kepala_outlet', 'kasir', 'crew', 'kiosk',
                    'mitra', 'staff_pusat');
$$;
