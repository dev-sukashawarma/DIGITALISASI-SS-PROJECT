-- outlet_staff RLS: per-outlet isolation + role-based access
ALTER TABLE outlet_staff ENABLE ROW LEVEL SECURITY;

-- Policy 1: Staff read own profile
CREATE POLICY outlet_staff_read_self
  ON outlet_staff FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy 2: SPV/Kepala outlet can read staff in own outlet
CREATE POLICY outlet_staff_read_own_outlet
  ON outlet_staff FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff AS supervisor
      WHERE supervisor.id = auth.uid()
        AND supervisor.outlet_id = outlet_staff.outlet_id
        AND supervisor.role IN ('spv', 'kepala_outlet')
    )
  );

-- Policy 3: SPV/Kepala outlet can update staff in own outlet
CREATE POLICY outlet_staff_update_own_outlet
  ON outlet_staff FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff AS supervisor
      WHERE supervisor.id = auth.uid()
        AND supervisor.outlet_id = outlet_staff.outlet_id
        AND supervisor.role IN ('spv', 'kepala_outlet')
    )
  );

-- Policy 4: Service role (Edge Function) can INSERT/UPDATE for sync
CREATE POLICY outlet_staff_service_role_insert
  ON outlet_staff FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY outlet_staff_service_role_update
  ON outlet_staff FOR UPDATE
  TO service_role
  USING (true);
