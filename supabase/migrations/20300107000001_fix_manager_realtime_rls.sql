-- Fix RLS for cancellation_requests and petty_cash_topups to ensure area_manager
-- can receive Realtime updates (since SECURITY DEFINER policies block Realtime).

-- 1. Ensure tables are in publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'cancellation_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE cancellation_requests;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'petty_cash_topups'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE petty_cash_topups;
    END IF;
END $$;

-- 2. Add RLS for cancellation_requests if not exists, and allow select for area_manager
ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cancellation_requests_select" ON public.cancellation_requests;
CREATE POLICY "cancellation_requests_select" ON public.cancellation_requests 
FOR SELECT TO authenticated 
USING (
  -- Admin/Finance/Owner
  EXISTS (
    SELECT 1 FROM public.outlet_staff 
    WHERE id = auth.uid() 
      AND role IN ('admin', 'admin_finance', 'finance', 'owner', 'regional_manager')
  )
  -- Or belongs to the outlet
  OR order_id IN (
    SELECT id FROM public.orders WHERE outlet_id IN (
      SELECT outlet_id FROM public.outlet_staff WHERE id = auth.uid()
      UNION
      SELECT outlet_id FROM public.staff_outlets WHERE staff_id = auth.uid()
      UNION
      SELECT outlet_id FROM public.area_manager_outlets WHERE manager_id = auth.uid()
    )
  )
);

-- 3. Fix petty_cash_topups to include area_manager_outlets
DROP POLICY IF EXISTS "petty_cash_topups_select" ON public.petty_cash_topups;
CREATE POLICY "petty_cash_topups_select" ON public.petty_cash_topups 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.outlet_staff 
    WHERE id = auth.uid() 
      AND role IN ('admin', 'admin_finance', 'finance', 'owner', 'regional_manager')
  )
  OR outlet_id IN (
    SELECT outlet_id FROM public.staff_outlets WHERE staff_id = auth.uid()
  )
  OR outlet_id IN (
    SELECT outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  )
  OR outlet_id IN (
    SELECT outlet_id FROM public.area_manager_outlets WHERE manager_id = auth.uid()
  )
);
