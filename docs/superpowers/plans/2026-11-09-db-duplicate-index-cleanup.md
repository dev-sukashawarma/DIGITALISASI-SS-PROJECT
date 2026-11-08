# Perapihan Index Duplikat `orders` & `order_items` serta Reindex `ledger_stok` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghapus 6 index non-unik kembar pada `public.orders` dan `public.order_items` (~64 MB) serta merapatkan ulang (`REINDEX`) `public.idx_ledger_outlet_bahan_created` pada `public.ledger_stok` (156 MB → < 60 MB) dengan risiko *misconfiguration* 0%.

**Architecture:** Seluruh perubahan dibatasi pada index sekunder non-unik yang 100% memiliki kembaran identik/superset di kolom urutan yang sama, tanpa menyentuh satupun index `UNIQUE`/`PRIMARY KEY`, index penopang *Foreign Key*, 4 index standalone non-kembar, maupun view `ledger_transaksi_ringkas`. Di produksi (`khpkoreaaucvyqfhynfq`), eksekusi dijalankan satu per satu memakai `CONCURRENTLY` (atau pengaman `SET LOCAL lock_timeout = '3s'` apabila Management API membungkus transaksi implisit) agar tidak menahan antrean transaksi kasir, diikuti pencatatan berkas migrasi `20300254011700` dan pengujian otomatis TDD (`t2_index_cleanup.sql`).

**Tech Stack:** PostgreSQL 15+ (Supabase), PL/pgSQL, Supabase CLI (`supabase db query --linked`).

## Global Constraints

- **Hanya 6 index kembar non-unik** yang boleh dihapus: `idx_orders_outlet_status_created`, `idx_orders_status_created`, `idx_orders_outlet_created`, `idx_orders_completed_composite`, `idx_order_items_order_menu`, dan `idx_order_items_order_menu_qty`.
- **Dilarang keras menghapus** index `UNIQUE`, `PRIMARY KEY`, index penopang *Foreign Key*, keempat index standalone non-kembar (`idx_orders_source_created`, `orders_channel_idx`, `orders_source_idx`, `idx_order_items_is_promo_reward`), maupun view `public.ledger_transaksi_ringkas`.
- `public.idx_ledger_outlet_bahan_created` **wajib dipertahankan** dan hanya dirapatkan ulang (`REINDEX`) hingga ukurannya `< 60 MB` (`62914560` byte) dengan `indisvalid = true`.
- Penomoran berkas migrasi wajib `20300254011700_rapikan_index_duplikat_orders_dan_reindex_ledger.sql` (tepat setelah `20300254011600_kunci_rls_optimasi_resep_retensi_cron.sql`).
- Jangan pernah menjalankan `git add .` karena terdapat berkas tak terlacak milik sesi lain di repositori; selalu stage berkas secara eksplisit menggunakan `git add -- <path>`.

---

## File Structure

- **Create:** `supabase/verifikasi/keamanan_dan_performa/t2_index_cleanup.sql` — Skrip verifikasi baca-saja (`BEGIN; ... ROLLBACK;`) untuk membuktikan kegagalan sebelum eksekusi (RED) dan kelulusan sesudah eksekusi (GREEN) atas penghapusan 6 index duplikat, keutuhan & validitas (`indisvalid = true`) 32 index yang dipertahankan, penyusutan ukuran `idx_ledger_outlet_bahan_created` di bawah 60 MB, serta rencana `EXPLAIN` tanpa regresi `Seq Scan`.
- **Create:** `supabase/migrations/20300254011700_rapikan_index_duplikat_orders_dan_reindex_ledger.sql` — Berkas migrasi idempoten yang kompatibel dengan transaksi `supabase db push` / `supabase db reset`, lengkap dengan dokumentasi perintah `CONCURRENTLY` produksi dan perintah *rollback* instan.
- **Test (Existing Regression):** `supabase/verifikasi/keamanan_dan_performa/t1_rls_resep_cron.sql` dan `supabase/verifikasi/pemakaian_resep/t1_pemakaian_resep_harian.sql` — Regresi keamanan & performa Paket 1.
- **Modify:** `CLAUDE.md` — Catatan sesi penerapan migrasi Paket 2 di bagian akhir dokumen.

---

### Task 1: Verifikasi TDD (`t2_index_cleanup.sql`), Migrasi & Eksekusi Live Non-Blocking, serta Dokumentasi

