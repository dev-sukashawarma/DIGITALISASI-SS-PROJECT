-- 20260612000000_pos_kasir_attendance_rls.sql
-- Allow POS Kasir to read attendance data for their outlet

CREATE POLICY "attendance_read_kasir" ON attendance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'kasir'
        AND p.outlet_id = attendance.outlet_id
    )
  );

-- Helper function to check if there is an active staff presence in the outlet today
CREATE OR REPLACE FUNCTION get_outlet_presence(p_outlet_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT outlet_staff_id, (array_agg(type ORDER BY ts_server DESC))[1] as latest_type
      FROM attendance
      WHERE outlet_id = p_outlet_id
        AND (ts_server AT TIME ZONE 'Asia/Jakarta')::date = (NOW() AT TIME ZONE 'Asia/Jakarta')::date
      GROUP BY outlet_staff_id
    ) sub
    WHERE latest_type = 'in'
  );
$$;
