-- ============================================================
-- DEVELOPMENT TOOLS: Add DELETE permission to SPV for 'attendance' table
-- Jalankan script ini di: Supabase Dashboard > SQL Editor
-- ============================================================

DROP POLICY IF EXISTS "attendance_delete_spv" ON attendance;

CREATE POLICY "attendance_delete_spv"
  ON attendance FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND me.outlet_id = attendance.outlet_id
        AND me.role IN ('spv','kepala_outlet')
    )
  );
