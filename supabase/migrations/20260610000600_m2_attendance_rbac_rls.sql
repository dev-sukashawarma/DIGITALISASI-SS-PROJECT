-- ====================================================================
-- M2: Tighten Attendance RLS for Role-Based Access (Crew vs SPV)
-- ====================================================================

-- Drop old policy
DROP POLICY IF EXISTS attendance_read_own_outlet ON attendance;

-- Create new policies
-- 1. Crew can only read THEIR OWN attendance records
CREATE POLICY attendance_read_own_records
  ON attendance FOR SELECT
  TO authenticated
  USING (outlet_staff_id = auth.uid());

-- 2. SPV can read ALL attendance records in their outlet
CREATE POLICY attendance_spv_read_outlet
  ON attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND me.outlet_id = attendance.outlet_id
        AND me.role IN ('spv', 'kepala_outlet')
    )
  );
