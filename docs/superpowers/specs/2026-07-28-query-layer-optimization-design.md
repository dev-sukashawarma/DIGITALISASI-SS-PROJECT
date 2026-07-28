# Query Layer Optimization — Audit & Design

**Tanggal:** 2026-07-28
**Status:** Spec — belum dieksekusi
**Scope yang dipilih user:** lapisan query & index (bukan realtime/polling)
**Metode:** ground truth dari DB produksi (`pg_stat_statements`, `pg_stat_user_tables`, `EXPLAIN ANALYZE`), bukan pembacaan kode saja

---

## 1. Ringkasan eksekutif

Analisis ini berangkat dari hipotesis "ada query yang perlu dioptimalkan". Setelah diukur
langsung ke DB produksi, **hipotesis itu sebagian besar tidak terbukti untuk lapisan
query**. Rencana penambahan index yang semula disusun gugur satu per satu di verifikasi
selektivitas.

Temuan sebenarnya: **biaya sistem ini ada di volume pemanggilan query, bukan di rencana
eksekusi query.** Dua beban terbesar berada di luar scope yang dipilih, dan keduanya
berkali-kali lipat lebih besar daripada total yang bisa diperoleh dari pekerjaan index.

Yang benar-benar layak dikerjakan di lapisan query hanya **dua item kecil** (Bagian 4).

---

## 2. Ground truth: peringkat beban DB nyata

Dari `pg_stat_statements` (kumulatif sejak reset terakhir — angka absolut adalah
akumulasi, peringkat relatifnya yang bermakna):

| # | Beban | Total waktu DB | Calls | Mean |
|---|---|---|---|---|
| 1 | **Realtime WAL decoding** (`realtime.apply_rls`) | **25.393 s (~7 jam)** | 2.724.330 | 9,3 ms |
| 2 | **`daily_checklist_ticks` by `record_id`** | **6.528 s** | 102.999 | 63 ms |
| 3 | Realtime subscription setup (`pg_publication_tables`, 2 query) | 1.392 s | 184.788 | — |
| 4 | PostgREST schema-cache reload (`pg_timezone_names`, ekstensi, tipe) | ~2.470 s | 2.213 reload | 689 ms |
| 5 | `attendance` polling | 612 s | 114.026 | 5,4 ms |
| 6 | `get_my_target_progress()` | 568 s | 8.550 | 66 ms |
| 7 | `system_health_latest` | 378 s | 408 | **926 ms** |
| 8 | `stockout_forecast_spv` | 377 s | 2.497 | 151 ms |

