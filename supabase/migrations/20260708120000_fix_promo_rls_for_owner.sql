-- Create missing table outlet_promos if it doesn't exist to prevent errors
CREATE TABLE IF NOT EXISTS public.outlet_promos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID REFERENCES public.outlets(id),
    name TEXT NOT NULL,
    discount_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.outlet_promos ENABLE ROW LEVEL SECURITY;

-- Update RLS policy for outlet_promos to include 'owner'
DROP POLICY IF EXISTS "outlet_promos_all_admin" ON public.outlet_promos;

CREATE POLICY "outlet_promos_all_admin_owner" ON public.outlet_promos 
FOR ALL USING (get_user_role() IN ('admin', 'owner'));
