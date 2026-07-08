-- Update RLS policy for outlet_promos to include 'owner'
DROP POLICY IF EXISTS "outlet_promos_all_admin" ON outlet_promos;

CREATE POLICY "outlet_promos_all_admin_owner" ON outlet_promos 
FOR ALL USING (get_user_role() IN ('admin', 'owner'));
