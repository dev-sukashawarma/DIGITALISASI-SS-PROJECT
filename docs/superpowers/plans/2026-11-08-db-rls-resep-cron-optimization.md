# Penguncian RLS, Optimasi `pemakaian_resep_harian`, dan Retensi `pg_cron` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengunci celah RLS pada `public.hermes_bot_registry` serta menghapus tabel debug `_temp_*`, memangkas ~92% pembacaan blok pada RPC `public.pemakaian_resep_harian(uuid, date)`, dan membersihkan serta menjadwalkan retensi 7 hari pada `cron.job_run_details`.

**Architecture:** Seluruh perubahan dikemas dalam satu migrasi SQL idempoten (`20300254011600_kunci_rls_optimasi_resep_retensi_cron.sql`) tanpa perubahan kode aplikasi maupun redeploy. RPC `pemakaian_resep_harian` mempertahankan mode `SECURITY INVOKER` dan tanda tangan yang identik, namun mengganti anti-join penuh ke histori `ledger_stok` dengan dua pembacaan berindeks satu putaran (`loops = 1`) pada `idx_ledger_stok_outlet_created_at` dan `idx_ledger_stok_ref_order_id`.

**Tech Stack:** PostgreSQL 15+ (Supabase), PL/pgSQL, `pg_cron`, Supabase CLI (`supabase db query --linked`).

## Global Constraints

- Kontrak RPC `public.pemakaian_resep_harian(p_outlet_id uuid, p_tanggal date) RETURNS TABLE (bahan_baku_id uuid, qty numeric)` wajib tetap `LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public` dengan hasil identik 100%.
- `public.hermes_bot_registry` wajib memiliki kolom `bot_token text`, `ENABLE ROW LEVEL SECURITY`, pencabutan seluruh privilege dari `PUBLIC`, `anon`, dan `authenticated`, serta pemberian `ALL` hanya ke `service_role`.
- `public._temp_sql_output` dan `public._temp_timings` wajib dihapus (`DROP TABLE IF EXISTS`).
- Pembersihan `cron.job_run_details` hanya boleh menghapus baris yang sudah selesai (`end_time IS NOT NULL AND end_time < now() - interval '7 days'`) dan dijadwalkan harian pada `45 20 * * *` (03:45 WIB) dengan nama job `cron-job-run-details-retensi-7-hari`.
- Penomoran berkas migrasi wajib `20300254011600_kunci_rls_optimasi_resep_retensi_cron.sql` (setelah `20300254011500` dan setelah `20300254002200_hermes_bot_catalog_and_access.sql`).
- Tidak boleh membuat index baru pada `ledger_stok`.
- Jangan menjalankan `git add .` karena terdapat berkas tak terlacak dari sesi lain di repositori; stage berkas secara eksplisit per path.

---

## File Structure

- **Create:** `supabase/verifikasi/keamanan_dan_performa/t1_rls_resep_cron.sql` — Skrip verifikasi baca-saja (`BEGIN; ... ROLLBACK;`) untuk membuktikan kegagalan sebelum migrasi (RED) dan kelulusan sesudah migrasi (GREEN) atas RLS `hermes_bot_registry`, ketiadaan `_temp_*`, jadwal & kebersihan `cron.job_run_details`, serta anggaran buffer `pemakaian_resep_harian` di bawah role `authenticated`.
- **Create:** `supabase/migrations/20300254011600_kunci_rls_optimasi_resep_retensi_cron.sql` — Migrasi atomik untuk penguncian RLS, penghapusan tabel `_temp_*`, pembaruan fungsi `pemakaian_resep_harian`, pembersihan awal `cron.job_run_details`, dan penjadwalan job `pg_cron`.
- **Test (Existing Regression):** `supabase/verifikasi/pemakaian_resep/t1_pemakaian_resep_harian.sql` — Skrip regresi fungsional & isolasi RLS yang sudah ada untuk memastikan paritas angka D1/D2, void lintas hari, dan akses `crew`.
- **Modify:** `CLAUDE.md` — Catatan sesi penerapan migrasi di bagian akhir dokumen.

---

