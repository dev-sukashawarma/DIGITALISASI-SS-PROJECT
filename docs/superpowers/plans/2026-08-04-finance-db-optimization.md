# Plan: Optimasi Beban DB `apps/finance`

**Tanggal:** 2026-08-04
**Status:** DRAFT — belum dieksekusi
**Scope:** `apps/finance` (query layer + 1 objek DB baru). Tidak mengubah `sales_hourly_spv` (dipakai 4 app lain).

---

## 0. Baseline — bukti dari DB live (bukan asumsi)

Diukur via `supabase db query --linked` pada 2026-08-04.

**Ukuran data:**

| Tabel | Baris | Ukuran |
|---|---|---|
| `orders` | 30.744 | 20 MB |
| `order_items` | 41.854 | 14 MB |
| `cash_transaction` | 57 | — |
| `petty_cash_topups` | 64 | — |
| `expenses` | 13 | — |

**`pg_stat_statements` — konsumsi kumulatif query milik finance:**

| Query | Calls | Total | Mean |
|---|---|---|---|
| `petty_cash_topups` (+join outlet_staff/outlets) | 3.035 | 39,6 s | 13,0 ms |
| `petty_cash_topups` `select *` | 4.303 | 27,3 s | 6,3 ms |
| `petty_cash_topups` (varian lain, 4 bentuk) | ~7.500 | ~21 s | 0,7–29 ms |
| `sales_items_spv` | 167 + 76 | 16,4 s | **67 ms** |
| `petty_cash_expenses` (2 varian) | 11.373 | 17,4 s | ~1,5 ms |
| `sales_hourly_spv` (5 varian) | ~1.200 | ~17 s | 5–31 ms |

Total finance ≈ **200 detik CPU kumulatif**. Untuk perbandingan, top-1 seluruh DB (`sync_missing_daily_targets`, milik app lain) sendirian 498 detik. **Jadi finance BUKAN pembakar CPU terbesar di database hari ini** — tapi polanya yang akan jadi masalah, dan itulah yang plan ini targetkan.

**EXPLAIN ANALYZE `sales_items_spv`, rentang 30 hari, tanpa filter outlet:**

```
HashAggregate (rows=19594)  Batches: 5  Memory: 7089kB  Disk Usage: 1576kB   ← spill ke disk
  Hash Join (rows=37054)
    Seq Scan on order_items (rows=41857)          ← SELURUH tabel, tiap kali
    Seq Scan on orders (rows=27207, removed 3538) ← seq scan, filter tak ter-index
Execution Time: 135 ms
```

**EXPLAIN ANALYZE `sales_hourly_spv`, rentang 4 hari:**

```
Bitmap Index Scan on orders_outlet_bizdate_number_uq (rows=3242)
Execution Time: 13 ms
```

→ `sales_hourly_spv` **sudah sehat**: predikat `sales_date` ter-push-down dan kebetulan cocok dengan index ekspresi `orders_outlet_bizdate_number_uq`. **Tidak perlu disentuh.**
→ `sales_items_spv` **tidak sehat**: tak ada index yang bisa dipakai untuk sisi `order_items`, agregasi tumpah ke disk, dan mengirim ~19.600 baris ke browser untuk kemudian diagregasi ulang di JavaScript.

---

## 1. Temuan, diurutkan berdasar dampak

### 🚨 T0 — LAPORAN OMZET SALAH: data dipotong diam-diam di 1.000 baris

**Ditemukan 2026-08-04 dari laporan user** ("kenapa di Penjualan per Item cuma muncul 4 outlet?"). Bukan isu performa — ini **angka keuangan yang dilaporkan salah**.

PostgREST (Supabase) memotong respons di **1.000 baris** (`db-max-rows`). Pemotongan ini **tidak memunculkan error** — `error` tetap `null`, aplikasi mengira datanya lengkap.

Semua query sales di finance melebihi batas itu dan **tidak satu pun punya `.limit()`, `.order()`, atau paginasi**:

| Query | Baris asli (1–4 Agu) | Terkirim | Hilang |
|---|---|---|---|
| `sales_items_spv` | 4.375 | 1.000 | 77% |
| `sales_hourly_spv` | 1.102 | 1.000 | 9% |
| `sales_hourly_spv` (rentang 30 hari) | **7.830** | 1.000 | **87%** |

