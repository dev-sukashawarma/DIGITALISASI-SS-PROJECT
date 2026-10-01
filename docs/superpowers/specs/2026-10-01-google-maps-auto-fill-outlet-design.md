# Design Spec: Auto-Fill Data Outlet dari Link Google Maps

- **Status**: Approved
- **Date**: 2026-10-01
- **Target Application**: `apps/admin-dashboard`
- **Scope**: Modal Tambah & Edit Outlet (`OutletForm.tsx`)

---

## 1. Latar Belakang & Masalah
Saat ini, penambahan outlet di form `OutletForm.tsx` mengharuskan admin menginput titik koordinat (Latitude & Longitude) secara manual atau menggunakan dialog popup bawaan browser (`prompt()`) yang hanya menerima koordinat berformat angka koma (`-6.5971, 106.8060`). 

Banyak staf atau admin operasional tidak terbiasa mencari titik koordinat angka secara manual dari Google Maps dan lebih sering menyalin tautan (link "Bagikan / Share") dari aplikasi HP Google Maps (`https://maps.app.goo.gl/...`) atau browser. Selain itu, penulisan alamat manual sering kali tidak seragam atau tidak lengkap.

## 2. Tujuan
1. Menyediakan fitur **Quick-Fill** di form outlet: admin cukup menempelkan link Google Maps (baik short link dari HP maupun web link desktop) atau koordinat mentah.
2. Sistem secara otomatis mengekstrak:
   - **Latitude & Longitude** presisi.
   - **Alamat Lengkap** dalam Bahasa Indonesia yang terstruktur dan mudah dibaca manusia.
   - **Nama Outlet** (jika kolom nama belum diisi oleh admin) beserta auto-generate **Slug**.
3. **Zero Regression Guarantee**: Tidak mengganggu fungsi form yang sudah ada. Admin tetap bisa mengedit atau menginput secara manual kapan pun.

---

## 3. Arsitektur Solusi

```
+-------------------------------------------------------------+
| Client: OutletForm.tsx (Next.js Client Component)           |
| - Quick-Fill Input Bar: [ Tempel Link Maps / Koordinat ]   |
| - Tombol "Ekstrak Lokasi" (dengan Loading Spinner)          |
+------------------------------+------------------------------+
                               |
            resolveLokasiGoogleMaps(inputString)
                               |
                               v
+-------------------------------------------------------------+
| Server Action: lokasiActions.ts                             |
|                                                             |
| 1. Otorisasi: requireRole(['admin', 'owner'])                |
|                                                             |
| 2. Unshorten URL: Ikuti redirect (maps.app.goo.gl)          |
|    - Anti-SSRF check: hostGoogleMapsDiizinkan               |
|    - Bebas CORS karena berjalan di server Next.js           |
|                                                             |
| 3. URL Parsing & Coordinate Extraction:                     |
|    - Regex: @lat,lng, /place/Nama, !3dlat!4dlng, ?q=lat,lng |
|    - Parser derajat menit detik (DMS) & angka koma mentah   |
|                                                             |
| 4. Reverse Geocoding Engine:                                |
|    - OSM Nominatim (Bahasa Indonesia, Rate-limited 1 req/s) |
|    - formatAlamat(): Jalan, No, Kel/Kec, Kota, Kodepos      |
+------------------------------+------------------------------+
                               |
              Hasil: { ok: true, lat, lng, alamat, namaTempat }
                               |
                               v
+-------------------------------------------------------------+
| Client: Update State & Tampilan Form                        |
| - v.address  <- alamat lengkap                              |
| - v.lat, lng <- koordinat presisi                           |
| - v.name     <- nama tempat (jika kolom nama masih kosong)  |
| - v.slug     <- auto-generate slug jika nama baru diisi     |
| - Badge Sukses + Link "Lihat di Google Maps ↗"             |
+-------------------------------------------------------------+
```

---

## 4. Rincian Komponen & Integrasi

