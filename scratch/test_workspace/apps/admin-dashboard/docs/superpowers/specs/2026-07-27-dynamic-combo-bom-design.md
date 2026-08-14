# Dynamic Combo BOM Design

## 1. Project Context
Sistem Manajemen Resep saat ini membutuhkan cara untuk menangani Bill of Materials (BOM) untuk menu dengan tipe Combo/Package. Karena combo merupakan gabungan dari beberapa item dasar (seperti Nasi dan Ayam), mengelola BOM combo secara manual akan merepotkan dan rentan tidak akurat jika resep item dasarnya berubah.

## 2. Approach: Dynamic View
Pendekatan yang disepakati adalah **Dynamic View** tanpa menduplikasi data ke dalam database.
- **Tabel `resep_item`** tidak akan menyimpan baris data untuk combo.
- **BOM Combo** akan selalu ditarik (di-generate/dihitung) secara dinamis (*on-the-fly*) dari tabel `package_items` yang merujuk pada resep item-item dasarnya.

## 3. UI/UX Changes

### 3.1. Halaman Manajemen Resep Utama (`ResepTabView` & `page.tsx`)
- **Penentuan Status BOM Combo:** 
  - Jika menu adalah `is_package = true`, status BOM ("Aktif" atau "Belum Diatur") ditentukan dari kelengkapan BOM item-item penyusunnya.
  - Jika *semua* item dasar penyusun combo memiliki BOM aktif, maka combo berstatus "Aktif".
  - Jika ada *satu atau lebih* item dasar yang belum memiliki BOM, combo berstatus "Tidak Lengkap" / "Belum Diatur".
- **Label Tombol:**
  - Tombol pada baris combo akan berubah dari "Buat/Edit Resep" menjadi **"Lihat Resep"**.

### 3.2. Halaman Detail Resep (`[menu_id]/page.tsx` & komponen terkait)
- **Mode Read-Only:**
  - Jika menu yang diakses adalah combo (`is_package = true`), form untuk menambah bahan baku akan disembunyikan/dinonaktifkan.
- **Tampilan Berkelompok (Grouped View):**
  - BOM akan ditampilkan dalam UI yang dikelompokkan berdasarkan item dasar (misalnya, grup "Dari Nasi Putih", grup "Dari Ayam Original").
- **Peringatan Kelengkapan (Warning):**
  - Jika terdapat item dasar dalam combo yang belum memiliki BOM, sistem akan memunculkan banner peringatan (misal: "Resep untuk [Nama Item Dasar] belum diatur. Silakan atur terlebih dahulu di menu satuan.").

## 4. Backend / Data Fetching
- Query di halaman utama (dan saat kalkulasi) perlu melakukan *join* secara rekursif atau subquery yang cukup dalam untuk menarik BOM item dasar (hal ini sebenarnya sebagian sudah berjalan untuk keperluan penghitungan HPP).
- Halaman detail perlu memastikan query mengambil data `package_items` beserta relasi `resep` dan `resep_item` dari masing-masing `menu_item_id` di dalamnya.

## 5. Security / Safety (YAGNI & Edge Cases)
- **Mencegah Edit:** API endpoint/server actions yang meng-handle update atau insert BOM harus memvalidasi agar tidak memproses update untuk menu bertipe `is_package = true` jika tidak diperbolehkan.
- **Stok Pengurangan (Inventory deduction):**
  - *(Catatan: Meski tidak diubah dalam dokumen ini, pastikan saat proses checkout/pengurangan stok, POS dan backend sudah benar-benar mengurangi stok berdasarkan item penyusun, atau jika sistem mengurangi berdasarkan BOM, algoritma pengurangan stok harus tahu cara "membongkar" package menjadi BOM dasar).*

## 6. Self-Review
- [x] Placeholder scan: Tidak ada TBD/TODO.
- [x] Internal consistency: Desain database dan UI sinkron.
- [x] Scope check: Fokus hanya pada Dynamic View BOM Combo di halaman admin.
- [x] Ambiguity check: Perilaku detail halaman dan tombol sudah dijelaskan.
