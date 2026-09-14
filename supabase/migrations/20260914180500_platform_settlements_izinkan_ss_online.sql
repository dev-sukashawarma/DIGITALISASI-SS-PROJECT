-- 20260914180500_platform_settlements_izinkan_ss_online.sql
--
-- Izinkan settlement SS Online (TikTok Shop & Shopee Shop) disimpan di
-- `platform_settlements`, di samping food delivery yang sudah ada.
--
-- Keputusan owner 2026-09-14: kartu "Rekonsiliasi Settlement" di Ringkasan
-- Penjualan hanya tampil bila file settlement sudah DIUNGGAH — dan SS Online
-- harus berperilaku sama persis dengan TikTok GO. Sebelumnya CHECK kolom
-- `platform` hanya menerima food delivery, sehingga settlement SS Online secara
-- teknis tidak mungkin disimpan.
--
-- Nilai platform mengikuti `orders.sales_source` SS Online (Session 2026-08-05):
-- `tiktok_shop` dan `shopee_shop` — BUKAN `shopee`, yang sudah jadi alias
-- ShopeeFood dan akan memberi label salah.
--
-- `outlet_id` untuk baris SS Online = outlet virtual marketplace
-- (`outlets.type = 'marketplace'`: TikTok Shop, Shopee).
--
-- Aditif: hanya melebarkan himpunan nilai yang diterima. Nol baris yang ada
-- berubah (tabel kosong saat migration ini ditulis — 184 baris kembar Hermes
-- sudah dihapus hari yang sama). Nama constraint diverifikasi di DB live lewat
-- pesan penolakan insert: `platform_settlements_platform_check`.

ALTER TABLE public.platform_settlements
  DROP CONSTRAINT IF EXISTS platform_settlements_platform_check;

ALTER TABLE public.platform_settlements
  ADD CONSTRAINT platform_settlements_platform_check
  CHECK (platform IN ('shopeefood', 'grabfood', 'gofood', 'tiktokgo', 'tiktok_shop', 'shopee_shop'));