### Task 1: Verifikasi TDD, Migrasi RLS + RPC + Retensi Cron, Penerapan Live, dan Dokumentasi

**Files:**
- Create: `supabase/verifikasi/keamanan_dan_performa/t1_rls_resep_cron.sql`
- Create: `supabase/migrations/20300254011600_kunci_rls_optimasi_resep_retensi_cron.sql`
- Test: `supabase/verifikasi/pemakaian_resep/t1_pemakaian_resep_harian.sql`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes:
  - Tabel `public.hermes_bot_registry` (dari `20300254002200_hermes_bot_catalog_and_access.sql` & `20300254004400_bot_telegram_whitelist_and_invites.sql`)
  - Tabel `public.ledger_stok` beserta index `idx_ledger_stok_outlet_created_at` dan `idx_ledger_stok_ref_order_id`
  - Tabel sistem `cron.job` dan `cron.job_run_details`
- Produces:
  - Kolom terjamin `public.hermes_bot_registry.bot_token text` dengan RLS aktif (`service_role` only)
  - Fungsi `public.pemakaian_resep_harian(p_outlet_id uuid, p_tanggal date) RETURNS TABLE (bahan_baku_id uuid, qty numeric)` versi dua-scan berindeks (`loops = 1`)
  - Jadwal `pg_cron` `cron-job-run-details-retensi-7-hari` (`45 20 * * *`)

- [x] **Step 1: Tulis skrip verifikasi TDD (`t1_rls_resep_cron.sql`)**

Buat berkas `supabase/verifikasi/keamanan_dan_performa/t1_rls_resep_cron.sql` dengan isi lengkap berikut:

