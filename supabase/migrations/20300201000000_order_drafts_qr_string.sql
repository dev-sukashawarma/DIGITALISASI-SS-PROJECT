-- supabase/migrations/20300201000000_order_drafts_qr_string.sql
--
-- Menyimpan teks mentah kode QRIS untuk pesanan aplikasi pelanggan.
--
-- Sebelumnya gateway memakai Invoice API Xendit, yang hanya mengembalikan URL
-- halaman pembayaran -- pelanggan harus dilempar ke peramban. QR Code API
-- mengembalikan `qr_string`, sehingga aplikasi bisa menggambar sendiri
-- kodenya dan pembayaran tidak lagi meninggalkan aplikasi.
--
-- Kolomnya NULLABLE dan itu disengaja:
--   * pesanan lama (jalur Invoice) tidak punya nilai ini;
--   * jalur Invoice sengaja DIPERTAHANKAN sebagai cadangan, dan pesanan yang
--     dibuat lewat jalur itu tetap ber-`qr_string` NULL.
--
-- Aditif sepenuhnya: tidak mengubah kolom, kendala, atau kebijakan mana pun
-- yang sudah ada. Tabel ini hanya disentuh Retail Gateway (service_role);
-- POS kasir, stok, dan absensi tidak mengenalnya.

ALTER TABLE retail.order_drafts
  ADD COLUMN IF NOT EXISTS qr_string text;

COMMENT ON COLUMN retail.order_drafts.qr_string IS
  'Teks mentah QRIS dari Xendit QR Code API. NULL untuk pesanan jalur Invoice.';

-- PostgREST menyimpan cache skema; tanpa ini kolom baru tidak terlihat oleh
-- gateway sampai layanannya kebetulan memuat ulang sendiri.
NOTIFY pgrst, 'reload schema';
