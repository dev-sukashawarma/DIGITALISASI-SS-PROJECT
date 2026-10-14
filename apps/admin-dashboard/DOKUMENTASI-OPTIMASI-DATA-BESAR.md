# Arsitektur & Standar Optimasi Pengambilan Data Skala Besar (High-Scale Data Pipeline)

Dokumen ini mendokumentasikan arsitektur, pola kode, optimasi komputasi CPU/memori, dan indeks database yang diterapkan pada modul **Rangkuman Penjualan (`/dashboard/reports/pos`)** untuk menangani ratusan ribu transaksi beserta ratusan ribu baris item (`order_items` dan `ecommerce_sale_items`) secara cepat, hemat memori, dan tanpa membebani database Supabase.

Metode ini dirancang sebagai **cetak biru standar (blueprint)** yang dapat diterapkan ulang pada halaman laporan lain maupun aplikasi lain dalam ekosistem proyek ini ketika berhadapan dengan dataset berukuran besar (puluhan ribu hingga ratusan ribu baris).

---

## 1. Ringkasan Hasil Benchmark Data Nyata (Live Production Dataset)

Pengujian dilakukan langsung terhadap database produksi Supabase (total **119.301 order** / **Rp 6.422.674.485,66** omzet kotor) menggunakan `vitest` di seluruh rentang waktu:

### A. Benchmark Komputasi CPU Murni (20.000 Order / 40.000 Item)
Perbandingan _side-by-side_ rumus lama vs rumus teroptimasi dengan verifikasi kesetaraan matematis 100% (`perfEquivalence.test.ts`):

| Tahap Komputasi | Sebelum Optimasi | Sesudah Optimasi | Peningkatan |
| :--- | ---: | ---: | ---: |
| `computeAnalytics` (KPI, Channel, HPP, Grafik) | 8.210,4 ms | 198,2 ms | **41,4x lebih cepat** |
| `filterTableData` + `computeTableFooter` | 412,6 ms | 24,5 ms | **16,8x lebih cepat** |
| `computeItemBreakdown` (Agregasi Menu & Paket) | 496,3 ms | 58,3 ms | **8,5x lebih cepat** |
| **Total Pipeline CPU (20.000 Order)** | **9.119,3 ms** | **281,0 ms** | **32,5x lebih cepat** |

### B. Benchmark End-to-End Berdasarkan Data Nyata (Semua Filter Tanggal)

Perintah untuk menjalankan benchmark data nyata kapan saja:
```powershell
$env:RUN_LIVE_BENCHMARK="1"; node ../../node_modules/vitest/vitest.mjs run src/lib/posReport/liveBenchmark.test.ts
```

| Filter Rentang Waktu | Jumlah Order (Completed) | Omzet Kotor (Rp) | Cold Fetch (DB -> Server) | Ganti Filter Channel / Outlet (0 DB Query) | Buka Ulang Rentang (Warm Day Memo) | Ganti Halaman / Cari (Prepared Hit) | Penggunaan RAM (Heap) |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Hari Ini (`today`)** | 0 (0) | Rp 0 | 303 ms | **1 ms** | **1 ms** | **0,26 ms** | 22,3 MB |
| **7 Hari Terakhir (`7days`)** | 8.480 (8.451) | Rp 492.575.804 | 969 ms | **46 ms** | **72 ms** | **0,32 ms** | 47,3 MB |
| **Bulan Ini (`thisMonth`)** | 16.026 (15.943) | Rp 922.763.774 | 811 ms | **139 ms** | **491 ms** | **0,30 ms** | 72,3 MB |
| **30 Hari Terakhir (`30days`)** | 35.815 (35.617) | Rp 2.024.267.649 | 2.807 ms* | **405 ms** | **1.196 ms** | **0,26 ms** | 101,0 MB |
| **Kustom Tanggal (Bulan Lalu)** | 34.296 (34.099) | Rp 1.902.561.611 | 2.397 ms* | **383 ms** | **861 ms** | **0,30 ms** | 152,7 MB |
| **Semua Waktu (`all`)** | 119.301 (118.623) | Rp 6.422.674.485,66 | 13.011 ms* | **1.150 ms** | **2.606 ms** | **0,26 ms** | 298,2 MB |

> **Catatan Penting (*):**
> Pada lingkungan produksi Next.js, hari-hari lampau disimpan di disk cache (`unstable_cache` per tanggal WIB) dan di memori proses (`decodedPastDayMemo`). Setelah rentang tanggal pernah dibuka sekali oleh satu pengguna, pembukaan ulang rentang yang sama atau irisan tanggalnya oleh pengguna mana pun hanya memakan waktu **46 ms – 1.196 ms** (atau **2,6 detik** untuk 119.301 order Semua Waktu) dengan **0 query ke Supabase**.