```sql
-- Uji penguncian RLS hermes_bot_registry, penghapusan tabel _temp_*,
-- retensi cron.job_run_details, dan anggaran buffer pemakaian_resep_harian.
-- Jalankan utuh; selesai tanpa EXCEPTION = LULUS. Baca-saja (ROLLBACK di akhir).

BEGIN;

DO $$
DECLARE
  v_rls boolean;
  v_has_col boolean;
  v_cron_active boolean;
  v_cron_sched text;
  v_old_cron_rows bigint;
  v_fn_def text;
  v_outlet uuid;
  v_crew uuid;
  v_tanggal date;
  v_plan json;
  v_total_blks bigint;
BEGIN
  -- 1. Kolom bot_token & RLS pada public.hermes_bot_registry
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hermes_bot_registry'
      AND column_name = 'bot_token'
  ) INTO v_has_col;
  IF NOT v_has_col THEN
    RAISE EXCEPTION 'hermes_bot_registry.bot_token belum terdaftar';
  END IF;

  SELECT c.relrowsecurity
    INTO v_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'hermes_bot_registry';

  IF COALESCE(v_rls, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'hermes_bot_registry: relrowsecurity masih FALSE';
  END IF;

  IF has_table_privilege('anon', 'public.hermes_bot_registry', 'SELECT') THEN
    RAISE EXCEPTION 'hermes_bot_registry: anon masih punya hak SELECT';
  END IF;

  IF has_table_privilege('authenticated', 'public.hermes_bot_registry', 'SELECT') THEN
    RAISE EXCEPTION 'hermes_bot_registry: authenticated masih punya hak SELECT';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.hermes_bot_registry', 'SELECT') THEN
    RAISE EXCEPTION 'hermes_bot_registry: service_role kehilangan hak SELECT';
  END IF;

  -- Kontrol negatif runtime: anon benar-benar ditolak saat SELECT
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM 1 FROM public.hermes_bot_registry LIMIT 1;
    RESET ROLE;
    RAISE EXCEPTION 'kontrol negatif gagal: anon berhasil SELECT hermes_bot_registry';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RESET ROLE;
  END;

  -- Kontrol negatif runtime: authenticated benar-benar ditolak saat SELECT
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM 1 FROM public.hermes_bot_registry LIMIT 1;
    RESET ROLE;
    RAISE EXCEPTION 'kontrol negatif gagal: authenticated berhasil SELECT hermes_bot_registry';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RESET ROLE;
  END;

  -- 2. Tabel debug sementara sudah dihapus
  IF to_regclass('public._temp_sql_output') IS NOT NULL THEN
    RAISE EXCEPTION 'tabel sisa debug public._temp_sql_output masih ada';
  END IF;

  IF to_regclass('public._temp_timings') IS NOT NULL THEN
    RAISE EXCEPTION 'tabel sisa debug public._temp_timings masih ada';
  END IF;

  -- 3. Jadwal retensi pg_cron & kebersihan histori > 7 hari
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT j.active, j.schedule
      INTO v_cron_active, v_cron_sched
    FROM cron.job j
    WHERE j.jobname = 'cron-job-run-details-retensi-7-hari';

    IF v_cron_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'job cron-job-run-details-retensi-7-hari belum terdaftar/aktif';
    END IF;

    IF v_cron_sched IS DISTINCT FROM '45 20 * * *' THEN
      RAISE EXCEPTION 'jadwal cron-job-run-details-retensi-7-hari salah: %', v_cron_sched;
    END IF;

    SELECT count(*)
      INTO v_old_cron_rows
    FROM cron.job_run_details
    WHERE end_time IS NOT NULL
      AND end_time < now() - interval '7 days';

    IF v_old_cron_rows > 0 THEN
      RAISE EXCEPTION 'cron.job_run_details masih memiliki % baris selesai > 7 hari', v_old_cron_rows;
    END IF;
  END IF;

  -- 4. Definisi & anggaran buffer pemakaian_resep_harian di bawah role authenticated
  SELECT pg_get_functiondef('public.pemakaian_resep_harian(uuid,date)'::regprocedure)
    INTO v_fn_def;

  IF position('baris_kandidat' IN v_fn_def) = 0 THEN
    RAISE EXCEPTION 'pemakaian_resep_harian belum memakai CTE baris_kandidat';
  END IF;

  IF position('order_milik_hari_ini' IN v_fn_def) > 0 THEN
    RAISE EXCEPTION 'pemakaian_resep_harian masih memuat CTE lama order_milik_hari_ini';
  END IF;

  -- Pilih tanggal aktif terbaru pada outlet tersibuk (MITRA CILEUNGSI atau fallback outlet ramai)
  SELECT l.outlet_id,
         (max(l.created_at) AT TIME ZONE 'Asia/Jakarta')::date
    INTO v_outlet, v_tanggal
  FROM public.ledger_stok l
  JOIN public.outlets o ON o.id = l.outlet_id
  WHERE l.tipe = 'pemakaian'
    AND l.created_at >= now() - interval '7 days'
    AND o.name ILIKE '%cileungsi%'
  GROUP BY l.outlet_id
  LIMIT 1;

  IF v_outlet IS NULL THEN
    SELECT l.outlet_id,
           (max(l.created_at) AT TIME ZONE 'Asia/Jakarta')::date
      INTO v_outlet, v_tanggal
    FROM public.ledger_stok l
    WHERE l.tipe = 'pemakaian'
      AND l.created_at >= now() - interval '7 days'
    GROUP BY l.outlet_id
    ORDER BY count(*) DESC
    LIMIT 1;
  END IF;

  SELECT s.id
    INTO v_crew
  FROM public.outlet_staff s
  WHERE s.role = 'crew'
    AND s.status = 'active'
    AND s.outlet_id = v_outlet
  LIMIT 1;

  IF v_outlet IS NOT NULL AND v_crew IS NOT NULL THEN
    PERFORM set_config(
      'request.jwt.claims',
      json_build_object('sub', v_crew, 'role', 'authenticated')::text,
      true
    );
    SET LOCAL ROLE authenticated;

    EXECUTE
      'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM public.pemakaian_resep_harian($1, $2)'
      INTO v_plan
      USING v_outlet, v_tanggal;

    RESET ROLE;

    v_total_blks := COALESCE((v_plan->0->'Plan'->>'Shared Hit Blocks')::bigint, 0)
                  + COALESCE((v_plan->0->'Plan'->>'Shared Read Blocks')::bigint, 0);

    -- Sebelum optimasi: ~8.000-9.031 blok karena Bitmap Heap Scan 123k baris.
    -- Sesudah optimasi: ~660-1.800 blok (termasuk evaluasi accessible_outlet_ids()).
    IF v_total_blks > 3500 THEN
      RAISE EXCEPTION 'anggaran buffer pemakaian_resep_harian terlampaui: % blok (batas 3500)', v_total_blks;
    END IF;
  END IF;

  RAISE NOTICE 'LULUS — RLS terkunci, _temp_* bersih, cron aktif, pemakaian_resep_harian = % blok', v_total_blks;
END $$;

ROLLBACK;
```