**Realtime (#1 + #3) ≈ 65–70% dari seluruh waktu DB.** Semua query aplikasi digabung
tidak menyentuh angka itu.

Statistik tabel (`pg_stat_user_tables`), untuk konteks:

| Tabel | Baris | Ukuran | seq_scan | seq_tup_read | idx_scan |
|---|---|---|---|---|---|
| `ledger_stok` | 38.160 | 14 MB | 9.092 | 192.221.749 | 59.722 |
| `orders` | 21.640 | 13 MB | 49.329 | 75.584.459 | 690.643 |
| `resep` | 23 | 32 kB | 1.808.647 | 36.947.763 | 101.937 |
| `menu_packages` | 63 | 56 kB | 543.042 | 33.528.397 | **0** |
| `daily_sales_targets` | 28 | 40 kB | 685.045 | 19.296.138 | 125.314 |
| `system_health_log` | 50.022 | 11 MB | 376 | 10.119.462 | 4.011 |
| `outlet_staff` | 105 | 1144 kB | 124.593 | 3.280.675 | **238.441.717** |

---

## 3. Hipotesis yang diuji dan **gugur**

Bagian ini sengaja didokumentasikan agar tidak ada yang mengulang analisis yang sama
dan sampai pada kesimpulan keliru yang sama.

### 3.1 "`accessible_outlet_ids()` adalah pajak 10 ms di setiap query" — GUGUR

`EXPLAIN ANALYZE` pada `sales_daily_scoped` memperlihatkan:

```
Hash Join (actual time=10.442..10.445)
  Hash Cond: ((accessible_outlet_ids()) = sales_daily_spv.outlet_id)
  Buffers: shared hit=558
```

Terlihat seperti fungsi itu memakan 10,4 ms / 558 buffer. **Salah.** Saat body fungsinya
di-`EXPLAIN` langsung:

```
Execution Time: 0.177 ms      Buffers: shared hit=1
  CTE me -> Index Scan using outlet_staff_pkey     (bukan seq scan)
Planning:  Buffers: shared hit=436
```

**0,177 ms, 1 buffer.** Angka 10,4 ms tadi hampir seluruhnya biaya **planning** — fungsi
`SETOF` di posisi `ProjectSet` tidak bisa di-inline sehingga body-nya direncanakan
terpisah, dan sesi `EXPLAIN` adalah koneksi dingin tanpa plan cache. Di koneksi panas
PostgREST biaya itu tidak berulang.

**Konsekuensi:** rencana menulis ulang `accessible_outlet_ids()` **dicabut**. Fungsi itu
adalah batas keamanan RLS seluruh sistem; mengubahnya demi keuntungan yang tidak terbukti
adalah pertukaran yang buruk.

### 3.2 "238 juta index scan pada `outlet_staff` itu masalah" — GUGUR

Jumlahnya besar, tapi tiap scan adalah index scan 1-buffer via `outlet_staff_pkey` dari
`auth.uid()` di tiap policy RLS. Ramai, bukan mahal. Bukan tuas yang berguna.

### 3.3 "`orders` butuh index ekspresi tanggal" — GUGUR (selektivitas)

`Seq Scan on orders` memang muncul di plan, dengan filter
`((created_at AT TIME ZONE 'Asia/Jakarta')::date)`. Index ekspresinya **legal** dibuat
(`timezone(text, timestamptz)` sudah dipastikan `IMMUTABLE`, bukan `STABLE`).

Tapi distribusi datanya menutup opsi itu:

| Metrik | Nilai |
|---|---|
| Total baris | 21.640 |
| Dalam 28 hari terakhir | 21.610 (**99,86%**) |
| Rentang riwayat | 2026-06-18 s/d 2026-07-27 (~40 hari) |

Filter tanggal dashboard menyapu hampir seluruh tabel. **`Seq Scan` adalah plan yang
benar**, dan index ekspresi tidak akan pernah dipilih planner.

### 3.4 "`ledger_stok` butuh index `(tipe, created_at)`" — GUGUR (selektivitas)

`stockout_forecast_spv` memfilter `tipe='pemakaian' AND created_at >= now()-7d`:

| Metrik | Nilai |
|---|---|
| Total baris | 38.728 |
| `tipe='pemakaian'` | 36.766 (95%) |
| `pemakaian` + 7 hari | 29.572 (**76%**) |

Index tidak berguna pada selektivitas 76%.

### 3.5 "`menu_packages` tanpa index adalah bug" — GUGUR (ukuran tabel)

Benar bahwa tabel ini punya **nol** index selain PK dan di-seq-scan 543.042 kali oleh
trigger BOM (`SELECT ... FROM menu_packages WHERE package_id = rec.menu_item_id` di dalam
`FOR ... LOOP` per order-item). Tapi tabelnya 63 baris dalam **satu halaman heap**. Index
scan di tabel satu halaman bukan lebih cepat — 2 buffer lawan 1.

### 3.6 "`daily_sales_targets` butuh index `(outlet_id, tanggal)`" — GUGUR (sudah ada)

Sudah ada `daily_sales_targets_lookup_idx` pada
`(outlet_id, effective_from DESC, created_at DESC)` — persis yang hendak diusulkan.
685.045 seq scan-nya adalah planner memilih dengan benar pada tabel 1 halaman.

### 3.7 "`resep` 1,8 juta seq scan" — GUGUR (ukuran tabel)

23 baris / 32 kB = satu halaman. Sama seperti 3.5.

---

## 4. Yang **layak** dikerjakan di lapisan query

Hanya dua item yang bertahan, dan keduanya tidak bergantung pada ukuran tabel.

### 4.1 Hapus dua unique index duplikat pada `orders.external_order_id`

Tabel paling sering ditulis di sistem ini menanggung **tiga** unique index pada kolom yang
sama:

```
orders_external_order_id_key         UNIQUE (external_order_id) WHERE external_order_id IS NOT NULL
orders_external_order_id_unique_idx  UNIQUE (external_order_id) WHERE external_order_id IS NOT NULL
orders_external_order_id_uq          UNIQUE (external_order_id)          -- tidak parsial
```

Dua yang pertama **identik persis** — murni pemborosan tulis di jalur checkout.

Yang ketiga **berbeda semantik**: tanpa klausa parsial, ia juga menolak `NULL` ganda pada
sebagian versi Postgres, sehingga bisa jadi ia yang justru membatasi order non-Pawoon.
Karena itu:

- **Aman dihapus:** salah satu dari dua index parsial yang identik (sisakan satu).
- **Perlu keputusan terpisah:** `orders_external_order_id_uq`. Jangan disentuh sebelum
  perilaku `NULL`-nya diverifikasi terhadap alur import Pawoon
  (`20260725000000_skip_bom_for_pawoon_import.sql`).

**Sifat:** `DROP INDEX CONCURRENTLY`, merusak (tidak aditif). Manfaat: mengurangi
amplifikasi tulis pada `INSERT INTO orders` — 1.463 call @ 73,68 ms tercatat.

### 4.2 Retensi `system_health_log`

50.022 baris / 11 MB tanpa kebijakan retensi apa pun, dan itulah yang membuat
`system_health_latest` menjadi **926 ms — query paling lambat di seluruh sistem**.
Sumbernya cron collector (`net.http_post`, 13.167 call).

**Sifat:** aditif (kebijakan retensi + purge periodik). Tidak menyentuh kode aplikasi.
Ini satu-satunya perbaikan di lapisan query dengan dampak yang benar-benar terukur.

### 4.3 (Opsional, marginal) `PARALLEL SAFE` pada helper RLS

`accessible_outlet_ids`, `is_admin`, `is_owner`, `is_kitchen_staff` semuanya
`proparallel='u'` (nilai default), yang melarang parallel plan pada query mana pun yang
RLS-nya menyentuhnya. Semuanya read-only sehingga penandaan `PARALLEL SAFE` benar secara
semantik, dan `ALTER FUNCTION` **tidak menyentuh isi fungsi** sehingga batas keamanan RLS
tidak berubah.

**Namun:** dengan tabel 1–3 halaman, planner tidak akan memilih parallel plan.
Manfaatnya nol hari ini, dan baru relevan kalau `orders`/`ledger_stok` tumbuh jauh lebih
besar. Dicantumkan sebagai kebenaran semantik, bukan sebagai optimasi.

---

## 5. Utang kecil (di luar scope, dicatat agar tidak hilang)

- `apps/owner-dashboard/src/hooks/useSalesSummary.ts` masih memakai `useEffect` tanpa
  cache dan fetch tabel `outlets` terpisah. Padanannya di `admin-dashboard` sudah
  dioptimasi (React Query + nama outlet dari `useOutlets()`). Duplikat basi.
- ~20 index dengan `idx_scan = 0` (mis. `idx_menu_sync_queue_outlet`,
  `idx_bahan_baku_kategori`, `idx_supplier_nama`). Kecil, tapi tiap index menambah biaya
  tulis. Perlu diamati dulu, bukan langsung dihapus — `idx_scan=0` bisa berarti fiturnya
  memang belum dipakai, bukan index-nya salah.
- Tiga view `ledger_stok` mengerjakan pekerjaan penuh sebelum aplikasi menyaring
  (`ledger_transaksi_ringkas` `GROUP BY` seluruh tabel tanpa batas tanggal;
  `ledger_feed_spv` `ORDER BY ... DESC` tanpa `LIMIT`; `stockout_forecast_spv` agregasi
  7 hari). Hari ini tidak menyakitkan karena tabelnya kecil, tapi **biayanya tumbuh
  linier** dan tidak ada batas atas. Ini kandidat terkuat begitu `ledger_stok` melewati
  ~500k baris.

---

## 6. Tuas sebenarnya (di luar scope yang dipilih)

Dicatat karena mengabaikannya akan menyesatkan siapa pun yang membaca spec ini dan
menyangka lapisan query adalah masalah utama.

### 6.1 `GlobalBlockerMount` — 6.528 s, akar tunggal

`apps/pos-kasir/components/GlobalBlockerMount.tsx`, ter-mount di **setiap halaman POS di
19 outlet**:

- **Polling 5 detik** (`setInterval(checkStatus, 5000)`, baris 237); tiap `checkStatus`
  menembak 5–6 query berantai (`outlet_staff` → `attendance` → `checklist_categories` →
  `daily_checklist_records` → `daily_checklist_ticks`).
- **4 channel realtime** (baris 240–277) yang semuanya memanggil `checkStatus()` lagi —
  termasuk `daily_checklist_ticks` dengan `event:'*'` **tanpa filter outlet**, sehingga
  satu crew mencentang checklist di satu outlet membangunkan seluruh terminal POS di 19
  outlet.
- Dependency array `[bypassedTypes, blockType]` (baris 287) sementara `blockType`
  di-`set` **di dalam** `checkStatus` → effect teardown dan 4 channel di-subscribe ulang
  setiap kali status berubah. Ini menjelaskan 184.788 call ke `pg_publication_tables`
  (biaya setup subscription, bukan query data).

Estimasi: 19 outlet × 720 poll/jam × ~5 query ≈ **68.000 query/jam** hanya untuk
menanyakan "toko sudah buka belum?".

### 6.2 Beban realtime WAL — 25.393 s

Publication `supabase_realtime` berisi **37 tabel** (sudah dipangkas oleh
`20300103000009_optimize_realtime_publication.sql`). Yang mahal bukan keanggotaan
publication, melainkan **volume event × jumlah subscriber**: tiap order menulis `orders` +
`ledger_stok` + `stok_balance` lewat trigger BOM, dan tiap event di-decode serta
di-RLS-check per subscriber.

---

## 7. Rekomendasi

1. **Jangan** kerjakan penambahan index. Buktinya tidak mendukung, dan setiap index baru
   memperlambat tulis tanpa mempercepat baca pada ukuran data sekarang.
2. Kerjakan **4.2 (retensi `system_health_log`)** — satu-satunya perbaikan lapisan query
   dengan dampak terukur (926 ms → sekian milidetik), aditif, tanpa sentuh kode aplikasi.
3. Kerjakan **4.1 (hapus satu index duplikat)** — aman dan langsung mengurangi biaya tulis
   checkout. Sisakan `orders_external_order_id_uq` untuk keputusan terpisah.
4. Angkat **6.1 (`GlobalBlockerMount`)** ke spec tersendiri. Akarnya satu file, dampaknya
   berkali-kali lipat dari seluruh isi dokumen ini.
5. Tinjau ulang bagian 5 (view `ledger_stok`) begitu `ledger_stok` melewati ~500k baris.

---

## 8. Cara verifikasi (untuk item yang jadi dikerjakan)

- **4.1** — `EXPLAIN (ANALYZE, BUFFERS)` pada `INSERT INTO orders` sebelum/sesudah;
  konfirmasi jumlah index yang di-maintain turun. Pastikan constraint unik untuk
  `external_order_id` masih ditegakkan (uji insert duplikat harus tetap ditolak).
- **4.2** — ukur `mean_exec_time` `system_health_latest` di `pg_stat_statements`
  sebelum/sesudah purge; target turun dari 926 ms.
- Untuk semua: `pg_stat_statements_reset()` **tidak** dijalankan tanpa persetujuan —
  DB ini bersama dan statistiknya dipakai orang lain.

---

## 9. Catatan metodologi

Tiga klaim di dokumen ini terbalik total antara pembacaan kode dan pengukuran DB
(3.1, 3.3, 3.4). Satu lagi (3.6) terbantah hanya dengan membaca `pg_indexes`. Pola yang
sama pernah tercatat di `CLAUDE.md` sesi 2026-07-21: **nama file, nama policy, dan
"seq scan" di plan adalah klaim, bukan bukti.**

`seq_scan` yang tinggi bukan cacat kalau tabelnya muat dalam satu-dua halaman, dan
`Seq Scan` di plan bukan cacat kalau filternya menyapu 99% baris. Ukur selektivitas
sebelum mengusulkan index.

Satu catatan integritas: selama analisis ini, satu probe `CREATE INDEX`/`DROP INDEX`
sempat dijalankan di DB produksi untuk menguji legalitas index ekspresi. Probe itu
berhasil dan sudah bersih (`leftover_probe = 0` diverifikasi), tapi seharusnya tidak
dijalankan dalam analisis read-only. Pertanyaan yang sama akhirnya terjawab read-only
lewat `pg_proc.provolatile`.
