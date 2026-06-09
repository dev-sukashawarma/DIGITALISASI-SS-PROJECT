-- attendance RLS: isolasi per-outlet
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Staff/ SPV boleh baca attendance di outlet-nya sendiri
CREATE POLICY attendance_read_own_outlet
  ON attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND me.outlet_id = attendance.outlet_id
    )
  );

-- Tulis attendance HANYA via Edge Function (service role). Client tidak insert langsung.
CREATE POLICY attendance_service_insert
  ON attendance FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY attendance_service_update
  ON attendance FOR UPDATE
  TO service_role
  USING (true);

-- outlet_attendance_config RLS
ALTER TABLE outlet_attendance_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY oac_read_own_outlet
  ON outlet_attendance_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND me.outlet_id = outlet_attendance_config.outlet_id
    )
  );

CREATE POLICY oac_update_spv
  ON outlet_attendance_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND me.outlet_id = outlet_attendance_config.outlet_id
        AND me.role IN ('spv','kepala_outlet')
    )
  );

-- DOWN:
-- DROP POLICY IF EXISTS attendance_read_own_outlet ON attendance;
-- DROP POLICY IF EXISTS attendance_service_insert ON attendance;
-- DROP POLICY IF EXISTS attendance_service_update ON attendance;
-- DROP POLICY IF EXISTS oac_read_own_outlet ON outlet_attendance_config;
-- DROP POLICY IF EXISTS oac_update_spv ON outlet_attendance_config;