### A. Backend Engine yang Sudah Siap Pakai:
1. `src/lib/lokasi/googleMapsLink.ts`:
   - Validasi URL Google Maps & pencegahan SSRF (`hostGoogleMapsDiizinkan`).
   - Ekstraksi koordinat dari parameter URL (`!3d..!4d..`, `?q=`, `@lat,lng`), DMS, dan desimal.
   - Ekstraksi nama tempat dari URL path.
2. `src/lib/lokasi/formatAlamat.ts`:
   - Memformat respons OSM Nominatim menjadi alamat Indonesia yang rapi (Jalan, No, Kelurahan/Kecamatan, Kota/Kabupaten, Provinsi & Kode Pos).
3. `src/app/dashboard/outlets/lokasiActions.ts`:
   - Server Action `resolveLokasiGoogleMaps(input: string)`:
     - Melindungi akses dengan `requireRole(['admin', 'owner'])`.
     - Mengikuti redirect link pendek (`maps.app.goo.gl`).
     - Melakukan reverse geocoding dengan rate limit sopan & in-memory caching.

### B. Frontend Form: `OutletForm.tsx`
1. **Quick-Fill Section (Modern UI)**:
   - Diletakkan di bagian paling atas sebelum field `Nama`.
   - Menggunakan kartu ringkas dengan aksen khas Suka Shawarma (`border-suka-gray-200 bg-suka-gray-50/50 p-3 rounded-2xl`).
   - Terdiri dari:
     - Input text bergaya modern dengan ikon lokasi (`MapPin`).
     - Tombol "Ekstrak Lokasi" dengan spinner saat `loading`.
     - Penanganan aksi `Enter` pada input agar mengekstrak lokasi alih-alih langsung submit seluruh form.
     - Badge sukses berwarna hijau lembut (`bg-emerald-50 text-emerald-700 border-emerald-200`) ketika lokasi berhasil dimuat.
     - Link eksternal kecil "Lihat di Maps ↗" untuk membuka koordinat di tab baru guna verifikasi visual.
2. **Pembaruan State**:
   - Memperbarui `address`, `lat`, `lng`.
   - Memperbarui `name` dan `slug` hanya jika kolom nama sebelumnya masih kosong (tidak menimpa nama yang sudah diketik manual oleh admin).
3. **Pembersihan Fitur Lama**:
   - Menghapus tombol teks `onPaste` yang memanggil dialog popup browser `prompt()`.

---

## 5. Jaminan Zero Regression (Keamanan Fitur Lama)
1. **Model Data Tidak Berubah**: Struktur `OutletFormValues` (`name`, `slug`, `address`, `lat`, `lng`, `type`, `is_active`, `marquee_warning_threshold`, `open_hour`, `close_hour`) tetap sama 100%.
2. **Semua Input Manual Tetap Aktif**: Admin tetap dapat mengetik alamat, koordinat, nama, jam buka/tutup secara manual seperti sedia kala.
3. **Validasi & Submit Form Tetap Sama**: Validasi form wajib `name`, `slug`, koordinat valid tetap berjalan tanpa modifikasi alur `onSubmit`.
4. **IsEdit Mode Tetap Aman**: Saat mode edit outlet, slug locking dan data awal (`initial`) berfungsi normal.

---

## 6. Rencana Pengujian
1. **Unit Test (`googleMapsLink.test.ts`)**:
   - Uji parsing link pendek `maps.app.goo.gl`.
   - Uji parsing URL desktop dengan `@lat,lng` dan `!3d..!4d..`.
   - Uji parsing koordinat koma biasa (`-6.59, 106.80`).
   - Uji parsing URL invalid / bukan Google Maps.
2. **Integration Test**:
   - Uji `resolveLokasiGoogleMaps` dengan input valid dan invalid.
3. **Manual Verification**:
   - Buka modal Outlet Baru di Admin Dashboard.
   - Tempel link Google Maps nyata dan klik "Ekstrak Lokasi".
   - Verifikasi pengisian otomatis kolom alamat, lat/lng, dan nama.
   - Simpan outlet baru dan verifikasi data tersimpan di database.
