# Panduan Pembaruan (Update) SuperApp Sukashawarma

Dokumen ini menjelaskan arsitektur hibrida (*hybrid WebView*) dari aplikasi SuperApp Sukashawarma dan panduan operasional mengenai **kapan pengguna harus mengunduh ulang APK** versus **kapan pembaruan otomatis didapatkan**.

## Konsep Dasar Arsitektur
Aplikasi kasir dan outlet Sukashawarma dibangun menggunakan arsitektur **Native WebView Shell** (SuperApp). Ini berarti aplikasi terbagi menjadi dua lapis "otak":

1. **Native Shell (`mobile/superapp`)**: Cangkang luar aplikasi (dibangun dengan Expo/React Native) yang berkomunikasi langsung dengan perangkat keras HP (Kamera, Getaran, Bluetooth, Push Notifications).
2. **Web Content (`apps/` & `packages/`)**: Isi dalam aplikasi (dibangun dengan Next.js) yang memuat antarmuka pengguna (UI), logika bisnis kasir, absensi, dan koneksi ke *database* Supabase. Konten ini di-*hosting* terpisah di server cPanel.

Karena pemisahan ini, kita memiliki **dua alur pembaruan (update)** yang sama sekali berbeda.

---

## 1. Pembaruan Otomatis (Web Content Update)
**Kondisi:** Pembaruan terjadi **OTOMATIS** dan seketika (Instan). Kru/Kasir di lapangan **TIDAK PERLU** men-download ulang APK. Cukup lakukan *pull to refresh* atau *restart* aplikasi.

**Kapan ini berlaku?**
Pembaruan otomatis terjadi jika *developer* mengubah atau menambahkan kode di dalam:
- Folder `apps/` (seperti `pos-kasir`, `absensi`, `stok`, `portal`)
- Folder `packages/` (seperti `design-system`, `auth`)
- Konfigurasi *database* (Supabase/SQL)

**Contoh Kasus Sehari-hari:**
- ✅ Mengubah warna tombol "Bayar".
- ✅ Mengubah rumus perhitungan PPN 12% di kasir.
- ✅ Memperbaiki *bug* keranjang yang tidak mau dihapus.
- ✅ Menambah halaman baru (contoh: menu `/laporan-shift`).
- ✅ Memodifikasi teks *tooltip* atau pengumuman fitur baru.

**Alur Kerja Developer:**
`Edit Kode Next.js` ➔ `Git Push ke branch main` ➔ `cPanel Auto-Deploy` ➔ `Pengguna langsung dapat update!`

---

## 2. Pembaruan Manual (Native Shell Update)
**Kondisi:** Pembaruan **TIDAK OTOMATIS**. Kru/Kasir di lapangan **WAJIB** men-download file `.apk` versi terbaru dan menginstalnya secara manual di HP mereka.

**Kapan ini berlaku?**
Pembaruan manual wajib dilakukan jika *developer* mengubah sesuatu di dalam:
- Folder `mobile/superapp/` (File seperti `App.tsx`, `app.json`, `package.json`).

**Contoh Kasus:**
- ⚠️ Mengganti Logo APK (`icon.png`).
- ⚠️ Mengganti Gambar Splash Screen (`splash.png`).
- ⚠️ Menginstal modul perangkat keras baru (contoh: SDK Printer Bluetooth, Scanner Barcode Laser).
- ⚠️ Mengubah izin sistem Android (meminta akses lokasi GPS di *background*, akses notifikasi *native*).
- ⚠️ Mengubah *Version Code* atau *App Name* di `app.json`.

**Alur Kerja Developer:**
`Edit Kode di mobile/superapp` ➔ `Git Push` ➔ `Jalankan "eas build -p android --profile preview" di lokal` ➔ `Bagikan file .apk baru ke tim operasional`

---

## Tabel Ringkasan (Cheat Sheet)

| Jenis Perubahan | Letak Folder yang Diedit | Apakah Butuh Build APK Baru? | Reaksi di HP Kru / Kasir |
| :--- | :--- | :---: | :--- |
| **Logika Kasir / UI / CSS** | `apps/*` atau `packages/*` | ❌ **TIDAK** | Berubah otomatis saat itu juga |
| **Perbaikan Bug Database** | `apps/*` | ❌ **TIDAK** | Berubah otomatis saat itu juga |
| **Menambah Modul Expo Baru**| `mobile/superapp/` | ✅ **YA** | Fitur tidak jalan sampai APK baru di-install |
| **Ganti Logo & Splash Screen**| `mobile/superapp/assets/`| ✅ **YA** | Logo lama bertahan sampai APK baru di-install |

## Hubungan Antara Keduanya (The "Bridge")
Terkadang, fitur Web membutuhkan akses Hardware. Contoh: *Web* POS Kasir menyuruh *Native* HP untuk bergetar (Haptics) saat pembayaran sukses. 
- Jika *developer* merilis UI tombol getar di Web, UI-nya akan otomatis muncul di seluruh pengguna. 
- Namun, **getarannya tidak akan benar-benar terjadi** jika pengguna belum menginstal APK terbaru yang berisi "Jembatan" (Bridge) penerima sinyal getar di `App.tsx`. 
Oleh karena itu, sangat penting untuk mensinkronkan versi Web dengan versi APK jika ada fitur *hardware* yang baru dirilis.