- [x] **Step 2: Jalankan skrip verifikasi sebelum migrasi untuk membuktikan kegagalan (RED)**

Run:
```powershell
supabase db query --linked -f supabase/verifikasi/keamanan_dan_performa/t1_rls_resep_cron.sql
```
Expected: FAIL dengan pesan `ERROR: P0001: hermes_bot_registry: relrowsecurity masih FALSE`.

- [x] **Step 3: Tulis berkas migrasi (`20300254011600_kunci_rls_optimasi_resep_retensi_cron.sql`)**

Buat berkas `supabase/migrations/20300254011600_kunci_rls_optimasi_resep_retensi_cron.sql` dengan isi lengkap berikut:

```sql
-- 20300254011600_kunci_rls_optimasi_resep_retensi_cron.sql
--
-- 1. Kunci kembali RLS & privilege public.hermes_bot_registry (serta catat kolom bot_token)
--    dan hapus tabel sisa sesi debug public._temp_sql_output & public._temp_timings.
-- 2. Optimasi public.pemakaian_resep_harian(uuid, date): ganti anti-join penuh atas
--    seluruh riwayat ledger_stok outlet (Bitmap Heap Scan ~124 rb baris / ~8.000 blok)
--    menjadi dua pembacaan berindeks satu putaran (loops=1) via idx_ledger_stok_outlet_created_at
--    dan idx_ledger_stok_ref_order_id (~666 blok, paritas hasil 100%, tetap SECURITY INVOKER).
-- 3. Bersihkan histori selesai cron.job_run_details > 7 hari dan jadwalkan retensi harian
--    cron-job-run-details-retensi-7-hari pada pukul 03:45 WIB (45 20 * * * UTC).
--
-- Spec: docs/superpowers/specs/2026-11-08-db-rls-resep-cron-optimization-design.md

SET lock_timeout = '15s';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Keamanan RLS hermes_bot_registry & penghapusan tabel _temp_*
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.hermes_bot_registry
  ADD COLUMN IF NOT EXISTS bot_token text;

ALTER TABLE public.hermes_bot_registry ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hermes_bot_registry FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.hermes_bot_registry TO service_role;

DROP TABLE IF EXISTS public._temp_sql_output;
DROP TABLE IF EXISTS public._temp_timings;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Optimasi RPC public.pemakaian_resep_harian(uuid, date)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pemakaian_resep_harian(p_outlet_id uuid, p_tanggal date)
RETURNS TABLE (bahan_baku_id uuid, qty numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH jendela AS (
    SELECT (p_tanggal::timestamp AT TIME ZONE 'Asia/Jakarta')       AS mulai,
           ((p_tanggal + 1)::timestamp AT TIME ZONE 'Asia/Jakarta') AS akhir
  ),
  -- Putaran indeks #1 (loops=1): idx_ledger_stok_outlet_created_at pada 1 hari WIB.
  hari_ini AS MATERIALIZED (
    SELECT l.ref_order_id, l.bahan_baku_id, l.qty
    FROM public.ledger_stok l, jendela j
    WHERE l.outlet_id = p_outlet_id
      AND l.tipe = 'pemakaian'
      AND l.created_at >= j.mulai
      AND l.created_at <  j.akhir
  ),
  -- Putaran indeks #2 (loops=1): idx_ledger_stok_ref_order_id untuk seluruh order kandidat
  -- sekaligus lewat = ANY(ARRAY(...)) agar:
  --   (a) tidak memicu Hash Right Anti Join ke seluruh riwayat ledger outlet, dan
  --   (b) policy RLS ledger_read (accessible_outlet_ids()) hanya dievaluasi sekali, bukan per order.
  baris_kandidat AS MATERIALIZED (
    SELECT l.ref_order_id, l.bahan_baku_id, l.qty, l.tipe, l.created_at
    FROM public.ledger_stok l
    WHERE l.ref_order_id = ANY (
      ARRAY(SELECT DISTINCT h.ref_order_id FROM hari_ini h WHERE h.ref_order_id IS NOT NULL)
    )
      AND l.outlet_id = p_outlet_id
      AND l.tipe IN ('pemakaian', 'adjustment')
  ),
  -- Order yang sudah pernah memotong stok sebelum awal hari WIB ini adalah milik hari sebelumnya.
  order_lama AS (
    SELECT DISTINCT p.ref_order_id
    FROM baris_kandidat p, jendela j
    WHERE p.tipe = 'pemakaian'
      AND p.created_at < j.mulai
  ),
  per_order AS (
    SELECT b.bahan_baku_id,
           GREATEST(-SUM(b.qty), 0) AS q
    FROM baris_kandidat b
    LEFT JOIN order_lama ol ON ol.ref_order_id = b.ref_order_id
    WHERE ol.ref_order_id IS NULL
    GROUP BY b.ref_order_id, b.bahan_baku_id
  ),
  tanpa_order AS (
    SELECT h.bahan_baku_id, -h.qty AS q
    FROM hari_ini h
    WHERE h.ref_order_id IS NULL
  )
  SELECT x.bahan_baku_id, SUM(x.q)::numeric AS qty
  FROM (SELECT * FROM per_order UNION ALL SELECT * FROM tanpa_order) x
  GROUP BY x.bahan_baku_id
  HAVING SUM(x.q) > 0;
$$;

REVOKE ALL ON FUNCTION public.pemakaian_resep_harian(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pemakaian_resep_harian(uuid, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.pemakaian_resep_harian(uuid, date) IS
  'Pemakaian resep (BOM) bersih per bahan untuk satu outlet & tanggal WIB; order batal dibalik. Dioptimasi di migration 20300254011600.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Pembersihan awal & jadwal retensi harian cron.job_run_details (7 hari)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    DELETE FROM cron.job_run_details
    WHERE end_time IS NOT NULL
      AND end_time < now() - interval '7 days';

    PERFORM cron.unschedule('cron-job-run-details-retensi-7-hari')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'cron-job-run-details-retensi-7-hari'
    );

    PERFORM cron.schedule(
      'cron-job-run-details-retensi-7-hari',
      '45 20 * * *',
      $cmd$DELETE FROM cron.job_run_details WHERE end_time IS NOT NULL AND end_time < now() - interval '7 days';$cmd$
    );
  END IF;
END $$;
```

