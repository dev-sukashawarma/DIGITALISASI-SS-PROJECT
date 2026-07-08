# Original User Request

## Initial Request — 2026-07-04T07:20:12Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Build a native mobile superapp for internal use, connected to the existing digital ecosystem. The project will focus entirely on a native Android (Kotlin) codebase for now to maximize verifiability on the current Windows environment.

Working directory: d:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT\mobile\native-superapp
Integrity mode: development

## Requirements

### R1. Native Android Application Setup
Initialize a mobile application project for Android using Kotlin. The app must be configured to connect to the existing Supabase backend for authentication and database interactions.

### R2. Internal Superapp Modules
Implement the foundational structure, navigation, and initial UI/UX for the following internal modules:
- Dashboard & Laporan (Keuangan, Penjualan)
- Manajemen Inventaris & Stok
- Absensi & Manajemen Karyawan (HR)
- Manajemen Pesanan / Order Fulfillment
- Fitur Kasir / Point of Sale (POS)

## Acceptance Criteria

### Compilation & Verification
- [ ] `gradlew.bat assembleDebug` (atau setara) berhasil dijalankan di dalam direktori proyek tanpa error kompilasi.
- [ ] Terdapat struktur navigasi yang jelas antar ke-5 modul utama yang telah ditentukan.
- [ ] Koneksi ke Supabase berhasil diinisialisasi pada level aplikasi (harus ada bukti/skrip verifikasi atau setidaknya kompilasi dependensi Supabase-kt sukses).
- [ ] Tim agent tidak mensertifikasi sendiri hasil kerjanya; harus ada log output dari gradle build yang membuktikan keberhasilan build.

---
*Next: when approved → delegate via invoke_subagent (see Delegation Protocol)*