---

## 2. Arsitektur 4-Lapis Pengambilan & Penyimpanan Data (Multi-Tier Caching)

Masalah utama pada aplikasi laporan skala besar adalah menarik ulang puluhan ribu baris dari database setiap kali pengguna mengganti filter cabang, metode pembayaran, halaman tabel, atau ketika ada order baru masuk.

Solusinya adalah membagi pipeline menjadi **4 lapisan terpisah**:

```
[ Browser / Client ]
       |  (Hanya menerima JSON ringkas ~25 KB: angka KPI + 10 baris tabel halaman aktif)
       v
+-----------------------------------------------------------------------------------+
| LAPIS 4: Derived Table Slice Memo (In-Memory per Prepared Entry, Maks 20 Kunci)   |
| - Kunci: (paymentMethod, searchQuery)                                             |
| - Ganti halaman (Page 1 -> Page 2): 0,25 ms (hanya Array.slice di memori)         |
+-----------------------------------------------------------------------------------+
       |
       v
+-----------------------------------------------------------------------------------+
| LAPIS 3: Prepared Report Memo (`lib/posReport/prepared.ts`)                       |
| - Kunci: (scopeKey, from, to, today, outlets, channels, isPawoonVisible)          |
| - TTL: 15 detik (jika rentang mencakup Hari Ini) / 5 menit (jika masa lampau)     |
| - Deduplikasi in-flight: 10 tab refresh bersamaan = 1 eksekusi komputasi          |
+-----------------------------------------------------------------------------------+
       |
       v
+-----------------------------------------------------------------------------------+
| LAPIS 2: In-Memory Decoded Day & Range Aux Memo (`load.ts` & `laporan.ts`)        |
| - `decodedPastDayMemo`: Menyimpan array order per tanggal WIB yang sudah          |
|   di-decode & diurutkan DESC (batas aman LRU 300.000 order).                      |
| - `todayMemo` (TTL 20 dtk): Menyimpan order hari ini yang sudah terurut DESC.     |
| - `rangeAuxMemo` (TTL 20 dtk) & `menuMemo` (TTL 60 dtk): Menyimpan master menu,   |
|   peta HPP, daftar outlet, shifts, dan settlements untuk seluruh cabang.          |
| - Saat pengguna ganti filter Cabang atau Channel: 0 query ke database,            |
|   0 JSON.parse/gunzip, dan 0 pengurutan ulang (.sort).                            |
+-----------------------------------------------------------------------------------+
       |
       v
+-----------------------------------------------------------------------------------+
| LAPIS 1: Persistent Per-Day Disk Cache (`unstable_cache` + `dayCodec.ts`)         |
| - Data masa lampau bersifat hampir imutabel; di-cache per 1 hari WIB (`YYYY-MM-DD`)|
| - Dikompresi dengan Columnar Dictionary + Gzip (`dayCodec.ts`) agar hemat ruang   |
| - Invalidasi selektif per tanggal (`pos-report-day:YYYY-MM-DD` + `dayGeneration`) |
+-----------------------------------------------------------------------------------+
       |
       v
[ Database Supabase (PostgreSQL) ]
```

---

## 3. Teknik Optimasi yang Wajib Diterapkan Ulang di Aplikasi Lain

### Prinsip 1: Partisi Pengambilan Data per Hari WIB (`Past` vs `Today`)
Jangan pernah melakukan cache berdasarkan rentang tanggal arbitrer (`from..to`) secara utuh di lapisan terendah, karena rentang `1..7 Okt` dan `1..30 Okt` tidak akan berbagi cache.
1. Pecah rentang `[from, to]` menjadi daftar tanggal harian zona waktu Jakarta (`Asia/Jakarta`, `YYYY-MM-DD`) menggunakan `splitRangeByToday(from, to, today)`.
2. **Hari Lampau (`date < today`)**: Tarik per tanggal menggunakan `unstable_cache` dengan TTL panjang (24 jam) dan tag spesifik tanggal `pos-report-day:${date}`.
3. **Hari Ini (`date === today`)**: Jangan masukkan ke disk cache jangka panjang; gunakan memo in-memory singkat (`TODAY_MEMO_TTL_MS = 20_000`) dengan deduplikasi _in-flight Promise_ agar puluhan kasir/admin yang membuka dashboard bersamaan berbagi 1 query database.
4. **Batas Tanggal Awal (`getEarliestSalesDate`)**: Untuk filter "Semua Waktu" (`from = '2000-01-01'`), cari terlebih dahulu `MIN(created_at)` di database (di-memo 1 jam) agar server tidak memecah tahun kosong menjadi ribuan potongan hari.

