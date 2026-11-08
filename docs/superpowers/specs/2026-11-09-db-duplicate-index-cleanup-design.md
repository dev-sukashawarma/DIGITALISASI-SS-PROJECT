# Perapihan Index Duplikat `orders` & `order_items` serta Reindex `ledger_stok` — Desain

**Tanggal:** 2026-11-09
**Lingkup:** Database Supabase (`supabase/migrations`, `supabase/verifikasi`) — nol perubahan kode aplikasi / nol redeploy
**Status:** Desain disetujui, siap perencanaan implementasi

## 1. Latar Belakang & Bukti Diagnostik Live

Tindak lanjut tahap kedua dari laporan audit `pg_stat_statements` dan `pg_stat_user_indexes` pada database produksi (`khpkoreaaucvyqfhynfq`, penghitung kumulatif dengan `28.877.553` scan pada `orders_pkey` dan `8.949.432` scan pada `idx_order_items_order_id_full`) menunjukkan dua sumber pemborosan ruang dan beban tulis index:

1. **Enam Index Non-Unik Kembar pada `public.orders` (~137.829 baris) dan `public.order_items` (~154.083 baris) Sebesar ~64 MB:**
   - Penambahan index *covering* dan komposit pada migrasi `20260826000000_phase1_sql_optimizations.sql`, `20300112000000_optimize_mitra_queries.sql`, dan `20300126000000_optimize_mitra_performance.sql` meninggalkan index versi lama yang memiliki kolom kunci identik atau menjadi prefiks ketat dari index yang lebih lengkap.
   - Setiap transaksi kasir (`create_order_with_items`), pembatalan/void, dan sinkronisasi order online harus memperbarui seluruh index duplikat tersebut tanpa memberi jalur pencarian baru bagi planner PostgreSQL.

2. **Pembengkakan (*Index Bloat*) `public.idx_ledger_outlet_bahan_created` pada `public.ledger_stok` (~1.377.957 baris) Sebesar 156 MB:**
   - Index `(outlet_id, bahan_baku_id, created_at DESC)` membengkak hingga **156 MB** (~5x lipat ukuran rapat normal ~25–35 MB, sementara `ledger_stok_pkey` hanya 72 MB dan `idx_ledger_stok_outlet_created_at` hanya 24 MB).
   - Walaupun `pg_stat_user_indexes` mencatat `idx_scan = 0`, pengujian `EXPLAIN` membuktikan bahwa planner **memilih index ini** untuk kueri rincian pergerakan satu bahan di satu outlet pada modal Monitoring (`apps/stok/src/lib/queries/monitoring.ts:348` dan `apps/admin-dashboard/src/lib/queries/monitoring.ts:296`, sesuai tujuan awal migrasi `20260620100000_perf_indexes.sql`). Menghapus index ini berisiko memperlambat rincian bahan langka, sehingga tindakan yang aman adalah **merapatkan ulang (`REINDEX`)** tanpa menghapusnya.

## 2. Cakupan & Pengaman Anti-Misconfiguration

### 2.1 Masuk dalam paket ini (Paket Super Aman)

1. **Penghapusan 6 index non-unik yang 100% memiliki kembaran identik/superset pada kolom urutan yang sama:**

   | Tabel | Index yang Dihapus | Ukuran Saat Ini | Index Kembaran yang Dipertahankan |
   |---|---|---:|---|
   | `public.orders` | `idx_orders_outlet_status_created` `(outlet_id, status, created_at DESC)` | 14 MB | `idx_orders_outlet_status_created_covering` `(outlet_id, status, created_at DESC) INCLUDE (total_amount, discount_amount, promo_subsidy, channel, sales_source, is_endorse)` (21 MB) |
   | `public.orders` | `idx_orders_status_created` `(status, created_at DESC)` | 9,9 MB | `idx_orders_status_created_covering` `(status, created_at DESC) INCLUDE (outlet_id, total_amount, discount_amount, promo_subsidy, channel, sales_source, is_endorse)` (17 MB) |
   | `public.orders` | `idx_orders_outlet_created` `(outlet_id, created_at DESC)` (`0` scan) | 8,9 MB | `idx_orders_outlet_created_at` `(outlet_id, created_at)` (7,4 MB, `3.992` scan) |
   | `public.orders` | `idx_orders_completed_composite` `(outlet_id, created_at DESC) WHERE status = 'completed'` (`0` scan) | 7,4 MB | `idx_orders_completed_outlet_created` `(outlet_id, created_at) WHERE status = 'completed'` (7,3 MB, `1.511` scan) |
   | `public.order_items` | `idx_order_items_order_menu` `(order_id, menu_item_id)` (`0` scan) | 11 MB | `idx_order_items_order_id_cover` `(order_id, menu_item_id, quantity, subtotal)` (18 MB) & `idx_order_items_order_id_full` `(order_id) INCLUDE (...)` (24 MB) |
   | `public.order_items` | `idx_order_items_order_menu_qty` `(order_id, menu_item_id, quantity)` | 13 MB | `idx_order_items_order_id_cover` `(order_id, menu_item_id, quantity, subtotal)` (18 MB) & `idx_order_items_order_id_full` `(order_id) INCLUDE (...)` (24 MB) |

   Keenam index di atas telah diverifikasi di katalog `pg_index` dan `pg_constraint` memiliki `indisunique = false`, `indisprimary = false`, `indisreplident = false`, `indisclustered = false`, dan `constraint_def IS NULL`.

