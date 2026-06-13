-- Fix auth_outlet_id to bypass RLS issues and stable issues
CREATE OR REPLACE FUNCTION auth_outlet_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT outlet_id FROM outlet_staff WHERE id = auth.uid();
$$;