- [x] **Step 4: Terapkan migrasi ke database produksi & stempel `schema_migrations`**

Jalankan berkas migrasi ke database terhubung:
```powershell
supabase db query --linked -f supabase/migrations/20300254011600_kunci_rls_optimasi_resep_retensi_cron.sql
```

Lalu stempel versi migrasi pada `supabase_migrations.schema_migrations` dan verifikasi barisnya:
```powershell
supabase db query --linked "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20300254011600', 'kunci_rls_optimasi_resep_retensi_cron') ON CONFLICT (version) DO NOTHING; SELECT version, name FROM supabase_migrations.schema_migrations WHERE version = '20300254011600';"
```
Expected: Mengembalikan 1 baris `version = "20300254011600"`, `name = "kunci_rls_optimasi_resep_retensi_cron"`.

- [x] **Step 5: Jalankan kedua skrip verifikasi (baru & regresi) untuk memastikan GREEN**

Jalankan skrip verifikasi keamanan, cron, & performa:
```powershell
supabase db query --linked -f supabase/verifikasi/keamanan_dan_performa/t1_rls_resep_cron.sql
```
Expected: Keluar dengan kode `0` (tanpa error/exception).

Jalankan skrip regresi fungsional & RLS asli `pemakaian_resep_harian`:
```powershell
supabase db query --linked -f supabase/verifikasi/pemakaian_resep/t1_pemakaian_resep_harian.sql
```
Expected: Keluar dengan kode `0` (tanpa error/exception).

