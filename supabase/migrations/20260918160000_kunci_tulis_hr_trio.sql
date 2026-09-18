-- Migration: 20260918160000_kunci_tulis_hr_trio.sql
-- Tujuan: menutup H1 kelompok A untuk cash_advance_payments,
--         attendance_logs, dan discipline_records (audit 2026-09-18).
--
-- MASALAH (identik di ketiganya):
--   Masing-masing punya "Allow authenticated insert/update/delete" dengan
--   USING(true). Siapa pun yang login bisa:
--     - cash_advance_payments : mencatat/menghapus cicilan kasbon siapa pun
--     - attendance_logs       : mengubah dan menghapus catatan kehadiran
--                               serta jadwal shift siapa pun
--     - discipline_records    : membuat, mengubah, menghapus catatan SP
--   Ketiganya berbeda dengan tabel lain di kelompok ini karena BELUM punya
--   policy ber-scope sama sekali -- jadi policy di bawah dirancang dari nol,
--   bukan mengganti yang dekoratif.
--
-- ALUR SAH (dipetakan sebelum menulis policy; semuanya sesi user/RLS):
--   apps/HR/src/hooks/useCashAdvanceMutations.ts  (cash_advance_payments)
--   apps/HR/src/hooks/useRoster.ts                (attendance_logs)
--   apps/HR/src/hooks/useDiscipline.ts            (discipline_records)
--   padanannya di apps/admin-dashboard/src/hooks/:
--     useAttendanceMutations.ts, useLeaveMutations.ts, useRoster.ts,
--     useDiscipline.ts, useCashAdvanceMutations.ts
--
--   Halaman yang memakainya bergating ADMIN_HR + ADMIN di navConfig:
--     /dashboard/hr/attendance, /dashboard/hr/roster, /dashboard/hr/discipline
--   Sejalan dengan is_hr_pusat() (keputusan owner 2026-09-18: urusan HR
--   ditangani HR pusat), helper yang sama dengan migration kasbon/cuti.
--
--   Melewati RLS, tidak terdampak:
--     apps/admin-dashboard/src/app/api/users/[id]/route.ts (supabaseService)
--   Diperiksa: NOL edge function di supabase/functions/ yang menulis
--   ketiga tabel ini.
--
--   Penting: kiosk absensi TIDAK menulis attendance_logs -- jalur absen
--   crew memakai tabel `attendance` (policy service_role tersendiri).
--   Jadi pengetatan ini tidak menyentuh alur absen harian crew.
--
-- TIDAK DISENTUH:
--   Policy SELECT ketiganya, termasuk "Allow anon select" pada
--   discipline_records yang membuat catatan SP terbaca TANPA LOGIN.
--   Itu masalah nyata, tetapi masuk lingkup C2 (paparan baca) yang masih
--   terbuka -- bukan lingkup H1, dan tidak ditambal diam-diam di sini.

-- ============ cash_advance_payments ============
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.cash_advance_payments;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.cash_advance_payments;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.cash_advance_payments;

CREATE POLICY cash_advance_payments_write_hr ON public.cash_advance_payments
  FOR ALL TO authenticated
  USING (public.is_hr_pusat())
  WITH CHECK (public.is_hr_pusat());

-- ============ attendance_logs ============
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.attendance_logs;

CREATE POLICY attendance_logs_write_hr ON public.attendance_logs
  FOR ALL TO authenticated
  USING (public.is_hr_pusat())
  WITH CHECK (public.is_hr_pusat());

-- ============ discipline_records ============
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.discipline_records;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.discipline_records;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.discipline_records;

CREATE POLICY discipline_records_write_hr ON public.discipline_records
  FOR ALL TO authenticated
  USING (public.is_hr_pusat())
  WITH CHECK (public.is_hr_pusat());
