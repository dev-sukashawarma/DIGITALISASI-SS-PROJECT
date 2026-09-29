-- Tutup kebocoran baca data karyawan (gaji, cuti, kasbon, SP).
--
-- Sebelumnya policy SELECT `USING (true)`:
--   payroll_records, leave_requests, cash_advances, cash_advance_payments → SEMUA user login
--   (termasuk crew) bisa membaca gaji & kasbon semua karyawan;
--   discipline_records → bisa dibaca TANPA login (anon).
--
-- Pembaca sah (audit kode seluruh repo 2026-09-29):
--   * apps/HR, admin-dashboard (HR/payroll/profit) → admin, admin_hr, owner, developer
--   * apps/finance (pencairan gaji) → admin_finance (+ admin)
--   * apps/absensi → crew membaca cuti & kasbon MILIKNYA SENDIRI
--     (sudah dilayani policy "Users can read own ..." yang tetap dipertahankan)
--   * RPC SECURITY DEFINER & service_role tidak terpengaruh RLS.
-- Tidak ada alur approval SPV/leader yang membaca data karyawan lain.

-- Siapa boleh membaca data keuangan karyawan (gaji & kasbon)
CREATE OR REPLACE FUNCTION public.can_read_payroll()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND role IN ('admin', 'admin_hr', 'owner', 'developer', 'admin_finance', 'finance')
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_payroll() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_payroll() TO authenticated;

-- ── payroll_records ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated read" ON public.payroll_records;
DROP POLICY IF EXISTS payroll_read_scoped ON public.payroll_records;
CREATE POLICY payroll_read_scoped ON public.payroll_records FOR SELECT TO authenticated
  USING (staff_id = (SELECT auth.uid()) OR (SELECT public.can_read_payroll()));

-- ── cash_advances & cicilannya ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated read" ON public.cash_advances;
DROP POLICY IF EXISTS cash_advances_read_scoped ON public.cash_advances;
CREATE POLICY cash_advances_read_scoped ON public.cash_advances FOR SELECT TO authenticated
  USING ((SELECT public.can_read_payroll()));
-- (milik sendiri: policy "Users can read own cash_advances" tetap berlaku)

DROP POLICY IF EXISTS "Allow authenticated read" ON public.cash_advance_payments;
DROP POLICY IF EXISTS cash_advance_payments_read_scoped ON public.cash_advance_payments;
CREATE POLICY cash_advance_payments_read_scoped ON public.cash_advance_payments FOR SELECT TO authenticated
  USING (
    (SELECT public.can_read_payroll())
    OR EXISTS (
      SELECT 1 FROM public.cash_advances ca
      WHERE ca.id = cash_advance_payments.cash_advance_id
        AND ca.staff_id = (SELECT auth.uid())
    )
  );

-- ── leave_requests ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated read" ON public.leave_requests;
DROP POLICY IF EXISTS leave_requests_read_hr ON public.leave_requests;
CREATE POLICY leave_requests_read_hr ON public.leave_requests FOR SELECT TO authenticated
  USING ((SELECT public.is_hr_pusat()));
-- (milik sendiri: policy "Users can read own leave_requests" tetap berlaku)

-- ── discipline_records ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow anon select" ON public.discipline_records;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.discipline_records;
DROP POLICY IF EXISTS discipline_records_read_hr ON public.discipline_records;
CREATE POLICY discipline_records_read_hr ON public.discipline_records FOR SELECT TO authenticated
  USING ((SELECT public.is_hr_pusat()) OR staff_id = (SELECT auth.uid()));

-- anon (tanpa login) tidak punya kebutuhan sah atas tabel-tabel ini
REVOKE ALL ON public.payroll_records, public.cash_advances, public.cash_advance_payments,
              public.leave_requests, public.discipline_records FROM anon;