**Files:**
- Create: `supabase/verifikasi/keamanan_dan_performa/t2_index_cleanup.sql`
- Create: `supabase/migrations/20300254011700_rapikan_index_duplikat_orders_dan_reindex_ledger.sql`
- Test: `supabase/verifikasi/keamanan_dan_performa/t1_rls_resep_cron.sql`
- Test: `supabase/verifikasi/pemakaian_resep/t1_pemakaian_resep_harian.sql`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes:
  - Tabel `public.orders`, `public.order_items`, dan `public.ledger_stok` beserta katalog `pg_index`, `pg_class`, dan `pg_constraint`.
  - Index kembaran pengganti dari migrasi `20260826000000_phase1_sql_optimizations.sql` (`idx_orders_outlet_status_created_covering`, `idx_orders_status_created_covering`), `idx_orders_outlet_created_at`, `idx_orders_completed_outlet_created`, `idx_order_items_order_id_cover`, dan `idx_order_items_order_id_full`.
- Produces:
  - Skema tanpa 6 index duplikat pada `public.orders` & `public.order_items`.
  - Index `public.idx_ledger_outlet_bahan_created` yang telah dirapatkan (`< 60 MB`, `indisvalid = true`).
  - Stempel versi `20300254011700` pada `supabase_migrations.schema_migrations`.

- [ ] **Step 1: Tulis skrip verifikasi TDD (`t2_index_cleanup.sql`)**

Buat berkas `supabase/verifikasi/keamanan_dan_performa/t2_index_cleanup.sql` dengan isi lengkap berikut:

