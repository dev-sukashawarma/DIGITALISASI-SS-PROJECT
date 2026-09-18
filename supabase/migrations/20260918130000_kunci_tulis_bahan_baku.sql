-- Migration: 20260918130000_kunci_tulis_bahan_baku.sql
-- Tujuan: menutup H1 kelompok A untuk bahan_baku (audit 2026-09-18).
--
-- MASALAH:
--   Policy "Allow update for authenticated users on bahan baku" memakai
--   USING(true) untuk {authenticated}. Siapa pun yang login -- 80 crew,
--   29 leader, 19 mitra -- bisa mengubah 69 baris master bahan baku,
--   termasuk harga_beli yang menjadi DASAR HPP seluruh menu.
--
--   Di sebelahnya sudah ada policy ber-scope bernama bahan_baku_write,
--   tetapi ia dekoratif: policy permissive di-OR-kan, jadi selama policy
--   USING(true) masih ada, scope apa pun tidak berarti. Penyakit yang sama
--   dengan surat_jalan_all (Session 2026-09-10).
--
-- KENAPA bahan_baku_write TIDAK CUKUP DIPERTAHANKAN SENDIRIAN:
--   Isinya hanya role = 'leader'. Kalau policy terbuka dibuang tanpa
--   mengganti bahan_baku_write, maka ADMIN dan PURCHASING -- satu-satunya
--   pihak yang benar-benar memakai layar harga bahan baku -- justru
--   kehilangan akses, sementara 29 leader tetap memegangnya. Terbalik.
--
-- ALUR SAH (dipetakan sebelum menulis policy):
--   Hanya SATU penulis yang tunduk RLS, yaitu lewat sesi user:
--     apps/admin-dashboard/src/hooks/useBahanBakuHargaMutations.ts
--   Dikonsumsi oleh:
--     - /dashboard/bahan-baku            -> navConfig roles: ADMIN
--     - /dashboard/pembelian/[id]        -> navConfig roles: ADMIN, PURCHASING
--
--   Penulis lain memakai service_role sehingga MELEWATI RLS dan tidak
--   terpengaruh migration ini (sudah diperiksa satu per satu):
--     apps/portal/src/app/public/form-bahan-baku/actions.ts
--     apps/admin-dashboard/src/app/public/form-bahan-baku/actions.ts
--     apps/admin-dashboard/src/app/actions/bahanBakuActions.ts
--     apps/stok/src/app/actions/bahanBakuActions.ts
--     apps/stok/src/app/actions/hargaBahan.ts
--     apps/stok/src/app/actions/budget.ts
--   Begitu pula trigger/fungsi SECURITY DEFINER (katalog_tulis_dari_po,
--   verifikasi_terima_po, sync_harga_beli_display) -- semuanya bypass RLS.
--
-- PERUBAHAN PERILAKU YANG DISENGAJA:
--   role 'leader' KEHILANGAN hak tulis bahan_baku. Tidak ada alur RLS yang
--   membutuhkannya (layar bahan baku bergating ADMIN/PURCHASING), sedangkan
--   membiarkan 29 leader mengubah harga_beli berarti membiarkan 29 orang
--   menggeser dasar HPP seluruh menu. Kalau ternyata ada layar leader yang
--   belum ketahuan, gejalanya akan eksplisit (penolakan RLS, bukan diam),
--   dan pemulihannya cukup menambahkan 'leader' ke helper di bawah.
--
-- TIDAK DISENTUH:
--   Kedua policy SELECT (bahan_baku_read untuk authenticated, dan
--   bahan_baku_read_anon yang hanya membuka baris is_active = true untuk
--   katalog pelanggan). Lingkup H1 adalah policy TULIS.

-- Satu sumber kebenaran untuk "siapa boleh mengubah master bahan baku".
CREATE OR REPLACE FUNCTION public.can_write_bahan_baku()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND role IN ('admin', 'owner', 'purchasing')
  );
$$;

REVOKE ALL ON FUNCTION public.can_write_bahan_baku() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_bahan_baku() TO authenticated;

-- 1. Buang policy terbuka.
DROP POLICY IF EXISTS "Allow update for authenticated users on bahan baku" ON public.bahan_baku;

-- 2. Ganti policy leader-only dengan yang mencerminkan pemakai sebenarnya.
DROP POLICY IF EXISTS bahan_baku_write ON public.bahan_baku;

CREATE POLICY bahan_baku_write ON public.bahan_baku
  FOR ALL TO authenticated
  USING (public.can_write_bahan_baku())
  WITH CHECK (public.can_write_bahan_baku());