**Dampak terukur, periode 1–4 Agustus 2026:**

| | Sebenarnya di DB | Tampil di dashboard | Selisih |
|---|---|---|---|
| Total omzet | **Rp 163.311.155** | Rp 140.191.319 | **−Rp 23.119.836 (−14%)** |
| Total order | **3.194** | 2.764 | −430 order |
| Outlet di tab Item | **21** | **4** | 17 outlet hilang |

Simulasi `LIMIT 1000` pada view menghasilkan Rp 140.526.076 / 2.768 order — cocok dengan angka layar (selisih 0,2% karena urutan baris tanpa `ORDER BY` tidak deterministik + order baru masuk). Reproduksi meyakinkan.

Kenapa yang muncul justru Cibubur/Empang/Sentul/BNR: tanpa `ORDER BY`, Postgres mengembalikan baris sesuai urutan fisik tabel, jadi 1.000 baris pertama kebetulan milik segelintir outlet saja. Bukan pilihan, cuma kebetulan.

**Menyebar ke app lain — SUDAH DIVERIFIKASI, bukan dugaan lagi.** Pola identik (tanpa `.limit()`, `.order()`, atau paginasi) ada di:

| App | File | Sumber | Baris (30 hari) | Terpotong |
|---|---|---|---|---|
| admin-dashboard | `hooks/useSalesHourlyRaw.ts:25` | `sales_hourly_scoped` | 7.830 | 87% |
| admin-dashboard | `actions/ownerDashboard.ts:29` | `sales_hourly_scoped` | 7.830 | 87% |
| admin-dashboard | `actions/ownerDashboard.ts:45` | `orders` + `order_items` | **27.226** | **96%** |
| owner-dashboard | `hooks/useSalesSummary.ts:22` | `sales_hourly_spv` | 7.830 | 87% |
| manager | `app/page.tsx:157` | `sales_hourly_spv` | 7.830 | 87% |

`sales_hourly_scoped` hanyalah `sales_hourly_spv` + filter `accessible_outlet_ids()` — untuk owner/admin isinya sama persis, jadi terpotong sama.

Baris `ownerDashboard.ts:45` layak disorot: query `orders` + join `order_items` itu juga tercatat di `pg_stat_statements` sebagai **407 calls, mean 1.071 ms, total 436 detik** — salah satu dari 5 konsumen CPU terbesar di SELURUH database. Dan hasilnya tetap dipotong di 1.000 dari 27.226 baris. Mahal **sekaligus** salah.

**Catatan tambahan:** role `authenticator` punya `statement_timeout=8s`. Perbaikan apa pun harus tetap di bawah 8 detik.

---

### 🔴 T1 — `sales_items_spv` selalu di-fetch walau tab-nya tidak dibuka
`OutletRevenueTab.tsx:141` — `useQuery` untuk `sales_items_spv` jalan **tanpa syarat saat mount**, padahal defaultnya `viewMode === 'ringkasan'` yang cuma butuh `revenueData`. Artinya query 67 ms + 19.600 baris itu **dibayar setiap kali dashboard dibuka, oleh semua orang, meski tab "Penjualan per Item" tak pernah diklik.**

Ini penjelasan langsung kenapa `sales_items_spv` punya mean 67 ms tertinggi di daftar finance.

### 🔴 T2 — Agregasi dikerjakan di browser, bukan di Postgres
Baik `sales_hourly_spv` maupun `sales_items_spv` di-`SELECT` mentah lalu di-`reduce` ke `Map` di klien (`OutletRevenueTab.tsx:105-128` dan `:174-205`). Postgres sudah meng-`GROUP BY` per **jam**, lalu klien meng-group ulang per **hari**. Jadi 24× lebih banyak baris dikirim daripada yang ditampilkan. Untuk view item, seluruh 19.600 baris melintasi jaringan untuk menghasilkan tabel yang jauh lebih pendek.

### 🟠 T3 — `outlets` di-fetch 3× per pembukaan tab Omzet
`OutletRevenueTab` memanggil `useOutlets()` (key `['outlets']`, sudah ter-cache 5 menit), **lalu** kedua `queryFn`-nya masing-masing menembak `supabase.from('outlets').select('id, name')` lagi di dalam `Promise.all` (`:94` dan `:163`). Dua fetch itu tak pernah masuk cache dan diulang tiap kali filter tanggal/outlet/channel berubah.