2. **Perapatan ulang (`REINDEX`) 1 index bengkak tanpa mengubah definisinya:**
   - `public.idx_ledger_outlet_bahan_created` pada `public.ledger_stok` dirapatkan agar ukurannya turun dari **156 MB** menjadi **< 60 MB** (estimasi ~25–35 MB).

3. **Pembaruan statistik planner (`ANALYZE`)** pada `public.orders`, `public.order_items`, dan `public.ledger_stok`.

4. **Skrip verifikasi otomatis TDD** di `supabase/verifikasi/keamanan_dan_performa/t2_index_cleanup.sql`.

### 2.2 Sengaja TIDAK Disentuh (Jaminan 0% Misconfiguration)

- **Seluruh index `UNIQUE` dan `PRIMARY KEY`** (`orders_pkey`, `orders_outlet_bizdate_number_uq`, `orders_client_order_id_key`, `orders_external_order_id_uq`, `orders_external_order_id_key`, `uq_orders_online_order_id`, `order_items_pkey`, `ledger_stok_pkey`, `idx_ledger_shipment_item`, `ledger_stok_client_op_id_key`) — menjaga keutuhan seluruh operasi `UPSERT` / `ON CONFLICT` offline maupun online.
- **Seluruh index penopang Foreign Key** (`idx_ledger_bahan`, `idx_ledger_stok_ref_order_id`, `idx_ledger_ref_retur`, `ledger_ref_terima_vendor`, `idx_ledger_stok_ref_waste_id`, `idx_ledger_stok_ref_opname_id`, `idx_ledger_stok_ref_shipment_id`, `idx_ledger_stok_ref_transfer_id`, `idx_ledger_ref_po`, `idx_order_items_menu_item_id`, `idx_order_items_order_id`).
- **Empat index non-unik tanpa kembaran di kolom depan** meskipun saat ini tercatat `0` scan (`idx_orders_source_created`, `orders_channel_idx`, `orders_source_idx`, `idx_order_items_is_promo_reward`) — dibiarkan utuh demi mencegah kueri ad-hoc/tahunan kehilangan index.
- **View `public.ledger_transaksi_ringkas`** — tetap dipertahankan agar perangkat tablet APK lama yang belum diperbarui tidak mengalami galat saat mengaksesnya.

## 3. Rancangan Teknis, Eksekusi Tanpa Mengunci Kasir, & Rollback

### 3.1 Strategi Eksekusi di Produksi vs Berkas Migrasi

1. **Eksekusi ke database produksi (`khpkoreaaucvyqfhynfq`):**
   - Setiap operasi dijalankan satu per satu melalui `supabase db query --linked` menggunakan varian non-blocking:
     - `DROP INDEX CONCURRENTLY IF EXISTS public.<nama_index>;` (6 statement terpisah)
     - `REINDEX INDEX CONCURRENTLY public.idx_ledger_outlet_bahan_created;` (1 statement terpisah)
   - **Jalur pengaman bila endpoint CLI Management API membungkus statement dalam transaksi implisit (`SQLSTATE 25001`):**
     Jika panggilan tunggal `CONCURRENTLY` ditolak dengan pesan `cannot run inside a transaction block`, setiap statement dijalankan secara terpisah dengan batas tunggu kunci ketat `SET LOCAL lock_timeout = '3s';` (`DROP INDEX IF EXISTS ...` hanya berupa penghapusan metadata milidetik; `REINDEX INDEX` pada 1,38 juta baris memakan beberapa detik dan akan otomatis membatalkan diri tanpa menahan antrean kasir apabila kunci tabel tidak didapat dalam 3 detik).
   - Setelah seluruh operasi index selesai, jalankan `ANALYZE public.orders; ANALYZE public.order_items; ANALYZE public.ledger_stok;` dan catat versi `20300254011700` ke `supabase_migrations.schema_migrations` secara idempoten (`ON CONFLICT (version) DO NOTHING`).

2. **Berkas migrasi repositori (`supabase/migrations/20300254011700_rapikan_index_duplikat_orders_dan_reindex_ledger.sql`):**
   - Mengikuti konvensi di `20300104000001_index_orders_fk_referencers.sql` dan `20260620100000_perf_indexes.sql`, runner `supabase db push` / `supabase db reset` membungkus isi berkas migrasi dalam transaksi. Karena itu isi SQL di berkas migrasi menggunakan `DROP INDEX IF EXISTS ...`, `REINDEX INDEX public.idx_ledger_outlet_bahan_created;`, dan `ANALYZE`, disertai blok komentar yang mendokumentasikan perintah `CONCURRENTLY` produksi serta perintah *rollback*.

