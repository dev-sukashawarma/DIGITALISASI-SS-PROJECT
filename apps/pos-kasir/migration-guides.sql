-- Tabel guides untuk Buku Panduan dinamis
CREATE TABLE IF NOT EXISTS guides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  image_url   TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guides_select_public" ON guides;
DROP POLICY IF EXISTS "guides_all_admin" ON guides;

CREATE POLICY "guides_select_public" ON guides FOR SELECT USING (true);
CREATE POLICY "guides_all_admin" ON guides FOR ALL USING (get_user_role() = 'admin');

-- Seed Data Awal
INSERT INTO guides (category, title, content, image_url, sort_order) VALUES
  (
    '1. Memulai Sistem', 
    'Siapa Saja yang Ada di Sistem Ini?', 
    'Halo! Selamat datang di aplikasi Shawarma Kasir. Di sini ada 3 peran penting:\n1. Admin Pusat: Sang Pemilik yang mengatur menu dan semua cabang dari jauh.\n2. Kasir (Itu Anda!): Ujung tombak resto. Anda bertugas mengatur pesanan, mengatur layar outlet, dan menerima uang.\n3. Outlet: Ini adalah Layar Tablet Pelanggan. Tempat di mana pelanggan memesan makanannya sendiri secara mandiri tanpa harus Anda tanyai satu-satu.', 
    NULL, 
    1
  ),
  (
    '1. Memulai Sistem', 
    'Cara Masuk (Login) ke Aplikasi', 
    'Untuk memulai kerja hari ini:\n1. Buka halaman utama aplikasi kasir.\n2. Masukkan Email dan Password yang dikasih oleh Bos/Admin.\n3. Setelah berhasil, Anda akan langsung masuk ke halaman "Pesanan Aktif" (Dashboard Kasir). Ingat, perhatikan huruf besar dan kecil saat mengetik password ya!', 
    NULL, 
    2
  ),
  (
    '2. Panduan Kasir (Tugas Anda)', 
    'Mengatur Menu Habis & Promo', 
    'Di menu "Manajemen Menu", Anda TIDAK BISA menghapus atau menambah makanan baru (itu tugas Admin). TAPI, Anda punya kendali penuh untuk:\n- Mengubah Status: Kalau ada bahan yang habis, klik tombol "Tersedia" menjadi "Habis". Otomatis makanan itu akan hilang dari layar pelanggan agar mereka tidak kecewa.\n- Mengatur Tampilan: Anda bisa menekan tombol "Aksi" untuk menandai menu sebagai "Best Seller", "Menu Rekomendasi", atau "Menu Ekstra".', 
    NULL, 
    1
  ),
  (
    '2. Panduan Kasir (Tugas Anda)', 
    'Mengubah Layar Iklan (Layar Istirahat)', 
    'Di menu "Pengaturan" (Settings), Anda bisa mengganti Gambar Iklan yang muncul di tablet pelanggan saat sedang tidak ada yang memesan (sering disebut Attract Screen / Layar Istirahat). Cukup unggah gambar promosi terbaru, lalu simpan. Tampilan di tablet pelanggan akan otomatis berubah menjadi lebih menarik!', 
    NULL, 
    2
  ),
  (
    '3. Mengurus Outlet & Pesanan', 
    'Cara Menghubungkan Tablet Pelanggan', 
    'Tablet pelanggan TIDAK BISA dipakai kalau belum Anda hubungkan. Caranya sangat gampang:\n1. Siapkan tablet pelanggan.\n2. Di komputer kasir Anda, buka menu "Kontrol Outlet" lalu klik "Hubungkan Outlet".\n3. Akan muncul kode kotak-kotak (QR Code) di layar kasir Anda.\n4. Buka aplikasi di tablet pelanggan, klik "Scan QR", lalu arahkan kameranya ke QR Code di layar Anda tadi. Selesai! Tablet siap dipakai pelanggan.', 
    NULL, 
    1
  ),
  (
    '3. Mengurus Outlet & Pesanan', 
    'Proses Pesanan (Dari Masuk s/d Selesai)', 
    'Ketika ada pelanggan yang memesan, prosesnya dibagi 3 tahap:\n\n1. PESANAN MASUK: Akan terdengar bunyi "Ting!" dan pesanan baru muncul di layar kasir Anda. Segera siapkan makanannya.\n2. BAYAR (QRIS vs TUNAI): \n- Kalau pelanggan pilih QRIS: Mereka langsung bayar pakai HP-nya di tablet. Di layar Anda, statusnya otomatis hijau "Lunas".\n- Kalau pilih Tunai (Cash): Pelanggan akan datang ke meja Anda bawa uang. Anda harus terima uangnya, lalu pencet tombol "Tandai Lunas" di pesanan tersebut.\n3. SELESAI: Setelah makanan jadi dan sudah diserahkan ke pelanggan, pastikan Anda menekan tombol "Selesaikan Pesanan". Pesanan akan hilang dari layar aktif.', 
    NULL, 
    2
  ),
  (
    '4. Riwayat & Laporan Penjualan', 
    'Mengecek Histori & Laporan Hari Ini', 
    'Setelah seharian bekerja, Anda bisa mengecek semuanya di:\n\n- HISTORI PEMESANAN: Di sini Anda bisa melihat kembali daftar semua pesanan yang sudah selesai atau dibatalkan hari ini. Cocok kalau Anda butuh memastikan ulang pesanan.\n- LAPORAN (REPORTS): Ini ringkasan uang yang masuk hari ini. Anda bisa melihat total pendapatan QRIS dan Tunai secara terpisah. Sangat berguna untuk mencocokkan jumlah uang di laci kasir sebelum Anda tutup toko atau ganti shift.', 
    NULL, 
    1
  )
ON CONFLICT DO NOTHING;