Periksa juga ukuran baru `cron.job_run_details` dan performa aktual `EXPLAIN (ANALYZE, BUFFERS)` `pemakaian_resep_harian`:
```powershell
supabase db query --linked "SELECT relname, relrowsecurity, pg_size_pretty(pg_total_relation_size(oid)) AS total_size FROM pg_class WHERE oid IN ('public.hermes_bot_registry'::regclass, 'cron.job_run_details'::regclass);"
```
Expected: `hermes_bot_registry` memiliki `relrowsecurity = true`; jumlah baris historis > 7 hari pada `cron.job_run_details` sudah terhapus.

- [x] **Step 6: Perbarui `CLAUDE.md` dan commit seluruh perubahan paket ini**

Tambahkan seksi ringkas di akhir `CLAUDE.md` (sebelum baris `**Last updated:**`) dan perbarui tanggal `**Last updated:** 2026-11-09`:

```markdown
## Session 2026-11-08: Penguncian RLS `hermes_bot_registry`, Optimasi `pemakaian_resep_harian`, & Retensi `pg_cron` (DB)

**Status:** ✅ DB **LIVE** — migration `20300254011600_kunci_rls_optimasi_resep_retensi_cron` applied & terstempel; uji `supabase/verifikasi/keamanan_dan_performa/t1_rls_resep_cron.sql` & regresi `supabase/verifikasi/pemakaian_resep/t1_pemakaian_resep_harian.sql` LULUS. Nol app perlu redeploy.

**Spec/plan:** `docs/superpowers/specs/2026-11-08-db-rls-resep-cron-optimization-design.md`, `docs/superpowers/plans/2026-11-08-db-rls-resep-cron-optimization.md`

- **Keamanan RLS:** `public.hermes_bot_registry` dikunci kembali (`ENABLE ROW LEVEL SECURITY`, `REVOKE ALL FROM PUBLIC, anon, authenticated`, `GRANT ALL TO service_role`, kolom `bot_token` disinkronkan ke migrasi). Tabel sisa debug `public._temp_sql_output` & `public._temp_timings` dihapus. ⚠️ Disarankan merotasi `bot_token` Bot CEO via `@BotFather` karena sebelumnya sempat terbuka ke `anon`.
- **Optimasi `pemakaian_resep_harian(uuid, date)`:** CTE `order_milik_hari_ini` yang memicu `Hash Right Anti Join` (`Bitmap Heap Scan` ~124 rb baris / ~8.000–9.031 blok, ~5,9 dtk dingin) diganti dua scan berindeks `loops=1` (`idx_ledger_stok_outlet_created_at` + `idx_ledger_stok_ref_order_id` via `= ANY(ARRAY(...))`). Tetap `SECURITY INVOKER`, selisih angka 0, pembacaan turun ke ~666 blok (~15 ms).
- **Retensi `pg_cron`:** Histori selesai `cron.job_run_details` > 7 hari dibersihkan dan dijadwalkan harian lewat `cron-job-run-details-retensi-7-hari` (`45 20 * * *` / 03:45 WIB).
- **Catatan tindak lanjut terpisah:** Sisa 12 panggilan ke view `ledger_transaksi_ringkas` di `pg_stat_statements` berasal dari luar monorepo web (kemungkinan APK native lama; web sudah memakai `ledger_transaksi_page`).
```

Commit secara eksplisit hanya berkas milik tugas ini:
```powershell
git add docs/superpowers/plans/2026-11-08-db-rls-resep-cron-optimization.md supabase/migrations/20300254011600_kunci_rls_optimasi_resep_retensi_cron.sql supabase/verifikasi/keamanan_dan_performa/t1_rls_resep_cron.sql CLAUDE.md
git commit -m "perf(db): kunci RLS hermes_bot_registry, optimasi pemakaian_resep_harian, dan retensi pg_cron"
```
