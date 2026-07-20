# Rekap Bulanan — Business Report per Channel (admin-dashboard)

**Status:** Design approved, not yet implemented.
**App:** `apps/admin-dashboard`

## Latar Belakang

Setiap bulan, tim SS Digital menyusun rekap performa manual di Google Sheets ("SS REPORT JULY 2026") berisi matriks per outlet × channel penjualan (Offline/Food Apps/TikTok Go), dengan Revenue, Gross Profit, dan PCS per channel, ditambah breakdown Opex (Outlet + Gaji) dan Total Gross Profit per outlet. Fitur ini mengotomasi rekap tersebut sebagai halaman baru di admin-dashboard, di grup nav **Bisnis**.

Kolom Mitra Profit / SS Profit pada sheet asli **tidak** dibawa ke v1 — tidak ada field persentase bagi-hasil mitra per outlet di database saat ini, dan skema bagi-hasilnya sendiri terlihat tidak konsisten di sheet manual (kandidat kuat untuk fase berikutnya setelah skema final diputuskan oleh owner). Kolom Kerugian Waste (sudah ada di halaman terpisah `/dashboard/owner/waste`) juga tidak diduplikasi di sini — laporan ini mengikuti struktur kolom sheet asli apa adanya.

## Cakupan

- Route baru: `/dashboard/owner/rekap-bulanan`, label nav "Rekap Bulanan" (shortLabel "Rekap"), ditambahkan ke `NAV_GROUPS` grup **Bisnis** di `navConfig.ts`, setelah item "Kerugian Waste".
- Akses: **OWNER & ADMIN saja** (roles `['OWNER', 'ADMIN']`) — MITRA tidak melihat halaman ini sama sekali, konsisten dengan Untung Rugi & Pengeluaran.
- Granularitas: **rekap bulanan** (pilih Bulan + Tahun), bukan rentang tanggal bebas — konsisten dengan pola sheet asli & halaman Payroll.
- Tidak ada fitur Cetak PDF di v1 (tabel terlalu lebar untuk layout print sederhana; didesain terpisah kalau dibutuhkan nanti).

## Data Layer

### Migration baru (1 file)

RPC `get_hpp_periode_by_channel(p_from date, p_to date)` — turunan dari `get_hpp_periode` (`supabase/migrations/20260708225000_hpp_teoritis_periode.sql`) yang sudah ada, dengan `sales_source` ditambahkan ke SELECT & GROUP BY (join tabel yang sama, `orders` sudah punya kolom `sales_source` — tinggal tidak dibuang di grouping). Return: `{outlet_id, sales_source, hpp}`. Tetap `SECURITY DEFINER`, scoped ke `accessible_outlet_ids()` seperti RPC HPP existing.

### Hooks baru

- `useHppByChannel(filter)` — React Query wrapper memanggil RPC di atas. Shape: `{rows: {outlet_id, sales_source, hpp}[], loading, error}`.
- `usePcsByChannel(filter)` — query view `menu_sales_scoped` (sudah ada kolom `outlet_id, sales_source, qty`) tanpa perlu migration baru; jumlahkan `qty` client-side per `outlet_id` + `sales_source`. Shape sama: `{rows: {outlet_id, sales_source, pcs}[], loading, error}`.

### Reuse hook existing (tidak diubah)

- `useSalesDaily(filter, outlets)` — Revenue per outlet × `sales_source` (sudah return `omzet` per baris outlet+sales_source+date, tinggal disum per bulan).
- `useExpenses(filter)` — untuk Opex. Kategori `gaji_crew_outlet` (scope `outlet`) dijumlah sebagai kolom **Salary**; kategori outlet lain (scope `outlet`, source `monthly` + `petty_cash`) dijumlah sebagai kolom **Outlet**. Total Opex = Outlet + Salary. Ini logika yang identik dengan yang sudah dipakai di `owner/profit/page.tsx` (`pengeluaranOutletBulanan` + `pengeluaranOutletPettyCash`), hanya dipecah tambahan per-kategori gaji vs non-gaji.

