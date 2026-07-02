-- Drop the old insecure policies
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.system_guides;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.system_guides;

-- Create correct policies that only allow admin or owner to modify
CREATE POLICY "Allow insert for admin and owner" ON public.system_guides 
    FOR INSERT TO authenticated 
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.outlet_staff WHERE id = auth.uid() AND role IN ('admin', 'owner', 'admin_hr'))
    );

CREATE POLICY "Allow update for admin and owner" ON public.system_guides 
    FOR UPDATE TO authenticated 
    USING (
        EXISTS (SELECT 1 FROM public.outlet_staff WHERE id = auth.uid() AND role IN ('admin', 'owner', 'admin_hr'))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.outlet_staff WHERE id = auth.uid() AND role IN ('admin', 'owner', 'admin_hr'))
    );
