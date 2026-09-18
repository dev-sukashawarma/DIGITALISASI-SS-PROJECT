-- Migration: 20260918120000_kunci_tulis_payroll_records.sql
-- Tujuan: menutup H1 kelompok A untuk payroll_records (audit 2026-09-18).
--
-- MASALAH:
--   Tiga policy bertuliskan "Allow authenticated insert/update/delete" pada
--   payroll_records memakai USING(true)/WITH CHECK kosong untuk role
--   {authenticated}. Artinya SIAPA PUN yang login -- termasuk 80 akun crew
--   dan 29 leader -- bisa menyisipkan, mengubah, dan MENGHAPUS baris gaji
--   siapa saja. Tabel ini memuat 378 baris payroll.
--
-- ALUR SAH (dipetakan sebelum menulis policy):
--   Penulis payroll_records hanya dua, keduanya lewat sesi user (RLS berlaku):
--     - apps/HR/src/hooks/usePayrollMutations.ts
--     - apps/admin-dashboard/src/hooks/usePayrollMutations.ts
--   apps/finance/src/hooks/usePayrollDisbursement.ts hanya MEMBACA
--   (nol .insert/.update/.upsert/.delete), jadi tidak terdampak migration ini.
--
--   ROLE_APP_ACCESS (packages/auth/src/access.ts) memberi akses app 'HR'
--   hanya kepada: admin, admin_hr, owner, developer. Itulah himpunan yang
--   dipakai di bawah -- bukan karangan baru, melainkan aturan yang sudah
--   berlaku di lapisan aplikasi, kini ditegakkan juga di database.
--
-- KENAPA HELPER BARU, BUKAN is_admin():
--   is_admin() = (admin, admin_hr, owner) -- tidak memuat 'developer',
--   padahal 4 akun developer nyata memegang akses app HR hari ini.
--   Memakai is_admin() akan mematikan mereka tanpa alasan keamanan.
--   Helper sendiri dibuat supaya aturannya hidup di SATU tempat, bukan
--   disalin ke tiga policy (pelajaran "dua tempat menebak aturan role
--   sendiri-sendiri", Session 2026-07-20).
--
-- SENGAJA TIDAK DISENTUH:
--   Policy SELECT "Allow authenticated read" (USING true) DIBIARKAN.
--   Membatasinya akan mengubah apa yang dilihat pengguna nyata: nav app
--   finance (apps/finance/src/components/CashLayout.tsx) menampilkan menu
--   "Gaji" TANPA gating role, sehingga spv/leader/area_manager/purchasing
--   ikut membukanya. Siapa yang berhak MELIHAT gaji adalah keputusan owner,
--   bukan keputusan teknis -- diangkat terpisah, tidak diputuskan diam-diam
--   di sini. Lingkup H1 adalah policy TULIS.

-- Satu sumber kebenaran untuk "siapa boleh mengubah payroll".
CREATE OR REPLACE FUNCTION public.can_write_payroll()
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

REVOKE ALL ON FUNCTION public.can_write_payroll() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_payroll() TO authenticated;

-- Buang tiga policy terbuka. Policy permissive di-OR-kan, jadi selama
-- ketiganya masih ada, policy ber-scope apa pun tidak berarti apa-apa.
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.payroll_records;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.payroll_records;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.payroll_records;

CREATE POLICY payroll_insert_hr ON public.payroll_records
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_payroll());

CREATE POLICY payroll_update_hr ON public.payroll_records
  FOR UPDATE TO authenticated
  USING (public.can_write_payroll())
  WITH CHECK (public.can_write_payroll());

CREATE POLICY payroll_delete_hr ON public.payroll_records
  FOR DELETE TO authenticated
  USING (public.can_write_payroll());
