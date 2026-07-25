# Integrasi Data Historis Pawoon (Desain & Implementasi)

## Konteks
Sebagian outlet Suka Shawarma telah bermigrasi dari sistem POS Pawoon ke sistem internal baru sejak 18 Juli 2026. Sisa outlet lainnya akan menyusul pada tanggal 1 Agustus 2026. Untuk menjaga kesinambungan pelaporan analitik, kita perlu mengimpor data transaksi historis dari Pawoon ke sistem baru.

## Pendekatan & Implementasi Saat Ini
Berdasarkan hasil eksekusi, integrasi telah diimplementasikan dalam bentuk **Web-Based Importer** di dalam Admin Dashboard (`/dashboard/pawoon-import`).
Pendekatan utamanya:
1. **Upload Excel/CSV via UI**: Pengguna dapat mengunggah file ekspor (Excel) bawaan dari Pawoon langsung ke web browser. Server action di Next.js akan membaca dan memproses data Excel tersebut.
2. **Penyimpanan di Tabel Utama**: Data Pawoon disuntikkan ke tabel `orders` dan `order_items` dengan penanda `source = 'pos'` dan catatan di `customer_name` (Pawoon Import).
3. **Idempotency (Pencegahan Duplikasi)**: Kita menggunakan Nomor Struk/Order ID dari Pawoon (`external_order_id`). Jika file diunggah ulang, order yang `external_order_id`-nya sudah ada di database akan dilewati secara otomatis (Skip).
4. **Pemetaan Outlet & Produk**:
   - Pemetaan outlet dilakukan secara dinamis dengan membersihkan prefix "Suka Shawarma " dan "Mitra " agar sinkron dengan nama di database.
   - Tersedia Alias Pemetaan khusus untuk nama yang sangat berbeda (contoh: "KOTA WISATA" -> "CIBUBUR", "DEPOK" -> "DEPOK SUKMAJAYA").
   - Pemetaan menu item menggunakan dictionary JSON (`src/data/pawoon_item_map.json`). Jika ada nama di luar dictionary, sistem menolak proses sync sebagai peringatan dini.

## Penanganan Edge Cases (Lessons Learned)
Selama proses implementasi dan testing, beberapa limitasi ditemukan dan telah diselesaikan:

### 1. Pembatasan Constraint Database (`order_items_quantity_check`)
Database memiliki konstrain yang membatasi sebuah row `order_items` maksimal hanya memiliki `quantity` sebesar 10 (kemungkinan untuk cegah spam). Transaksi Pawoon (seperti memborong "Extra Keju" sebanyak 15 pcs) menyebabkan *constraint violation*.
**Solusi**: Logic import akan mendeteksi `quantity` > 10, dan secara otomatis memecahnya menjadi kelipatan 10. (Misal beli 15 pcs akan di-insert sebagai 2 row item: 10 pcs dan 5 pcs). Total omset dan jumlah terjual tetap 100% presisi.

### 2. Limitasi Supabase Pagination (1.000 row limit)
API Supabase secara default hanya mengembalikan maksimal 1.000 data per query. Saat merangkum (summary) data yang sudah tersinkronisasi, outlet dengan lebih dari 1.000 transaksi terlihat salah periode tanggalnya.
**Solusi**: Logic summary dan detail transaksi diubah menggunakan pagination internal (`.range(from, to)`) dan sebuah loop untuk menarik *seluruh* rekaman tanpa batas secara chunk/step (per 1.000 data) sampai habis, memastikan perhitungan tanggal summary akurat.

## Keamanan & Reliabilitas
- Script bersifat _idempotent_, artinya sangat aman jika tereksekusi dua kali untuk data yang sama.
- Data yang dimasukkan akan ditandai dengan `external_order_id` yang jelas, sehingga proses *rollback* (seperti menghapus seluruh data import untuk outlet Cibubur) dapat dilakukan dengan satu perintah delete SQL yang simpel.

## Status Proses Pelaksanaan
Sistem telah siap dan *live* untuk admin di dashboard. Tim operasional dapat menarik data CSV/Excel dari Pawoon per outlet dan mengimpor data harian atau bulanan langsung dari halaman Admin secara mandiri.
