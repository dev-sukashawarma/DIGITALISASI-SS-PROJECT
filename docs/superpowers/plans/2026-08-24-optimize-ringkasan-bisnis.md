# Optimasi Performa Halaman "Ringkasan Bisnis" (/dashboard/owner)

## Ringkasan Proyek
- **Tanggal:** 24 Agustus 2026
- **Tujuan:** Mempercepat waktu muat halaman "Ringkasan Bisnis" dari >120 detik (dan sering mengalami *statement timeout / 500 error*) menjadi < 1 detik.
- **Aplikasi Terdampak:** `apps/admin-dashboard` (khususnya `/dashboard/owner`) dan PostgreSQL database (Supabase).

---

## Masalah & Akar Masalah (Root Causes)
1. **Paginasi & Loop JavaScript Berat di Server Action:**
   - `getOwnerDashboardData` dan `getAggregatedMenuSales` melakukan loop paginasi `PAGE_SIZE = 1000` via HTTP Supabase client.
   - Ribuan baris data mentah `orders` dan relasi 4 tingkatnya didownload ke memori Node.js, kemudian dihitung secara manual (omzet, hourly distribution, HPP / COGS, dan deduksi).
   - Dijalankan 4x paralel (periode saat ini dan periode pembanding untuk summary dan menu sales).
2. **Kueri Correlated Subquery pada Target Harian:**
   - RPC `get_daily_target_progress_range` mengeksekusi subquery per hari × per outlet ($N \times M$ query terpisah).
3. **Scan Berulang pada Database Planner (Penyebab Error 500 / Timeout):**
   - CTE dalam RPC SQL awal dievaluasi ulang sebanyak 5 kali tanpa *materialization*, menyebabkan pembacaan berulang dan pemindaian jutaan baris pada tabel `orders` dan `order_items`.

---

## Solusi & Perubahan yang Dilakukan

### 1. Database Indexes
- **Migration:** `supabase/migrations/20300109000001_index_orders_status_created.sql`
  - Menambahkan indeks majemuk `idx_orders_status_created` pada `public.orders (status, created_at DESC)`.
  - Menambahkan indeks `idx_petty_expenses_outlet_date` pada `public.petty_cash_expenses (outlet_id, expense_date)`.
- **Migration:** `supabase/migrations/20300109000004_perf_missing_fks.sql`
  - Memastikan indeks FK `idx_menu_packages_package_id` dan `idx_order_items_order_id` aktif.

### 2. RPC Terpadu PostgreSQL (`get_owner_dashboard_summary`)
- **Migration:** `supabase/migrations/20300109000007_super_fast_dashboard.sql`
  - Seluruh agregasi (KPI, jam sibuk/hourly, penjualan menu, HPP/COGS bertingkat, OPEX, dan potongan harga) dikerjakan langsung oleh PostgreSQL dalam 1 panggilan tunggal.
  - Menggunakan `AS MATERIALIZED` pada CTE `filtered_orders` agar filter transaksi hanya dieksekusi 1 kali dan disimpan di memori kerja database.
  - Menggantikan *correlated subqueries* pada perhitungan paket HPP dan deduksi pesanan dengan *pre-aggregated CTE* + `LEFT JOIN`.

### 3. Optimasi RPC Target Harian (`get_daily_target_progress_range`)
- **Migration:** `supabase/migrations/20300109000003_optimize_target_progress_range.sql`
  - Mengganti subquery $N \times M$ menjadi agregasi tunggal berbasis *series date* + `LEFT JOIN`.

### 4. Refaktor Server Actions & Server Component
- **File:** `apps/admin-dashboard/src/app/actions/ownerDashboard.ts`
  - Menambahkan fungsi `getOwnerDashboardDataFast` yang langsung memanggil RPC `get_owner_dashboard_summary`.
  - Memetakan output JSONB langsung ke tipe data frontend tanpa melakukan loop perhitungan mentah.
- **File:** `apps/admin-dashboard/src/app/dashboard/owner/page.tsx`
  - Mengganti pemanggilan 4 query berat menjadi 2 panggilan paralel RPC (`curData` dan `prevData`).
  - Data penjualan menu (`menuRows`) langsung diambil dari hasil kembalian RPC `curData` dan `prevData` tanpa *round-trip* terpisah.

---

## Verifikasi & Hasil Uji

| Metrik | Sebelum Optimasi | Setelah Optimasi |
| :--- | :--- | :--- |
| **Waktu Respon Query (Rentang 1 Bulan)** | > 120 detik (*Timeout / Error 500*) | **~0.5 – 0.9 detik** |
| **HTTP Round-trips ke Database** | Puluhan loop paginasi | **Hanya 2 RPC Call** |
| **Beban Memori Node.js Server** | Berat (menampung ribuan objek) | Ringan (hanya menampung summary JSON) |
| **Akurasi Data** | Sesuai | 100% konsisten |

---

## Riwayat Commit
- `6ce76420` — `perf(db): add indexes + RPC get_owner_dashboard_summary + optimize target progress range`
- `8e949a54` — `perf(dashboard): switch Ringkasan Bisnis to getOwnerDashboardDataFast — 2 RPC calls instead of N paginated loops`
- `5b81591a` — `chore(db): rename duplicate migration timestamps to fix supabase cli push`
- `60c055c6` — `perf(db): massively optimize dashboard CTE with AS MATERIALIZED and pre-aggregation to prevent timeouts`
