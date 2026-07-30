-- Migration: Create area_manager_outlets mapping table

CREATE TABLE IF NOT EXISTS public.area_manager_outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(manager_id, outlet_id)
);

-- Enable RLS
ALTER TABLE public.area_manager_outlets ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own mappings
CREATE POLICY "Area managers can view their own mappings"
    ON public.area_manager_outlets FOR SELECT
    TO authenticated
    USING (auth.uid() = manager_id);

-- Allow admins and owners to manage all mappings
CREATE POLICY "Admins and owners can manage mappings"
    ON public.area_manager_outlets FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.outlet_staff 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'owner', 'admin_hr')
        )
    );

-- Helper function to get outlets for a manager
CREATE OR REPLACE FUNCTION get_manager_outlets(p_manager_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT outlet_id FROM public.area_manager_outlets WHERE manager_id = p_manager_id;
$$;
