-- 20260613000800_rls_kepala_outlet_multi.sql
-- kepala_outlet boleh membaca data outlet binaannya (staff_outlets) via helper.
DROP POLICY IF EXISTS attendance_read_kepala_multi ON public.attendance;
CREATE POLICY attendance_read_kepala_multi ON public.attendance
  FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

DROP POLICY IF EXISTS ledger_read_kepala_multi ON public.ledger_stok;
CREATE POLICY ledger_read_kepala_multi ON public.ledger_stok
  FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));