### Prinsip 2: Cache Data Mentah Tanpa Filter Cabang, Filter di Memori (`selectReportOrders`)
- Saat menarik data harian (`orders`, `ecommerce_sales`, `shifts`, `platform_settlements`), **tarik untuk semua cabang sekaligus** (kecuali outlet testing).
- Simpan di memori (`decodedPastDayMemo` dan `rangeAuxMemo`).
- Ketika pengguna memilih cabang tertentu di dropdown UI, lakukan penyaringan `outlet_id` di memori menggunakan `Set.has(order.outlet_id)`.
- **Manfaat**: Pengguna yang berpindah-pindah antar 15 cabang tidak memicu query database baru sama sekali.

### Prinsip 3: Pre-Sorting Harian + Linear Two-Pointer Merge $O(N + M)$
Menggabungkan 119.000 order lalu memanggil `.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))` setiap ganti filter memakan jutaan pemanggilan `new Date()` ($O(N \log N)$).
- **Solusi**:
  1. Cache timestamp numerik setiap order menggunakan `WeakMap<object, number>` (`Date.parse(o.created_at)`).
  2. Urutkan array `pos` dan `ecommerce` menurun (`DESC`) **satu kali saja** ketika hari tersebut pertama kali di-decode dari cache.
  3. Saat menggabungkan banyak hari (`loadPosReportOrders`), iterasi dari hari paling baru (`todayPart`) mundur ke hari paling lama (`pastParts` dari belakang ke depan). Hasil konkatenasi otomatis sudah terurut `DESC` tanpa perlu `.sort()`!
  4. Saat menggabungkan `pos` dan `ecommerce` di `selectReportOrders`, gunakan algoritma **Two-Pointer Merge $O(N + M)$** seperti pada _merge sort_:

```ts
if (posSorted && ecSorted) {
  const merged = new Array(posList.length + ecList.length)
  let i = 0, j = 0, k = 0
  while (i < posList.length && j < ecList.length) {
    if (getOrderTs(posList[i]) >= getOrderTs(ecList[j])) {
      merged[k++] = posList[i++]
    } else {
      merged[k++] = ecList[j++]
    }
  }
  while (i < posList.length) merged[k++] = posList[i++]
  while (j < ecList.length) merged[k++] = ecList[j++]
  return merged
}
```

### Prinsip 4: Dilarang Membuat `new Intl.DateTimeFormat` di Dalam Loop (Hot Path)
Pada JavaScript/V8, membuat instance `new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' })` di dalam loop yang dieksekusi 100.000+ kali adalah penyebab utama _CPU bottleneck_ (menghabiskan > 7 detik hanya untuk format tanggal).
- **Solusi**:
  - Gunakan perhitungan aritmatika epoch `UTC+7` (`ms + 7 * 3600_000`) karena zona waktu `Asia/Jakarta` (WIB) memiliki offset tetap `+07:00` sepanjang tahun tanpa _Daylight Saving Time (DST)_.
  - Tambahkan `Map<string, string>` berbatas (mis. maksimal 50.000 entri) untuk mememoisasi konversi string ISO `created_at` -> `YYYY-MM-DD`:

```ts
const WIB_OFFSET_MS = 7 * 3600_000
const isoDateCache = new Map<string, string>()

export function tanggalWibFast(iso: string): string {
  const hit = isoDateCache.get(iso)
  if (hit !== undefined) return hit
  const ms = Date.parse(iso)
  const d = new Date(ms + WIB_OFFSET_MS)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const out = `${y}-${m}-${day}`
  if (isoDateCache.size >= 50_000) isoDateCache.clear()
  isoDateCache.set(iso, out)
  return out
}
```

### Prinsip 5: Loop Fusion (Satu Lintasan untuk Banyak Metrik)
Jangan menggunakan rantai `.filter().reduce()` berulang-ulang pada array berukuran puluhan ribu elemen.
- **Sebelum**: 9 lintasan terpisah di `computeAnalytics` dan 7 lintasan `.reduce()` terpisah di `computeTableFooter`.
- **Sesudah**: Gabungkan ke dalam **satu loop `for (let i = 0; i < len; i++)`** yang mengakumulasi semua metrik (`grossRevenue`, `totalDiscount`, `netSales`, `totalCogs`, `channelBreakdown`, `paymentBreakdown`, `hourlySales`, `dailySales`, dan `completedOrders`) sekaligus dalam satu lintasan memori CPU cache-friendly.

