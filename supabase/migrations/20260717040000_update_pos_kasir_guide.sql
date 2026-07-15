-- Hapus panduan kasir lama
DELETE FROM public.system_guides WHERE system_code = 'pos';

-- Insert panduan kasir baru
INSERT INTO public.system_guides (system_code, category, title, content_html, sort_order) VALUES
(
  'pos', 
  'Mulai Transaksi (Kasir)', 
  'Cara Membuat Pesanan', 
  '<p><strong>1. Pilih Menu</strong><br/>Di halaman utama Kasir, Anda akan melihat daftar menu. Klik pada menu yang dipesan oleh pelanggan. Anda bisa menggunakan kotak pencarian di bagian atas jika ingin mencari nama menu dengan cepat.</p><p><strong>2. Atur Jumlah</strong><br/>Setelah menu dipilih, klik tombol <strong>+</strong> atau <strong>-</strong> pada daftar pesanan di sebelah kanan (atau di bagian bawah pada layar kecil) untuk mengatur jumlah porsinya.</p><p><strong>3. Selesaikan Pembayaran</strong><br/>Jika pesanan sudah sesuai, klik tombol <strong>Bayar</strong>. Pilih metode pembayaran yang digunakan oleh pelanggan (Tunai, QRIS, atau Kartu). Masukkan nominal uang yang diterima jika pelanggan membayar dengan uang tunai, lalu klik konfirmasi untuk menyelesaikan transaksi.</p>',
  1
),
(
  'pos', 
  'Mulai Transaksi (Kasir)', 
  'Cara Menggunakan Fitur Split Bill', 
  '<p>Fitur Split Bill digunakan jika pelanggan ingin membayar pesanan secara terpisah (misalnya, patungan).</p><p><strong>1. Buka Pembayaran</strong><br/>Setelah pesanan lengkap, klik <strong>Bayar</strong>, lalu pilih tombol <strong>Split Bill</strong>.</p><p><strong>2. Bagi Pembayaran</strong><br/>Anda bisa memilih item mana saja yang akan dibayar pada sesi pertama. Setelah itu, selesaikan pembayaran untuk item tersebut.</p><p><strong>3. Lanjutkan Sisa Pembayaran</strong><br/>Setelah pembayaran pertama selesai, sistem akan kembali ke halaman pembayaran untuk melunasi sisa item yang belum dibayar.</p>',
  2
),
(
  'pos', 
  'Kelola Shift & Saldo Kas', 
  'Membuka & Menutup Shift', 
  '<p><strong>Membuka Shift</strong><br/>Saat pertama kali masuk ke aplikasi Kasir, Anda akan diminta untuk membuka shift. Masukkan <strong>Saldo Awal Kas</strong> (modal uang receh/kembalian) yang ada di laci kasir, lalu klik <strong>Buka Shift</strong>. Sistem akan mulai mencatat semua transaksi pada shift Anda.</p><p><strong>Menutup Shift</strong><br/>Saat jam kerja Anda selesai, klik profil Anda di pojok aplikasi, lalu pilih <strong>Tutup Shift</strong>. Sistem akan merangkum total penjualan, penerimaan uang tunai, dan saldo akhir yang seharusnya ada di laci. Cocokkan jumlah fisik uang di laci dengan sistem sebelum Anda menyelesaikan penutupan shift.</p>',
  1
),
(
  'pos', 
  'Simulasi Bonus Kru', 
  'Cara Melihat Perkiraan Bonus', 
  '<p>Fitur ini digunakan untuk melihat seberapa besar perkiraan bonus yang akan didapat oleh kru jika mencapai target penjualan tertentu.</p><p><strong>1. Buka Halaman Histori</strong><br/>Di menu utama, pilih halaman <strong>Histori Penjualan</strong>. Anda akan melihat kartu <strong>Simulasi Bonus Harian</strong>.</p><p><strong>2. Aktifkan Simulasi</strong><br/>Aktifkan tombol geser (toggle) pada bagian <strong>Simulasi Aktif</strong>. Progress bar penjualan akan berubah menjadi mode simulasi interaktif.</p><p><strong>3. Atur Target dan Kru</strong><br/>Geser titik kuning pada garis (slider) untuk mensimulasikan jumlah porsi/item menu ekstra yang terjual. Sesuaikan juga <strong>Jumlah Kru Aktif</strong> menggunakan tombol <strong>+</strong> dan <strong>-</strong>. Sistem akan secara otomatis menghitung berapa perkiraan bonus yang didapatkan per kru, dengan asumsi bonus per item tambahan sebesar Rp 5.000.</p>',
  1
);
