-- Fix RLS policies for inbound_outbound

DROP POLICY IF EXISTS "inbound_outbound_read" ON public.inbound_outbound;
DROP POLICY IF EXISTS "inbound_outbound_insert" ON public.inbound_outbound;
DROP POLICY IF EXISTS "inbound_outbound_service_all" ON public.inbound_outbound;

CREATE POLICY "inbound_outbound_read"
    ON public.inbound_outbound FOR SELECT
    TO authenticated
    USING (
        outlet_id IN (SELECT accessible_outlet_ids()) OR
        (SELECT role FROM public.outlet_staff WHERE id = auth.uid()) IN ('admin', 'owner', 'admin_finance', 'finance', 'purchasing', 'kitchen', 'spv', 'regional_manager', 'leader', 'area_manager', 'developer')
    );

CREATE POLICY "inbound_outbound_insert"
    ON public.inbound_outbound FOR INSERT
    TO authenticated
    WITH CHECK (
        outlet_id IN (SELECT accessible_outlet_ids()) OR
        (SELECT role FROM public.outlet_staff WHERE id = auth.uid()) IN ('admin', 'owner', 'admin_finance', 'finance', 'purchasing', 'kitchen', 'spv', 'regional_manager', 'leader', 'area_manager', 'developer')
    );

CREATE POLICY "inbound_outbound_service_all"
    ON public.inbound_outbound FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