### 🟠 T4 — Tabrakan queryKey `['outlets']`
Ada **dua** hook bernama `useOutlets` dengan **queryKey identik** tapi bentuk data berbeda:
- `hooks/useOutlets.ts` → `select('id, slug, name, address, lat, lng, type, is_active')`
- `hooks/useCashDeposit.ts:15` → `select('id, name')`

Siapa pun yang mount duluan menang; yang kedua membaca cache yang bentuknya salah (atau menimpanya). Selain bug laten, ini juga bikin refetch tak perlu saat dua konsumen hidup bersamaan.

### 🟠 T5 — `petty_cash_topups` di-query tanpa `LIMIT` dan tanpa filter tanggal
Sumber panggilan terbanyak di finance (≈15.000 calls kumulatif, ~90 s). Semua varian mengambil **seluruh riwayat**:
- `app/petty-cash/page.tsx:19` — SSR, `select *` + 2 join, no limit
- `hooks/usePettyCash.ts:16` — client, `select *` + 2 join, no limit
- `components/PettyCashExpensesTab.tsx:89` — punya filter tanggal (baik)

Hari ini cuma 64 baris jadi murah. Pada 19 outlet × pengajuan rutin, ini tumbuh tanpa batas dan biayanya naik linear selamanya.

### 🟠 T6 — SSR + client memfetch data yang sama
`app/petty-cash/page.tsx` dan `app/pengeluaran/page.tsx` (`force-dynamic`) melakukan query berat di server, lalu komponen klien menjalankan hook yang query hal yang sama. `initialData` memang dipasang sehingga refetch pertama tertahan, **tapi biaya SSR-nya tetap dibayar penuh di setiap navigasi** — dan `pengeluaran/page.tsx:36-46` menduplikasi persis body `useExpenses` (dua salinan logika yang bisa menyimpang).

### 🟡 T7 — Polling 30 detik
`PettyCashExpensesTab.tsx:191` — `refetchInterval: 30000` pada `get_all_latest_petty_cash_balances`. Murah (2,1 ms, 31 calls tercatat) dan React Query menjeda saat window blur, tapi ini polling di app yang **sudah punya realtime**. Redundan.

### 🟡 T8 — Realtime invalidate terlalu lebar
`useFinanceRealtime.ts` — event pada `petty_cash_expenses` meng-invalidate `['petty_cash_topups']`. Karena React Query mencocokkan **prefix**, satu event membatalkan **seluruh** varian query topup (semua status, semua region) sekaligus → badai refetch. Sama untuk `cash_transaction` yang meng-invalidate 3 key.

### 🟡 T9 — `useExpectedCash` menarik baris `orders` mentah
`hooks/useExpectedCash.ts:23` — `select('total_amount')` semua order cash satu hari, lalu `reduce` di klien. Seharusnya agregat di DB.

### ⚪ T10 — Bukan perf, tapi ditemukan saat audit (catat, jangan diam-diam dibiarkan)
`hooks/useCashData.ts:36-67` — `DEFAULT_LOCATIONS` **hardcode saldo Rp 10.471.000 dan Rp 10.000.000** sebagai fallback saat query mengembalikan nol baris (mis. RLS memblokir). Dashboard akan menampilkan angka kas palsu yang tampak sah. Ini risiko keuangan, bukan performa. Perlu keputusan terpisah.

---

## 2. Rencana eksekusi

Diurutkan **rasio dampak/risiko**. Fase 1 & 2 tak menyentuh DB sama sekali.

### Fase 0 — HOTFIX kebenaran data (dulukan, sebelum optimasi apa pun)

Optimasi tidak ada gunanya kalau angkanya salah. Ini didahulukan.

**0.1 — Hentikan pemotongan senyap.** Ambil per potongan 1.000 baris memakai `.range()`, ulangi sampai potongan terakhir < 1.000. Butuh `.order()` eksplisit dan stabil (mis. `sales_date, outlet_id, menu_item_name`) — tanpa itu paginasi bisa melewatkan/menduplikasi baris. Berlaku untuk **kedua** query di `OutletRevenueTab.tsx` (`:78` dan `:147`).