### Fungsi murni baru (testable)

- `src/lib/channelGroups.ts` — `groupChannel(sales_source: string): 'offline' | 'online' | 'foodapps' | 'tiktok'`. Mapping: `pos → offline`, `online → online`, `gofood | shopeefood | grabfood → foodapps`, `tiktok → tiktok`. Unit test menutupi semua nilai `sales_source` yang valid + fallback untuk nilai tak dikenal.
- `src/lib/businessReport.ts` — `buildBusinessReportRows(outlets, salesRows, hppByChannelRows, pcsRows, expenseRows)`:
  - Untuk tiap outlet, untuk tiap 4 grup channel: `revenue = Σ omzet` (sales rows dengan `groupChannel(sales_source)` cocok), `hpp = Σ hpp` (hpp-by-channel rows cocok), `gp = revenue - hpp`, `pcs = Σ pcs`.
  - `totalPerformance = Σ (revenue, gp, pcs)` across 4 grup.
  - `opexOutlet`, `opexSalary` dari expense rows (lihat di atas); `opexTotal = opexOutlet + opexSalary`.
  - `totalGrossProfit = totalPerformance.gp - opexTotal`.
  - Baris TOTAL = penjumlahan seluruh outlet per kolom (bukan rata-rata).
  - Unit test dengan data outlet dummy mencakup: outlet tanpa transaksi di suatu channel (harus 0, bukan crash), outlet dengan `totalGrossProfit` negatif, kategori expense campur gaji+non-gaji.

## UI

```
PageHeader "Rekap Bulanan"  [Bulan ▾] [Tahun input]
─────────────────────────────────────────────────────────
Tabel lebar (overflow-x-auto), header kolom berwarna per grup mengikuti palet suka-*:
Outlet | OFFLINE (Rev/GP/PCS) | ONLINE (Rev/GP/PCS) | FOOD APPS (Rev/GP/PCS) | TIKTOK GO (Rev/GP/PCS)
       | TOTAL PERFORMANCE (Rev/GP/PCS) | OPEX (Outlet/Gaji/Total) | TOTAL GROSS PROFIT
... 19 baris outlet ...
TOTAL (baris terakhir, bold, sticky)
```

- Warna grup kolom: offline=`suka-green`, online=`suka-orange`, food apps=merah muted, tiktok=abu gelap/hitam, total performance=teal/cyan, opex=merah, total GP=hijau tebal — palet `suka-*` yang sudah dipakai di seluruh app, bukan warna mentah dari Google Sheets.
- `Total Gross Profit` negatif ditandai merah (pola `isProfit` yang sama seperti tabel Profitabilitas per Outlet di halaman Untung Rugi).
- Loading state: skeleton (pola `StatTilesSkeleton`/tabel skeleton existing). Error state: banner merah seperti halaman lain.
- Filter Bulan/Tahun: `<select>` bulan + `<input type="number">` tahun, pola identik dengan `dashboard/hr/payroll/page.tsx`.

## Testing

- Unit test `groupChannel` (semua nilai `sales_source` valid + fallback).
- Unit test `buildBusinessReportRows` (kasus di atas: channel kosong, GP negatif, split gaji vs non-gaji, baris TOTAL benar).
- `yarn type-check` & `yarn build` bersih untuk file baru.
- Manual smoke test: pilih bulan dengan data nyata, verifikasi angka Revenue/PCS per channel cocok dengan `sales_daily_scoped`/`menu_sales_scoped` mentah, dan Total Gross Profit outlet tertentu cocok dihitung manual.

## Di luar cakupan (v1)

- Split Mitra Profit vs SS Profit — menunggu keputusan skema bagi-hasil per outlet dari owner (kandidat field baru: persentase bagi-hasil mitra per outlet).
- Kolom Kerugian Waste (tetap di halaman terpisah).
- Cetak PDF / export.
- Rentang tanggal bebas (selalu bulan kalender penuh).