```sql
-- Uji perapihan 6 index kembar pada orders & order_items, penyusutan bloat
-- idx_ledger_outlet_bahan_created, keutuhan seluruh index pengaman (UNIQUE/PK/FK/standalone),
-- serta rencana EXPLAIN tanpa regresi.
-- Jalankan utuh; selesai tanpa EXCEPTION = LULUS. Baca-saja (ROLLBACK di akhir).

BEGIN;

DO $$
DECLARE
  v_idx text;
  v_oid regclass;
  v_valid boolean;
  v_ready boolean;
  v_invalid_list text;
  v_ledger_idx_bytes bigint;
  v_outlet uuid;
  v_bahan uuid;
  v_order_id uuid;
  v_plan json;
  v_dropped_indexes constant text[] := ARRAY[
    'idx_orders_outlet_status_created',
    'idx_orders_status_created',
    'idx_orders_outlet_created',
    'idx_orders_completed_composite',
    'idx_order_items_order_menu',
    'idx_order_items_order_menu_qty'
  ];
  v_kept_indexes constant text[] := ARRAY[
    -- 6 index kembaran pengganti
    'idx_orders_outlet_status_created_covering',
    'idx_orders_status_created_covering',
    'idx_orders_outlet_created_at',
    'idx_orders_completed_outlet_created',
    'idx_order_items_order_id_cover',
    'idx_order_items_order_id_full',
    -- 10 index UNIQUE & PRIMARY KEY (penjaga anti-dobel / ON CONFLICT)
    'orders_pkey',
    'orders_outlet_bizdate_number_uq',
    'orders_client_order_id_key',
    'orders_external_order_id_uq',
    'orders_external_order_id_key',
    'uq_orders_online_order_id',
    'order_items_pkey',
    'ledger_stok_pkey',
    'idx_ledger_shipment_item',
    'ledger_stok_client_op_id_key',
    -- 11 index penopang Foreign Key
    'idx_ledger_bahan',
    'idx_ledger_stok_ref_order_id',
    'idx_ledger_ref_retur',
    'ledger_ref_terima_vendor',
    'idx_ledger_stok_ref_waste_id',
    'idx_ledger_stok_ref_opname_id',
    'idx_ledger_stok_ref_shipment_id',
    'idx_ledger_stok_ref_transfer_id',
    'idx_ledger_ref_po',
    'idx_order_items_menu_item_id',
    'idx_order_items_order_id',
    -- 4 index standalone non-kembar yang sengaja dibiarkan utuh
    'idx_orders_source_created',
    'orders_channel_idx',
    'orders_source_idx',
    'idx_order_items_is_promo_reward',
    -- 1 index Monitoring yang dirapatkan ulang (REINDEX)
    'idx_ledger_outlet_bahan_created'
  ];
BEGIN
  -- 1. Pastikan keenam index duplikat sudah dihapus
  FOREACH v_idx IN ARRAY v_dropped_indexes LOOP
    IF to_regclass('public.' || v_idx) IS NOT NULL THEN
      RAISE EXCEPTION 'index duplikat masih ada: public.%', v_idx;
    END IF;
  END LOOP;

  -- 2. Pastikan seluruh 32 index pengaman/pengganti masih ada dan valid
  FOREACH v_idx IN ARRAY v_kept_indexes LOOP
    v_oid := to_regclass('public.' || v_idx);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'index penting hilang: public.%', v_idx;
    END IF;

    SELECT i.indisvalid, i.indisready
      INTO v_valid, v_ready
    FROM pg_index i
    WHERE i.indexrelid = v_oid;

    IF COALESCE(v_valid, false) IS NOT TRUE OR COALESCE(v_ready, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'index penting tidak valid/ready: public.% (valid=%, ready=%)', v_idx, v_valid, v_ready;
    END IF;
  END LOOP;

  -- 3. Pastikan tidak ada satupun index cacat (mis. sisa _ccnew / _ccold) pada ketiga tabel
  SELECT string_agg(ci.relname, ', ')
    INTO v_invalid_list
  FROM pg_index i
  JOIN pg_class ci ON ci.oid = i.indexrelid
  JOIN pg_class ct ON ct.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = ct.relnamespace
  WHERE n.nspname = 'public'
    AND ct.relname IN ('orders', 'order_items', 'ledger_stok')
    AND (NOT i.indisvalid OR NOT i.indisready);

  IF v_invalid_list IS NOT NULL THEN
    RAISE EXCEPTION 'ditemukan index cacat/invalid pada orders/order_items/ledger_stok: %', v_invalid_list;
  END IF;

  -- Pastikan view kompatibilitas mundur APK lama tetap utuh
  IF to_regclass('public.ledger_transaksi_ringkas') IS NULL THEN
    RAISE EXCEPTION 'view kompatibilitas public.ledger_transaksi_ringkas hilang';
  END IF;

  -- 4. Pastikan ukuran idx_ledger_outlet_bahan_created sudah menyusut (< 60 MB dari 156 MB)
  v_ledger_idx_bytes := pg_relation_size('public.idx_ledger_outlet_bahan_created'::regclass);
  IF v_ledger_idx_bytes >= 62914560 THEN
    RAISE EXCEPTION 'idx_ledger_outlet_bahan_created masih bengkak: % bytes (batas < 62914560 / 60 MB)', v_ledger_idx_bytes;
  END IF;

  -- 5. Verifikasi EXPLAIN pola kueri utama
  SELECT l.outlet_id, l.bahan_baku_id
    INTO v_outlet, v_bahan
  FROM (
    SELECT outlet_id, bahan_baku_id
    FROM public.ledger_stok
    WHERE created_at >= now() - interval '30 days'
    LIMIT 5000
  ) l
  GROUP BY l.outlet_id, l.bahan_baku_id
  ORDER BY count(*) ASC
  LIMIT 1;

  IF v_outlet IS NOT NULL AND v_bahan IS NOT NULL THEN
    EXECUTE format(
      'EXPLAIN (FORMAT JSON) SELECT tipe, qty, catatan, created_at FROM public.ledger_stok WHERE outlet_id = %L::uuid AND bahan_baku_id = %L::uuid ORDER BY created_at DESC LIMIT 50',
      v_outlet,
      v_bahan
    ) INTO v_plan;

    IF position('idx_ledger_outlet_bahan_created' IN v_plan::text) = 0 THEN
      RAISE EXCEPTION 'EXPLAIN fetchItemDetail tidak memakai idx_ledger_outlet_bahan_created: %', v_plan::text;
    END IF;
  END IF;

  SELECT oi.order_id
    INTO v_order_id
  FROM public.order_items oi
  LIMIT 1;

  IF v_order_id IS NOT NULL THEN
    EXECUTE format(
      'EXPLAIN (FORMAT JSON) SELECT order_id, menu_item_id, quantity FROM public.order_items WHERE order_id = %L::uuid',
      v_order_id
    ) INTO v_plan;

    IF position('Seq Scan' IN v_plan::text) > 0 THEN
      RAISE EXCEPTION 'EXPLAIN order_items per order_id jatuh ke Seq Scan: %', v_plan::text;
    END IF;
  END IF;

  IF v_outlet IS NOT NULL THEN
    EXECUTE format(
      'EXPLAIN (FORMAT JSON) SELECT id, total_amount, discount_amount, promo_subsidy, channel, sales_source, is_endorse FROM public.orders WHERE outlet_id = %L::uuid AND status = %L ORDER BY created_at DESC LIMIT 50',
      v_outlet,
      'completed'
    ) INTO v_plan;

    IF position('Seq Scan' IN v_plan::text) > 0 THEN
      RAISE EXCEPTION 'EXPLAIN orders dashboard jatuh ke Seq Scan: %', v_plan::text;
    END IF;
  END IF;

  RAISE NOTICE 'LULUS — 6 index duplikat bersih, 32 index penting valid, idx_ledger_outlet_bahan_created = % MB',
    round(v_ledger_idx_bytes / 1048576.0, 2);
END $$;

ROLLBACK;
```

