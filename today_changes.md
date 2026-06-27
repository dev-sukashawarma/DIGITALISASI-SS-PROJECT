# Ringkasan Perubahan Hari Ini (26 Juni 2026)

Hari ini kita melakukan perubahan besar pada arsitektur aplikasi Sukashawarma Outlet Suite, yaitu beralih dari arsitektur PWA (Progressive Web App) dengan Service Worker ke aplikasi web standar yang dibungkus dalam **React Native WebView (Superapp)** untuk platform mobile.

Berikut adalah rincian lengkap perubahan yang telah diimplementasikan hari ini:

---

## 1. Pembersihan & Penghapusan Sistem PWA

Seluruh infrastruktur PWA berbasis **Serwist** telah dihapus dari seluruh sub-aplikasi monorepo untuk mengembalikan status aplikasi ke aplikasi web biasa.

### Aset dan File yang Dihapus
* **Paket Internal `@suka/pwa`**: Dihapus sepenuhnya dari direktori `packages/`.
* **Manifest & Service Worker**: File `manifest.ts` dan `sw.ts` dihapus dari seluruh aplikasi di direktori `apps/`.
* **Aset Ikon PWA**: Seluruh file PNG ikon PWA (`icon-192x192.png`, `icon-512x512.png`, dan versi maskable) dihapus dari folder `public/icons/` di setiap aplikasi.

### Perubahan Konfigurasi Aplikasi
* **next.config.js / next.config.mjs**:
  - Menghapus wrapper `withSerwist`.
  - Menghapus `@suka/pwa` dari daftar `transpilePackages`.
  - Menghapus konfigurasi build Service Worker.
* **package.json**:
  - Menghapus dependensi `@serwist/next`, `serwist`, dan `@suka/pwa` dari semua aplikasi.

### Perubahan pada Layout Utama (`layout.tsx`)
Menghapus komponen UI PWA berikut dari seluruh layout utama di ke-7 aplikasi:
* **`<InstallPrompt />`**: Tombol / pop-up prompt instalasi dihapus.
* **`<PwaUpdater />`**: Komponen pendeteksi update cache Service Worker dihapus.

### Perubahan pada Dashboard & Halaman Pengaturan Staf
Menghapus tombol atau kartu pengaturan notifikasi push (`NotificationToggle` dan tipe data pendukung) di file berikut:
* **Absensi**: Halaman pengaturan (`apps/absensi/src/app/dashboard/pengaturan/page.tsx`).
* **Distribusi**: Halaman utama dashboard (`apps/distribusi/src/app/dashboard/page.tsx`).
* **POS Kasir**: Halaman pengaturan kiosk (`apps/pos-kasir/app/kasir/settings/page.tsx`).
* **Stok**: Dashboard kru (`apps/stok/src/components/monitoring/CrewDashboard.tsx`) dan supervisor (`apps/stok/src/components/monitoring/SPVDashboard.tsx`).

---

## 2. Pengembangan Mobile Superapp (React Native)

Sebagai pengganti instalasi PWA, kita menginisialisasi aplikasi mobile native berbasis **Expo** yang akan membungkus seluruh aplikasi web ke dalam satu aplikasi terpadu (Superapp).

* **Inisialisasi Expo**: Proyek baru dibuat di direktori `mobile/superapp/`.
* **Instalasi Dependensi**: Menginstal `react-native-webview` untuk merender aplikasi web, serta `expo-splash-screen` dan `expo-status-bar` untuk kenyamanan visual.
* **Konfigurasi Android & iOS**: Konfigurasi nama aplikasi, paket (`com.sukashawarma.superapp`), status bar, dan izin akses kamera (untuk face recognition absensi) di `mobile/superapp/app.json`.
* **Pengaturan EAS (Expo Application Services)**: Mengonfigurasi `eas.json` untuk persiapan build cloud, serta mendapatkan `projectId` resmi.
* **Pemrograman WebView (`App.tsx`)**:
  - Integrasi WebView yang mengarah ke portal utama Sukashawarma.
  - Penanganan tombol kembali Android (*hardware back button*) agar navigasi dalam WebView berjalan seperti aplikasi native (tidak langsung keluar dari aplikasi).
  - Tampilan layar error kustom jika koneksi internet terputus.

---

## 3. Hasil Validasi & Pengujian

* **Kompilasi Sukses**: Seluruh aplikasi web yang dimodifikasi telah divalidasi menggunakan type-check TypeScript dan berjalan dengan **0 error** (seperti aplikasi `portal` dan `absensi`).
* **Verifikasi Kode (Grep)**: Tidak ada lagi import `@suka/pwa` atau komponen `NotificationToggle` yang tersisa di seluruh folder `apps/`.
