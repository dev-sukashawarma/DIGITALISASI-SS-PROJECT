-- Migration: 20260918190000_nyalakan_rls_tiktok_transaksi.sql
-- Tujuan: menutup bagian C2 dengan volume terbesar kedua -- data transaksi
--         marketplace TikTok yang terbaca tanpa login (audit 2026-09-18).
--
-- MASALAH (dibuktikan lewat HTTP nyata memakai anon key):
--   tiktok_transaksi_item -> 17.775 baris terbaca
--   tiktok_transaksi      -> 14.891 baris terbaca
--   v_tiktok_rekap_sku    ->     11 baris terbaca
--
--   Kedua tabel itu RLS-nya TIDAK PERNAH DINYALAKAN dan nol policy. Jadi
--   ini bukan policy yang salah tulis, melainkan langkah yang terlewat
--   saat tabelnya dibuat. Keduanya memuat data penjualan marketplace:
--   nomor pesanan, nama produk, tanggal settlement, nilai transaksi.
--
-- MENYALAKAN RLS SAJA TIDAK CUKUP:
--   v_tiktok_rekap_sku adalah view tanpa security_invoker, artinya ia
--   berjalan sebagai PEMILIKNYA dan MELEWATI RLS tabel dasarnya. Kalau
--   hanya RLS yang dinyalakan, view ini tetap menyajikan rekap data yang
--   sama kepada anon -- kebocoran berpindah, bukan tertutup. Karena itu
--   view-nya sekalian disetel security_invoker = true supaya tunduk pada
--   RLS yang baru, sejalan dengan aturan yang sudah berlaku di repo ini
--   (lih. system_health_views: view di atas tabel sensitif WAJIB invoker).
--
-- KENAPA AMAN:
--   Disisir seluruh repo tanpa filter ekstensi: NOL referensi ke
--   tiktok_transaksi, tiktok_transaksi_item, maupun v_tiktok_rekap_sku.
--   Tidak ada kode aplikasi, tidak ada migration -- ketiga objek ini
--   dibuat langsung di database, di luar repo. Pengisian datanya memakai
--   service_role yang MELEWATI RLS, jadi proses impor tidak terganggu.
--
--   Policy baca untuk owner/admin tetap dibuat meski hari ini tak ada
--   pembacanya, supaya data ini masih bisa ditinjau dari aplikasi tanpa
--   harus memakai service_role -- dan supaya tidak muncul sebagai
--   "tabel kosong yang misterius" di kemudian hari.
--
--   Tidak ada policy TULIS yang dibuat: satu-satunya penulis adalah
--   proses impor ber-service_role, yang tidak membutuhkannya.
--
-- CATATAN: ketiga objek ini tidak punya berkas migration, jadi tidak ada
--   risiko replay yang menghidupkan kembali keadaan lama.

ALTER TABLE public.tiktok_transaksi      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_transaksi_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tiktok_transaksi_read ON public.tiktok_transaksi;
CREATE POLICY tiktok_transaksi_read ON public.tiktok_transaksi
  FOR SELECT TO authenticated
  USING (public.is_owner_or_admin());

DROP POLICY IF EXISTS tiktok_transaksi_item_read ON public.tiktok_transaksi_item;
CREATE POLICY tiktok_transaksi_item_read ON public.tiktok_transaksi_item
  FOR SELECT TO authenticated
  USING (public.is_owner_or_admin());

-- View ikut tunduk RLS, bukan melewatinya.
ALTER VIEW public.v_tiktok_rekap_sku SET (security_invoker = true);

-- Pertahanan berlapis: anon tidak perlu menyentuh ketiganya sama sekali.
REVOKE ALL ON TABLE public.tiktok_transaksi      FROM anon;
REVOKE ALL ON TABLE public.tiktok_transaksi_item FROM anon;
REVOKE ALL ON TABLE public.v_tiktok_rekap_sku    FROM anon;
