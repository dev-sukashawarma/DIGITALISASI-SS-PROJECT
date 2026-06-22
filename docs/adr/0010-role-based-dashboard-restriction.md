# ADR-0010 — Restriksi Akses & Visibilitas Dashboard Berdasarkan Role (Owner & Crew)

- Status: Accepted
- Tanggal: 2026-06-22
- Terkait: ADR-008 (SSO Portal Gerbang Tunggal), `docs/ROLE-JOBDESK.md`

## Konteks

Aplikasi `admin-dashboard` dirancang untuk mengelola data operasional, personalia (HR), serta konfigurasi sistem. Terdapat tiga kelompok fungsionalitas utama di dalamnya:
1. **Owner Dashboard** (Laporan omzet, profitabilitas, pengeluaran lintas-outlet).
2. **HR Dashboard** (Manajemen database staf, absensi, cuti, payroll, KPI, rekrutmen).
3. **System & Admin** (Manajemen outlet, monitoring kesehatan infrastruktur/system health).

Sebelumnya, terdapat dua celah keamanan dan fungsionalitas:
* **Hak Akses Owner**: Pengguna dengan role `owner` dapat melihat dan mengakses modul HR Dashboard serta System Admin di Sidebar. Berdasarkan kebijakan bisnis, `owner` seharusnya hanya difokuskan pada analisis keuangan (Owner Dashboard) secara *read-only* tanpa perlu melihat menu personalia staff maupun konfigurasi teknis/system health.
* **Kebocoran Akses Crew**: Saat inisialisasi state role di client-side (`RoleContext.tsx`), nilai default diset ke `'ADMIN_HR'`. Akibatnya, jika ada role lain seperti `crew` atau `kasir` yang berhasil melewati middleware (misalnya di lingkungan development/localhost yang menonaktifkan middleware), mereka secara otomatis dianggap memiliki role `ADMIN_HR` dan diizinkan mengakses menu sensitif HR.

## Keputusan

Untuk memperketat keamanan dan menyelaraskan antarmuka dengan jobdesk masing-masing role:

1. **Restriksi Visibilitas Menu Sidebar untuk Owner**:
   - Menghapus role `OWNER` dari konfigurasi menu kategori **HR Dashboard** dan **System & Admin** di `Sidebar.tsx`. Menu ini kini hanya terpasang untuk `ADMIN` dan `ADMIN_HR`.
2. **Implementasi Route Guard Aktif**:
   - Melindungi rute secara aktif di client-side. Jika pengguna dengan role `owner` mencoba mengetikkan URL rute HR (`/dashboard/hr/*`) atau System Admin (`/dashboard/system-health`, `/dashboard/outlets`) secara langsung di address bar, sistem akan menangkapnya menggunakan `usePathname` dan mengalihkannya (redirect) kembali ke `/dashboard/owner`.
3. **Pemberhentian Akses Total & Redirect Portal untuk Role Non-Admin/Non-Owner**:
   - Mengubah inisialisasi default state `role` menjadi `null` di `RoleProvider`.
   - Melakukan evaluasi terhadap role pengguna yang berhasil login. Jika role tersebut tidak terdaftar dalam grup akses dashboard (`owner`, `admin`, `admin_hr`), rendering seluruh halaman dashboard akan langsung diblokir dan digantikan dengan layar loading ("Memuat Akses...").
   - Pengguna dengan role tidak sah (misalnya `crew` atau `kasir`) akan segera dialihkan (`window.location.href`) ke Portal Utama (`http://localhost:3010` pada local development atau `https://app.sukashawarma.com` di produksi).

## Alternatif yang ditolak

* **Mengandalkan Middleware Saja**: Ditolak karena di lingkungan local development, middleware sering kali di-skip (`request.nextUrl.hostname === 'localhost'`) demi kemudahan pengujian tanpa cookie autentikasi yang lengkap. Proteksi ganda pada level client-side layout/provider memastikan keamanan tetap terjaga di semua environment.
* **Memisahkan Owner Dashboard ke Repositori Aplikasi Terpisah**: Ditolak karena integrasi menu owner di dalam aplikasi admin-dashboard yang sudah ada jauh lebih efisien dalam penggunaan kode bersama (shared components, shared style tokens) dan mengurangi beban pemeliharaan infrastruktur deploy baru.

## Konsekuensi

- (+) **Keamanan Lebih Ketat**: Menutup celah default-role-fallback di mana user non-admin mendapatkan hak akses HR Admin secara tidak sengaja.
- (+) **UX Lebih Rapi**: Pengguna `owner` memiliki antarmuka yang bersih dan terfokus pada angka bisnis tanpa distraksi modul administrasi lainnya.
- (+) **Keandalan Lokal & Prod**: Proteksi tetap aktif baik saat di-deploy di VPS produksi maupun saat dijalankan tester di mesin lokal (`localhost`).
- (−) Layar loading ("Memuat Akses...") akan muncul sesaat saat pertama kali memuat dashboard selagi data autentikasi diverifikasi, namun hal ini menjamin tidak ada kebocoran konten sensitif (no UI flashing).
