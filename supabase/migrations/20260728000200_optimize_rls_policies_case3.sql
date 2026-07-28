-- Migration: 20260728000200_optimize_rls_policies_case3.sql
-- Description: Optimization for Case 3 (RLS Subquery Elimination using STABLE Security Definer Functions)
-- Safe to apply: Replaces nested per-row subqueries with cached accessible_outlet_ids() function calls.

-- 1. Ensure accessible_outlet_ids() is STABLE SECURITY DEFINER for subquery caching
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

-- 2. Optimize opname & opname_item RLS policies
DROP POLICY IF EXISTS opname_read ON public.opname;
CREATE POLICY opname_read ON public.opname FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

DROP POLICY IF EXISTS opname_insert ON public.opname;
CREATE POLICY opname_insert ON public.opname FOR INSERT TO authenticated
  WITH CHECK (outlet_id IN (SELECT public.accessible_outlet_ids()));

DROP POLICY IF EXISTS opname_update ON public.opname;
CREATE POLICY opname_update ON public.opname FOR UPDATE TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

DROP POLICY IF EXISTS opname_item_read ON public.opname_item;
CREATE POLICY opname_item_read ON public.opname_item FOR SELECT TO authenticated
  USING (
    opname_id IN (
      SELECT id FROM public.opname WHERE outlet_id IN (SELECT public.accessible_outlet_ids())
    )
  );

-- 3. Optimize ledger_stok & stok_balance RLS policies
DROP POLICY IF EXISTS ledger_read ON public.ledger_stok;
CREATE POLICY ledger_read ON public.ledger_stok FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

DROP POLICY IF EXISTS ledger_insert ON public.ledger_stok;
CREATE POLICY ledger_insert ON public.ledger_stok FOR INSERT TO authenticated
  WITH CHECK (outlet_id IN (SELECT public.accessible_outlet_ids()));

DROP POLICY IF EXISTS stok_balance_read ON public.stok_balance;
CREATE POLICY stok_balance_read ON public.stok_balance FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

-- 4. Optimize attendance RLS policy
DROP POLICY IF EXISTS attendance_read ON public.attendance;
CREATE POLICY attendance_read ON public.attendance FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));
