-- 20260719050000_fix_ledger_insert_rls.sql
-- Fix INSERT/UPDATE policies for ledger_stok, opname, opname_item to use accessible_outlet_ids()
-- This allows privileged roles (like kitchen, admin) to modify data across multiple outlets.

-- ledger_stok
DROP POLICY IF EXISTS ledger_insert ON public.ledger_stok;
CREATE POLICY ledger_insert ON public.ledger_stok 
  FOR INSERT TO authenticated 
  WITH CHECK (outlet_id IN (SELECT public.accessible_outlet_ids()));

-- opname
DROP POLICY IF EXISTS opname_insert ON public.opname;
CREATE POLICY opname_insert ON public.opname 
  FOR INSERT TO authenticated
  WITH CHECK (outlet_id IN (SELECT public.accessible_outlet_ids()));

DROP POLICY IF EXISTS opname_update ON public.opname;
CREATE POLICY opname_update ON public.opname 
  FOR UPDATE TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()) AND status = 'draft')
  WITH CHECK (outlet_id IN (SELECT public.accessible_outlet_ids()) AND status = 'draft');

-- opname_item
DROP POLICY IF EXISTS opname_item_write ON public.opname_item;
CREATE POLICY opname_item_write ON public.opname_item 
  FOR ALL TO authenticated
  USING (opname_id IN (SELECT id FROM public.opname WHERE status='draft' AND outlet_id IN (SELECT public.accessible_outlet_ids())))
  WITH CHECK (opname_id IN (SELECT id FROM public.opname WHERE status='draft' AND outlet_id IN (SELECT public.accessible_outlet_ids())));
