-- Migration: 20260918170000_kunci_tulis_harga_outlet_sales_channels.sql
-- Tujuan: menutup H1 kelompok A untuk menu_outlet_prices dan
--         sales_channels (audit 2026-09-18). Dua tabel terakhir kelompok A.
--
-- MASALAH:
--   Keduanya punya "Enable all access for authenticated users" dengan
--   USING(true): siapa pun yang login bisa mengubah harga jual per outlet
--   dan master kanal penjualan. Belum ada policy ber-scope sama sekali.
--
-- DUA ATURAN BERBEDA -- sengaja tidak disamakan:
--
-- 1. menu_outlet_prices -> admin, owner, spv, regional_manager
--    Penulisnya BUKAN hanya admin-dashboard. App `manager` juga menulisnya:
--      apps/manager/src/app/resep/OutletPricingView.tsx
--      apps/manager/src/app/resep/HppDashboardView.tsx
--    dan halaman /resep di sana terbuka untuk seluruh role app manager
--    KECUALI area_manager (ManagerLayout.tsx: excludedRoles ['area_manager']).
--    ROLE_APP_ACCESS memberi app 'manager' kepada spv, regional_manager,
--    area_manager -- jadi penulis sahnya spv dan regional_manager.
--    Membatasi tabel ini ke owner/admin saja akan mematikan layar harga
--    di app manager bagi mereka.
--
--    Catatan untuk owner: apakah SPV memang seharusnya menetapkan harga
--    jual per outlet adalah pertanyaan bisnis, bukan teknis. Di sini
--    dipertahankan sesuai perilaku yang berjalan hari ini; mempersempitnya
--    adalah keputusan tersendiri.
--
-- 2. sales_channels -> owner/admin (is_owner_or_admin)
--    Disisir seluruh repo lewat dua pencarian terpisah: NOL penulis.
--    Setiap rujukan hanya .select() (admin-dashboard resep/page.tsx,
--    pos-admin/menu/page.tsx, manager resep/page.tsx, dan beberapa skrip
--    pemeriksa). Ini data referensi yang praktis hanya dibaca, jadi
--    dikunci rapat tanpa risiko memutus alur mana pun.
--
-- TIDAK DISENTUH:
--   Policy SELECT kedua tabel. Lingkup H1 adalah policy TULIS.

-- Sumber kebenaran untuk "siapa boleh menetapkan harga jual per outlet".
CREATE OR REPLACE FUNCTION public.can_set_harga_outlet()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND role IN ('admin', 'owner', 'spv', 'regional_manager')
  );
$$;

REVOKE ALL ON FUNCTION public.can_set_harga_outlet() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_set_harga_outlet() TO authenticated;

-- ============ menu_outlet_prices ============
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.menu_outlet_prices;

CREATE POLICY menu_outlet_prices_write ON public.menu_outlet_prices
  FOR ALL TO authenticated
  USING (public.can_set_harga_outlet())
  WITH CHECK (public.can_set_harga_outlet());

-- ============ sales_channels ============
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.sales_channels;

CREATE POLICY sales_channels_write ON public.sales_channels
  FOR ALL TO authenticated
  USING (public.is_owner_or_admin())
  WITH CHECK (public.is_owner_or_admin());
