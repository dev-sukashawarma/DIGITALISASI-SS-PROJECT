-- 20260712000000_fix_ledger_rls_for_privileged_roles.sql
--
-- Masalah: Policy lama `ledger_read` hanya mengecek outlet_id tunggal dari
-- tabel outlet_staff (kolom outlet_id), sehingga role seperti `kitchen`, `spv`,
-- dan `admin` yang punya akses multi-outlet via accessible_outlet_ids() tidak
-- bisa membaca ledger dari outlet lain.
--
-- Policy `ledger_read_kepala_multi` yang dibuat sebelumnya sudah menggunakan
-- accessible_outlet_ids(), namun karena kedua policy bersifat permissive dan
-- di-OR, hal ini seharusnya bekerja. Namun jika ada race condition atau bug
-- pada pemanggilan function context, kita unify semua ke satu policy.
--
-- Solusi: Drop semua policy SELECT pada ledger_stok, ganti dengan satu policy
-- tunggal yang menggunakan accessible_outlet_ids() untuk semua role.

-- Hapus policy lama
DROP POLICY IF EXISTS ledger_read ON public.ledger_stok;
DROP POLICY IF EXISTS ledger_read_kepala_multi ON public.ledger_stok;

-- Buat satu policy bersatu menggunakan accessible_outlet_ids()
-- yang sudah mencakup semua role (admin, spv, kitchen, korlap, crew, dll.)
CREATE POLICY ledger_read ON public.ledger_stok
  FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

-- Juga fix policy stok_balance agar konsisten
DROP POLICY IF EXISTS stok_balance_read ON public.stok_balance;
CREATE POLICY stok_balance_read ON public.stok_balance
  FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

-- Fix opname read policy agar role privileged bisa lihat opname semua outlet
DROP POLICY IF EXISTS opname_read ON public.opname;
CREATE POLICY opname_read ON public.opname
  FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));
