# Manager Dashboard Design

## 1. Overview & Purpose
Aplikasi Manager Dashboard dibangun untuk menggantikan fungsionalitas pengawasan per-outlet menjadi pengawasan agregat berbasis area.
Terdapat dua *role* utama yang menggunakan aplikasi ini:
1. **Area Manager**: Membantu mengawasi beberapa outlet di satu area. (Dulunya bernama `leader`).
2. **Regional Manager**: Membawahi dan mengawasi cakupan area yang lebih luas (menggantikan peran SPV).

Aplikasi ini akan di-hosting di `apps/manager` menggunakan arsitektur *Next.js App Router* dan Tailwind CSS.

## 2. Architecture & Data Flow
- **Aplikasi Terpusat:** Baik Regional Manager maupun Area Manager *login* ke portal yang sama.
- **Relasi Pemetaan (Mapping):** Karena 1 Area Manager mengawasi banyak outlet (misal: Abu Bakar memegang 5 outlet), dibutuhkan struktur data (misalnya tabel `area_manager_outlets` di Supabase) untuk memetakan `user_id` ke kumpulan `outlet_id`.
- **Global Data Filtering:** *Query* di semua halaman dashboard (seperti pendapatan dan *petty cash*) akan difilter berdasarkan array `outlet_id` yang dimiliki oleh Manager yang sedang *login*.

## 3. UI/UX Design
- **Responsive Design (Mobile & Desktop):** 
  - **Mobile:** Navigasi bawah (*Bottom Navigation Bar*) untuk mempermudah saat di lapangan.
  - **Desktop:** Tampilan *dashboard* penuh dengan *Sidebar Navigation* dan *Grid Layout* yang optimal untuk layar lebar (PC/Laptop), ideal untuk *monitoring* mendalam di kantor.
- **Consolidated Dashboard (Aggregated View):**
  - Halaman utama langsung merangkum total penjualan dari *seluruh* outlet yang dipegang.
  - Terdapat *Global Dropdown* di bagian *header* yang memungkinkan manager berpindah dari tampilan "Semua Outlet" menjadi "Outlet Spesifik" (misal, hanya melihat performa outlet Dramaga).

## 4. Fitur & Komponen Utama
1. **Home / Overview:**
   - Ringkasan pendapatan harian total.
   - Status Buka/Tutup outlet di areanya.
   - *Red Badge / Alert* jika ada persetujuan *Petty Cash* yang menunggu (*Pending*).
2. **Transaksi:**
   - Tabel *real-time* daftar pesanan (order) dari semua outlet di area tersebut.
3. **Persetujuan (Approvals):**
   - Halaman sentral untuk mereviu, menyetujui, atau menolak pengajuan dana *Petty Cash* dari berbagai outlet.
4. **Tim / Kru:**
   - Pantauan absensi (*shift* aktif) untuk memastikan kru di tiap outlet sudah hadir sesuai jadwal.

## 5. Security & Error Handling
- **Middleware:** `middleware.ts` pada Next.js akan memblokir akses selain *role* `area_manager` dan `regional_manager`.
- **Row Level Security (RLS):** Supabase RLS *policies* perlu diperbarui atau disesuaikan agar staf *manager* hanya bisa `SELECT` dan `UPDATE` data pada outlet yang menjadi wewenang mereka (berdasarkan tabel *mapping*).
- **Error Handling:** Jika seorang manager belum dipetakan ke outlet satupun, sistem akan menampilkan *Empty State* (Halaman Kosong) dengan pesan ramah meminta mereka menghubungi Admin Pusat.
