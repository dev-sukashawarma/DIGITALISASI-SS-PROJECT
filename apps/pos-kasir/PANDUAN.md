# SHAWARMA Self-Ordering Kiosk & POS Kasir — Panduan Lengkap

Sistem ini telah berevolusi dari sekadar aplikasi Kiosk sederhana menjadi sistem **Enterprise POS** yang tangguh, mendukung pengoperasian kasir secara manual, offline capabilities, dan manajemen outlet secara menyeluruh.

---

## 1. Arsitektur & Fungsionalitas Utama

Sistem ini dibagi menjadi dua bagian utama yang terintegrasi penuh:
1. **Customer Kiosk (`/`)**
   Digunakan oleh pelanggan untuk memesan secara mandiri.
2. **POS Kasir (`/kasir`)**
   Digunakan oleh kasir untuk mengelola pesanan (baik dari Kiosk maupun manual *Walk-in*), manajemen menu, hingga *petty cash* dan pengaturan tampilan toko.

### Fitur Kunci:
- **Dukungan Offline (ServiceWorker & IndexedDB)**: Transaksi dan antrean sinkronisasi tetap berjalan walaupun koneksi internet terputus. Pesanan akan otomatis tersinkronisasi kembali ketika online.
- **Cetak Struk Otomatis**: Integrasi langsung ke printer termal (Bluetooth/Network) untuk pencetakan struk *real-time* setelah pesanan selesai.
- **Notifikasi Suara**: Kasir akan mendapat peringatan suara instan jika ada pesanan baru yang masuk dari Kiosk.
- **Dynamic Pairing Kiosk**: Kasir dapat memunculkan QR Code untuk di-scan oleh tablet Kiosk agar perangkat kiosk secara otomatis terhubung dengan outlet yang bersangkutan.
- **Branding Dinamis**: Logo dan nama brand bisa dikustomisasi secara terpusat melalui pengaturan Kasir (`BrandContext`), dan akan otomatis berubah di seluruh aplikasi Kiosk maupun Kasir.

---

## 2. Struktur Menu POS Kasir (`/kasir`)

Sistem Kasir saat ini memiliki beberapa modul yang dapat diakses melalui Sidebar:

* **Order (`/kasir`)**
  *Kanban Board* untuk melacak status pesanan: **Masuk**, **Diproses**, dan **Selesai**. Dilengkapi fitur *drag-and-drop* atau aksi tombol untuk memindahkan status.
* **POS Manual / Walk-in (`/kasir/order-manual`)**
  Mode kasir tradisional untuk menerima pesanan langsung dari pelanggan yang tidak menggunakan Kiosk.
* **Manajemen Menu (`/kasir/menu`)**
  Pengelolaan kategori, produk, harga, dan pengaturan *stock availability* (Tersedia/Habis).
* **Petty Cash / Shift (`/kasir/shift`)**
  Pencatatan uang masuk dan keluar pada laci kasir (modal awal, setoran akhir, pengeluaran kas).
* **Histori (`/kasir/histori`)**
  Laporan dan riwayat daftar pesanan yang telah selesai atau dibatalkan untuk audit.
* **Kontrol Device Pelanggan (`/kasir/kiosk`)**
  Manajemen integrasi perangkat Kiosk pelanggan.
* **Laporan (`/kasir/reports`)**
  Ringkasan analitik dan grafik data penjualan (harian/bulanan).
* **Tampilan Layar (`/kasir/settings`)**
  Pengaturan tema, Nama Brand, dan Logo yang tayang pada UI dan cetakan struk.
* **Stok Outlet (Eksternal)**
  Terhubung langsung dengan portal pusat untuk pemantauan inventaris bahan baku. Ada indikator *badge* merah jika stok menipis.

---

## 3. Struktur Folder

```
shawarma-kiosk/
├── app/
│   ├── layout.tsx              ← Root layout + metadata global
│   ├── globals.css             ← Tailwind + komponen CSS kustom
│   ├── page.tsx                ← Halaman menu utama Kiosk (Customer)
│   ├── checkout/               ← Halaman konfirmasi checkout Kiosk
│   ├── order-success/          ← Halaman sukses Kiosk
│   ├── panduan/                ← Halaman panduan onboarding
│   ├── kasir/                  ← Modul POS Kasir Utama
│   │   ├── layout.tsx          ← Layout kasir (dengan sidebar navigasi)
│   │   ├── page.tsx            ← Kanban Board Pesanan (Order)
│   │   ├── menu/               ← Manajemen menu
│   │   ├── order-manual/       ← POS Manual Walk-in
│   │   ├── shift/              ← Petty Cash & Manajemen Shift
│   │   ├── histori/            ← Histori dan riwayat pesanan
│   │   ├── kiosk/              ← Pengaturan QR Code Device Kiosk
│   │   ├── reports/            ← Laporan Penjualan
│   │   └── settings/           ← Pengaturan Tampilan & Branding
│   └── api/
│       └── checkout/           ← API transaksi (validasi server-side)
├── components/                 ← Reusable UI components
├── lib/
│   ├── db.ts                   ← Setup IndexedDB (Dexie) untuk mode offline
│   ├── supabase/               ← Koneksi Supabase client & server
│   └── validations.ts          ← Format Rupiah & utility validation
├── store/                      ← Global State Management (Zustand)
├── types/                      ← Definisi TypeScript
├── middleware.ts               ← Proteksi rute (Auth, Service Worker routing)
└── package.json
```

---

## 4. Setup Project Lokal

```bash
# Masuk ke folder project
cd apps/pos-kasir

# Install dependencies
npm install

# Buat file .env.local dari contoh
copy .env.local.example .env.local
```

Edit file `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://XXXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_PORTAL_URL=https://app.sukashawarma.com
```

Jalankan Development:
```bash
npm run dev
```

Buka browser:
- **Kiosk Customer:** `http://localhost:3000`
- **Dashboard Kasir:** `http://localhost:3000/kasir`

---

## 5. Keamanan & Sinkronisasi

| Fitur | Implementasi |
|-------|-------------|
| **Proteksi Halaman Kasir** | Middleware Next.js + Autentikasi Eksternal (Attendance Session Portal) |
| **Kiosk Publik** | RLS public SELECT untuk melihat menu |
| **Integrasi Portal** | Menerima data outlet dan kasir lewat integrasi URL parameters / auth portal |
| **Mode Offline Kasir** | Menggunakan `Dexie.js` (IndexedDB) dan interceptor ServiceWorker |
| **Validasi Harga & Qty** | Diverifikasi ulang di server (API Route) via `service_role` |
| **Database Security** | Row Level Security (RLS) di-enable untuk semua tabel Supabase |

---

## 6. Integrasi dengan Sistem Order Pusat

Sistem POS ini dikonfigurasi untuk mensinkronkan data status pesanan bolak-balik antara *POS Lokal* dan *Sistem Portal Pusat*. Pembaruan status oleh Admin di Pusat akan ditangkap melalui webhook dan diolah oleh sistem agar status di sisi Kasir otomatis ter-update secara *real-time*.
