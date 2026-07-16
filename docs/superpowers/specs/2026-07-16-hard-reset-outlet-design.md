# Hard Reset Outlet Data Design

## 1. Context & Goal
Mempersiapkan peluncuran Beta Tester di Outlet Kitchen dan Outlet Empang dengan menyediakan mekanisme untuk membersihkan semua data uji coba (dummy data) sebelum operasional dimulai. Fitur utama yang akan dibuat adalah tombol **"Hard Reset Outlet"** di *Admin Dashboard* yang memungkinkan penghapusan transaksi dan pengembalian stok ke angka 0 secara spesifik per outlet.

## 2. Scope & Constraints
- **Cakupan Reset:** Per Outlet (bukan global). Admin memilih outlet mana yang akan di-reset.
- **Kondisi Stok:** Setelah reset, semua stok bahan baku di outlet tersebut akan diset menjadi 0, sehingga staf bisa melakukan input *stock opname* fisik dari awal.
- **Data yang Dihapus (Hard Delete):**
  1. Penjualan: `orders`, `order_items`
  2. Pembayaran: `payments` (jika tabel terpisah) / data payment di dalam `orders`
  3. Riwayat Stok: `stok_mutations` / `ledger_stok`
  4. Absensi: Data kehadiran uji coba (`attendance` / `absensi`) untuk staf di outlet tersebut.
  5. Antrean/Penomoran: Reset nomor urut antrean harian jika memungkinkan.
- **Keamanan:** Memerlukan konfirmasi teks (misal mengetik `RESET`) untuk mencegah eksekusi tidak sengaja.

## 3. Architecture & Components

### 3.1. Frontend (UI)
- **Lokasi:** Terintegrasi pada *Admin Dashboard*, kemungkinan di halaman pengaturan outlet atau manajemen data.
- **Komponen:**
  - Tombol aksi berwarna merah (Danger Zone).
  - Modal Konfirmasi.
  - Dropdown untuk memilih Outlet.
  - Input teks validasi wajib ketik `RESET`.
  - Notifikasi *Success/Error* (Toast).

### 3.2. Backend (Database / Supabase)
- **RPC (Remote Procedure Call) di PostgreSQL:** Pembuatan *function* baru bernama `hard_reset_outlet_data(p_outlet_id UUID)`.
- **Logic / Flow RPC:**
  1. Validasi hak akses (hanya admin/role tertentu yang diizinkan).
  2. `DELETE` dari tabel `order_items` yang terkait dengan `orders` dari outlet terpilih.
  3. `DELETE` dari tabel `orders` untuk outlet terpilih.
  4. `DELETE` dari tabel `ledger_stok` (mutasi/riwayat stok) untuk outlet terpilih.
  5. `DELETE` dari tabel `absensi` (attendance) untuk staf dengan `outlet_id` terpilih.
  6. `UPDATE` tabel `stok_balance` dengan mengubah kolom `quantity = 0` khusus untuk outlet terpilih.

## 4. Error Handling & Testing
- Memastikan tidak ada *Foreign Key constraint* yang menghalangi proses *delete* (atau menggunakan query yang urutannya benar: *child* dihapus sebelum *parent*).
- Menampilkan pesan *error* yang informatif jika proses reset gagal.
- Menguji di sistem lokal dengan melakukan transaksi dummy dan memastikan semuanya hilang dengan aman ketika RPC dijalankan.

## 5. Next Steps
- Implementasi Skrip Migrasi SQL untuk RPC `hard_reset_outlet_data`.
- Implementasi UI Modal Konfirmasi di *Admin Dashboard*.
- Menghubungkan UI dengan RPC via Supabase Client.
- Uji coba secara lokal sebelum rilis ke Beta.