### Prinsip 6: Memoisasi Fungsi String & Lookup Master di Dalam Loop Item
Pada 119.000 order terdapat lebih dari **250.000 baris item**, tetapi jumlah nama menu unik di restoran hanya sekitar **90–150 nama menu**.
1. **Fast-Path String (`cleanItemName`)**: Cek dulu apakah string mengandung karakter target (`indexOf('(') === -1 && !/\s{2,}/.test(name)`) sebelum menjalankan beberapa `.replace()` RegExp.
2. **Memoisasi Resolusi Channel (`resolveOrderSource`)**: Simpan hasil pemetaan `(sales_source, channel, payment_method)` di `Map` karena kombinasinya di dunia nyata kurang dari 50 variasi.
3. **Hoist Komputasi Level Order di Luar Loop Item**: Pada `computeItemBreakdown`, hitung `orderDateStr`, `penerapHpp.untuk(orderDateStr)`, `channelGroupKey`, dan `outletName` **di level order** (luar loop `order.order_items`), bukan diulang untuk setiap item di dalam order.

### Prinsip 7: Hindari `SELECT *` & Gunakan Indeks Komposit yang Tepat di Supabase
1. Selalu sebutkan kolom secara eksplisit (`ORDER_SELECT`, `ECOMMERCE_SELECT`, `SHIFT_SELECT`, `SETTLEMENT_SELECT`).
2. Pastikan tabel besar memiliki indeks B-Tree yang sesuai dengan klausa `WHERE` dan `ORDER BY`:
   - `orders (created_at, id DESC) WHERE outlet_id <> 'b0000000-0000-0000-0000-000000000001'`
   - `ecommerce_sales (order_date, id DESC)`
   - `shifts (status, end_time DESC) WHERE status = 'closed'`
   - `platform_settlements (tanggal, outlet_id, id ASC)`
   *(Lihat migrasi: `supabase/migrations/20261014031500_optimize_pos_report_indexes.sql`)*.

### Prinsip 8: Direct Server Call pada SSR Pertama (`page.tsx`)
Pada Server Component (`src/app/dashboard/reports/pos/page.tsx`), jalankan query autentikasi/staff, daftar `outlets`, dan pengambilan data laporan awal (`laporanPosUntukScope`) secara paralel dengan `Promise.all` langsung di server dan kirim sebagai `initialData` ke Client Component (`ReportsView.tsx`). Client Component tidak boleh menembak ulang Server Action pada _mount_ pertama apabila `initialData` sudah sesuai dengan filter awal.

---

## 4. Daftar Berkas Referensi Implementasi

Jika ingin menyalin pola ini ke halaman laporan baru atau aplikasi lain, gunakan berkas-berkas berikut sebagai referensi utama:

1. **Orkestrasi & Multi-Tier Memo**: [`src/lib/posReport/laporan.ts`](file:///d:/PROJECT-WEB-SS/DIGITALISASI-SS-PROJECT/apps/admin-dashboard/src/lib/posReport/laporan.ts)
2. **Loader Harian, Decoded LRU Memo, & Two-Pointer Merge**: [`src/lib/posReport/load.ts`](file:///d:/PROJECT-WEB-SS/DIGITALISASI-SS-PROJECT/apps/admin-dashboard/src/lib/posReport/load.ts)
3. **Kompresi Harian (Columnar + Gzip)**: [`src/lib/posReport/dayCodec.ts`](file:///d:/PROJECT-WEB-SS/DIGITALISASI-SS-PROJECT/apps/admin-dashboard/src/lib/posReport/dayCodec.ts)
4. **Deduplikasi In-Flight & Prepared Cache**: [`src/lib/posReport/prepared.ts`](file:///d:/PROJECT-WEB-SS/DIGITALISASI-SS-PROJECT/apps/admin-dashboard/src/lib/posReport/prepared.ts)
5. **Single-Pass Compute Engine**: [`src/lib/posReport/compute.ts`](file:///d:/PROJECT-WEB-SS/DIGITALISASI-SS-PROJECT/apps/admin-dashboard/src/lib/posReport/compute.ts)
6. **Fast WIB Date Formatter (`UTC+7`)**: [`src/lib/posReportKpi.ts`](file:///d:/PROJECT-WEB-SS/DIGITALISASI-SS-PROJECT/apps/admin-dashboard/src/lib/posReportKpi.ts) & [`src/lib/hpp/riwayatHpp.ts`](file:///d:/PROJECT-WEB-SS/DIGITALISASI-SS-PROJECT/apps/admin-dashboard/src/lib/hpp/riwayatHpp.ts)
7. **Migrasi Indeks Database**: [`supabase/migrations/20261014031500_optimize_pos_report_indexes.sql`](file:///d:/PROJECT-WEB-SS/DIGITALISASI-SS-PROJECT/supabase/migrations/20261014031500_optimize_pos_report_indexes.sql)
8. **Pengujian Kesetaraan Matematis & Benchmark CPU**: [`src/lib/posReport/perfEquivalence.test.ts`](file:///d:/PROJECT-WEB-SS/DIGITALISASI-SS-PROJECT/apps/admin-dashboard/src/lib/posReport/perfEquivalence.test.ts)
