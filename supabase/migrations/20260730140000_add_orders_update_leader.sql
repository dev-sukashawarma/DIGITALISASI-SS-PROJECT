-- Add UPDATE policy for 'leader' role on the orders table
-- This allows leaders to update orders for outlets they have access to (via staff_outlets)
DROP POLICY IF EXISTS "orders_update_leader" ON public.orders;
CREATE POLICY "orders_update_leader" ON public.orders FOR UPDATE 
USING (
  outlet_id IN (SELECT public.accessible_outlet_ids()) AND 
  get_user_role() = 'leader'
);