### 3.2 Resep Rollback Instan (Tanpa Kehilangan Data)

Karena operasi ini murni menyentuh struktur index sekunder non-unik, pemulihan penuh dapat dijalankan kapan saja tanpa *downtime* menggunakan perintah berikut:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_outlet_status_created
  ON public.orders USING btree (outlet_id, status, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_created
  ON public.orders USING btree (status, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_outlet_created
  ON public.orders USING btree (outlet_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_completed_composite
  ON public.orders USING btree (outlet_id, created_at DESC) WHERE (status = 'completed'::text);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_menu
  ON public.order_items USING btree (order_id, menu_item_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_menu_qty
  ON public.order_items USING btree (order_id, menu_item_id, quantity);
```

## 4. Struktur Berkas & Penomoran Migrasi

- **Buat migrasi:** `supabase/migrations/20300254011700_rapikan_index_duplikat_orders_dan_reindex_ledger.sql`
  - Menggunakan versi `20300254011700` tepat setelah `20300254011600_kunci_rls_optimasi_resep_retensi_cron.sql`.
- **Buat skrip verifikasi:** `supabase/verifikasi/keamanan_dan_performa/t2_index_cleanup.sql`
- **Jalankan ulang regresi Paket 1:** `supabase/verifikasi/keamanan_dan_performa/t1_rls_resep_cron.sql` dan `supabase/verifikasi/pemakaian_resep/t1_pemakaian_resep_harian.sql`.

## 5. Kriteria Lulus Verifikasi Otomatis (`t2_index_cleanup.sql`)

Skrip verifikasi wajib gagal (**RED**) sebelum perubahan diterapkan dan lulus (**GREEN**, exit code `0`) sesudahnya dengan memeriksa seluruh asersi berikut dalam satu blok transaksi baca-saja (`BEGIN ... ROLLBACK`):

1. **Keenam index duplikat sudah bersih:** `to_regclass` untuk keenam nama index bernilai `NULL`.
2. **Enam index kembaran pengganti tetap ada dan valid:** `idx_orders_outlet_status_created_covering`, `idx_orders_status_created_covering`, `idx_orders_outlet_created_at`, `idx_orders_completed_outlet_created`, `idx_order_items_order_id_cover`, dan `idx_order_items_order_id_full` ada di `pg_index` dengan `indisvalid = true AND indisready = true`.
3. **Seluruh index pengaman tetap utuh dan valid:**
   - Seluruh index `UNIQUE` & `PRIMARY KEY` pada `orders`, `order_items`, dan `ledger_stok` (`orders_pkey`, `orders_outlet_bizdate_number_uq`, `orders_client_order_id_key`, `orders_external_order_id_uq`, `orders_external_order_id_key`, `uq_orders_online_order_id`, `order_items_pkey`, `ledger_stok_pkey`, `idx_ledger_shipment_item`, `ledger_stok_client_op_id_key`) tetap ada dan `indisvalid = true`.
   - Seluruh index penopang Foreign Key (`idx_ledger_bahan`, `idx_ledger_stok_ref_order_id`, `idx_ledger_ref_retur`, `ledger_ref_terima_vendor`, `idx_ledger_stok_ref_waste_id`, `idx_ledger_stok_ref_opname_id`, `idx_ledger_stok_ref_shipment_id`, `idx_ledger_stok_ref_transfer_id`, `idx_ledger_ref_po`, `idx_order_items_menu_item_id`, `idx_order_items_order_id`) tetap ada dan `indisvalid = true`.
   - Keempat index standalone non-kembar (`idx_orders_source_created`, `orders_channel_idx`, `orders_source_idx`, `idx_order_items_is_promo_reward`) tetap ada dan `indisvalid = true`.
   - Tidak ada satu pun index berstatus `indisvalid = false` (termasuk sisa `_ccnew` / `_ccold`) pada tabel `orders`, `order_items`, maupun `ledger_stok`.
4. **Ukuran `idx_ledger_outlet_bahan_created` menyusut signifikan:** index tetap ada, `indisvalid = true`, dan `pg_relation_size('public.idx_ledger_outlet_bahan_created') < 62914560` (`< 60 MB`, turun dari `156 MB`).
5. **Verifikasi rencana eksekusi (`EXPLAIN FORMAT JSON`):**
   - Kueri pola `fetchItemDetail` (`SELECT ... FROM public.ledger_stok WHERE outlet_id = ... AND bahan_baku_id = ... ORDER BY created_at DESC LIMIT 50`) tetap menggunakan `idx_ledger_outlet_bahan_created`.
   - Kueri agregasi `order_items` per `order_id` (`SELECT order_id, menu_item_id, quantity FROM public.order_items WHERE order_id = ...`) tetap menggunakan index scan (`idx_order_items_order_id_cover` / `idx_order_items_order_id_full` / `idx_order_items_order_id`), bukan `Seq Scan`.
