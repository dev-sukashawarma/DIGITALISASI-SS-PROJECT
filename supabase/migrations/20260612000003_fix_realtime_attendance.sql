-- Fix: Enable Realtime for attendance table + ensure RLS policies
-- Run this in Supabase SQL Editor (Absensi/unified project)

-- 1. Tambahkan tabel attendance ke Realtime publication
-- (Ini yang sebelumnya corrupt dan tidak jalan)
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;

-- 2. Pastikan kasir bisa membaca attendance untuk outlet mereka
-- (diperlukan agar Realtime postgres_changes bisa berfungsi)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'attendance' AND policyname = 'attendance_read_kasir'
  ) THEN
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
  END IF;
END $$;

-- 3. Pastikan fungsi get_outlet_presence ada
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
