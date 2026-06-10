-- Fix infinite recursion in outlet_staff RLS.
--
-- Root cause: outlet_staff_read_own_outlet and outlet_staff_update_own_outlet
-- policies query outlet_staff from within outlet_staff policies, causing
-- Postgres to recurse indefinitely.
--
-- Fix: SECURITY DEFINER helper functions bypass RLS, breaking the cycle.

CREATE OR REPLACE FUNCTION auth_outlet_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT outlet_id FROM outlet_staff WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION auth_is_supervisor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE id = auth.uid() AND role IN ('spv', 'kepala_outlet')
  );
$$;

-- Drop recursive policies and replace with function-based equivalents.
DROP POLICY IF EXISTS outlet_staff_read_own_outlet ON outlet_staff;
DROP POLICY IF EXISTS outlet_staff_update_own_outlet ON outlet_staff;

CREATE POLICY outlet_staff_read_own_outlet
  ON outlet_staff FOR SELECT
  TO authenticated
  USING (outlet_id = auth_outlet_id() AND auth_is_supervisor());

CREATE POLICY outlet_staff_update_own_outlet
  ON outlet_staff FOR UPDATE
  TO authenticated
  USING (outlet_id = auth_outlet_id() AND auth_is_supervisor());
