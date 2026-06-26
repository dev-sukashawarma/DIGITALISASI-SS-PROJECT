# PWA & Offline Support Implementation (26 Juni 2026)

Dokumen ini mencatat pembaruan dan penyelesaian implementasi *Progressive Web App* (PWA) untuk keseluruhan 7 aplikasi dalam ekosistem Sukashawarma. Implementasi ini memungkinkan aplikasi diinstal di perangkat (Android/iOS/Desktop) dan mendukung mode luring (*offline*) atau koneksi lambat.

## 1. Arsitektur & Teknologi PWA
- **Library**: Menggunakan `@serwist/next` (v10.0.0+) dan `serwist` sebagai pengganti `next-pwa` (yang sudah *deprecated* / tidak dikelola).
- **Paket Internal**: Pembuatan paket `@suka/pwa` di dalam *monorepo* untuk menyediakan komponen UI instalasi yang dapat digunakan ulang (reusable) di semua aplikasi.
- **Komponen**:
  - `InstallPrompt`: Menampilkan *prompt* native (Chrome/Safari) untuk menambahkan aplikasi ke *Home Screen*.
  - `PwaUpdater`: Mengelola pembaruan *Service Worker* dan menyarankan pengguna untuk *refresh* saat ada versi aplikasi terbaru.

## 2. Integrasi ke 7 Aplikasi
Aplikasi yang diintegrasikan:
1. `portal` (`app.sukashawarma.com`)
2. `absensi` (`absensi.sukashawarma.com`)
3. `stok` (`stok.sukashawarma.com`)
4. `distribusi` (`distribusi.sukashawarma.com`)
5. `owner-dashboard` (`owner.sukashawarma.com`)
6. `admin-dashboard` (`admin.sukashawarma.com`)
7. `pos-kasir` (`pos.sukashawarma.com`)

### Standarisasi yang Diterapkan di Setiap App:
- **`manifest.ts`**: Terletak di `src/app/manifest.ts` (atau `app/manifest.ts` untuk CJS) untuk men-*generate* file `manifest.webmanifest`. Berisi nama aplikasi, warna tema, dan definisi *standalone*.
- **`sw.ts`**: *Service worker* kustom berbasis Serwist. Menangani *Pre-caching*, *Runtime caching*, dan *Background Sync*.
- **`public/icons/`**: Meng-generate logo standar (192x192 & 512x512) dan *maskable icons* agar sesuai spesifikasi ketat *installable PWA* dari Android/Chrome.
- **`next.config.mjs` (atau `.js`)**: Dibungkus menggunakan `withSerwist` yang mengkonfigurasi rute `sw.js` tujuan.
- **`layout.tsx`**: Pemasangan `<InstallPrompt />` dan `<PwaUpdater />` di *root layout* masing-masing aplikasi.

## 3. Penanganan Isu Lintas-Sistem (*Cross-Cutting Fixes*)

### A. Isu Middleware & "This app cannot be installed"
**Gejala:** Chrome memblokir instalasi PWA dan memunculkan error *"This app cannot be installed"* saat pengguna mencoba menginstal dari browser.
**Akar Masalah:** File spesifik PWA (`manifest.webmanifest`, `sw.js`, dan `icons/`) dicegat oleh `middleware.ts` otentikasi. Karena browser melakukan *fetching* file ini di-latar belakang tanpa sesi *login* aktif, *middleware* me-*redirect* permintaan tersebut ke halaman `/login`. Browser pun gagal membaca manifest dan menganggap PWA tidak valid.
**Solusi:** Memodifikasi `matcher` di semua file `middleware.ts` milik aplikasi untuk memberikan jalur khusus (Pengecualian/Whitelist) kepada rute PWA:
```javascript
matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|workbox-|icons/|...).*)']
```

### B. Isu Multi-Subdomain & Bar URL (*Custom Tab*)
**Gejala:** Saat pengguna menginstal aplikasi "Portal" dan menekan tautan yang mengarah ke aplikasi "Absensi", sistem Android memunculkan "Green Address Bar" layaknya peramban normal (bukan *full-screen*).
**Akar Masalah:** Keamanan standar PWA. Setiap *subdomain* (`app.`, `absensi.`, `pos.`) dianggap sebagai identitas (*origin*) aplikasi yang terpisah secara ketat oleh Chrome. Menyeberang antar *subdomain* akan dianggap sebagai membuka *website* eksternal.
**Penyelesaian (SOP):** Ini dipertahankan sebagai fitur keamanan berdasarkan peran (Role-based). Karyawan outlet cukup menginstal PWA "Absensi", dan Kasir cukup menginstal PWA "POS Kasir" secara independen. Ini memisahkan *cache*, penyimpanan, dan isolasi keamanan masing-masing aplikasi.

### C. Optimalisasi *Cache* Model Wajah (Absensi)
File model *Face Recognition* (`public/models/`) berukuran cukup besar (~15MB). Diintegrasikan *strategy* `CacheFirst` di dalam `sw.ts` khusus untuk Absensi. Saat PWA Absensi dibuka untuk pertama kalinya, 15MB akan diunduh. Untuk kunjungan berikutnya, 15MB dibaca langsung secara instan dari penyimpanan lokal perangkat tanpa melalui jaringan internet.

### D. Perbaikan `yarn install` di Server Produksi
Server produksi (cPanel CloudLinux) menggunakan `Yarn v1`. Skrip *deploy* gagal mengeksekusi dependensi berformat `workspace:*` (fitur Yarn v2+/PNPM). Telah dilakukan normalisasi file `package.json` dari `workspace:*` ke `*` secara masif agar kompatibel dengan lingkungan `Yarn v1` di *legacy server*.

## 4. Push Notification & Role Targeting
Mengembangkan Edge Function Supabase (`send-push`) yang mampu memfilter pengiriman berdasarkan `target_roles` karyawan. 
- *Database Migration* ditambahkan (`20260626140000_update_push_triggers_roles.sql`)
- *Background sync* di PWA terhubung ke API antrean offline.

## 5. Deployment Terakhir
- Dijalankan menggunakan sintaks yang mengamankan memori server saat *rebuild* aplikasi berat: `./deploy.sh all --no-pull --free-nproc`
- Flag `--free-nproc` mematikan proses node yang berjalan agar tidak terjadi limit OOM (Out-of-Memory) di Container CloudLinux saat kompilasi berjalan.
