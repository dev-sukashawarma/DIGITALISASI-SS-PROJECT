-- Drop old restrictive policies for kasir if they exist
DROP POLICY IF EXISTS "attendance_read_kasir" ON public.attendance;

-- Create new inclusive policies that allow any staff in the outlet to read attendance
-- This is critical for POS Kasir Realtime subscriptions, as the POS tablet is often
-- logged in as a specific crew or leader, but needs to listen to ALL attendance events for that outlet.
CREATE POLICY "attendance_read_kasir" ON public.attendance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid()
        AND (s.outlet_id = attendance.outlet_id OR s.role IN ('admin', 'admin_hr', 'spv', 'korlap'))
    )
  );

-- For checklist records
DROP POLICY IF EXISTS "checklist_records_read_kasir" ON public.daily_checklist_records;
CREATE POLICY "checklist_records_read_kasir" ON public.daily_checklist_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid()
        AND (s.outlet_id = daily_checklist_records.outlet_id OR s.role IN ('admin', 'admin_hr', 'spv', 'korlap'))
    )
  );

-- For checklist ticks
DROP POLICY IF EXISTS "checklist_ticks_read_kasir" ON public.daily_checklist_ticks;
CREATE POLICY "checklist_ticks_read_kasir" ON public.daily_checklist_ticks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_checklist_records r
      JOIN public.outlet_staff s ON s.outlet_id = r.outlet_id
      WHERE r.id = daily_checklist_ticks.record_id
        AND (s.id = auth.uid() OR s.role IN ('admin', 'admin_hr', 'spv', 'korlap'))
    )
  );
