-- supabase/migrations/20260909110000_orders_izinkan_source_app.sql
--
-- Mengizinkan nilai 'app' pada `orders.source` dan `orders.sales_source`.
--
-- SEBAB YANG NYATA, bukan antisipasi:
-- Pembayaran QRIS Rp1 berhasil di Xendit pukul 10:11 WIB, 9 September 2026
-- (GoPay, `qrpy_935d4dc4-...`). Webhook `qr.payment` terkirim, token lolos,
-- draft ketemu -- lalu `atomic_insert_order` DITOLAK constraint karena
-- `susunPayloadPos` mengirim `source='app'` dan `sales_source='app'`, dua
-- nilai yang tidak ada di daftar mana pun. Gateway membalas 500, Xendit
-- menandai webhook `Failed`.
--
-- Akibatnya kelas kegagalan terburuk yang ada: **uang pelanggan diterima,
-- pesanan tidak pernah sampai ke dapur.**
--
-- Nilai sebelum perubahan (diverifikasi ke pg_constraint di DB produksi):
--   orders_source_check       : pos, online, manual, kiosk
--   orders_sales_source_check : pos, online, gofood, grabfood, shopeefood,
--                               tiktok, tiktok_shop, shopee_shop
--
-- Keduanya ADITIF: seluruh nilai lama tetap sah, nol baris existing yang
-- menjadi tidak valid. Mengikuti preseden penambahan `tiktok_shop` dan
-- `shopee_shop` ke daftar yang sama.
--
-- ⚠️ Ini menyentuh tabel transaksi 19 outlet. Diterapkan ke produksi atas
-- persetujuan eksplisit owner (2026-09-09) lewat SQL Editor.
--
-- Konsekuensi yang perlu diketahui: laporan yang memetakan kanal satu per
-- satu (`resolveOrderSource`, `channelGroups`, dsb.) belum mengenal 'app' dan
-- akan menampilkannya sebagai kanal tak dikenal sampai petanya diperbarui.
-- Itu kekurangan tampilan, bukan data yang salah.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_source_check
  CHECK (source = ANY (ARRAY['pos', 'online', 'manual', 'kiosk', 'app']::text[]));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_sales_source_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_sales_source_check
  CHECK (sales_source = ANY (ARRAY[
    'pos', 'online', 'gofood', 'grabfood', 'shopeefood',
    'tiktok', 'tiktok_shop', 'shopee_shop', 'app'
  ]::text[]));

COMMENT ON CONSTRAINT orders_source_check ON public.orders IS
  'Asal pesanan. ''app'' = SukaShawarma APP (pelanggan), ditambahkan 2026-09-09.';

COMMENT ON CONSTRAINT orders_sales_source_check ON public.orders IS
  'Kanal penjualan untuk pelaporan. ''app'' ditambahkan 2026-09-09.';
