-- 20260711190000_fix_accessible_outlet_ids_regression.sql
-- Restores accessible_outlet_ids() after 20260711180000 (applied directly to
-- remote, uncommitted) regressed it:
--   - admin_hr, spv, kitchen lost all-outlet access (only owner/admin/admin_finance kept it)
--   - crew, kiosk, mitra, staff_pusat lost outlet access entirely (no clause
--     returned their outlet_staff.outlet_id), so their RLS-scoped queries
--     started returning zero outlets.
--
-- This reinstates the role coverage from 20260711100500_add_role_korlap.sql.
-- Korlap stays scoped via staff_outlets (explicit assignment) rather than the
-- hardcoded outlet-name exclusion list introduced by 20260711180000.

CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT id, role, outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  )
  SELECT o.id FROM public.outlets o, me
    WHERE me.role IN ('admin', 'admin_hr', 'owner', 'spv', 'kitchen', 'admin_finance')
  UNION
  SELECT so.outlet_id FROM public.staff_outlets so, me
    WHERE me.role IN ('leader', 'korlap') AND so.staff_id = me.id
  UNION
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('crew', 'kiosk', 'mitra', 'staff_pusat');
$$;
