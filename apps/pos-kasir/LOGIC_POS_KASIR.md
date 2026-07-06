# Dokumentasi Logika Sistem POS Kasir Suka Shawarma

Dokumen ini mencatat seluruh logika bisnis, alur kerja (workflow), dan mekanisme teknis yang berjalan di dalam aplikasi `pos-kasir`.

---

## 1. Arsitektur Utama
- **Framework**: Next.js 14+ (App Router).
- **Styling**: Tailwind CSS & `@suka/design-system` (komponen UI internal).
- **State Management & Caching**: TanStack React Query (`@tanstack/react-query`).
- **Database & Backend as a Service**: Supabase (PostgreSQL, GoTrue Auth, Realtime, Storage).

## 2. Autentikasi & Otorisasi (RBAC)
- **Sistem Auth**: Menggunakan Supabase Auth dengan SSO yang diatur oleh `@suka/auth` (memastikan cookie `sb-[project]-auth-token` dibagikan di seluruh subdomain).
- **Role-Based Access Control (RBAC)**:
  - Hak akses diatur melalui tabel `outlet_staff` yang berisi kolom `role` (contoh: `admin`, `spvkitchen`, `leader`, `cashier`).
  - Middleware Next.js (`middleware.ts`) dan layout utama memverifikasi login dan role user. Jika user belum login, akan diarahkan ke halaman `/login`.

## 3. Alur Manajemen Pesanan (Order Flow)
Aplikasi membedakan tiga sumber pesanan (`source`): **Kasir (Offline)**, **Kiosk (Self-order)**, dan **Online**.

### A. Order Manual (di Kasir / `/kasir/order-manual`)
1. Kasir memilih menu dan menambahkannya ke keranjang (cart state lokal).
2. Kasir memilih metode pembayaran (Tunai, QRIS/BCA).
3. Saat dibayar tunai: 
   - Status pesanan langsung di-set ke `pending` (atau `completed` langsung, tergantung logika kasir). Biasanya masuk antrean dapur sebagai `pending`.
4. Menyimpan data ke tabel `orders` dan relasi ke `order_items`.

### B. Order Kiosk (Self-Order)
- Pelanggan memilih menu sendiri lewat layar Kiosk.
- Setelah selesai, sistem menghasilkan **Kode QR / Nomor Antrian**.
- Pelanggan membawa struk/nomor ke Kasir untuk pembayaran tunai, atau membayar via QRIS otomatis.
- Pesanan akan masuk ke layar Kasir dengan tag sumber `Kiosk`.

## 4. Dashboard Kasir Utama (`/kasir`)
Halaman utama kasir menampilkan **3 Kolom Status Antrean**:
1. **Kolom Kiri (Menunggu Pembayaran / Pending)**: 
   Pesanan baru masuk yang berstatus `pending`. Kasir menekan tombol **Mulai Masak** untuk menggeser status ke `preparing`.
2. **Kolom Tengah (Sedang Diproses / Preparing)**:
   Pesanan yang sedang dimasak di dapur. Jika sudah matang, Kasir/Dapur menekan tombol **Pesanan Siap** untuk mengubah status menjadi `completed`.
3. **Kolom Kanan (Selesai / Lunas / Completed)**:
   Riwayat pesanan hari ini yang sudah selesai. Berisi fitur pencarian nomor antrean dan cetak ulang struk.

### Sinkronisasi Realtime (Supabase Channels)
- Layar kasir tidak perlu di-refresh. Sistem me-subscribe *PostgreSQL changes* via Supabase Channel (`orders_channel`).
- Jika ada pesanan baru (INSERT) atau perubahan status (UPDATE) dari device lain atau platform online, `queryClient.invalidateQueries` akan dipanggil, dan React Query akan memuat ulang data di latar belakang.

## 5. Bypass RLS (Row Level Security)
Karena kebijakan RLS pada tabel `orders` memiliki kendala teknis (saat ini merujuk ke tabel `profiles` alih-alih `outlet_staff`), proses perubahan status pesanan di klien (browser) sering diblokir (`403 Forbidden` / RLS Policy violation).

**Solusi Logika:**
- Transisi status (seperti *Mulai Masak*, *Pesanan Siap*, dan *Batalkan Pesanan*) **TIDAK** memanggil Supabase update secara langsung dari sisi Client.
- Client memanggil API internal Next.js: `POST /api/orders/update-status-internal`.
- Route Handler ini menggunakan `createServiceClient()` (Service Role Key) untuk mem-bypass RLS PostgreSQL dan memperbarui status pesanan dengan aman di sisi server, kemudian mengembalikan response sukses ke Client.

## 6. Manajemen Inventori & Menu (`/kasir/menu`)
- Kasir atau SPV dapat mematikan (Sold Out) atau menyalakan (Available) menu jika bahan baku habis.
- Hal ini memperbarui boolean `is_available` pada tabel `menu_items`. Menu yang `is_available = false` otomatis tidak bisa dibeli di Kasir, Kiosk, maupun platform Online.

## 7. Shift & Petty Cash (`/kasir/shift`)
- **Laci Kasir (Drawer)**: Pencatatan serah terima uang fisik (Modal awal, Pendapatan Tunai, Selisih/Nombok).
- **Petty Cash**: Pencatatan uang keluar dari laci untuk keperluan darurat (Beli es batu, galon air, parkir).
- Top-Up: Pengajuan penambahan dana operasional ke manajemen pusat.

## 8. Kiosk Pairing Mechanism
Untuk menyambungkan tablet Kiosk ke cabang tertentu tanpa perlu login manual:
1. Kasir membuka halaman pengaturan Kiosk di POS dan mendapatkan **Kode Pairing** (contoh: 6 digit unik).
2. Tablet Kiosk membuka halaman `/kiosk/qr-login` dan memasukkan kode tersebut.
3. Sistem memvalidasi kode di tabel `kiosk_pairing_code`, kemudian mengeluarkan sesi (JWT) khusus atau menyimpan `outlet_id` di device Kiosk secara permanen selama tidak di-logout oleh kasir.

## 9. Integrasi Hardware (Native Superapp)
Aplikasi dibungkus dalam WebView (Superapp Android/iOS) buatan internal. Komunikasi dengan fungsi *hardware native* menggunakan jembatan event: `postToNative({ type, ...payload })` dari `@suka/design-system`.
- **Haptic Feedback**: Getaran HP/Tablet saat menekan tombol (*success, error, heavy*).
- **Sound Alert**: `postToNative({ type: 'sound', file: '/sound-pesanan.mp3' })` untuk membunyikan alarm keras saat pesanan online baru masuk, sehingga Kasir tidak terlewat.
- **Thermal Printer**: Memerintahkan modul native untuk mencetak struk ESC/POS ke printer Bluetooth kasir.

---
*Dokumen ini dibuat dan diperbarui secara otomatis. Jika terdapat penambahan fitur atau logika baru, harap tambahkan pada bagian yang relevan di atas.*