**0.2 — Bikin pemotongan mustahil lolos diam-diam lagi.** Minta `count: 'exact'`, bandingkan dengan jumlah baris yang diterima; kalau tak sama, munculkan error — jangan render angka yang tidak lengkap. Laporan keuangan lebih baik gagal terang-terangan daripada salah diam-diam.

**0.3 — Audit `apps/admin-dashboard`.** Cek apakah `useSalesHourlyRaw` juga terpotong (kemungkinan besar iya, 7.830 baris untuk 30 hari). Kalau iya, terapkan perbaikan yang sama. Ini di luar `apps/finance` → butuh keputusan scope.

**0.4 — Setelah perbaikan, cocokkan ulang.** Dashboard 1–4 Agustus harus menunjukkan **Rp 163.311.155 / 3.194 order / 21 outlet**. Kalau tidak, perbaikannya belum benar.

> **Fase 2.1/2.2 (RPC) adalah perbaikan permanennya**, dan lebih baik dari paginasi: RPC yang mengembalikan **satu baris berisi JSON agregat** tak tersentuh batas 1.000 baris sama sekali, sekaligus memindahkan agregasi ke DB. Paginasi di Fase 0 adalah tambal cepat supaya angka benar hari ini; Fase 2 yang menghapus kelas bug-nya.

### Fase 1 — Nol perubahan DB, dampak terbesar (~1 jam)

| # | Aksi | File | Menghapus |
|---|---|---|---|
| 1.1 | `enabled: viewMode === 'item'` pada query `sales_items_spv` | `OutletRevenueTab.tsx:141` | **T1** — query 67 ms + 19.600 baris hilang dari jalur default |
| 1.2 | Buang 2 fetch `outlets` inline; pakai `outlets` dari `useOutlets()` yang sudah ada di komponen untuk membangun `nameMap` | `OutletRevenueTab.tsx:92-97, 161-166` | **T3** |
| 1.3 | Hapus `useOutlets` duplikat di `useCashDeposit.ts`, re-export dari `hooks/useOutlets.ts` | `useCashDeposit.ts:12-27` | **T4** |
| 1.4 | Tambah `.limit(200)` + filter `created_at >= now() - interval '90 days'` pada kedua query `petty_cash_topups` tanpa batas | `petty-cash/page.tsx:19`, `usePettyCash.ts:16` | **T5** |
| 1.5 | Ganti `select('*')` → kolom eksplisit pada query `petty_cash_topups` & `cash_transaction` | idem + `useCashData.ts:96` | payload |
| 1.6 | Persempit realtime: event `petty_cash_expenses` → key sendiri, bukan prefix `['petty_cash_topups']` | `useFinanceRealtime.ts` | **T8** |
| 1.7 | Hapus `refetchInterval: 30000`; andalkan realtime yang sudah ada | `PettyCashExpensesTab.tsx:191` | **T7** |

**Verifikasi Fase 1:** buka tab Omzet dengan DevTools Network → hanya 1 request sales (bukan 2) dan tanpa request `outlets` tambahan. Lalu `pg_stat_statements_reset()`-kan? **Tidak** — DB shared, jangan reset. Sebagai gantinya catat `calls`/`total_exec_time` untuk `sales_items_spv` sebelum & sesudah, bandingkan deltanya.

### Fase 2 — Pindahkan agregasi ke DB (~2 jam)

| # | Aksi | Catatan |
|---|---|---|
| 2.1 | RPC baru `get_finance_revenue_summary(p_from date, p_to date, p_outlet uuid, p_source text)` — GROUP BY per **hari** (bukan jam) + join `outlets` untuk nama, kembalikan baris siap-render | Mengganti seluruh blok `aggMap` di `:105-128`. Menghapus **T2** untuk view ringkasan. |
| 2.2 | RPC baru `get_finance_item_sales(...)` — sama, untuk view item; sekaligus bersihkan suffix `\|ID\|` di SQL (sekarang dilakukan di JS `:183-186`) | Menghapus **T2** untuk view item; payload turun dari ~19.600 baris ke jumlah baris yang benar-benar tampil |
| 2.3 | RPC `get_expected_cash(p_outlet uuid, p_date date)` mengembalikan satu angka | Menghapus **T9** |
| 2.4 | Ekstrak body `useExpenses` jadi satu fungsi bersama, dipakai SSR page & hook | Menghapus duplikasi di **T6** |

