# Rancangan Arsitektur Sistem POS Offline-First (Standar Industri)

Dokumen ini merangkum strategi, arsitektur, dan langkah-langkah implementasi (best practice) untuk membuat aplikasi POS Kasir tetap dapat beroperasi (menerima pesanan dan pembayaran) saat koneksi internet terputus (offline).

## 1. Pendekatan Offline-First
Sistem akan dibangun dengan prinsip **Offline-First**, di mana aplikasi dirancang untuk menyimpan dan membaca data dari database lokal (*client-side database*) terlebih dahulu, lalu melakukan sinkronisasi dengan *server* (Supabase) di latar belakang saat koneksi internet tersedia.

### Mengapa IndexedDB?
IndexedDB dipilih sebagai standar industri untuk penyimpanan lokal karena:
- **Kapasitas Besar**: Mendukung penyimpanan data hingga ratusan Megabyte (bahkan Gigabyte), jauh melampaui limit 5MB pada `localStorage`.
- **Query & Indexing**: Mendukung pencarian dan *indexing* data terstruktur yang ideal untuk menyimpan ribuan daftar menu, transaksi kasir, dan antrean *order*.
- **Asynchronous**: Proses baca/tulis data tidak memblokir antarmuka pengguna (UI/Main Thread).

**Rekomendasi Pustaka (Library):** `dexie.js` atau `idb`. (Dexie.js direkomendasikan karena *wrapper*-nya sangat rapi untuk React/TypeScript).

---

## 2. Arsitektur Data Sinkronisasi

### A. Master Data (Read-Only di Lokal)
Data yang di-cache di IndexedDB agar kasir bisa berjualan saat offline:
1. `menu_items` (Katalog produk & harga)
2. `categories` (Kategori menu)
3. `kiosk_settings` (Ketersediaan, best-seller, gambar)
4. `outlet_staff` (Sesi pengguna yang sedang login)

*Strategi Sinkronisasi:* 
- Aplikasi melakukan proses *fetching* saat *online*, lalu menyimpannya (menggantikan/memperbarui data lama) ke IndexedDB. 
- Jika *offline*, aplikasi langsung membaca data master ini dari IndexedDB.

### B. Transactional Data (Write-Local, Sync-to-Server)
Data transaksi yang akan ditampung sementara saat offline:
1. `orders` (Struk/Nota Pesanan Manual)
2. `order_items` (Rincian barang di dalam pesanan)
3. `petty_cash_expenses` (Pengeluaran kas kecil jika dilakukan saat offline)

*Strategi Sinkronisasi (Queue System):*
1. Kasir memproses transaksi (pembayaran Cash / QRIS Statis).
2. Sistem mengecek status jaringan (`navigator.onLine`).
3. **Jika Offline:** Transaksi disimpan ke dalam tabel IndexedDB khusus (misal: `sync_queue_orders`) dengan label `status: 'pending_sync'`. 
4. Kasir bisa melanjutkan melayani pelanggan berikutnya tanpa hambatan.
5. **Jika Online Kembali:** Sebuah fungsi *Background Worker* atau `SyncManager` akan membaca data dari `sync_queue_orders`, lalu mem-post (INSERT) data tersebut ke Supabase. Jika berhasil, data dihapus dari antrean lokal.

---

## 3. Pembayaran QRIS Saat Offline

Sesuai dengan kesepakatan, QRIS dinamis tidak bisa di-*generate* jika server internet mati. Solusinya:
- Sistem akan menggunakan **QRIS Statis (Fallback)**.
- QRIS Statis ini (berupa gambar/kode statis toko) akan **disimpan secara lokal (di dalam aplikasi/sistem)**, bukan di-*print* fisik.
- Saat offline dan pelanggan memilih pembayaran QRIS, layar otomatis memunculkan barcode QRIS Statis tersebut.
- Pelanggan men-scan dan melakukan pembayaran, lalu menunjukkan bukti transfer berhasil ke Kasir.
- Kasir menekan tombol "Konfirmasi Pembayaran Selesai", pesanan disimpan di *Queue* IndexedDB dan masuk omset.

---

## 4. UI/UX & Indikator Jaringan

Standar UI kasir harus memberitahu pengguna secara transparan mengenai status sinkronisasi:
1. **Network Badge:** Menampilkan ikon Wi-Fi hijau (Online) atau merah (Offline) di sudut layar.
2. **Sync Indicator:** Menampilkan ikon *cloud* berputar jika ada antrean pesanan yang sedang mencoba di-sync ke server, atau menampilkan indikator angka (contoh: "3 Pesanan Belum Terkirim").
3. **Peringatan Log Out:** Menahan pengguna (Kasir) agar **tidak boleh melakukan Log Out** / Tutup Shift jika masih ada pesanan berstatus *Pending Sync* di dalam antrean IndexedDB (mencegah data hilang).

---

## 5. Rencana Fase Implementasi (Implementation Plan)

### Fase 1: Setup Infrastructure & IndexedDB
- Menginstal library `dexie` dan membuat *schema* database lokal.
- Mengimplementasi pendeteksi jaringan kustom (`useNetworkStatus` hook).
- Membuat antarmuka UI Indikator Online/Offline di Navigation Bar Kasir.

### Fase 2: Master Data Caching
- Mengubah fungsi `fetchMenu` dan `fetchCurrentState`.
- Jika terhubung internet: ambil dari Supabase, lalu simpan ke Dexie.
- Jika terputus internet: ambil (fallback) dari Dexie.

### Fase 3: Transaksi Offline & QRIS Statis
- Menyiapkan aset gambar QRIS statis dan menyimpannya di konfigurasi/lokal aplikasi.
- Memodifikasi alur Order Manual. Jika offline, tampilkan popup QRIS statis.
- Menyimpan struktur data `orders` beserta isian *order items*-nya ke antrean `sync_queue_orders` Dexie jika sedang offline (atau gagal API).

### Fase 4: Background Sync Engine
- Membuat komponen sinkronisasi yang berjaga (*listening*) pada event `window.addEventListener('online', syncQueue)`.
- Jika koneksi kembali tersambung, ambil seluruh antrean pesanan di Dexie dan kirim `INSERT` beruntun ke Supabase.
- Tandai pesanan yang sudah *synced* menjadi *completed* di server dan hapus dari antrean lokal.
- Uji coba (Testing) cabut jaringan internet (Offline mode di Browser DevTools) -> Input Transaksi -> Nyalakan kembali jaringan -> Pastikan masuk ke Database Supabase.

---
**Catatan Penting Security:** 
Data IndexedDB akan terikat ke masing-masing *browser* dan mesin perangkat (Device) kasir. Tidak disarankan kasir melakukan *Clear Browsing Data* atau mode Incognito karena data antrean bisa terhapus.
