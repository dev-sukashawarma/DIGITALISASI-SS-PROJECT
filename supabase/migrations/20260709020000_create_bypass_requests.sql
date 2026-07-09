-- Create bypass_requests table
CREATE TABLE IF NOT EXISTS public.bypass_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES public.outlets(id),
    requested_by_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- RLS Policies
ALTER TABLE public.bypass_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kasir can insert bypass requests" 
    ON public.bypass_requests FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Kasir can view bypass requests for their outlet" 
    ON public.bypass_requests FOR SELECT 
    USING (true);
    
-- SPV/Admin can update
CREATE POLICY "SPV can update bypass requests" 
    ON public.bypass_requests FOR UPDATE 
    USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE bypass_requests;