**Batasan penting:** RPC harus `SECURITY DEFINER` **dengan** `SET search_path = public` dan scope hasilnya lewat `accessible_outlet_ids()` — meniru pola view `_scoped` yang sudah ada, jangan bikin pola baru. Jangan pakai `security definer` polos tanpa scoping: `sales_hourly_spv` bypass RLS by design untuk owner/admin, tapi RPC baru ini akan dipanggil juga oleh role finance non-owner.

### Fase 3 — Index / matview, hanya jika Fase 1–2 belum cukup (~1 jam, keputusan terpisah)

Opsi, **urut dari paling aman**:

- **3a.** Index ekspresi pada `order_items`:
  `CREATE INDEX CONCURRENTLY idx_order_items_order_menu_qty ON order_items (order_id) INCLUDE (menu_item_name, quantity, subtotal);`
  Menghilangkan seq scan `order_items`. Aditif murni, tanpa risiko ke app lain.
- **3b.** Naikkan `work_mem` untuk RPC item saja (`SET LOCAL work_mem = '32MB'` di dalam fungsi) agar HashAggregate tak tumpah ke disk (`Disk Usage: 1576kB` di baseline).
- **3c.** MATERIALIZED VIEW `sales_items_daily_mv` + refresh terjadwal. **Hanya kalau 3a+3b tidak cukup.** Konsekuensi: data tidak lagi realtime → harus dikonfirmasi ke owner apakah laporan omzet boleh tertinggal N menit.

**JANGAN sentuh `sales_hourly_spv`.** Sudah cepat (13 ms, pakai index), dan dipakai `admin-dashboard`, `owner-dashboard`, `manager`, `finance`. Mengubahnya = 4 app kena risiko demi nol keuntungan.

---

## 3. Yang sengaja TIDAK dilakukan

- **Tidak** `pg_stat_statements_reset()` — DB shared dengan dev lain, akan menghapus data diagnostik mereka.
- **Tidak** mengubah publication realtime — sudah diputuskan permisif di ADR-0015, dan biaya nyatanya ada di subscription, bukan membership.
- **Tidak** memperbaiki T10 (saldo hardcode) di plan ini — itu isu keuangan/kebenaran data, butuh keputusan owner, bukan optimasi.

---

## 4. Gotcha proyek yang berlaku di sini

- **Ranjau migration 2030.** Sebelum menyentuh fungsi DB apa pun:
  `grep -rn "<nama_fungsi>" supabase/migrations/` — ada 8 migration bertimestamp 2030 yang selalu jalan paling akhir dan bisa menimpa perbaikan bertanggal wajar.
- **DB shared, riwayat migration berubah di tengah sesi.** Jalankan `supabase migration list` tepat sebelum push, jangan andalkan hasil cek lama. Jangan `migration repair` pada timestamp yang bukan milik sesi ini.
- **Verifikasi ground-truth, bukan status tooling.** Setelah push, cek objeknya benar-benar ada:
  `supabase db query "select proname, prosecdef from pg_proc where proname like 'get_finance_%'" --linked`
- **`npx` di repo ini bermasalah** untuk sebagian tool → pakai `./node_modules/.bin/<tool>`. (`npx supabase` sendiri terbukti jalan.)

---

## 5. Ekspektasi hasil

| Metrik | Sebelum | Sesudah Fase 1 | Sesudah Fase 2 |
|---|---|---|---|
| Query saat buka dashboard Omzet | 4 (2 sales + 2 outlets) | 2 | 2 |
| Baris dikirim ke browser (30 hari, semua outlet) | ~19.600 + ~1.500 | ~1.500 | ~200 |
| `sales_items_spv` mean | 67 ms, tiap mount | 67 ms, hanya saat tab item diklik | ~30 ms (setelah index) |
| `petty_cash_topups` payload | seluruh riwayat | 90 hari / 200 baris | idem |

Angka "sesudah" adalah **proyeksi**, bukan pengukuran. Harus diverifikasi dengan `pg_stat_statements` delta setelah eksekusi.