- [ ] **Step 2: Jalankan `t2_index_cleanup.sql` sebelum migrasi untuk membuktikan kegagalan (RED)**

Run:
```powershell
supabase db query --linked -f supabase/verifikasi/keamanan_dan_performa/t2_index_cleanup.sql
```
Expected: FAIL (exit code non-zero) dengan pesan `ERROR: P0001: index duplikat masih ada: public.idx_orders_outlet_status_created`.

- [ ] **Step 3: Tulis berkas migrasi (`20300254011700_rapikan_index_duplikat_orders_dan_reindex_ledger.sql`)**

Buat berkas `supabase/migrations/20300254011700_rapikan_index_duplikat_orders_dan_reindex_ledger.sql` dengan isi lengkap berikut:

```sql
-- ============================================================================
-- Migrasi 20300254011700:
-- 1. Hapus 6 index non-unik kembar pada public.orders & public.order_items
--    yang 100% telah dicakup oleh kembaran covering/komposit di kolom yang sama
-- 2. Rapatkan ulang (REINDEX) public.idx_ledger_outlet_bahan_created (bloat 156 MB)
-- 3. Segarkan statistik planner (ANALYZE) pada ketiga tabel
-- ============================================================================
-- CATATAN PRODUKSI:
-- `supabase db push` / `supabase db reset` membungkus berkas migrasi dalam blok
-- transaksi sehingga klausa CONCURRENTLY tidak dapat ditulis langsung di sini
-- (lihat 20300104000001_index_orders_fk_referencers.sql). Pada database produksi
-- yang sedang aktif, jalankan masing-masing statement secara terpisah memakai
-- `DROP INDEX CONCURRENTLY IF EXISTS ...` dan `REINDEX INDEX CONCURRENTLY ...`.
--
-- RESEP ROLLBACK INSTAN (tanpa kehilangan data, dapat dijalankan kapan saja):
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_outlet_status_created
--     ON public.orders USING btree (outlet_id, status, created_at DESC);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_created
--     ON public.orders USING btree (status, created_at DESC);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_outlet_created
--     ON public.orders USING btree (outlet_id, created_at DESC);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_completed_composite
--     ON public.orders USING btree (outlet_id, created_at DESC) WHERE (status = 'completed'::text);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_menu
--     ON public.order_items USING btree (order_id, menu_item_id);
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_menu_qty
--     ON public.order_items USING btree (order_id, menu_item_id, quantity);
-- ============================================================================

-- 1. public.orders: hapus 4 index non-unik yang sudah diwakili kembaran identik/covering
DROP INDEX IF EXISTS public.idx_orders_outlet_status_created;
DROP INDEX IF EXISTS public.idx_orders_status_created;
DROP INDEX IF EXISTS public.idx_orders_outlet_created;
DROP INDEX IF EXISTS public.idx_orders_completed_composite;

-- 2. public.order_items: hapus 2 index non-unik prefiks ketat dari idx_order_items_order_id_cover
DROP INDEX IF EXISTS public.idx_order_items_order_menu;
DROP INDEX IF EXISTS public.idx_order_items_order_menu_qty;

-- 3. public.ledger_stok: rapatkan ulang index rincian bahan Monitoring (tetap dipertahankan)
REINDEX INDEX public.idx_ledger_outlet_bahan_created;

-- 4. Segarkan statistik planner
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.ledger_stok;
```

- [ ] **Step 4: Terapkan perubahan ke database produksi secara non-blocking & stempel `schema_migrations`**

Jalankan satu per satu menggunakan `CONCURRENTLY` terlebih dahulu:
```powershell
supabase db query --linked "DROP INDEX CONCURRENTLY IF EXISTS public.idx_orders_outlet_status_created;"
supabase db query --linked "DROP INDEX CONCURRENTLY IF EXISTS public.idx_orders_status_created;"
supabase db query --linked "DROP INDEX CONCURRENTLY IF EXISTS public.idx_orders_outlet_created;"
supabase db query --linked "DROP INDEX CONCURRENTLY IF EXISTS public.idx_orders_completed_composite;"
supabase db query --linked "DROP INDEX CONCURRENTLY IF EXISTS public.idx_order_items_order_menu;"
supabase db query --linked "DROP INDEX CONCURRENTLY IF EXISTS public.idx_order_items_order_menu_qty;"
supabase db query --linked "REINDEX INDEX CONCURRENTLY public.idx_ledger_outlet_bahan_created;"
```

