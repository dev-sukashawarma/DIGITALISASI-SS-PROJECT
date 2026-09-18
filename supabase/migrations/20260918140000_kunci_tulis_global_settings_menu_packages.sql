-- Migration: 20260918140000_kunci_tulis_global_settings_menu_packages.sql
-- Tujuan: menutup H1 kelompok A untuk global_settings & menu_packages
--         (audit 2026-09-18).
--
-- MASALAH (pola yang sama di kedua tabel):
--   Masing-masing punya policy USING(true) untuk {authenticated} yang
--   memberi hak tulis penuh kepada siapa pun yang login, BERDAMPINGAN
--   dengan policy ber-scope admin yang karenanya jadi dekorasi belaka
--   (policy permissive di-OR-kan). Sama seperti surat_jalan_all dan
--   bahan_baku_write.
--
--     global_settings : "Allow authenticated users to update global_settings"
--     menu_packages   : "Enable all access for authenticated"
--
--   global_settings memuat setelan lintas sistem (mis. print_layout,
--   global_attendance_config, brand_name). menu_packages menentukan isi
--   paket menu, yang ikut menentukan pemotongan BOM tiap order.
--
-- KEPUTUSAN OWNER (2026-09-18): owner HARUS bisa menulis keduanya.
--   Policy ber-scope yang ada hanya menyebut role 'admin', sehingga
--   membuang policy terbuka tanpa menggantinya akan mengunci owner dari
--   setelan sistem dan paket menu. Karena itu keduanya DIGANTI, bukan
--   sekadar dipertahankan.
--
--   Dipakai helper kanonik is_owner_or_admin() yang sudah ada -- isinya
--   persis role IN ('owner','admin'), STABLE, SECURITY DEFINER, dengan
--   search_path terkunci. Tidak perlu helper baru.
--
-- ALUR SAH (dipetakan sebelum menulis policy):
--   Yang tunduk RLS (sesi user):
--     - apps/pos-kasir/app/api/settings/route.ts (brand_name, brand_logo).
--       Sudah menolak sendiri role selain 'admin' di lapisan app, jadi
--       policy ini tidak mempersempit apa pun yang sebelumnya jalan.
--     - apps/admin-dashboard/src/app/dashboard/pos-admin/menu/actions.ts
--       (createSupabaseServerClient dari @suka/auth). Nav-nya bergating
--       ADMIN. Catatan: Server Action ini TIDAK punya cek role sendiri,
--       jadi RLS adalah satu-satunya gerbangnya -- persis kelas masalah
--       Session 2026-07-20, dan alasan tambahan untuk memperbaikinya.
--
--   Melewati RLS (service_role), tidak terdampak:
--     - apps/absensi/src/app/dashboard/pengaturan/actions.ts
--     - apps/absensi/src/app/api/outlet-config/route.ts
--     - apps/admin-dashboard/src/app/api/settings/route.ts
--   Ini penting: halaman Pengaturan absensi dipakai SPV, dan karena ia
--   memakai service_role, SPV TIDAK terpengaruh pengetatan ini.
--
--   apps/admin-dashboard/src/components/GoogleSheetsSettingsModal.tsx
--   memakai sesi user, tetapi tidak diimpor berkas mana pun (komponen
--   mati) -- bukan alur hidup.
--
-- TIDAK DISENTUH:
--   Semua policy SELECT kedua tabel, termasuk pembacaan publik
--   menu_packages untuk katalog pelanggan. Lingkup H1 adalah policy TULIS.

-- ============ global_settings ============
DROP POLICY IF EXISTS "Allow authenticated users to update global_settings" ON public.global_settings;
DROP POLICY IF EXISTS "Admin write access for global_settings" ON public.global_settings;

CREATE POLICY global_settings_write ON public.global_settings
  FOR ALL TO authenticated
  USING (public.is_owner_or_admin())
  WITH CHECK (public.is_owner_or_admin());

-- ============ menu_packages ============
DROP POLICY IF EXISTS "Enable all access for authenticated" ON public.menu_packages;
DROP POLICY IF EXISTS menu_packages_all_admin ON public.menu_packages;

CREATE POLICY menu_packages_write ON public.menu_packages
  FOR ALL TO authenticated
  USING (public.is_owner_or_admin())
  WITH CHECK (public.is_owner_or_admin());
