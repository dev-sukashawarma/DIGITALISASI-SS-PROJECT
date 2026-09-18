-- Migration: 20260918150000_kunci_tulis_kasbon_cuti.sql
-- Tujuan: menutup H1 kelompok A untuk cash_advances & leave_requests
--         (audit 2026-09-18).
--
-- MASALAH 1 -- policy terbuka:
--   Keduanya punya "Allow authenticated insert/update/delete" dengan
--   USING(true). Siapa pun yang login bisa mengubah dan menghapus kasbon
--   serta pengajuan cuti milik siapa saja.
--
-- MASALAH 2 -- pemohon memegang kunci persetujuannya sendiri:
--   Policy "Users can update own ..." memakai USING (staff_id = auth.uid())
--   dengan WITH CHECK kosong, sehingga pemeriksaannya jatuh kembali ke
--   USING. Akibatnya pemohon boleh mengubah barisnya sendiri termasuk
--   kolom status -- yaitu MENYETUJUI KASBON DAN CUTINYA SENDIRI.
--   Ini pola yang sama dengan temuan approval-key-held-by-requester.
--
-- KEPUTUSAN OWNER (2026-09-18): yang menyetujui hanya HR pusat.
--
-- ALUR SAH (dipetakan sebelum menulis policy; semuanya sesi user/RLS):
--   Pengajuan (INSERT saja, oleh diri sendiri):
--     apps/absensi/src/features/kasbon/api.ts
--     apps/absensi/src/features/cuti/api.ts
--   Persetujuan (INSERT + UPDATE status):
--     apps/HR/src/hooks/useCashAdvanceMutations.ts, useLeaveMutations.ts
--     apps/admin-dashboard/src/hooks/... (nav roles ADMIN_HR, ADMIN)
--
--   Diperiksa dan dipastikan: apps/absensi TIDAK punya satu pun UPDATE
--   atau DELETE ke kedua tabel ini. Jadi mencabut hak ubah dari pemohon
--   tidak mematikan alur mana pun -- crew memang hanya mengajukan.
--
-- BENTUK AKHIR:
--   INSERT : diri sendiri (policy lama dipertahankan) ATAU HR pusat
--   UPDATE : HR pusat saja  <- ini yang menutup persetujuan-diri-sendiri
--   DELETE : HR pusat saja
--
-- TIDAK DISENTUH:
--   Semua policy SELECT. Saat ini "Allow authenticated read" (USING true)
--   masih membuat setiap akun yang login bisa membaca kasbon dan cuti
--   orang lain. Itu memang perlu diperbaiki, TETAPI Session 2026-07-10
--   mencatat adanya permukaan realtime kasbon/cuti di app absensi yang
--   kemungkinan dipakai SPV, dan itu belum diaudit. Mempersempit SELECT
--   tanpa memetakannya berisiko mematikan layar yang sah. Diangkat
--   terpisah; lingkup H1 adalah policy TULIS.

-- Satu sumber kebenaran untuk "siapa HR pusat".
-- Himpunan role = ROLE_APP_ACCESS['HR'] di packages/auth/src/access.ts,
-- sama dengan can_write_payroll(); sengaja diberi nama sendiri karena
-- maknanya berbeda (persetujuan kasbon/cuti, bukan penggajian).
CREATE OR REPLACE FUNCTION public.is_hr_pusat()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND role IN ('admin', 'admin_hr', 'owner', 'developer')
  );
$$;

REVOKE ALL ON FUNCTION public.is_hr_pusat() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_hr_pusat() TO authenticated;

-- ============ cash_advances ============
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.cash_advances;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.cash_advances;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.cash_advances;
-- Mencabut hak pemohon mengubah barisnya sendiri (termasuk status).
DROP POLICY IF EXISTS "Users can update own cash_advances" ON public.cash_advances;

CREATE POLICY cash_advances_insert_hr ON public.cash_advances
  FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_pusat());

CREATE POLICY cash_advances_update_hr ON public.cash_advances
  FOR UPDATE TO authenticated
  USING (public.is_hr_pusat())
  WITH CHECK (public.is_hr_pusat());

CREATE POLICY cash_advances_delete_hr ON public.cash_advances
  FOR DELETE TO authenticated
  USING (public.is_hr_pusat());

-- ============ leave_requests ============
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.leave_requests;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.leave_requests;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can update own leave_requests" ON public.leave_requests;

CREATE POLICY leave_requests_insert_hr ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_pusat());

CREATE POLICY leave_requests_update_hr ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (public.is_hr_pusat())
  WITH CHECK (public.is_hr_pusat());

CREATE POLICY leave_requests_delete_hr ON public.leave_requests
  FOR DELETE TO authenticated
  USING (public.is_hr_pusat());
