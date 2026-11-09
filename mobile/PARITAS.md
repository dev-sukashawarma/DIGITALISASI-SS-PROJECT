# Paritas Aplikasi Pelanggan — Android ↔ iOS

**Aturan (keputusan owner, 2026-11-09):** setiap perubahan perilaku aplikasi
pelanggan dikerjakan untuk **Android (`mobile/customer-app`) dan iOS
(`mobile/customer-ios-app`) di commit/PR yang sama**. Pelanggan Android dan
iPhone harus melihat aplikasi yang sama.

Latar belakang: iOS disalin dari Android pada 22 Sep 2026. Sesudahnya 22 commit
Android masuk tanpa padanan iOS, dan port iOS yang dikerjakan belakangan
menggantung tak ter-commit selama 6 minggu. Aturan ini ada supaya itu tidak
terulang.

## Cara kerja

1. **Ubah keduanya bersamaan.** iOS = "clone perilaku, bukan terjemahan baris"
   (lihat `customer-ios-app/RANCANGAN.md`). Nama fungsi/tipe mengikuti Android
   supaya dua kode bisa dibandingkan berdampingan; tiap berkas iOS menulis
   `Padanan <berkas>.kt` di atasnya.
2. **Uji ikut dipasangkan.** Uji unit Android baru (`app/src/test`) → uji
   Swift Testing padanannya di `customer-ios-app/SukaShawarmaTests`.
3. **Aturan bisnis sebisa mungkin di gateway** (`apps/retail-gateway`). Harga,
   voucher, status outlet, versi minimum, kurasi menu: diputuskan server, jadi
   cukup diubah sekali.
4. **CI menjaga.** Job `paritas-aplikasi-pelanggan` (`scripts/paritas-aplikasi-pelanggan.mjs`)
   gagal bila kode `.kt` di `customer-app/app/src/main/java` berubah tanpa
   `.swift` di `customer-ios-app/SukaShawarma`, atau sebaliknya.
5. **Pengecualian disengaja** — perubahan yang memang khas satu platform
   (izin Android 13, Credential Manager, Sign in with Apple, Keychain, dsb.):
   tulis `[hanya-android]` atau `[hanya-ios]` **beserta alasannya** di pesan
   commit atau judul/isi PR.

Berkas non-kode (ikon, Gradle, `project.yml`/`.xcodeproj`, aset toko, uji) tidak
dihitung pengecek — itu memang khas platform.

## Rilis & paksa update

Nomor build kedua platform **tidak sejajar** (Android `versionCode` di
`app/build.gradle.kts`, iOS `CURRENT_PROJECT_VERSION` di `project.yml`).

Setiap rilis:
1. Naikkan nomor build **di kedua aplikasi** (wajib naik — Play Store/App Store
   menolak nomor yang sama, dan paksa update tak bisa membedakan versi lama
   dari yang baru bila nomornya sama).
2. Terbitkan keduanya.
3. Setelah versi baru **tersedia di toko**, naikkan "Versi minimum Android" dan
   "Versi minimum iOS" di admin-dashboard → App Retail → Pengaturan Aplikasi.
   Aplikasi di bawah angka itu menampilkan layar "Perbarui aplikasi"; dicek
   ulang tiap aplikasi dibuka lagi. Server tak terjangkau = tidak memaksa.

Kolom `app_pengaturan.versi_minimum_ios` (migration `20261109170000`) **wajib
ada sebelum** retail-gateway versi baru di-deploy: gateway membaca kolom itu,
dan bila kueri gagal ia jatuh ke nilai bawaan untuk SEMUA setelan (WA CS,
batas pesan terakhir, Menu Terlaris, versi minimum Android).

## Perbedaan yang disengaja

| Hal | Android | iOS | Alasan |
|---|---|---|---|
| Login | Credential Manager (Google) | `ASWebAuthenticationSession` + PKCE (Google) + Sign in with Apple | Tanpa SDK pihak ketiga di iOS; Apple mewajibkan Sign in with Apple |
| Penyimpanan sesi | SharedPreferences terenkripsi | Keychain | Idiom platform |
| Navigasi | satu `NavHost` | satu `NavigationStack`, bukan `TabView` | Meniru perilaku Android (lihat `AppShell.swift`) |
| Tautan toko di layar update | Play Store | App Store — **kosong sampai Apple ID aplikasi ada** (`tautanAppStore`) | Aplikasi iOS belum terbit |