Jika endpoint Management API pada `supabase db query --linked` menolak `CONCURRENTLY` karena pembungkusan transaksi implisit (`SQLSTATE 25001: cannot run inside a transaction block`), jalankan masing-masing statement secara terpisah dengan batas tunggu kunci ketat `SET LOCAL lock_timeout = '3s'`:
```powershell
supabase db query --linked "SET LOCAL lock_timeout = '3s'; DROP INDEX IF EXISTS public.idx_orders_outlet_status_created;"
supabase db query --linked "SET LOCAL lock_timeout = '3s'; DROP INDEX IF EXISTS public.idx_orders_status_created;"
supabase db query --linked "SET LOCAL lock_timeout = '3s'; DROP INDEX IF EXISTS public.idx_orders_outlet_created;"
supabase db query --linked "SET LOCAL lock_timeout = '3s'; DROP INDEX IF EXISTS public.idx_orders_completed_composite;"
supabase db query --linked "SET LOCAL lock_timeout = '3s'; DROP INDEX IF EXISTS public.idx_order_items_order_menu;"
supabase db query --linked "SET LOCAL lock_timeout = '3s'; DROP INDEX IF EXISTS public.idx_order_items_order_menu_qty;"
supabase db query --linked "SET LOCAL lock_timeout = '3s'; REINDEX INDEX public.idx_ledger_outlet_bahan_created;"
```

Selanjutnya segarkan statistik planner dan catat stempel migrasi:
```powershell
supabase db query --linked "ANALYZE public.orders; ANALYZE public.order_items; ANALYZE public.ledger_stok;"
supabase db query --linked "INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('20300254011700', 'rapikan_index_duplikat_orders_dan_reindex_ledger', ARRAY[]::text[]) ON CONFLICT (version) DO NOTHING;"
```
Expected: Seluruh perintah keluar dengan exit code `0`.

- [ ] **Step 5: Jalankan verifikasi TDD (`t2_index_cleanup.sql`) dan regresi Paket 1 untuk membuktikan kelulusan (GREEN)**

Run:
```powershell
supabase db query --linked -f supabase/verifikasi/keamanan_dan_performa/t2_index_cleanup.sql
supabase db query --linked -f supabase/verifikasi/keamanan_dan_performa/t1_rls_resep_cron.sql
supabase db query --linked -f supabase/verifikasi/pemakaian_resep/t1_pemakaian_resep_harian.sql
supabase db query --linked "SELECT pg_size_pretty(pg_relation_size('public.idx_ledger_outlet_bahan_created'::regclass)) AS ukuran_baru, pg_relation_size('public.idx_ledger_outlet_bahan_created'::regclass) AS bytes_baru;"
```
Expected: Ketiga skrip verifikasi keluar dengan exit code `0` (tanpa `EXCEPTION`), dan `ukuran_baru` berada di kisaran ~25–35 MB (`< 60 MB`).

- [ ] **Step 6: Perbarui `CLAUDE.md` dan commit perubahan**

Tambahkan ringkasan sesi `## Session 2026-11-09: Perapihan Index Kembar orders/order_items & Reindex ledger_stok (DB)` sebelum baris `**Last updated:**` di bagian akhir `CLAUDE.md` yang mencatat:
- Status migrasi `20300254011700_rapikan_index_duplikat_orders_dan_reindex_ledger` applied & terstempel + hasil `t2_index_cleanup.sql`.
- Daftar 6 index kembar yang dihapus beserta ukuran penghematan terukur dan hasil penyusutan `idx_ledger_outlet_bahan_created` (156 MB → ukuran baru terukur).
- Pengaman yang dijaga utuh (seluruh `UNIQUE`/`PK`, FK, 4 index standalone non-kembar, dan view `ledger_transaksi_ringkas`).

Kemudian stage secara eksplisit hanya berkas milik tugas ini dan commit:
```powershell
git add -- supabase/verifikasi/keamanan_dan_performa/t2_index_cleanup.sql supabase/migrations/20300254011700_rapikan_index_duplikat_orders_dan_reindex_ledger.sql CLAUDE.md
git status -s
git commit -m "perf(db): rapikan 6 index kembar orders/order_items dan reindex ledger_stok"
```
