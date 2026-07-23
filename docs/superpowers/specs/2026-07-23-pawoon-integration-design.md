# Integrasi Data Historis Pawoon (Desain & Spesifikasi)

## Konteks
Sebagian outlet Suka Shawarma telah bermigrasi dari sistem POS Pawoon ke sistem internal baru sejak 18 Juli 2026. Sisa outlet lainnya akan menyusul pada tanggal 1 Agustus 2026. Untuk menjaga kesinambungan pelaporan analitik, kita perlu mengimpor data transaksi historis dari Pawoon ke sistem baru.

## Pendekatan
Berdasarkan hasil sesi brainstorming, integrasi akan dilakukan dengan pendekatan berikut:
1. **Metode Export CSV**: Kita akan menggunakan file ekspor (CSV/Excel) bawaan dari Pawoon alih-alih membangun integrasi API yang kompleks, mengingat ini hanya untuk migrasi historis.
2. **Penyimpanan di Tabel Utama**: Data Pawoon akan disuntikkan langsung ke tabel `orders` dan `order_items` yang ada agar dashboard analitik yang sudah berjalan tidak perlu dimodifikasi.
3. **Idempotency (Pencegahan Duplikasi)**: Kita akan menggunakan Nomor Struk/Order ID dari Pawoon dan menyimpannya di kolom `external_order_id` pada tabel `orders`. Jika script dijalankan ulang pada file yang sama, order yang `external_order_id`-nya sudah ada di database akan dilewati secara otomatis.
4. **Pemetaan Produk (Item Mapping)**: Kita akan membaca detail penjualan dari setiap struk Pawoon dan memetakannya ke `menu_items` di sistem kita menggunakan file JSON konfigurasi (mapping dictionary).

## Arsitektur & Komponen Utama

### 1. Script Migrasi (`scripts/migrate_pawoon_csv.js`)
Sebuah script CLI Node.js yang berfungsi membaca file CSV Pawoon, melakukan validasi, dan memasukkan data ke database Supabase.
- **Input**: Path file CSV, ID Outlet yang dituju.
- **Proses**:
  - Parse CSV.
  - Lewati baris jika `external_order_id` (nomor struk Pawoon) sudah ada di Supabase.
  - Buat entri di tabel `orders` dengan `source = 'PAWOON'`.
  - Terjemahkan nama produk Pawoon ke `menu_item_id` sistem kita.
  - Buat entri di tabel `order_items`.

### 2. File Konfigurasi Mapping (`scripts/pawoon_item_map.json`)
File kamus sederhana yang memetakan nama item dari CSV Pawoon ke UUID `menu_items` di database Suka Shawarma.

Contoh struktur:
```json
{
  "Kebab Sapi Besar": "uuid-menu-kebab-sapi-besar",
  "Kebab Ayam Kecil": "uuid-menu-kebab-ayam-kecil"
}
```

## Keamanan & Reliabilitas
- Script akan bersifat _idempotent_, artinya sangat aman jika tereksekusi dua kali untuk data yang sama.
- Data yang dimasukkan akan ditandai secara eksplisit dengan `source = 'PAWOON'` sehingga jika ada masalah, data migrasi ini bisa dilacak atau dihapus secara bulk tanpa menyentuh data operasional riil.

## Proses Pelaksanaan (2 Gelombang)
1. **Gelombang 1 (Sekarang)**: Menarik data CSV dari 6 outlet awal (seperti Empang, BNR, Cimanggu, dll) sejak 1 Juli hingga 17/18 Juli. Menjalankan script migrasi.
2. **Gelombang 2 (1 Agustus)**: Menarik data CSV untuk sisa outlet yang baru akan _go live_, lalu menjalankan script migrasi lagi untuk mereka.
