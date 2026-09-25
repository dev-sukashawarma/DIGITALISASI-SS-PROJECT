# Riwayat HPP Override dengan Tanggal Berlaku — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HPP override (dan HPP per kanal) punya tanggal berlaku, sehingga laporan memakai HPP yang berlaku pada tanggal order — penjualan 1–18 Sep 2026 tetap HPP lama, 19 Sep ke depan HPP baru.

**Architecture:** Tabel baru `menu_hpp_riwayat` menyimpan satu baris per (menu, kunci, tanggal berlaku). Fungsi `menu_hpp_pada(menu, tanggal)` merekonstruksi `hpp_override`/`channel_hpp` pada tanggal itu. Semua pembaca laporan (2 fungsi DB + ~9 berkas TS) **mempertahankan aturan HPP masing-masing**; yang diganti hanya sumber angkanya — dari `menu_items` (angka hari ini) ke rekonstruksi pada tanggal order. Penulisan lewat RPC `ubah_hpp_menu` (owner/admin, tanggal boleh mundur dalam batas), dengan trigger jaring pengaman untuk tulisan langsung.

**Tech Stack:** Supabase Postgres (plpgsql/sql, RLS), Next.js app router (admin-dashboard, finance, manager), TypeScript, vitest, `supabase` CLI.

**Spec:** `docs/superpowers/specs/2026-09-25-riwayat-hpp-override-design.md` (baca §3, §5, §9 sebelum mulai).

## Global Constraints

- Branch kerja: `feat/riwayat-hpp-override`. **Sebelum setiap commit:** `git rev-parse --abbrev-ref HEAD` harus `feat/riwayat-hpp-override` (otomasi repo pernah memindah branch di tengah sesi). Jangan push kecuali diminta.
- Semua perintah git/yarn dijalankan dari root repo `D:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT` (pakai `cd` eksplisit; subagent mewarisi cwd sesi `apps/stok`).
- Tanggal selalu **WIB** (`Asia/Jakarta`). Tanggal order = `orders.created_at` WIB; ecommerce = `ecommerce_sales.order_date` WIB.
- **Nol pergeseran:** sebelum ada perubahan HPP bertanggal, setiap laporan harus menghasilkan angka **identik sampai rupiah terakhir** dengan sebelum fitur ini. Jangan "merapikan" atau menyatukan aturan HPP antar laporan.
- Batas tanggal berlaku (K5): `> hari ini WIB` ditolak; `< batas` ditolak, `batas = tanggal 1 bulan lalu` bila hari ini tanggal ≤ 10, selain itu `tanggal 1 bulan berjalan`.
- Penulis HPP: hanya `outlet_staff.role IN ('owner','admin')` dengan `status='active'` (cek di dalam RPC).
- Timestamp migration: `20260925150000`, `20260925151000`, `20260925152000`. **Sebelum Task 2**, jalankan `supabase db query "SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '20260925%' ORDER BY 1;" --linked` — kalau salah satu sudah dipakai, geser ke menit berikutnya yang kosong dan pakai nama baru itu konsisten di seluruh plan.
- Apply migration **selalu** lewat `supabase db query --linked -f <berkas>` (inline `"<sql>"` bisa no-op untuk DDL), lalu verifikasi katalog, lalu stempel `schema_migrations`.
- Commit message diakhiri baris: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Pesan UI dan komentar kode dalam Bahasa Indonesia, mengikuti gaya berkas sekitarnya.

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `supabase/verifikasi/riwayat_hpp/baseline_owner.sql` | Snapshot `total_cogs` owner summary per periode × outlet (gerbang nol pergeseran) |
| `supabase/verifikasi/riwayat_hpp/baseline_mitra.sql` | Snapshot `get_mitra_orders_summary` per periode |
| `supabase/verifikasi/riwayat_hpp/ukur_waktu.sql` | Waktu eksekusi owner summary 1–24 Sep |
| `supabase/migrations/20260925150000_riwayat_hpp_menu.sql` | Tabel, seed, `menu_hpp_pada`, trigger, RPC `ubah_hpp_menu` |
| `supabase/migrations/20260925151000_hpp_mitra_per_tanggal.sql` | Fungsi HPP mitra + `get_mitra_orders_summary` per tanggal |
| `supabase/migrations/20260925152000_owner_summary_hpp_per_tanggal.sql` | `get_owner_dashboard_summary` per tanggal |
| `supabase/verifikasi/riwayat_hpp/t1_tabel_rpc_trigger.sql`, `t2_mitra.sql`, `t3_owner_summary.sql` | Uji perilaku (transaksi + ROLLBACK) |
| `apps/admin-dashboard/src/lib/hpp/riwayatHpp.ts` (+ `.test.ts`) | Ambil riwayat, rekonstruksi, penerap per tanggal |
| `apps/admin-dashboard/src/lib/hpp/batasBerlakuHpp.ts` (+ `.test.ts`) | `hariIniWib`, `batasAwalBerlaku` untuk input tanggal |
| `apps/finance/src/lib/hpp/riwayatHpp.ts` | Salinan identik |
| `apps/manager/src/lib/hpp/batasBerlakuHpp.ts` | Salinan identik |
| Konsumen TS (Task 6–8) | Hanya ganti sumber angka HPP, aturan tetap |
| `HppDashboardView.tsx`, `ResepEditor.tsx` (admin-dashboard & manager) | Tulis lewat RPC, input "Berlaku mulai" |

---

### Task 1: Baseline nol pergeseran (SEBELUM migration apa pun)

**Files:**
- Create: `supabase/verifikasi/riwayat_hpp/baseline_owner.sql`
- Create: `supabase/verifikasi/riwayat_hpp/baseline_mitra.sql`
- Create: `supabase/verifikasi/riwayat_hpp/ukur_waktu.sql`
- Create (output): `supabase/verifikasi/riwayat_hpp/baseline-sebelum-owner.txt`, `baseline-sebelum-mitra.txt`

**Interfaces:**
- Produces: dua berkas `.txt` yang akan di-`diff` di Task 4; angka waktu dasar owner summary.

- [ ] **Step 1: Pastikan belum ada tabel riwayat (fitur belum terpasang)**

Run: `supabase db query "SELECT to_regclass('public.menu_hpp_riwayat') AS ada;" --linked`
Expected: `ada` = NULL. Kalau tidak NULL, BERHENTI dan laporkan — baseline harus diambil sebelum fitur terpasang.

- [ ] **Step 2: Tulis `baseline_owner.sql`**

```sql
-- Snapshot total_cogs Owner Dashboard per periode × outlet. Dijalankan sebagai postgres
-- (auth.uid() NULL → akses penuh). Output deterministik agar bisa di-diff.
WITH periode(nama, dari, sampai) AS (VALUES
  ('2026-08',        timestamptz '2026-08-01 00:00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
  ('2026-09-01..24', timestamptz '2026-09-01 00:00:00+07', timestamptz '2026-09-24 23:59:59.999+07')
),
target AS (
  SELECT NULL::uuid AS outlet_id, '~SEMUA' AS outlet
  UNION ALL
  SELECT o.id, o.name || ' [' || o.id || ']' FROM public.outlets o
)
SELECT p.nama AS periode, t.outlet,
       public.get_owner_dashboard_summary(p.dari, p.sampai, t.outlet_id) ->> 'total_cogs' AS total_cogs
FROM periode p CROSS JOIN target t
ORDER BY 1, 2;
```

- [ ] **Step 3: Tulis `baseline_mitra.sql`**

```sql
WITH periode(nama, dari, sampai) AS (VALUES
  ('2026-08',        timestamptz '2026-08-01 00:00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
  ('2026-09-01..24', timestamptz '2026-09-01 00:00:00+07', timestamptz '2026-09-24 23:59:59.999+07')
)
SELECT p.nama AS periode, s.outlet_id, s.channel_group, s.cogs, s.gross_revenue, s.order_count
FROM periode p
CROSS JOIN LATERAL public.get_mitra_orders_summary(
  (SELECT array_agg(id) FROM public.outlets WHERE type = 'mitra'), p.dari, p.sampai) s
ORDER BY 1, 2, 3;
```

- [ ] **Step 4: Tulis `ukur_waktu.sql`**

```sql
CREATE TEMP TABLE IF NOT EXISTS _waktu_owner (percobaan int, ms numeric);
DO $$
DECLARE t0 timestamptz;
BEGIN
  FOR i IN 1..3 LOOP
    t0 := clock_timestamp();
    PERFORM public.get_owner_dashboard_summary(timestamptz '2026-09-01 00:00:00+07', timestamptz '2026-09-24 23:59:59.999+07');
    INSERT INTO _waktu_owner VALUES (i, round(EXTRACT(EPOCH FROM clock_timestamp() - t0) * 1000));
  END LOOP;
END $$;
SELECT percobaan, ms FROM _waktu_owner ORDER BY percobaan;
```

- [ ] **Step 5: Jalankan dan simpan output**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
supabase db query --linked -f supabase/verifikasi/riwayat_hpp/baseline_owner.sql > supabase/verifikasi/riwayat_hpp/baseline-sebelum-owner.txt
supabase db query --linked -f supabase/verifikasi/riwayat_hpp/baseline_mitra.sql > supabase/verifikasi/riwayat_hpp/baseline-sebelum-mitra.txt
supabase db query --linked -f supabase/verifikasi/riwayat_hpp/ukur_waktu.sql
```
Expected: kedua `.txt` tidak kosong dan tidak berisi `ERROR`; baris `~SEMUA` punya `total_cogs` bukan NULL. Catat `ms` terkecil dari ukur_waktu (misal "dasar = 700 ms") di pesan commit.

Cek determinisme: jalankan `baseline_owner.sql` sekali lagi ke berkas sementara dan `diff` dengan `baseline-sebelum-owner.txt`. Harus identik. Kalau CLI menyisipkan baris non-data (waktu eksekusi, banner), buang baris itu dari kedua berkas dengan `grep -v` yang sama di semua perbandingan berikutnya (Task 3, 4, 10) dan catat pola `grep`-nya di pesan commit.

- [ ] **Step 6: Commit**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && git rev-parse --abbrev-ref HEAD
git add supabase/verifikasi/riwayat_hpp/
git commit -m "test(hpp): baseline nol pergeseran sebelum riwayat HPP (owner summary dasar <ms> ms)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tabel riwayat, rekonstruksi, trigger, RPC `ubah_hpp_menu`

**Files:**
- Create: `supabase/migrations/20260925150000_riwayat_hpp_menu.sql`
- Test: `supabase/verifikasi/riwayat_hpp/t1_tabel_rpc_trigger.sql`

**Interfaces:**
- Produces (dipakai Task 3, 4, 5–9):
  - Tabel `public.menu_hpp_riwayat(id uuid, menu_item_id uuid, kunci text, nilai numeric, berlaku_mulai date, sumber text, alasan text, dicatat_oleh uuid, dicatat_at timestamptz)`
  - `public.menu_hpp_pada(p_menu_item_id uuid, p_tanggal date DEFAULT NULL) RETURNS TABLE(hpp_override numeric, channel_hpp jsonb)`
  - `public.ubah_hpp_menu(p_menu_item_id uuid, p_perubahan jsonb, p_berlaku_mulai date DEFAULT NULL, p_alasan text DEFAULT NULL) RETURNS jsonb`
  - Kunci offline = `'hpp_override'`; kunci kanal = kunci `channel_hpp` apa adanya.

- [ ] **Step 1: Pra-cek data (nilai negatif/non-angka akan menggagalkan seed)**

Run:
```bash
supabase db query "SELECT count(*) FILTER (WHERE hpp_override < 0) AS override_negatif, (SELECT count(*) FROM menu_items m, jsonb_each(COALESCE(m.channel_hpp,'{}'::jsonb)) e WHERE jsonb_typeof(e.value) NOT IN ('number','string','null')) AS kanal_aneh, (SELECT count(*) FROM menu_items m, jsonb_each(COALESCE(m.channel_hpp,'{}'::jsonb)) e WHERE jsonb_typeof(e.value)='number' AND (e.value #>> '{}')::numeric < 0) AS kanal_negatif FROM menu_items;" --linked
```
Expected: ketiganya `0`. Kalau tidak, BERHENTI dan laporkan (jangan ubah data).

- [ ] **Step 2: Tulis uji `t1_tabel_rpc_trigger.sql` (akan gagal karena objek belum ada)**

```sql
-- supabase/verifikasi/riwayat_hpp/t1_tabel_rpc_trigger.sql — harapan: tanpa error, lalu 'T1 LULUS'
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_crew uuid; v_af uuid;
  v_m uuid; v_m2 uuid; v_old numeric; v_old2 numeric;
  v_hari_ini date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_d2 date := (now() AT TIME ZONE 'Asia/Jakarta')::date - 1;
  v_batas date;
  v_ok boolean; v_n int; v_h numeric; v_ch jsonb;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin'         AND status='active' LIMIT 1;
  SELECT id INTO v_crew  FROM outlet_staff WHERE role='crew'          AND status='active' LIMIT 1;
  SELECT id INTO v_af    FROM outlet_staff WHERE role='admin_finance' AND status='active' LIMIT 1;
  IF v_admin IS NULL OR v_crew IS NULL OR v_af IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture staf'; END IF;

  SELECT id, hpp_override INTO v_m, v_old FROM menu_items
   WHERE hpp_override > 0 AND NOT COALESCE(is_package,false) ORDER BY id LIMIT 1;
  SELECT id, hpp_override INTO v_m2, v_old2 FROM menu_items
   WHERE hpp_override > 0 AND NOT COALESCE(is_package,false) AND id <> v_m ORDER BY id LIMIT 1;
  IF v_m IS NULL OR v_m2 IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture menu'; END IF;
  v_batas := CASE WHEN EXTRACT(DAY FROM v_hari_ini) <= 10
                  THEN (date_trunc('month', v_hari_ini) - INTERVAL '1 month')::date
                  ELSE date_trunc('month', v_hari_ini)::date END;

  -- (a) seed: tiap menu punya baris hpp_override
  SELECT count(*) INTO v_n FROM menu_items m
   WHERE NOT EXISTS (SELECT 1 FROM menu_hpp_riwayat r WHERE r.menu_item_id=m.id AND r.kunci='hpp_override');
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (a): % menu tanpa seed', v_n; END IF;

  -- (b) nol pergeseran: rekonstruksi hari ini = menu_items, untuk SEMUA menu
  SELECT count(*) INTO v_n FROM menu_items m CROSS JOIN LATERAL menu_hpp_pada(m.id, v_hari_ini) h
   WHERE h.hpp_override IS DISTINCT FROM m.hpp_override
      OR h.channel_hpp IS DISTINCT FROM COALESCE((
           SELECT jsonb_object_agg(e.key, _hpp_nilai_json(e.value))
           FROM jsonb_each(COALESCE(m.channel_hpp,'{}'::jsonb)) e
           WHERE _hpp_nilai_json(e.value) IS NOT NULL), '{}'::jsonb);
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (b): % menu bergeser', v_n; END IF;

  -- (c) admin: ubah mundur ke kemarin
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM ubah_hpp_menu(v_m, jsonb_build_object('hpp_override', v_old + 1000), v_d2, 'uji t1');
  SELECT hpp_override INTO v_h FROM menu_hpp_pada(v_m, v_d2 - 1);
  IF v_h <> v_old THEN RAISE EXCEPTION 'GAGAL (c1): sehari sebelum = %, harap %', v_h, v_old; END IF;
  SELECT hpp_override INTO v_h FROM menu_hpp_pada(v_m, v_d2);
  IF v_h <> v_old + 1000 THEN RAISE EXCEPTION 'GAGAL (c2): tanggal berlaku = %', v_h; END IF;
  SELECT hpp_override INTO v_h FROM menu_items WHERE id = v_m;
  IF v_h <> v_old + 1000 THEN RAISE EXCEPTION 'GAGAL (c3): menu_items = %', v_h; END IF;

  -- (d) per kunci: perubahan kanal hari ini tidak menghidupkan lagi override lama
  PERFORM ubah_hpp_menu(v_m, '{"ss_online": 5000}'::jsonb, v_hari_ini, NULL);
  SELECT hpp_override, channel_hpp INTO v_h, v_ch FROM menu_hpp_pada(v_m, v_hari_ini);
  IF v_h <> v_old + 1000 OR (v_ch->>'ss_online')::numeric <> 5000 THEN
    RAISE EXCEPTION 'GAGAL (d): override %, kanal %', v_h, v_ch; END IF;
  SELECT channel_hpp INTO v_ch FROM menu_hpp_pada(v_m, v_d2);
  IF v_ch ? 'ss_online' AND (v_ch->>'ss_online')::numeric = 5000 THEN RAISE EXCEPTION 'GAGAL (d2): kanal bocor mundur'; END IF;

  -- (e) koreksi pada tanggal sama = satu baris
  PERFORM ubah_hpp_menu(v_m, jsonb_build_object('hpp_override', v_old + 2000), v_d2, NULL);
  SELECT count(*) INTO v_n FROM menu_hpp_riwayat WHERE menu_item_id=v_m AND kunci='hpp_override' AND berlaku_mulai=v_d2;
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL (e): % baris', v_n; END IF;

  -- (f) kontrol negatif sebagai admin
  v_ok := false; BEGIN PERFORM ubah_hpp_menu(v_m, '{"hpp_override": 1}'::jsonb, v_hari_ini + 1, NULL);
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f1): tanggal masa depan diterima'; END IF;
  v_ok := false; BEGIN PERFORM ubah_hpp_menu(v_m, '{"hpp_override": 1}'::jsonb, v_batas - 1, NULL);
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f2): tanggal sebelum batas diterima'; END IF;
  v_ok := false; BEGIN PERFORM ubah_hpp_menu(v_m, '{"hpp_override": -5}'::jsonb, v_hari_ini, NULL);
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f3): nilai negatif diterima'; END IF;
  v_ok := false; BEGIN PERFORM ubah_hpp_menu(v_m, '{"hpp_override": "abc"}'::jsonb, v_hari_ini, NULL);
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f4): teks diterima'; END IF;
  v_ok := false; BEGIN PERFORM ubah_hpp_menu(v_m, '{}'::jsonb, v_hari_ini, NULL);
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f5): objek kosong diterima'; END IF;
  RESET ROLE;

  -- (g) crew & admin_finance ditolak 42501
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false; BEGIN PERFORM ubah_hpp_menu(v_m, '{"hpp_override": 1}'::jsonb, v_hari_ini, NULL);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (g1): crew diterima'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_af, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false; BEGIN PERFORM ubah_hpp_menu(v_m, '{"hpp_override": 1}'::jsonb, v_hari_ini, NULL);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (g2): admin_finance diterima'; END IF;
  RESET ROLE;

  -- (h) trigger: tulis langsung → satu baris 'trigger' hari ini; jalur RPC tidak menghasilkan baris 'trigger'
  UPDATE menu_items SET hpp_override = v_old2 + 7 WHERE id = v_m2;
  SELECT count(*) INTO v_n FROM menu_hpp_riwayat
   WHERE menu_item_id=v_m2 AND kunci='hpp_override' AND berlaku_mulai=v_hari_ini AND sumber='trigger' AND nilai = v_old2 + 7;
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL (h1): % baris trigger', v_n; END IF;
  SELECT count(*) INTO v_n FROM menu_hpp_riwayat WHERE menu_item_id=v_m AND sumber='trigger';
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (h2): RPC tercatat ganda lewat trigger (%)', v_n; END IF;

  -- (i) anon tak bisa membaca riwayat
  SET LOCAL ROLE anon;
  v_ok := false; BEGIN PERFORM count(*) FROM menu_hpp_riwayat;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (i): anon bisa membaca riwayat'; END IF;
  RESET ROLE;
END $$;
SELECT 'T1 LULUS' AS hasil;
ROLLBACK;
```

- [ ] **Step 3: Jalankan uji, pastikan gagal**

Run: `supabase db query --linked -f supabase/verifikasi/riwayat_hpp/t1_tabel_rpc_trigger.sql`
Expected: ERROR `relation "menu_hpp_riwayat" does not exist` (atau fungsi tidak ada).

- [ ] **Step 4: Tulis migration `20260925150000_riwayat_hpp_menu.sql`**

```sql
-- Riwayat HPP menu dengan tanggal berlaku.
-- Spec: docs/superpowers/specs/2026-09-25-riwayat-hpp-override-design.md (§3, §4)
-- Satu baris = satu angka (kunci 'hpp_override' atau kunci channel_hpp) yang berlaku mulai tanggal WIB.
-- Seed '2000-01-01' = angka saat migration ini dijalankan, jadi laporan lama tidak bergeser.
BEGIN;

CREATE TABLE public.menu_hpp_riwayat (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id  uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  kunci         text NOT NULL CHECK (btrim(kunci) <> ''),
  nilai         numeric NULL CHECK (nilai IS NULL OR nilai >= 0),
  berlaku_mulai date NOT NULL,
  sumber        text NOT NULL CHECK (sumber IN ('awal', 'layar', 'trigger')),
  alasan        text NULL,
  dicatat_oleh  uuid NULL,
  dicatat_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_hpp_riwayat_unik UNIQUE (menu_item_id, kunci, berlaku_mulai)
);
CREATE INDEX menu_hpp_riwayat_cari ON public.menu_hpp_riwayat (menu_item_id, kunci, berlaku_mulai DESC);
COMMENT ON TABLE public.menu_hpp_riwayat IS
  'Riwayat HPP override & HPP per kanal menu. Nilai berlaku dari berlaku_mulai (WIB) sampai baris berikutnya untuk kunci yang sama. Tulis hanya lewat ubah_hpp_menu / trigger.';

ALTER TABLE public.menu_hpp_riwayat ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menu_hpp_riwayat FROM anon, authenticated;
GRANT SELECT ON public.menu_hpp_riwayat TO authenticated;
CREATE POLICY menu_hpp_riwayat_baca ON public.menu_hpp_riwayat
  FOR SELECT TO authenticated USING (true);

-- Nilai JSON channel_hpp → numeric (angka atau teks angka; selain itu NULL)
CREATE OR REPLACE FUNCTION public._hpp_nilai_json(p jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE jsonb_typeof(p)
           WHEN 'number' THEN (p #>> '{}')::numeric
           WHEN 'string' THEN NULLIF(btrim(p #>> '{}'), '')::numeric
           ELSE NULL
         END
$$;

-- Upsert satu angka riwayat. Internal: hanya dipanggil fungsi SECURITY DEFINER di bawah.
CREATE OR REPLACE FUNCTION public._hpp_catat(
  p_menu uuid, p_kunci text, p_nilai numeric, p_tgl date, p_sumber text, p_alasan text)
RETURNS void LANGUAGE sql SET search_path = public AS $$
  INSERT INTO public.menu_hpp_riwayat (menu_item_id, kunci, nilai, berlaku_mulai, sumber, alasan, dicatat_oleh)
  VALUES (p_menu, p_kunci, p_nilai, p_tgl, p_sumber, NULLIF(btrim(p_alasan), ''), auth.uid())
  ON CONFLICT (menu_item_id, kunci, berlaku_mulai) DO UPDATE
    SET nilai = EXCLUDED.nilai, sumber = EXCLUDED.sumber, alasan = EXCLUDED.alasan,
        dicatat_oleh = EXCLUDED.dicatat_oleh, dicatat_at = now();
$$;
REVOKE ALL ON FUNCTION public._hpp_catat(uuid, text, numeric, date, text, text) FROM PUBLIC, anon, authenticated;

-- Seed titik awal (K3): nilai apa adanya
INSERT INTO public.menu_hpp_riwayat (menu_item_id, kunci, nilai, berlaku_mulai, sumber)
SELECT m.id, 'hpp_override', m.hpp_override, DATE '2000-01-01', 'awal' FROM public.menu_items m;
INSERT INTO public.menu_hpp_riwayat (menu_item_id, kunci, nilai, berlaku_mulai, sumber)
SELECT m.id, e.key, public._hpp_nilai_json(e.value), DATE '2000-01-01', 'awal'
FROM public.menu_items m CROSS JOIN LATERAL jsonb_each(COALESCE(m.channel_hpp, '{}'::jsonb)) e;

-- Rekonstruksi nilai pada tanggal (WIB). p_tanggal NULL = hari ini.
CREATE OR REPLACE FUNCTION public.menu_hpp_pada(p_menu_item_id uuid, p_tanggal date DEFAULT NULL)
RETURNS TABLE (hpp_override numeric, channel_hpp jsonb)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH tgl AS (SELECT COALESCE(p_tanggal, (now() AT TIME ZONE 'Asia/Jakarta')::date) AS t),
  efektif AS (
    SELECT DISTINCT ON (r.kunci) r.kunci, r.nilai
    FROM public.menu_hpp_riwayat r, tgl
    WHERE r.menu_item_id = p_menu_item_id AND r.berlaku_mulai <= tgl.t
    ORDER BY r.kunci, r.berlaku_mulai DESC
  ),
  punya AS (
    SELECT EXISTS (SELECT 1 FROM public.menu_hpp_riwayat r WHERE r.menu_item_id = p_menu_item_id) AS ada
  )
  SELECT (SELECT e.nilai FROM efektif e WHERE e.kunci = 'hpp_override'),
         COALESCE((SELECT jsonb_object_agg(e.kunci, e.nilai) FROM efektif e
                   WHERE e.kunci <> 'hpp_override' AND e.nilai IS NOT NULL), '{}'::jsonb)
  FROM punya WHERE punya.ada
  UNION ALL
  SELECT m.hpp_override, m.channel_hpp
  FROM public.menu_items m, punya
  WHERE m.id = p_menu_item_id AND NOT punya.ada;
$$;
GRANT EXECUTE ON FUNCTION public.menu_hpp_pada(uuid, date) TO authenticated, service_role;

-- Gerbang nol pergeseran di dalam migration: rekonstruksi hari ini = menu_items untuk semua menu
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n
  FROM public.menu_items m CROSS JOIN LATERAL public.menu_hpp_pada(m.id, NULL) h
  WHERE h.hpp_override IS DISTINCT FROM m.hpp_override
     OR h.channel_hpp IS DISTINCT FROM COALESCE((
          SELECT jsonb_object_agg(e.key, public._hpp_nilai_json(e.value))
          FROM jsonb_each(COALESCE(m.channel_hpp, '{}'::jsonb)) e
          WHERE public._hpp_nilai_json(e.value) IS NOT NULL), '{}'::jsonb);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Seed riwayat HPP bergeser untuk % menu — migration dibatalkan', v_n;
  END IF;
END $$;

-- Jaring pengaman: tulisan langsung ke menu_items tetap meninggalkan jejak (berlaku hari ini)
CREATE OR REPLACE FUNCTION public.menu_hpp_catat_riwayat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tgl  date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_lama jsonb := '{}'::jsonb;
  v_baru jsonb := COALESCE(NEW.channel_hpp, '{}'::jsonb);
  v_kunci text;
BEGIN
  IF current_setting('app.hpp_via_rpc', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public._hpp_catat(NEW.id, 'hpp_override', NEW.hpp_override, DATE '2000-01-01', 'awal', NULL);
    FOR v_kunci IN SELECT jsonb_object_keys(v_baru) LOOP
      PERFORM public._hpp_catat(NEW.id, v_kunci, public._hpp_nilai_json(v_baru -> v_kunci), DATE '2000-01-01', 'awal', NULL);
    END LOOP;
    RETURN NEW;
  END IF;

  v_lama := COALESCE(OLD.channel_hpp, '{}'::jsonb);
  IF NEW.hpp_override IS DISTINCT FROM OLD.hpp_override THEN
    PERFORM public._hpp_catat(NEW.id, 'hpp_override', NEW.hpp_override, v_tgl, 'trigger', NULL);
  END IF;
  FOR v_kunci IN SELECT jsonb_object_keys(v_lama) UNION SELECT jsonb_object_keys(v_baru) LOOP
    IF (v_lama -> v_kunci) IS DISTINCT FROM (v_baru -> v_kunci) THEN
      PERFORM public._hpp_catat(NEW.id, v_kunci, public._hpp_nilai_json(v_baru -> v_kunci), v_tgl, 'trigger', NULL);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_menu_hpp_catat_riwayat
  AFTER INSERT OR UPDATE OF hpp_override, channel_hpp ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.menu_hpp_catat_riwayat();

-- Satu-satunya jalur tulis dari layar. Cek role DI SINI (guard halaman tidak melindungi).
CREATE OR REPLACE FUNCTION public.ubah_hpp_menu(
  p_menu_item_id uuid, p_perubahan jsonb, p_berlaku_mulai date DEFAULT NULL, p_alasan text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hari_ini date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_tgl      date := COALESCE(p_berlaku_mulai, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_batas    date;
  v_kunci    text;
  v_json     jsonb;
  v_nilai    numeric;
  v_hpp      numeric;
  v_ch       jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = auth.uid() AND s.role IN ('owner', 'admin') AND s.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh mengubah HPP menu' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.menu_items WHERE id = p_menu_item_id) THEN
    RAISE EXCEPTION 'Menu tidak ditemukan';
  END IF;
  IF p_perubahan IS NULL OR jsonb_typeof(p_perubahan) <> 'object' OR p_perubahan = '{}'::jsonb THEN
    RAISE EXCEPTION 'Perubahan HPP kosong';
  END IF;

  v_batas := CASE WHEN EXTRACT(DAY FROM v_hari_ini) <= 10
                  THEN (date_trunc('month', v_hari_ini) - INTERVAL '1 month')::date
                  ELSE date_trunc('month', v_hari_ini)::date END;
  IF v_tgl > v_hari_ini THEN
    RAISE EXCEPTION 'Tanggal berlaku % tidak boleh di masa depan', to_char(v_tgl, 'DD-MM-YYYY');
  END IF;
  IF v_tgl < v_batas THEN
    RAISE EXCEPTION 'Tanggal berlaku paling awal % (bulan lalu hanya bisa diubah sampai tanggal 10)',
      to_char(v_batas, 'DD-MM-YYYY');
  END IF;

  FOR v_kunci, v_json IN SELECT e.key, e.value FROM jsonb_each(p_perubahan) e LOOP
    IF btrim(v_kunci) = '' THEN
      RAISE EXCEPTION 'Kunci HPP kosong';
    END IF;
    IF jsonb_typeof(v_json) = 'null' THEN
      v_nilai := NULL;
    ELSIF jsonb_typeof(v_json) = 'number' THEN
      v_nilai := (v_json #>> '{}')::numeric;
    ELSE
      RAISE EXCEPTION 'Nilai HPP "%" harus angka atau null', v_kunci;
    END IF;
    IF v_nilai < 0 THEN
      RAISE EXCEPTION 'Nilai HPP "%" tidak boleh negatif', v_kunci;
    END IF;
    PERFORM public._hpp_catat(p_menu_item_id, v_kunci, v_nilai, v_tgl, 'layar', p_alasan);
  END LOOP;

  -- menu_items = angka yang berlaku HARI INI (perubahan mundur tak menimpa yang lebih baru)
  SELECT h.hpp_override, h.channel_hpp INTO v_hpp, v_ch FROM public.menu_hpp_pada(p_menu_item_id, v_hari_ini) h;
  PERFORM set_config('app.hpp_via_rpc', 'on', true);
  UPDATE public.menu_items SET hpp_override = v_hpp, channel_hpp = v_ch WHERE id = p_menu_item_id;
  PERFORM set_config('app.hpp_via_rpc', '', true);

  RETURN jsonb_build_object('hpp_override', v_hpp, 'channel_hpp', v_ch, 'berlaku_mulai', v_tgl);
END $$;
REVOKE ALL ON FUNCTION public.ubah_hpp_menu(uuid, jsonb, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ubah_hpp_menu(uuid, jsonb, date, text) TO authenticated, service_role;

COMMIT;
```

- [ ] **Step 5: Apply migration**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
supabase db query --linked -f supabase/migrations/20260925150000_riwayat_hpp_menu.sql
```
Expected: tanpa ERROR.

- [ ] **Step 6: Verifikasi katalog (bukan exit code)**

Run:
```bash
supabase db query "SELECT to_regclass('public.menu_hpp_riwayat') AS tabel, (SELECT count(*) FROM menu_hpp_riwayat) AS baris, (SELECT count(*) FROM pg_trigger WHERE tgname='trg_menu_hpp_catat_riwayat') AS trigger, (SELECT prosecdef FROM pg_proc WHERE proname='ubah_hpp_menu') AS rpc_definer, (SELECT count(*) FROM pg_policies WHERE tablename='menu_hpp_riwayat') AS policy, has_table_privilege('anon','public.menu_hpp_riwayat','SELECT') AS anon_baca;" --linked
```
Expected: `tabel` terisi, `baris` > 87, `trigger` 1, `rpc_definer` true, `policy` 1, `anon_baca` false.

- [ ] **Step 7: Jalankan uji t1**

Run: `supabase db query --linked -f supabase/verifikasi/riwayat_hpp/t1_tabel_rpc_trigger.sql`
Expected: `T1 LULUS`.

- [ ] **Step 8: Kontrol negatif uji (buktikan asersi bisa gagal)**

Salin t1 ke scratchpad, ubah asersi (c1) menjadi `IF v_h = v_old THEN RAISE EXCEPTION ...`, jalankan salinan itu.
Expected: ERROR `GAGAL (c1)`. Hapus salinan (jangan di-commit).

- [ ] **Step 9: Stempel riwayat migration + verifikasi**

```bash
supabase db query "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260925150000','riwayat_hpp_menu') ON CONFLICT (version) DO NOTHING;" --linked
supabase db query "SELECT version, name FROM supabase_migrations.schema_migrations WHERE version='20260925150000';" --linked
```
Expected: satu baris `20260925150000 | riwayat_hpp_menu`.

- [ ] **Step 10: Commit**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && git rev-parse --abbrev-ref HEAD
git add supabase/migrations/20260925150000_riwayat_hpp_menu.sql supabase/verifikasi/riwayat_hpp/t1_tabel_rpc_trigger.sql
git commit -m "feat(db): riwayat HPP menu per tanggal berlaku + RPC ubah_hpp_menu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Fungsi HPP mitra membaca HPP pada tanggal order

**Files:**
- Create: `supabase/migrations/20260925151000_hpp_mitra_per_tanggal.sql`
- Test: `supabase/verifikasi/riwayat_hpp/t2_mitra.sql`

**Interfaces:**
- Consumes: `menu_hpp_pada(uuid, date)`, `ubah_hpp_menu(...)` (Task 2).
- Produces: `get_mitra_item_hpp_base(uuid, text, date DEFAULT NULL)`, `get_mitra_item_hpp(uuid, text, date DEFAULT NULL)`, `get_mitra_item_hpp_by_name(text, text, date DEFAULT NULL)`; `get_mitra_orders_summary` (signature tetap) meneruskan tanggal WIB order.

- [ ] **Step 1: Cek tak ada objek yang bergantung pada fungsi lama**

Run:
```bash
supabase db query "SELECT d.classid::regclass, d.objid, d.refobjid::regprocedure FROM pg_depend d WHERE d.refobjid IN ('public.get_mitra_item_hpp_base(uuid,text)'::regprocedure,'public.get_mitra_item_hpp(uuid,text)'::regprocedure,'public.get_mitra_item_hpp_by_name(text,text)'::regprocedure) AND d.deptype='n';" --linked
```
Expected: 0 baris. Kalau ada, BERHENTI dan laporkan (DROP akan gagal).

- [ ] **Step 2: Tulis uji `t2_mitra.sql` (gagal sebelum migration: fungsi 3 argumen belum ada)**

```sql
-- supabase/verifikasi/riwayat_hpp/t2_mitra.sql — harapan: 'T2 LULUS'
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_m uuid; v_old numeric; v_nama text;
  v_p uuid; v_c uuid; v_c_old numeric; v_qty numeric;
  v_s uuid; v_s_old numeric;
  v_d2 date := (now() AT TIME ZONE 'Asia/Jakarta')::date - 1;
  v_d1 date := (now() AT TIME ZONE 'Asia/Jakarta')::date - 2;
  v_a numeric; v_b numeric;
  v_mitra uuid[]; v_sebelum numeric; v_sesudah numeric;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT array_agg(id) INTO v_mitra FROM outlets WHERE type='mitra';

  -- menu biasa: override > 0, tanpa HPP kanal, bukan komponen paket
  SELECT m.id, m.hpp_override, m.name INTO v_m, v_old, v_nama FROM menu_items m
   WHERE m.hpp_override > 0 AND NOT COALESCE(m.is_package,false) AND m.channel_hpp = '{}'::jsonb
     AND NOT EXISTS (SELECT 1 FROM menu_packages mp WHERE mp.menu_item_id = m.id)
     AND (SELECT count(*) FROM menu_items x WHERE lower(btrim(split_part(x.name,'|',1))) = lower(btrim(split_part(m.name,'|',1)))) = 1
   ORDER BY m.id LIMIT 1;
  -- paket tanpa override, komponen C ber-override
  SELECT p.id, mp.menu_item_id, c.hpp_override, COALESCE(mp.quantity,1) INTO v_p, v_c, v_c_old, v_qty
  FROM menu_items p JOIN menu_packages mp ON mp.package_id = p.id JOIN menu_items c ON c.id = mp.menu_item_id
  WHERE p.is_package AND COALESCE(p.hpp_override,0) = 0 AND p.channel_hpp = '{}'::jsonb
    AND c.hpp_override > 0 AND c.channel_hpp = '{}'::jsonb
    AND (SELECT count(*) FROM menu_packages x WHERE x.package_id = p.id AND x.menu_item_id = mp.menu_item_id) = 1
  ORDER BY p.id LIMIT 1;
  -- menu ber-HPP SS Online
  SELECT id, (channel_hpp->>'ss_online')::numeric INTO v_s, v_s_old FROM menu_items
   WHERE (channel_hpp->>'ss_online')::numeric > 0 ORDER BY id LIMIT 1;
  IF v_admin IS NULL OR v_m IS NULL OR v_p IS NULL OR v_s IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture'; END IF;

  SELECT COALESCE(sum(cogs),0) INTO v_sebelum FROM get_mitra_orders_summary(v_mitra,
    (v_d1::timestamp AT TIME ZONE 'Asia/Jakarta'), ((v_d1 + 1)::timestamp AT TIME ZONE 'Asia/Jakarta') - interval '1 millisecond');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM ubah_hpp_menu(v_m, jsonb_build_object('hpp_override', v_old + 1000), v_d2, 'uji t2');
  PERFORM ubah_hpp_menu(v_c, jsonb_build_object('hpp_override', v_c_old + 1000), v_d2, 'uji t2');
  PERFORM ubah_hpp_menu(v_s, jsonb_build_object('ss_online', v_s_old + 500), v_d2, 'uji t2');
  RESET ROLE;

  -- menu biasa
  v_a := get_mitra_item_hpp_base(v_m, NULL, v_d1); v_b := get_mitra_item_hpp_base(v_m, NULL, v_d2);
  IF v_a <> v_old OR v_b <> v_old + 1000 THEN RAISE EXCEPTION 'GAGAL (a): d1 % d2 %', v_a, v_b; END IF;
  IF get_mitra_item_hpp_base(v_m, NULL) <> v_old + 1000 THEN RAISE EXCEPTION 'GAGAL (a2): tanpa tanggal bukan hari ini'; END IF;
  IF get_mitra_item_hpp(v_m, NULL, v_d1) <> round(v_old * 1.10) THEN RAISE EXCEPTION 'GAGAL (b): markup d1'; END IF;
  IF get_mitra_item_hpp_by_name(v_nama, NULL, v_d1) <> round(v_old * 1.10) THEN RAISE EXCEPTION 'GAGAL (c): by_name d1'; END IF;

  -- paket: selisih d2 - d1 = qty komponen × 1000
  v_a := get_mitra_item_hpp_base(v_p, NULL, v_d1); v_b := get_mitra_item_hpp_base(v_p, NULL, v_d2);
  IF v_b - v_a <> v_qty * 1000 THEN RAISE EXCEPTION 'GAGAL (d): paket d1 % d2 % qty %', v_a, v_b, v_qty; END IF;

  -- kanal SS Online
  v_a := get_mitra_item_hpp_base(v_s, 'ss_online', v_d1); v_b := get_mitra_item_hpp_base(v_s, 'ss_online', v_d2);
  IF v_a <> v_s_old OR v_b <> v_s_old + 500 THEN RAISE EXCEPTION 'GAGAL (e): kanal d1 % d2 %', v_a, v_b; END IF;

  -- ringkasan mitra hari d1 TIDAK boleh berubah
  SELECT COALESCE(sum(cogs),0) INTO v_sesudah FROM get_mitra_orders_summary(v_mitra,
    (v_d1::timestamp AT TIME ZONE 'Asia/Jakarta'), ((v_d1 + 1)::timestamp AT TIME ZONE 'Asia/Jakarta') - interval '1 millisecond');
  IF v_sesudah <> v_sebelum THEN RAISE EXCEPTION 'GAGAL (f): cogs d1 bergeser % -> %', v_sebelum, v_sesudah; END IF;
END $$;
SELECT 'T2 LULUS' AS hasil;
ROLLBACK;
```

- [ ] **Step 3: Jalankan uji, pastikan gagal**

Run: `supabase db query --linked -f supabase/verifikasi/riwayat_hpp/t2_mitra.sql`
Expected: ERROR `function get_mitra_item_hpp_base(uuid, unknown, date) does not exist` (atau sejenis).

- [ ] **Step 4: Tulis migration `20260925151000_hpp_mitra_per_tanggal.sql`**

```sql
-- HPP mitra membaca HPP yang berlaku pada tanggal order (menu_hpp_pada).
-- Aturan HPP TIDAK diubah: channel_hpp → hpp_override > 0 → paket rekursif (komponen tanpa kanal).
-- ⚠️ Fungsi yang sama juga didefinisikan 20300125000000 (terurut SETELAH berkas ini): replay dari nol
-- akan memulihkan versi tanpa tanggal. Produksi aman (sudah terstempel). Lihat spec §6.
BEGIN;

DROP FUNCTION public.get_mitra_item_hpp_by_name(text, text);
DROP FUNCTION public.get_mitra_item_hpp(uuid, text);
DROP FUNCTION public.get_mitra_item_hpp_base(uuid, text);

CREATE FUNCTION public.get_mitra_item_hpp_base(p_menu_item_id uuid, p_channel text, p_tanggal date DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql STABLE AS $function$
  DECLARE
      v_base_hpp numeric := 0;
      v_is_package boolean;
      v_hpp_override numeric;
      v_channel_hpp jsonb;
      v_norm_ch text := lower(p_channel);
      v_ch_val numeric;
      v_pkg RECORD;
  BEGIN
      SELECT is_package INTO v_is_package FROM public.menu_items WHERE id = p_menu_item_id;
      IF NOT FOUND THEN
          RETURN 0;
      END IF;

      -- Nilai HPP yang berlaku pada tanggal order (NULL = hari ini)
      SELECT h.hpp_override, h.channel_hpp INTO v_hpp_override, v_channel_hpp
      FROM public.menu_hpp_pada(p_menu_item_id, p_tanggal) h;

      IF v_channel_hpp IS NOT NULL AND v_norm_ch IS NOT NULL THEN
          IF v_norm_ch IN ('ss-online', 'ss_online',
                           'f3305089-b9e4-4b92-95da-14bf6e7fb6d5',
                           'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584')
             OR v_norm_ch LIKE '%tiktok%' OR v_norm_ch LIKE '%shopee%' THEN
              v_ch_val := COALESCE(
                  (v_channel_hpp->>'ss_online')::numeric,
                  (v_channel_hpp->>'tiktok_shop')::numeric,
                  (v_channel_hpp->>'shopee_shop')::numeric,
                  (v_channel_hpp->>v_norm_ch)::numeric
              );
          ELSE
              v_ch_val := (v_channel_hpp->>v_norm_ch)::numeric;
          END IF;
      END IF;

      IF v_ch_val IS NOT NULL AND v_ch_val > 0 THEN
          v_base_hpp := v_ch_val;
      ELSIF v_hpp_override IS NOT NULL AND v_hpp_override > 0 THEN
          v_base_hpp := v_hpp_override;
      ELSIF v_is_package THEN
          -- Komponen paket selalu dihitung dari hpp_override bahan dasar (NULL channel)
          -- agar identik dengan useHpp.ts di Admin Dashboard (ProfitView)
          FOR v_pkg IN (
              SELECT menu_item_id, quantity
              FROM public.menu_packages
              WHERE package_id = p_menu_item_id
          ) LOOP
              v_base_hpp := v_base_hpp
                  + public.get_mitra_item_hpp_base(v_pkg.menu_item_id, NULL, p_tanggal)
                    * COALESCE(v_pkg.quantity, 1);
          END LOOP;
      END IF;

      RETURN v_base_hpp;
  END;
$function$;

CREATE FUNCTION public.get_mitra_item_hpp(p_menu_item_id uuid, p_channel text, p_tanggal date DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql STABLE AS $function$
DECLARE
    v_base numeric;
BEGIN
    v_base := public.get_mitra_item_hpp_base(p_menu_item_id, p_channel, p_tanggal);
    IF v_base > 0 THEN
        RETURN round(v_base * 1.10);
    END IF;
    RETURN 0;
END;
$function$;

CREATE FUNCTION public.get_mitra_item_hpp_by_name(p_name text, p_channel text, p_tanggal date DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql STABLE AS $function$
DECLARE
    v_id uuid;
    v_key text;
BEGIN
    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RETURN 0;
    END IF;

    v_key := lower(btrim(split_part(p_name, '|', 1)));
    IF v_key = '' THEN
        RETURN 0;
    END IF;

    SELECT m.id INTO v_id
    FROM public.menu_items m
    WHERE lower(btrim(split_part(m.name, '|', 1))) = v_key
    ORDER BY m.id
    LIMIT 1;

    IF v_id IS NULL THEN
        RETURN 0;
    END IF;

    RETURN public.get_mitra_item_hpp(v_id, p_channel, p_tanggal);
END;
$function$;

-- Grant disamakan dengan fungsi lama (termasuk anon — celah pre-existing, di luar cakupan; lihat spec §6)
GRANT EXECUTE ON FUNCTION public.get_mitra_item_hpp_base(uuid, text, date)  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_mitra_item_hpp(uuid, text, date)       TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_mitra_item_hpp_by_name(text, text, date) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_mitra_orders_summary(p_outlet_ids uuid[], p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS SETOF mitra_orders_summary_row
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH orders_filtered AS (
        SELECT
            o.id AS order_id,
            o.outlet_id,
            COALESCE(o.total_amount, 0)     AS total_amount,
            COALESCE(o.discount_amount, 0)  AS discount_amount,
            COALESCE(o.promo_subsidy, 0)    AS promo_subsidy,
            lower(COALESCE(o.channel, 'pos'))                  AS channel,
            lower(COALESCE(o.sales_source, o.channel, 'pos'))  AS src,
            (o.created_at AT TIME ZONE 'Asia/Jakarta')::date   AS tgl
        FROM public.orders o
        WHERE o.status = 'completed'
          AND o.outlet_id = ANY(p_outlet_ids)
          AND o.outlet_id != '00000000-0000-0000-0000-000000000000'
          AND o.created_at >= p_from
          AND o.created_at <= p_to
    ),
    order_agg AS (
        SELECT
            oi.order_id,
            SUM(oi.subtotal) AS item_value,
            COALESCE(SUM(
                oi.quantity * COALESCE(
                    NULLIF(public.get_mitra_item_hpp(oi.menu_item_id, of.channel, of.tgl), 0),
                    public.get_mitra_item_hpp_by_name(oi.menu_item_name, of.channel, of.tgl)
                )
            ), 0) AS order_cogs
        FROM public.order_items oi
        JOIN orders_filtered of ON oi.order_id = of.order_id
        GROUP BY oi.order_id
    ),
    calculated AS (
        SELECT
            of.outlet_id,
            of.total_amount,
            of.channel,
            of.src,
            COALESCE(oa.order_cogs, 0) AS order_cogs,
            -- Acuan tunggal Omzet Kotor
            CASE
                WHEN oa.item_value IS NULL
                    THEN of.discount_amount + of.promo_subsidy
                ELSE GREATEST(0, oa.item_value - of.total_amount)
            END AS deductions,
            of.total_amount + CASE
                WHEN oa.item_value IS NULL
                    THEN of.discount_amount + of.promo_subsidy
                ELSE GREATEST(0, oa.item_value - of.total_amount)
            END AS gross_rev,
            CASE
                WHEN of.src LIKE '%tiktok%' OR of.channel LIKE '%tiktok%'
                     OR of.channel = 'c9b01c9f-0e5b-462f-bba8-9a9b6525c5c8'
                     OR of.channel = 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5' THEN 'tiktok'
                WHEN of.src LIKE '%grab%' OR of.src LIKE '%gofood%' OR of.src LIKE '%go_food%'
                     OR of.src LIKE '%gojek%' OR of.src LIKE '%shopee%'
                     OR of.src IN ('food_delivery', 'food_apps', 'foodapps')
                     OR of.channel LIKE '%grab%' OR of.channel LIKE '%gofood%'
                     OR of.channel LIKE '%go_food%' OR of.channel LIKE '%gojek%'
                     OR of.channel LIKE '%shopee%'
                     OR of.channel IN ('food_delivery', 'food_apps', 'foodapps')
                     OR of.channel IN ('1284ac2a-e753-4380-9f32-59219a322459',
                                    '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a',
                                    '0eaf2746-da9f-492c-a9b4-f091307c98c2') THEN 'foodApps'
                ELSE 'pos'
            END AS channel_group,
            CASE WHEN (of.src LIKE '%grab%' OR of.channel LIKE '%grab%'
                       OR of.channel = '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a')
                      AND of.src NOT LIKE '%tiktok%' AND of.channel NOT LIKE '%tiktok%'
                 THEN of.total_amount ELSE 0 END AS grab_rev_val,
            CASE WHEN (of.src LIKE '%gofood%' OR of.src LIKE '%go_food%' OR of.src LIKE '%gojek%'
                       OR of.channel LIKE '%gofood%' OR of.channel LIKE '%go_food%'
                       OR of.channel LIKE '%gojek%'
                       OR of.channel = '1284ac2a-e753-4380-9f32-59219a322459')
                      AND of.src NOT LIKE '%tiktok%' AND of.channel NOT LIKE '%tiktok%'
                 THEN of.total_amount ELSE 0 END AS gofood_rev_val,
            CASE WHEN (of.src LIKE '%shopee%' OR of.channel LIKE '%shopee%'
                       OR of.channel = '0eaf2746-da9f-492c-a9b4-f091307c98c2')
                      AND of.src NOT LIKE '%tiktok%' AND of.channel NOT LIKE '%tiktok%'
                 THEN of.total_amount ELSE 0 END AS shopee_rev_val
        FROM orders_filtered of
        LEFT JOIN order_agg oa ON of.order_id = oa.order_id
    )
    SELECT
        c.outlet_id,
        c.channel_group,
        SUM(c.gross_rev)        AS gross_revenue,
        SUM(c.deductions)       AS deductions,
        SUM(c.order_cogs)       AS cogs,
        COUNT(*)::integer       AS order_count,
        SUM(c.grab_rev_val)     AS grab_rev,
        SUM(c.gofood_rev_val)   AS gofood_rev,
        SUM(c.shopee_rev_val)   AS shopee_rev
    FROM calculated c
    GROUP BY c.outlet_id, c.channel_group;
END;
$function$;

COMMIT;
```

- [ ] **Step 5: Apply + verifikasi katalog**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
supabase db query --linked -f supabase/migrations/20260925151000_hpp_mitra_per_tanggal.sql
supabase db query "SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.proacl::text, p.prosrc LIKE '%menu_hpp_pada%' OR p.prosrc LIKE '%p_tanggal%' OR p.prosrc LIKE '%of.tgl%' AS per_tanggal FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('get_mitra_item_hpp_base','get_mitra_item_hpp','get_mitra_item_hpp_by_name','get_mitra_orders_summary') ORDER BY 1;" --linked
```
Expected: tepat 4 baris (tak ada versi 2 argumen yang tersisa); ketiga fungsi item ber-argumen `..., p_tanggal date`; semua `per_tanggal` = true; `proacl` ketiga fungsi item memuat `anon`, `authenticated`, `service_role`.

- [ ] **Step 6: Jalankan uji t2**

Run: `supabase db query --linked -f supabase/verifikasi/riwayat_hpp/t2_mitra.sql`
Expected: `T2 LULUS`.

- [ ] **Step 7: Gerbang nol pergeseran mitra**

```bash
supabase db query --linked -f supabase/verifikasi/riwayat_hpp/baseline_mitra.sql > supabase/verifikasi/riwayat_hpp/baseline-sesudah-mitra.txt
diff supabase/verifikasi/riwayat_hpp/baseline-sebelum-mitra.txt supabase/verifikasi/riwayat_hpp/baseline-sesudah-mitra.txt && echo IDENTIK
```
Expected: `IDENTIK`. Kalau ada selisih, BERHENTI — jangan lanjut, laporkan baris yang berbeda.

- [ ] **Step 8: Stempel + commit**

```bash
supabase db query "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260925151000','hpp_mitra_per_tanggal') ON CONFLICT (version) DO NOTHING;" --linked
supabase db query "SELECT version, name FROM supabase_migrations.schema_migrations WHERE version='20260925151000';" --linked
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && git rev-parse --abbrev-ref HEAD
git add supabase/migrations/20260925151000_hpp_mitra_per_tanggal.sql supabase/verifikasi/riwayat_hpp/t2_mitra.sql supabase/verifikasi/riwayat_hpp/baseline-sesudah-mitra.txt
git commit -m "feat(db): HPP mitra memakai HPP yang berlaku pada tanggal order

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `get_owner_dashboard_summary` membaca HPP pada tanggal order

**Files:**
- Create: `supabase/migrations/20260925152000_owner_summary_hpp_per_tanggal.sql`
- Test: `supabase/verifikasi/riwayat_hpp/t3_owner_summary.sql`

**Interfaces:**
- Consumes: `menu_hpp_pada(uuid, date)`, `ubah_hpp_menu`.
- Produces: `get_owner_dashboard_summary` (signature & bentuk JSON keluaran tetap).

- [ ] **Step 1: Tulis uji `t3_owner_summary.sql`**

```sql
-- supabase/verifikasi/riwayat_hpp/t3_owner_summary.sql — harapan: 'T3 LULUS'
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_m uuid; v_old numeric;
  v_d2 date := (now() AT TIME ZONE 'Asia/Jakarta')::date - 1;
  v_d1 date := (now() AT TIME ZONE 'Asia/Jakarta')::date - 2;
  v_d1_dari timestamptz; v_d1_sampai timestamptz; v_d2_dari timestamptz; v_d2_sampai timestamptz;
  v_c1_sebelum numeric; v_c1_sesudah numeric; v_c2_sebelum numeric; v_c2_sesudah numeric; v_harap numeric;
BEGIN
  v_d1_dari := v_d1::timestamp AT TIME ZONE 'Asia/Jakarta';
  v_d1_sampai := (v_d1 + 1)::timestamp AT TIME ZONE 'Asia/Jakarta' - interval '1 millisecond';
  v_d2_dari := v_d2::timestamp AT TIME ZONE 'Asia/Jakarta';
  v_d2_sampai := (v_d2 + 1)::timestamp AT TIME ZONE 'Asia/Jakarta' - interval '1 millisecond';
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;

  -- menu terlaris yang terjual di d1 DAN d2, override > 0, bukan paket, bukan komponen paket
  SELECT m.id, m.hpp_override INTO v_m, v_old
  FROM menu_items m
  WHERE m.hpp_override > 0 AND NOT COALESCE(m.is_package,false)
    AND NOT EXISTS (SELECT 1 FROM menu_packages mp WHERE mp.menu_item_id = m.id)
    AND EXISTS (SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
                WHERE oi.menu_item_id = m.id AND o.status='completed' AND o.created_at BETWEEN v_d1_dari AND v_d1_sampai)
    AND EXISTS (SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
                WHERE oi.menu_item_id = m.id AND o.status='completed' AND o.created_at BETWEEN v_d2_dari AND v_d2_sampai)
  ORDER BY m.id LIMIT 1;
  IF v_admin IS NULL OR v_m IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture (butuh menu terjual kemarin & lusa)'; END IF;

  v_c1_sebelum := (get_owner_dashboard_summary(v_d1_dari, v_d1_sampai) ->> 'total_cogs')::numeric;
  v_c2_sebelum := (get_owner_dashboard_summary(v_d2_dari, v_d2_sampai) ->> 'total_cogs')::numeric;

  -- selisih yang diharapkan di d2: qty × (baru − lama), outlet mitra memakai ROUND(×1,1)
  SELECT COALESCE(SUM(COALESCE(oi.quantity,1) * CASE WHEN ot.type = 'mitra'
                        THEN ROUND((v_old + 1000) * 1.1) - ROUND(v_old * 1.1)
                        ELSE 1000 END), 0)
    INTO v_harap
  FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN outlets ot ON ot.id = o.outlet_id
  WHERE oi.menu_item_id = v_m AND o.status = 'completed' AND o.created_at BETWEEN v_d2_dari AND v_d2_sampai;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM ubah_hpp_menu(v_m, jsonb_build_object('hpp_override', v_old + 1000), v_d2, 'uji t3');
  RESET ROLE;

  v_c1_sesudah := (get_owner_dashboard_summary(v_d1_dari, v_d1_sampai) ->> 'total_cogs')::numeric;
  v_c2_sesudah := (get_owner_dashboard_summary(v_d2_dari, v_d2_sampai) ->> 'total_cogs')::numeric;

  IF v_c1_sesudah <> v_c1_sebelum THEN
    RAISE EXCEPTION 'GAGAL (a): cogs d1 bergeser % -> %', v_c1_sebelum, v_c1_sesudah; END IF;
  IF v_c2_sesudah - v_c2_sebelum <> v_harap THEN
    RAISE EXCEPTION 'GAGAL (b): selisih d2 %, harap %', v_c2_sesudah - v_c2_sebelum, v_harap; END IF;
  IF v_harap = 0 THEN RAISE EXCEPTION 'GAGAL (c): fixture tak menguji apa pun (selisih harapan 0)'; END IF;
END $$;
SELECT 'T3 LULUS' AS hasil;
ROLLBACK;
```

- [ ] **Step 2: Jalankan uji, pastikan gagal**

Run: `supabase db query --linked -f supabase/verifikasi/riwayat_hpp/t3_owner_summary.sql`
Expected: ERROR `GAGAL (a): cogs d1 bergeser` (fungsi lama memakai angka hari ini untuk semua tanggal).

- [ ] **Step 3: Tulis migration `20260925152000_owner_summary_hpp_per_tanggal.sql`**

Isi = definisi live saat ini (diambil 2026-09-25) dengan **hanya** CTE 3 dan 5 diganti. Salin persis:

```sql
-- Owner Dashboard: HPP per item diambil dari HPP yang berlaku pada tanggal order (menu_hpp_pada).
-- Aturan HPP TIDAK diubah: hpp_override > 0, selain itu paket = Σ hpp_override komponen, selain itu 0;
-- outlet mitra ROUND(×1,1). channel_hpp tetap TIDAK dipakai di sini (sama seperti sebelumnya).
-- Pasangan (menu, tanggal) dikumpulkan dulu, baru diberi HPP — jangan panggil menu_hpp_pada per baris item.
-- ⚠️ Fungsi yang sama juga didefinisikan 20300116000000 (terurut SETELAH berkas ini). Lihat spec §6.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_owner_dashboard_summary(p_from timestamp with time zone, p_to timestamp with time zone, p_outlet_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'all'::text, p_test_outlet_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
  v_user_role TEXT;
  v_has_full_access BOOLEAN := FALSE;
  v_mitra_outlet_ids UUID[];
BEGIN
  -- 1. Cek hak akses pemanggil secara efisien
  IF auth.uid() IS NULL THEN
    v_has_full_access := TRUE;
  ELSE
    SELECT role INTO v_user_role
    FROM public.outlet_staff
    WHERE id = auth.uid();

    IF v_user_role IN ('admin', 'admin_hr', 'owner', 'spv', 'kitchen') THEN
      v_has_full_access := TRUE;
    END IF;
  END IF;

  -- 2. Ambil daftar ID outlet mitra sekaligus (hanya ~10 baris, hindari repeated join)
  SELECT COALESCE(array_agg(id), '{}') INTO v_mitra_outlet_ids
  FROM public.outlets
  WHERE type = 'mitra';

  WITH
  -- 4. Filtered orders (fast-path inlining untuk deteksi sumber penjualan & index bypass)
  ord AS (
    SELECT
      o.id,
      o.outlet_id,
      o.total_amount,
      o.discount_amount,
      o.promo_subsidy,
      CASE
        WHEN o.is_endorse THEN 'endors'
        WHEN o.channel IS NULL OR o.channel = '' THEN lower(COALESCE(o.sales_source, 'pos'))
        WHEN o.channel = 'endorse' OR o.channel = 'endors' THEN 'endors'
        WHEN o.channel = 'shopeefood' THEN 'shopeefood'
        WHEN o.channel = 'tiktokgo' THEN 'tiktok'
        WHEN o.channel = 'grabfood' THEN 'grabfood'
        WHEN o.channel = 'gofood' THEN 'gofood'
        WHEN o.channel IN ('website', 'online', 'web') THEN 'online'
        ELSE public.resolve_sales_source(o.channel, o.sales_source)
      END AS src_key,
      (o.created_at AT TIME ZONE 'Asia/Jakarta')::date AS local_date,
      EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Asia/Jakarta'))::int AS local_hour,
      (o.outlet_id = ANY(v_mitra_outlet_ids)) AS is_mitra
    FROM public.orders o
    WHERE o.status = 'completed'
      AND o.created_at >= p_from
      AND o.created_at <= p_to
      AND (v_has_full_access OR o.outlet_id IN (SELECT accessible_outlet_ids()))
      AND (p_test_outlet_id IS NULL OR o.outlet_id <> p_test_outlet_id)
      AND (p_outlet_id IS NULL OR o.outlet_id = p_outlet_id)
      AND (
        p_source = 'all'
        OR CASE
             WHEN o.is_endorse THEN 'endors'
             WHEN o.channel IS NULL OR o.channel = '' THEN lower(COALESCE(o.sales_source, 'pos'))
             WHEN o.channel = 'endorse' OR o.channel = 'endors' THEN 'endors'
             WHEN o.channel = 'shopeefood' THEN 'shopeefood'
             WHEN o.channel = 'tiktokgo' THEN 'tiktok'
             WHEN o.channel = 'grabfood' THEN 'grabfood'
             WHEN o.channel = 'gofood' THEN 'gofood'
             WHEN o.channel IN ('website', 'online', 'web') THEN 'online'
             ELSE public.resolve_sales_source(o.channel, o.sales_source)
           END = p_source
      )
  ),

  -- 5a. Item terjual, dibaca SEKALI
  items_raw AS MATERIALIZED (
    SELECT
      oi.order_id,
      oi.menu_item_id,
      oi.quantity,
      oi.subtotal,
      oi.menu_item_name,
      oi.is_promo_reward,
      ord.is_mitra,
      ord.local_date
    FROM ord
    JOIN public.order_items oi ON oi.order_id = ord.id
  ),

  -- 3. HPP per (menu, tanggal) yang benar-benar terjual — dari riwayat, bukan angka hari ini
  menu_tgl AS (
    SELECT DISTINCT ir.menu_item_id, ir.local_date
    FROM items_raw ir
    WHERE ir.menu_item_id IS NOT NULL
  ),
  menu_hpp AS MATERIALIZED (
    SELECT
      mt.menu_item_id AS id,
      mt.local_date,
      COALESCE(
        CASE WHEN h.hpp_override > 0 THEN h.hpp_override
             WHEN m.is_package THEN (
               SELECT SUM(COALESCE(hc.hpp_override, 0) * COALESCE(mp.quantity, 1))
               FROM public.menu_packages mp
               JOIN public.menu_items comp ON comp.id = mp.menu_item_id
               CROSS JOIN LATERAL public.menu_hpp_pada(mp.menu_item_id, mt.local_date) hc
               WHERE mp.package_id = m.id
             )
             ELSE 0
        END, 0
      ) AS unit_hpp
    FROM menu_tgl mt
    JOIN public.menu_items m ON m.id = mt.menu_item_id
    CROSS JOIN LATERAL public.menu_hpp_pada(mt.menu_item_id, mt.local_date) h
  ),

  -- 5. Items joined once with pre-calculated HPP
  items AS (
    SELECT
      ir.order_id,
      ir.quantity,
      ir.subtotal,
      trim(split_part(ir.menu_item_name, '|', 1)) AS menu_name,
      COALESCE(
        CASE WHEN ir.is_mitra
             THEN ROUND(mh.unit_hpp * 1.1)
             ELSE mh.unit_hpp
        END, 0
      ) * COALESCE(ir.quantity, 1) AS item_cogs,
      COALESCE(ir.is_promo_reward, false) AS is_promo_reward
    FROM items_raw ir
    LEFT JOIN menu_hpp mh ON mh.id = ir.menu_item_id AND mh.local_date = ir.local_date
  ),

  -- 6. Order-level subtotals for deduction & quantity
  order_totals AS (
    SELECT
      it.order_id,
      SUM(it.subtotal) AS total_subtotal,
      SUM(it.quantity) AS total_quantity
    FROM items it
    GROUP BY it.order_id
  ),

  -- 7. KPI aggregation
  kpi_agg AS (
    SELECT
      o.outlet_id,
      o.src_key AS sales_source,
      o.local_date AS sales_date,
      SUM(o.total_amount) AS omzet,
      COUNT(*) AS order_count,
      COALESCE(SUM(ot.total_quantity), 0) AS total_qty,
      SUM(
        CASE
          WHEN ot.total_subtotal IS NULL
            THEN COALESCE(o.discount_amount, 0) + COALESCE(o.promo_subsidy, 0)
          ELSE GREATEST(0, ot.total_subtotal - COALESCE(o.total_amount, 0))
        END
      ) AS total_deductions
    FROM ord o
    LEFT JOIN order_totals ot ON ot.order_id = o.id
    GROUP BY o.outlet_id, o.src_key, o.local_date
  ),

  -- 8. Hourly aggregation
  hourly_agg AS (
    SELECT
      o.local_hour AS sales_hour,
      SUM(o.total_amount) AS omzet,
      COUNT(*) AS order_count
    FROM ord o
    GROUP BY o.local_hour
  ),

  -- 9. Menu aggregation
  menu_agg AS (
    SELECT
      it.menu_name,
      SUM(it.quantity) AS qty,
      SUM(it.subtotal) AS revenue
    FROM items it
    WHERE it.menu_name IS NOT NULL AND it.menu_name <> ''
    GROUP BY it.menu_name
  ),

  -- 10. Totals (COGS & BOGO)
  totals_agg AS (
    SELECT
      COALESCE(SUM(it.item_cogs), 0) AS total_cogs,
      COUNT(DISTINCT CASE WHEN it.is_promo_reward THEN it.order_id END) AS bogo_transactions,
      COALESCE(SUM(CASE WHEN it.is_promo_reward THEN it.quantity ELSE 0 END), 0) AS bogo_gift_units
    FROM items it
  ),

  -- 11. OPEX aggregation
  opex_agg AS (
    SELECT
      COALESCE((
        SELECT SUM(e.amount)
        FROM public.expenses e
        WHERE e.expense_date >= (p_from AT TIME ZONE 'Asia/Jakarta')::date
          AND e.expense_date <= (p_to   AT TIME ZONE 'Asia/Jakarta')::date
          AND (v_has_full_access OR e.outlet_id IN (SELECT accessible_outlet_ids()))
          AND (p_test_outlet_id IS NULL OR e.outlet_id <> p_test_outlet_id)
          AND (p_outlet_id IS NULL OR e.outlet_id = p_outlet_id)
      ), 0) +
      COALESCE((
        SELECT SUM(pce.amount)
        FROM public.petty_cash_expenses pce
        WHERE pce.expense_date >= (p_from AT TIME ZONE 'Asia/Jakarta')::date
          AND pce.expense_date <= (p_to   AT TIME ZONE 'Asia/Jakarta')::date
          AND (v_has_full_access OR pce.outlet_id IN (SELECT accessible_outlet_ids()))
          AND (p_test_outlet_id IS NULL OR pce.outlet_id <> p_test_outlet_id)
          AND (p_outlet_id IS NULL OR pce.outlet_id = p_outlet_id)
      ), 0) AS total_opex
  )

  SELECT jsonb_build_object(
    'kpi_rows',          COALESCE((SELECT jsonb_agg(row_to_json(k)) FROM kpi_agg k), '[]'::jsonb),
    'hourly_rows',       COALESCE((SELECT jsonb_agg(row_to_json(h) ORDER BY h.sales_hour) FROM hourly_agg h), '[]'::jsonb),
    'menu_rows',         COALESCE((SELECT jsonb_agg(row_to_json(m) ORDER BY m.revenue DESC) FROM menu_agg m), '[]'::jsonb),
    'total_cogs',        (SELECT total_cogs FROM totals_agg),
    'total_opex',        (SELECT total_opex FROM opex_agg),
    'bogo_transactions', (SELECT bogo_transactions FROM totals_agg),
    'bogo_gift_units',   (SELECT bogo_gift_units FROM totals_agg)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

COMMIT;
```

- [ ] **Step 4: Apply + verifikasi katalog**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
supabase db query --linked -f supabase/migrations/20260925152000_owner_summary_hpp_per_tanggal.sql
supabase db query "SELECT prosecdef, prosrc LIKE '%menu_hpp_pada%' AS per_tanggal, proacl::text FROM pg_proc WHERE proname='get_owner_dashboard_summary';" --linked
```
Expected: `prosecdef` true, `per_tanggal` true, `proacl` tanpa `anon` dan tanpa `=X` (sama seperti sebelumnya: postgres, authenticated, service_role).

- [ ] **Step 5: Jalankan uji t3**

Run: `supabase db query --linked -f supabase/verifikasi/riwayat_hpp/t3_owner_summary.sql`
Expected: `T3 LULUS`.

- [ ] **Step 6: Gerbang nol pergeseran owner + waktu**

```bash
supabase db query --linked -f supabase/verifikasi/riwayat_hpp/baseline_owner.sql > supabase/verifikasi/riwayat_hpp/baseline-sesudah-owner.txt
diff supabase/verifikasi/riwayat_hpp/baseline-sebelum-owner.txt supabase/verifikasi/riwayat_hpp/baseline-sesudah-owner.txt && echo IDENTIK
supabase db query --linked -f supabase/verifikasi/riwayat_hpp/ukur_waktu.sql
```
Expected: `IDENTIK`; `ms` terkecil < 1500 dan tidak lebih dari 2× angka dasar Task 1. Kalau `diff` berbeda → BERHENTI, rollback fungsi dengan menerapkan ulang definisi lama (ambil dari `supabase/migrations/20260911140100_omzet_kotor_acuan_tunggal.sql` bagian `get_owner_dashboard_summary`, cocokkan dengan definisi di plan ini sebelum CTE 3/5 diubah) dan laporkan.

- [ ] **Step 7: Stempel + commit**

```bash
supabase db query "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260925152000','owner_summary_hpp_per_tanggal') ON CONFLICT (version) DO NOTHING;" --linked
supabase db query "SELECT version, name FROM supabase_migrations.schema_migrations WHERE version='20260925152000';" --linked
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && git rev-parse --abbrev-ref HEAD
git add supabase/migrations/20260925152000_owner_summary_hpp_per_tanggal.sql supabase/verifikasi/riwayat_hpp/t3_owner_summary.sql supabase/verifikasi/riwayat_hpp/baseline-sesudah-owner.txt
git commit -m "feat(db): Owner Dashboard memakai HPP yang berlaku pada tanggal order

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Helper TypeScript riwayat HPP + batas tanggal

**Files:**
- Create: `apps/admin-dashboard/src/lib/hpp/riwayatHpp.ts`
- Create: `apps/admin-dashboard/src/lib/hpp/riwayatHpp.test.ts`
- Create: `apps/admin-dashboard/src/lib/hpp/batasBerlakuHpp.ts`
- Create: `apps/admin-dashboard/src/lib/hpp/batasBerlakuHpp.test.ts`
- Create: `apps/finance/src/lib/hpp/riwayatHpp.ts` (salinan identik)
- Create: `apps/manager/src/lib/hpp/batasBerlakuHpp.ts` (salinan identik)

**Interfaces:**
- Produces (dipakai Task 6–9):
  - `ambilRiwayatHpp(supabase: { from: (t: string) => any }): Promise<BarisRiwayatHpp[]>`
  - `ambilVersiRiwayatHpp(supabase): Promise<string>` — `dicatat_at` terbaru (ISO) atau `'kosong'`
  - `tanggalWib(waktu: string | Date): string` — `'YYYY-MM-DD'`
  - `nilaiHppPada(indeks: IndeksRiwayatHpp, menuId: string, tgl: string): NilaiHpp | null`
  - `buatPenerapRiwayat(menus: any[], rows: BarisRiwayatHpp[], kunciNama: (nama: string) => string): { untuk(tgl: string): PenerapHpp }`
  - `PenerapHpp = { terapkan<T>(menu: T): T; byId: Map<string, any>; byName: Map<string, any> }`
  - `hariIniWib(): string`, `batasAwalBerlaku(hariIni: string): string`

- [ ] **Step 1: Tulis test `riwayatHpp.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  tanggalWib,
  indeksRiwayat,
  nilaiHppPada,
  buatPenerapRiwayat,
  type BarisRiwayatHpp,
} from './riwayatHpp'

const AWAL = '2000-01-01'
const baris = (menu_item_id: string, kunci: string, nilai: number | null, berlaku_mulai: string): BarisRiwayatHpp =>
  ({ menu_item_id, kunci, nilai, berlaku_mulai })

describe('tanggalWib', () => {
  it('memakai zona Asia/Jakarta, bukan UTC', () => {
    expect(tanggalWib('2026-09-18T16:59:59Z')).toBe('2026-09-18')
    expect(tanggalWib('2026-09-18T17:00:00Z')).toBe('2026-09-19')
    expect(tanggalWib(new Date('2026-09-18T23:30:00+07:00'))).toBe('2026-09-18')
  })
})

describe('nilaiHppPada', () => {
  const indeks = indeksRiwayat([
    baris('m1', 'hpp_override', 20000, AWAL),
    baris('m1', 'hpp_override', 22000, '2026-09-19'),
    baris('m1', 'ss_online', 25000, AWAL),
    baris('m1', 'gofood', 30000, '2026-09-22'),
    baris('m1', 'ss_online', null, '2026-09-23'),
  ])

  it('memakai nilai terakhir yang berlaku pada tanggal itu', () => {
    expect(nilaiHppPada(indeks, 'm1', '2026-09-18')?.hpp_override).toBe(20000)
    expect(nilaiHppPada(indeks, 'm1', '2026-09-19')?.hpp_override).toBe(22000)
    expect(nilaiHppPada(indeks, 'm1', '2026-09-30')?.hpp_override).toBe(22000)
  })

  it('kunci kanal yang baru ditambah tidak berlaku mundur', () => {
    expect(nilaiHppPada(indeks, 'm1', '2026-09-21')?.channel_hpp).toEqual({ ss_online: 25000 })
    expect(nilaiHppPada(indeks, 'm1', '2026-09-22')?.channel_hpp).toEqual({ ss_online: 25000, gofood: 30000 })
  })

  it('kunci yang direset (null) hilang sejak tanggal berlakunya', () => {
    expect(nilaiHppPada(indeks, 'm1', '2026-09-23')?.channel_hpp).toEqual({ gofood: 30000 })
  })

  it('perubahan satu kunci tidak menghidupkan lagi nilai lama kunci lain', () => {
    expect(nilaiHppPada(indeks, 'm1', '2026-09-22')?.hpp_override).toBe(22000)
  })

  it('menu tanpa riwayat → null', () => {
    expect(nilaiHppPada(indeks, 'tidak-ada', '2026-09-22')).toBeNull()
  })

  it('nilai teks dari PostgREST dikonversi ke angka', () => {
    const i = indeksRiwayat([{ menu_item_id: 'm2', kunci: 'hpp_override', nilai: '15000', berlaku_mulai: AWAL }])
    expect(nilaiHppPada(i, 'm2', '2026-09-01')?.hpp_override).toBe(15000)
  })
})

describe('buatPenerapRiwayat', () => {
  const komponen = { id: 'c1', hpp_override: 5000, channel_hpp: {} }
  const paket = {
    id: 'p1', name: 'Paket Duo', hpp_override: null, channel_hpp: {}, is_package: true,
    package_items: [{ quantity: 2, component: komponen }],
  }
  const menu = { id: 'm1', name: 'Original Sapi Jumbo', hpp_override: 20000, channel_hpp: {}, is_package: false }
  const rows = [
    baris('m1', 'hpp_override', 20000, AWAL),
    baris('m1', 'hpp_override', 22000, '2026-09-19'),
    baris('c1', 'hpp_override', 5000, AWAL),
    baris('c1', 'hpp_override', 6000, '2026-09-19'),
    baris('p1', 'hpp_override', null, AWAL),
  ]
  const penerap = buatPenerapRiwayat([menu, paket, komponen], rows, (n) => n.toLowerCase())

  it('menimpa nilai HPP menu dengan nilai pada tanggal', () => {
    expect(penerap.untuk('2026-09-18').byId.get('m1').hpp_override).toBe(20000)
    expect(penerap.untuk('2026-09-19').byId.get('m1').hpp_override).toBe(22000)
  })

  it('komponen paket ikut ditimpa per tanggal', () => {
    const p18 = penerap.untuk('2026-09-18').byId.get('p1')
    const p19 = penerap.untuk('2026-09-19').byId.get('p1')
    expect(p18.package_items[0].component.hpp_override).toBe(5000)
    expect(p19.package_items[0].component.hpp_override).toBe(6000)
    expect(p19.package_items[0].quantity).toBe(2)
  })

  it('byName memakai kunci nama yang diberikan', () => {
    expect(penerap.untuk('2026-09-19').byName.get('original sapi jumbo').hpp_override).toBe(22000)
  })

  it('terapkan objek hasil join lain (bukan dari daftar menu) tetap ditimpa lewat id', () => {
    const hasilJoin = { id: 'm1', hpp_override: 20000, channel_hpp: {} }
    expect(penerap.untuk('2026-09-19').terapkan(hasilJoin).hpp_override).toBe(22000)
    expect(hasilJoin.hpp_override).toBe(20000) // tidak memutasi objek asal
  })

  it('objek tanpa id atau tanpa riwayat dikembalikan dengan nilai apa adanya', () => {
    const tanpaId = { hpp_override: 1234 }
    expect(penerap.untuk('2026-09-19').terapkan(tanpaId).hpp_override).toBe(1234)
    const tanpaRiwayat = { id: 'lain', hpp_override: 999, channel_hpp: {} }
    expect(penerap.untuk('2026-09-19').terapkan(tanpaRiwayat).hpp_override).toBe(999)
    expect(penerap.untuk('2026-09-19').terapkan(null)).toBeNull()
  })

  it('hasil per tanggal di-cache', () => {
    expect(penerap.untuk('2026-09-19')).toBe(penerap.untuk('2026-09-19'))
  })

  it('objek dari daftar menu diambil dari cache byId (identik)', () => {
    const p = penerap.untuk('2026-09-19')
    expect(p.terapkan(menu)).toBe(p.byId.get('m1'))
  })
})
```

- [ ] **Step 2: Tulis test `batasBerlakuHpp.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { batasAwalBerlaku } from './batasBerlakuHpp'

describe('batasAwalBerlaku', () => {
  it('tanggal 1–10: boleh mundur ke tanggal 1 bulan lalu', () => {
    expect(batasAwalBerlaku('2026-10-10')).toBe('2026-09-01')
    expect(batasAwalBerlaku('2026-10-01')).toBe('2026-09-01')
  })
  it('setelah tanggal 10: hanya bulan berjalan', () => {
    expect(batasAwalBerlaku('2026-10-11')).toBe('2026-10-01')
    expect(batasAwalBerlaku('2026-09-25')).toBe('2026-09-01')
  })
  it('Januari mundur ke Desember tahun lalu', () => {
    expect(batasAwalBerlaku('2027-01-05')).toBe('2026-12-01')
  })
})
```

- [ ] **Step 3: Jalankan test, pastikan gagal**

Run: `cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn vitest run src/lib/hpp`
Expected: FAIL — `Failed to resolve import "./riwayatHpp"`.

- [ ] **Step 4: Tulis `riwayatHpp.ts`**

```ts
/**
 * Riwayat HPP menu dengan tanggal berlaku (tabel `menu_hpp_riwayat`).
 *
 * Laporan dulu membaca `menu_items.hpp_override` / `channel_hpp` — angka HARI INI —
 * untuk penjualan tanggal berapa pun, sehingga mengganti HPP di tengah bulan
 * menggeser HPP seluruh bulan. Modul ini merekonstruksi nilai yang berlaku pada
 * tanggal order dan menimpakannya ke objek menu, supaya fungsi `getItemHpp` tiap
 * laporan tetap dipakai apa adanya (aturan HPP-nya sengaja tidak disatukan).
 *
 * Aturan rekonstruksi sama dengan `public.menu_hpp_pada` di DB:
 * per kunci, baris dengan berlaku_mulai terbesar yang <= tanggal; kunci tanpa
 * baris seperti itu = tidak ada; nilai null = kunci direset.
 * Spec: docs/superpowers/specs/2026-09-25-riwayat-hpp-override-design.md
 */

export const KUNCI_HPP_OVERRIDE = 'hpp_override'

export interface BarisRiwayatHpp {
  menu_item_id: string
  kunci: string
  nilai: number | string | null
  berlaku_mulai: string
}

export interface NilaiHpp {
  hpp_override: number | null
  channel_hpp: Record<string, number>
}

type Titik = { tgl: string; nilai: number | null }
export type IndeksRiwayatHpp = Map<string, Map<string, Titik[]>>

export interface PenerapHpp {
  terapkan<T>(menu: T): T
  byId: Map<string, any>
  byName: Map<string, any>
}

type KlienBaca = { from: (tabel: string) => any }

const FORMAT_WIB = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function tanggalWib(waktu: string | Date): string {
  return FORMAT_WIB.format(typeof waktu === 'string' ? new Date(waktu) : waktu)
}

/** Semua baris riwayat. Gagal = lempar error — jangan diam-diam memakai angka hari ini. */
export async function ambilRiwayatHpp(supabase: KlienBaca): Promise<BarisRiwayatHpp[]> {
  const UKURAN = 1000
  const semua: BarisRiwayatHpp[] = []
  for (let dari = 0; ; dari += UKURAN) {
    const { data, error } = await supabase
      .from('menu_hpp_riwayat')
      .select('menu_item_id, kunci, nilai, berlaku_mulai')
      .order('id', { ascending: true })
      .range(dari, dari + UKURAN - 1)
    if (error) throw new Error(`Gagal memuat riwayat HPP: ${error.message}`)
    const halaman = (data ?? []) as BarisRiwayatHpp[]
    semua.push(...halaman)
    if (halaman.length < UKURAN) return semua
  }
}

/** Penanda versi untuk kunci cache: berubah setiap kali ada perubahan HPP. */
export async function ambilVersiRiwayatHpp(supabase: KlienBaca): Promise<string> {
  const { data, error } = await supabase
    .from('menu_hpp_riwayat')
    .select('dicatat_at')
    .order('dicatat_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(`Gagal memuat versi riwayat HPP: ${error.message}`)
  return (data?.[0]?.dicatat_at as string | undefined) ?? 'kosong'
}

export function indeksRiwayat(rows: BarisRiwayatHpp[]): IndeksRiwayatHpp {
  const indeks: IndeksRiwayatHpp = new Map()
  for (const r of rows) {
    let perKunci = indeks.get(r.menu_item_id)
    if (!perKunci) {
      perKunci = new Map()
      indeks.set(r.menu_item_id, perKunci)
    }
    let titik = perKunci.get(r.kunci)
    if (!titik) {
      titik = []
      perKunci.set(r.kunci, titik)
    }
    titik.push({
      tgl: String(r.berlaku_mulai).slice(0, 10),
      nilai: r.nilai === null || r.nilai === undefined ? null : Number(r.nilai),
    })
  }
  for (const perKunci of indeks.values()) {
    for (const titik of perKunci.values()) titik.sort((a, b) => a.tgl.localeCompare(b.tgl))
  }
  return indeks
}

export function nilaiHppPada(indeks: IndeksRiwayatHpp, menuId: string, tgl: string): NilaiHpp | null {
  const perKunci = indeks.get(menuId)
  if (!perKunci) return null
  let hpp_override: number | null = null
  const channel_hpp: Record<string, number> = {}
  for (const [kunci, titik] of perKunci) {
    let nilai: number | null | undefined
    for (const t of titik) {
      if (t.tgl <= tgl) nilai = t.nilai
      else break
    }
    if (nilai === undefined) continue
    if (kunci === KUNCI_HPP_OVERRIDE) hpp_override = nilai
    else if (nilai !== null) channel_hpp[kunci] = nilai
  }
  return { hpp_override, channel_hpp }
}

function timpa<T>(menu: T, indeks: IndeksRiwayatHpp, tgl: string): T {
  const m = menu as any
  if (!m || typeof m !== 'object') return menu
  const v = typeof m.id === 'string' ? nilaiHppPada(indeks, m.id, tgl) : null
  const salinan: any = v ? { ...m, hpp_override: v.hpp_override, channel_hpp: v.channel_hpp } : { ...m }
  if (Array.isArray(m.package_items)) {
    salinan.package_items = m.package_items.map((p: any) =>
      p && p.component ? { ...p, component: timpa(p.component, indeks, tgl) } : p,
    )
  }
  return salinan as T
}

/**
 * `menus` = daftar menu yang sudah diambil halaman (boleh kosong).
 * `kunciNama` = normalisasi nama yang dipakai halaman untuk peta nama-nya.
 */
export function buatPenerapRiwayat(
  menus: any[],
  rows: BarisRiwayatHpp[],
  kunciNama: (nama: string) => string,
): { untuk(tgl: string): PenerapHpp } {
  const indeks = indeksRiwayat(rows)
  const asliById = new Map<string, any>()
  for (const m of menus) if (m?.id) asliById.set(m.id, m)
  const cache = new Map<string, PenerapHpp>()

  return {
    untuk(tgl: string): PenerapHpp {
      const ada = cache.get(tgl)
      if (ada) return ada
      const byId = new Map<string, any>()
      const byName = new Map<string, any>()
      for (const m of menus) {
        const t = timpa(m, indeks, tgl)
        if (m?.id) byId.set(m.id, t)
        if (m?.name) byName.set(kunciNama(m.name), t)
      }
      const penerap: PenerapHpp = {
        byId,
        byName,
        terapkan<T>(menu: T): T {
          const m = menu as any
          if (m && typeof m.id === 'string' && asliById.get(m.id) === m) return byId.get(m.id)
          return timpa(menu, indeks, tgl)
        },
      }
      cache.set(tgl, penerap)
      return penerap
    },
  }
}
```

- [ ] **Step 5: Tulis `batasBerlakuHpp.ts`**

```ts
/**
 * Batas tanggal "Berlaku mulai" HPP — harus sama dengan validasi di RPC `ubah_hpp_menu`:
 * bulan berjalan bebas; bulan lalu hanya sampai tanggal 10 bulan berjalan (WIB).
 */
const FORMAT_WIB = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function hariIniWib(): string {
  return FORMAT_WIB.format(new Date())
}

export function batasAwalBerlaku(hariIni: string): string {
  const [y, m, d] = hariIni.split('-').map(Number)
  if (d <= 10) {
    const tahun = m === 1 ? y - 1 : y
    const bulan = m === 1 ? 12 : m - 1
    return `${tahun}-${String(bulan).padStart(2, '0')}-01`
  }
  return `${y}-${String(m).padStart(2, '0')}-01`
}
```

- [ ] **Step 6: Jalankan test, pastikan lulus**

Run: `cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn vitest run src/lib/hpp`
Expected: PASS semua.

- [ ] **Step 7: Salin ke finance & manager, pastikan identik**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
mkdir -p apps/finance/src/lib/hpp apps/manager/src/lib/hpp
cp apps/admin-dashboard/src/lib/hpp/riwayatHpp.ts apps/finance/src/lib/hpp/riwayatHpp.ts
cp apps/admin-dashboard/src/lib/hpp/batasBerlakuHpp.ts apps/manager/src/lib/hpp/batasBerlakuHpp.ts
diff apps/admin-dashboard/src/lib/hpp/riwayatHpp.ts apps/finance/src/lib/hpp/riwayatHpp.ts && diff apps/admin-dashboard/src/lib/hpp/batasBerlakuHpp.ts apps/manager/src/lib/hpp/batasBerlakuHpp.ts && echo IDENTIK
```
Expected: `IDENTIK`.

- [ ] **Step 8: Commit**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && git rev-parse --abbrev-ref HEAD
git add apps/admin-dashboard/src/lib/hpp apps/finance/src/lib/hpp apps/manager/src/lib/hpp
git commit -m "feat(hpp): helper TS riwayat HPP per tanggal + batas tanggal berlaku

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: admin-dashboard — hook & server action HPP (useHpp, useHppByChannel, ownerDashboard e-commerce, profit Pawoon)

**Files:**
- Modify: `apps/admin-dashboard/src/hooks/useHpp.ts`
- Modify: `apps/admin-dashboard/src/hooks/useHppByChannel.ts`
- Modify: `apps/admin-dashboard/src/app/actions/ownerDashboard.ts:71-212` (`fetchEcommerceOwnerData`)
- Modify: `apps/admin-dashboard/src/app/dashboard/pawoon-import/profit/page.tsx:75-200`

**Interfaces:**
- Consumes: `ambilRiwayatHpp`, `ambilVersiRiwayatHpp`, `buatPenerapRiwayat`, `tanggalWib` dari `@/lib/hpp/riwayatHpp` (Task 5).
- Aturan: fungsi `getItemHpp` / blok hitung HPP di tiap berkas **tidak diubah**. Hanya objek menu & peta yang disuplai.

- [ ] **Step 1: `useHpp.ts`**

1. Tambah import:
```ts
import { ambilRiwayatHpp, ambilVersiRiwayatHpp, buatPenerapRiwayat, tanggalWib } from "@/lib/hpp/riwayatHpp";
```
2. Ganti konstanta select (komponen wajib ber-`id`):
```ts
const MENU_HPP_SELECT =
  "id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp))";
```
3. Di awal `useHpp`, sebelum `const queryKey`, tambah query versi (cache periode tertutup disimpan di localStorage tanpa batas — versi di kunci membuatnya kedaluwarsa saat HPP berubah):
```ts
  const versiQuery = useQuery({
    queryKey: ["hpp-riwayat-versi"],
    staleTime: 60_000,
    queryFn: () => ambilVersiRiwayatHpp(supabase),
  });
  const versiHpp = versiQuery.data;
```
4. Ganti `queryKey` dan `enabled`:
```ts
  const queryKey = [
    "hpp-client-calculated",
    filter.from,
    filter.to,
    filter.outletId,
    versiHpp ?? "",
  ] as const;
```
```ts
    enabled: Boolean(filter.from && filter.to && versiHpp),
```
5. Ganti `Promise.all` master:
```ts
      const [outletsRes, menuItemsRes, mitraInvRes, riwayatRows] = await Promise.all([
        supabase.from("outlets").select("id, type, name, slug").neq("id", TEST_OUTLET_ID),
        supabase.from("menu_items").select(MENU_HPP_SELECT),
        supabase.from("mitra_investments").select("outlet_id"),
        ambilRiwayatHpp(supabase),
      ]);
```
6. Ganti blok pembuatan `menuItemByNameMap`/`menuItemByIdMap` (baris `const menuItemsData = ...` s/d penutup `forEach`) dengan:
```ts
      const menuItemsData = menuItemsRes.data ?? [];
      // HPP per tanggal order: objek menu & peta nama/id ditimpa nilai yang
      // berlaku pada tanggal itu (lihat lib/hpp/riwayatHpp.ts).
      const penerapHpp = buatPenerapRiwayat(menuItemsData, riwayatRows, cleanItemName);
```
7. Select orders & ecommerce ikut mengambil tanggal:
```ts
            "outlet_id, channel, sales_source, created_at, order_items(menu_item_id, menu_item_name, quantity)",
```
```ts
            "channel_id, order_date, ecommerce_sale_items(menu_id, quantity)",
```
8. Loop orders — ganti blok `o.order_items?.forEach(...)` isi pemanggilan:
```ts
        const pHpp = penerapHpp.untuk(tanggalWib(o.created_at));
        o.order_items?.forEach((item: any) => {
          const { hpp, baseHpp, markup } = getItemHpp(
            item.menu_item_id ? pHpp.byId.get(item.menu_item_id) : null,
            outletType,
            item.menu_item_name,
            pHpp.byName,
            orderChannel,
          );
```
(sisa blok tidak berubah)
9. Loop ecommerce:
```ts
        const pHpp = penerapHpp.untuk(tanggalWib(saleRecord.order_date));
        saleRecord.ecommerce_sale_items?.forEach((item: any) => {
          const menuItem = item.menu_id
            ? pHpp.byId.get(item.menu_id)
            : null;
          const fallbackName = menuItem?.name || "Unknown";
          const { hpp, baseHpp, markup } = getItemHpp(
            menuItem,
            outletType,
            fallbackName,
            pHpp.byName,
            ecommerceChannel,
          );
```
10. Pastikan tak ada lagi referensi `menuItemByIdMap` / `menuItemByNameMap` di berkas: `grep -n "menuItemBy" apps/admin-dashboard/src/hooks/useHpp.ts` → kosong.

- [ ] **Step 2: `useHppByChannel.ts` (admin-dashboard)**

1. Import: `import { ambilRiwayatHpp, buatPenerapRiwayat, tanggalWib } from "@/lib/hpp/riwayatHpp";`
2. Select menu: komponen `component:menu_items!menu_item_id(id, hpp_override, channel_hpp)`.
3. Select orders jadi:
```ts
          "outlet_id, channel, sales_source, payment_method, status, created_at, order_items(menu_item_name, quantity, menu_items(id, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp))))",
```
4. Select ecommerce jadi:
```ts
          "channel_id, order_date, ecommerce_sale_items(menu_items:menu_id(id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp))), quantity)",
```
5. Setelah blok `menuItemByNameMap` dibangun, tambahkan:
```ts
      const riwayatRows = await ambilRiwayatHpp(supabase);
      const penerapHpp = buatPenerapRiwayat(menuItemsData ?? [], riwayatRows, cleanItemName);
```
6. Loop orders:
```ts
        const pHpp = penerapHpp.untuk(tanggalWib(o.created_at));
        o.order_items?.forEach((item: any) => {
          const hpp = getItemHpp(
            pHpp.terapkan(item.menu_items),
            outletType,
            item.menu_item_name,
            pHpp.byName,
            orderChannel,
          );
```
7. Loop ecommerce:
```ts
        const pHpp = penerapHpp.untuk(tanggalWib(saleRecord.order_date));
        saleRecord.ecommerce_sale_items?.forEach((item: any) => {
          const fallbackName = item.menu_items?.name || "Unknown";
          const hpp = getItemHpp(
            pHpp.terapkan(item.menu_items),
            outletType,
            fallbackName,
            pHpp.byName,
            source,
          );
```
8. Hapus `menuItemByNameMap` bila tak dipakai lagi (`grep -n menuItemByNameMap` → hanya tersisa di dalam `getItemHpp` sebagai nama parameter).

- [ ] **Step 3: `ownerDashboard.ts` — `fetchEcommerceOwnerData`**

1. Tambah import di bagian import: `import { ambilRiwayatHpp, buatPenerapRiwayat } from '@/lib/hpp/riwayatHpp'`
2. Select ecommerce (baris ~104) — `menu_items:menu_id(id, name, hpp_override, channel_hpp)`.
3. Setelah loop paginasi (sebelum `const kpiMap`), tambahkan:
```ts
  // HPP per tanggal order (dateStr = tanggal WIB di bawah)
  const penerapHpp = buatPenerapRiwayat([], await ambilRiwayatHpp(supabase), (n: string) => n)
```
4. Ganti `const mi = item.menu_items` menjadi:
```ts
      const mi = item.menu_items ? penerapHpp.untuk(dateStr).terapkan(item.menu_items) : item.menu_items
```

- [ ] **Step 4: `pawoon-import/profit/page.tsx`**

1. Import: `import { ambilRiwayatHpp, buatPenerapRiwayat, tanggalWib } from '@/lib/hpp/riwayatHpp';`
2. Select `order_items` — ganti blok `menu_items ( ... )` dengan:
```ts
                        menu_items ( 
                            id,
                            hpp_override,
                            is_package,
                            package_items:menu_packages!package_id (
                                quantity,
                                component:menu_items!menu_item_id ( id, hpp_override )
                            )
                        )
```
3. Setelah `allSyncedOrders.forEach(o => { ... })` (yang mengisi `orderOutletMap`), tambahkan:
```ts
    // HPP per tanggal order (riwayat HPP) — penjualan sebelum perubahan HPP tetap memakai HPP lama.
    const tanggalOrderMap = new Map<string, string>();
    allSyncedOrders.forEach(o => tanggalOrderMap.set(o.id, tanggalWib(o.created_at)));
    const penerapHpp = buatPenerapRiwayat([], shouldFetchData ? await ambilRiwayatHpp(supabase) : [], (n) => n);
```
4. Di dalam `allOrderItems.forEach(item => {`, tepat setelah `const outletType = ...`, tambahkan:
```ts
        const mi = item.menu_items
            ? penerapHpp.untuk(tanggalOrderMap.get(item.order_id) ?? tanggalWib(new Date())).terapkan(item.menu_items)
            : item.menu_items;
```
lalu di blok hitung HPP (baris `if (item.menu_items?.is_package)` s/d `isMissing = item.menu_items?.hpp_override === null;`) ganti setiap `item.menu_items` menjadi `mi`. Blok lain di bawahnya (channelGroup, dst.) tidak diubah.

- [ ] **Step 5: Type-check & test**

Run: `cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check && yarn vitest run src/lib/hpp`
Expected: type-check tanpa error baru di keempat berkas (bandingkan dengan `git stash`-free cara: jalankan `yarn type-check 2>&1 | grep -E "useHpp|useHppByChannel|ownerDashboard|pawoon-import"` → kosong); test PASS.

- [ ] **Step 6: Commit**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && git rev-parse --abbrev-ref HEAD
git add apps/admin-dashboard/src/hooks/useHpp.ts apps/admin-dashboard/src/hooks/useHppByChannel.ts apps/admin-dashboard/src/app/actions/ownerDashboard.ts apps/admin-dashboard/src/app/dashboard/pawoon-import/profit/page.tsx
git commit -m "feat(admin-dashboard): hook & aksi HPP memakai HPP yang berlaku pada tanggal order

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: admin-dashboard — Rangkuman Penjualan & jalur cadangan mitra

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/reports/pos/ReportsView.tsx`
- Modify: `apps/admin-dashboard/src/app/actions/mitraPnl.ts:222-415`
- Modify: `apps/admin-dashboard/src/app/actions/mitraRoi.ts:218-370`

**Interfaces:**
- Consumes: helper Task 5. `getItemHpp`/`getItemHppBase` di ketiga berkas **tidak diubah**.

- [ ] **Step 1: `ReportsView.tsx` (admin-dashboard)**

1. Import: `import { ambilRiwayatHpp, buatPenerapRiwayat, tanggalWib, type BarisRiwayatHpp } from '@/lib/hpp/riwayatHpp'`
2. State, tepat setelah `const [menuItems, setMenuItems] = useState<any[]>([])`:
```ts
  const [riwayatHpp, setRiwayatHpp] = useState<BarisRiwayatHpp[]>([])
```
3. Setelah `useMemo` `menuItemByIdMap`, tambahkan:
```ts
  // HPP per tanggal order: nilai HPP ditimpa nilai yang berlaku pada tanggal order.
  const penerapHpp = useMemo(
    () => buatPenerapRiwayat(menuItems, riwayatHpp, cleanItemName),
    [menuItems, riwayatHpp],
  )
```
4. `menuItemsQuery` select — komponen `component:menu_items!menu_item_id(id, hpp_override, channel_hpp)`.
5. Select ecommerce — `menu_items:menu_id(id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp)))`.
6. `Promise.all` di fungsi fetch jadi:
```ts
    const [ordersData, ecommerceData, { data: shiftsData }, { data: menuItemsData }, { data: settlementsData }, riwayatRows] = await Promise.all([
      !selectedOutlets.includes('ss-online') ? fetchAllOrders() : Promise.resolve([]), 
      fetchEcommerceOrders(),
      qShifts, 
      menuItemsQuery,
      qSettlements,
      ambilRiwayatHpp(supabase),
    ])
```
dan setelah `setMenuItems(menuItemsData ?? [])` tambahkan `setRiwayatHpp(riwayatRows)`.
7. Di **keempat** titik pemanggilan HPP (cari `grep -n "getItemHpp(menuItem" ReportsView.tsx` — 4 hasil), setiap pasangan dua baris:
```ts
const menuItem = X.menu_items || (X.menu_item_id ? menuItemByIdMap.get(X.menu_item_id) : null) || menuItemByNameMap.get(cleanItemName(X.menu_item_name))
const H = getItemHpp(menuItem, outletType, X.menu_item_name, menuItemByNameMap, CH, X.menu_item_id, menuItemByIdMap)
```
diganti menjadi (dengan `ORDER` = variabel order di loop itu: `o` di titik 1, 3, 4 dan `order` di titik 2; `X` = `item` atau `oi` sesuai aslinya; `H`, `CH` sesuai aslinya):
```ts
const pHpp = penerapHpp.untuk(tanggalWib(ORDER.created_at))
const menuItem = pHpp.terapkan(X.menu_items) || (X.menu_item_id ? pHpp.byId.get(X.menu_item_id) : null) || pHpp.byName.get(cleanItemName(X.menu_item_name))
const H = getItemHpp(menuItem, outletType, X.menu_item_name, pHpp.byName, CH, X.menu_item_id, pHpp.byId)
```
Di titik 1 (`totalHPP`, di dalam `o.order_items.reduce`), `pHpp` ditaruh di badan reduce luar setelah `const orderChannel = ...`.
8. Setiap array dependensi hook yang memuat `menuItemByIdMap` (cari `grep -n "menuItemByIdMap\]" ReportsView.tsx`, dan periksa juga hook yang membungkus titik 3 dan 4) — tambahkan `penerapHpp` ke array itu.
9. Verifikasi: `grep -n "getItemHpp(menuItem" ReportsView.tsx` → 4 baris, semuanya memakai `pHpp.byName` dan `pHpp.byId`.

- [ ] **Step 2: `mitraPnl.ts` (jalur cadangan saat RPC gagal)**

1. Import: `import { ambilRiwayatHpp, buatPenerapRiwayat, tanggalWib } from '@/lib/hpp/riwayatHpp'`
2. `buildOrdersQuery` select — `menu_items(id, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp)))`.
3. Select `menuList` — komponen `component:menu_items!menu_item_id(id, hpp_override, channel_hpp)`.
4. Setelah `menuByName` dibangun, tambahkan:
```ts
    const penerapHpp = buatPenerapRiwayat(menuList ?? [], await ambilRiwayatHpp(supabase), (n: string) => n)
```
5. Ganti `hppByName` jadi menerima tanggal:
```ts
    const hppByName = (rawName?: string | null, channel?: string | null, tgl?: string): number => {
      if (!rawName) return 0
      const m = menuByName.get(cleanItemName(rawName).trim().toLowerCase())
      return m ? getItemHpp(tgl ? penerapHpp.untuk(tgl).terapkan(m) : m, 'mitra', channel) : 0
    }
```
6. Di loop `for (const ord of allOrders)`, sebelum loop item: `const tglOrder = tanggalWib(ord.created_at)`; lalu:
```ts
          const hpp = getItemHpp(penerapHpp.untuk(tglOrder).terapkan(item.menu_items), 'mitra', ord.channel)
            || hppByName(item.menu_item_name, ord.channel, tglOrder)
```

- [ ] **Step 3: `mitraRoi.ts` (jalur cadangan)**

1. Import: `import { ambilRiwayatHpp, buatPenerapRiwayat, tanggalWib } from '@/lib/hpp/riwayatHpp'`
2. Select `menuList` di `hppByName` dan select `orders` cadangan — tambahkan `id` pada `menu_items(...)` dan pada `component:menu_items!menu_item_id(...)` (pola sama dengan Step 2).
3. Tambah penerap lazily, di samping `let menuByName`:
```ts
  let penerapHpp: ReturnType<typeof buatPenerapRiwayat> | null = null
  const ambilPenerapHpp = async () => {
    if (!penerapHpp) penerapHpp = buatPenerapRiwayat([], await ambilRiwayatHpp(supabase), (n: string) => n)
    return penerapHpp
  }
```
4. `hppByName` jadi:
```ts
  const hppByName = async (rawName?: string | null, channel?: string | null, tgl?: string): Promise<number> => {
    if (!rawName) return 0
    if (!menuByName) {
      const { data: menuList } = await supabase
        .from('menu_items')
        .select('id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp))')
      menuByName = new Map<string, any>()
      for (const m of menuList ?? []) {
        if (m?.name) menuByName.set(cleanItemName(m.name).trim().toLowerCase(), m)
      }
    }
    const m = menuByName.get(cleanItemName(rawName).trim().toLowerCase())
    if (!m) return 0
    const p = await ambilPenerapHpp()
    return getItemHpp(tgl ? p.untuk(tgl).terapkan(m) : m, 'mitra', channel)
  }
```
5. Di loop `for (const order of orders)`: `const tglOrder = tanggalWib(order.created_at)` dan `const p = await ambilPenerapHpp()` sebelum loop item, lalu:
```ts
          const hpp = getItemHpp(p.untuk(tglOrder).terapkan(item.menu_items), 'mitra', order.channel)
            || await hppByName(item.menu_item_name, order.channel, tglOrder)
```

- [ ] **Step 4: Type-check, test, build**

Run:
```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard"
yarn type-check 2>&1 | grep -E "ReportsView|mitraPnl|mitraRoi|useHpp|ownerDashboard|pawoon-import|lib/hpp" ; echo "--- (kosong = bersih)"
yarn vitest run src/lib/hpp
yarn build
```
Expected: tak ada error di berkas yang disentuh; test PASS; build sukses.

- [ ] **Step 5: Commit**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && git rev-parse --abbrev-ref HEAD
git add apps/admin-dashboard/src/app/dashboard/reports/pos/ReportsView.tsx apps/admin-dashboard/src/app/actions/mitraPnl.ts apps/admin-dashboard/src/app/actions/mitraRoi.ts
git commit -m "feat(admin-dashboard): Rangkuman Penjualan & cadangan mitra memakai HPP per tanggal order

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: finance — useHppByChannel & Rangkuman Penjualan

**Files:**
- Modify: `apps/finance/src/hooks/useHppByChannel.ts`
- Modify: `apps/finance/src/app/laporan/penjualan/ReportsView.tsx`

**Interfaces:**
- Consumes: `apps/finance/src/lib/hpp/riwayatHpp.ts` (salinan Task 5), import `@/lib/hpp/riwayatHpp`.

- [ ] **Step 1: `useHppByChannel.ts` (finance)** — terapkan **persis** perubahan Task 6 Step 2 (butir 1–8). Berkas finance setara dengan admin-dashboard (beda hanya akhir baris CRLF/LF dan titik koma); jaga gaya titik koma berkas finance.

- [ ] **Step 2: `ReportsView.tsx` (finance)** — terapkan **persis** perubahan Task 7 Step 1 (butir 1–9). Titik pemanggilan ada di sekitar baris 799, 1072, 1270, 1404; array dependensi di sekitar baris 984 dan 1096.

- [ ] **Step 3: Verifikasi**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/finance"
grep -n "getItemHpp(menuItem" src/app/laporan/penjualan/ReportsView.tsx
yarn type-check 2>&1 | grep -E "ReportsView|useHppByChannel|lib/hpp" ; echo "--- (kosong = bersih)"
yarn build
```
Expected: 4 baris `getItemHpp(menuItem` semuanya memakai `pHpp.byName`/`pHpp.byId`; tak ada error di berkas yang disentuh; build sukses.

- [ ] **Step 4: Commit**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && git rev-parse --abbrev-ref HEAD
git add apps/finance/src/hooks/useHppByChannel.ts apps/finance/src/app/laporan/penjualan/ReportsView.tsx
git commit -m "feat(finance): laporan HPP memakai HPP yang berlaku pada tanggal order

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Layar HPP — tulis lewat RPC + input "Berlaku mulai"

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/resep/HppDashboardView.tsx`
- Modify: `apps/manager/src/app/resep/HppDashboardView.tsx` (berkas kembar — hasil akhir harus identik kecuali baris revalidate)
- Modify: `apps/admin-dashboard/src/app/dashboard/resep/[menu_id]/ResepEditor.tsx:147-160`
- Modify: `apps/manager/src/app/resep/[menu_id]/ResepEditor.tsx:147-160`

**Interfaces:**
- Consumes: RPC `ubah_hpp_menu(p_menu_item_id, p_perubahan, p_berlaku_mulai, p_alasan)` (Task 2); `hariIniWib`, `batasAwalBerlaku` dari `@/lib/hpp/batasBerlakuHpp`; `revalidateOwnerDashboardCache` dari `@/app/actions/ownerDashboard` (admin-dashboard saja).

- [ ] **Step 1: `HppDashboardView.tsx` (admin-dashboard)**

1. Import:
```ts
import { hariIniWib, batasAwalBerlaku } from '@/lib/hpp/batasBerlakuHpp'
import { revalidateOwnerDashboardCache } from '@/app/actions/ownerDashboard'
```
2. Konstanta di atas komponen:
```ts
// Kunci channel_hpp yang mewakili SS Online — ditulis/direset bersamaan (sama seperti sebelumnya).
const KUNCI_SS_ONLINE = [
  'ss_online',
  'tiktok_shop',
  'shopee_shop',
  'f3305089-b9e4-4b92-95da-14bf6e7fb6d5',
  'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584',
] as const
```
3. State, di bawah `const [pusatHppValue, setPusatHppValue] = useState<string>('')`:
```ts
  const [berlakuMulai, setBerlakuMulai] = useState<string>(() => hariIniWib())
```
4. Di `handleSavePusatHpp`, ganti seluruh isi `if (channelKey === 'ss_online') { ... } else { ... }` **sampai sebelum** `setEditingPusatId(null)` dengan:
```ts
      if (val !== null && (!Number.isFinite(val) || val < 0)) {
        throw new Error('HPP harus angka 0 atau lebih')
      }
      const perubahan: Record<string, number | null> =
        channelKey === 'ss_online'
          ? Object.fromEntries(KUNCI_SS_ONLINE.map((k) => [k, val]))
          : { hpp_override: val }

      // Satu-satunya jalur tulis HPP: RPC mencatat riwayat bertanggal & mengecek role.
      const { error: rpcError } = await supabase.rpc('ubah_hpp_menu', {
        p_menu_item_id: row.id,
        p_perubahan: perubahan,
        p_berlaku_mulai: berlakuMulai,
      })
      if (rpcError) throw rpcError

      const { error: metaError } = await supabase
        .from('menu_items')
        .update({ updated_by: userUpdater, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (metaError) throw metaError

      const labelTanggal = berlakuMulai === hariIniWib() ? '' : ` (berlaku mulai ${berlakuMulai})`
      if (channelKey === 'ss_online') {
        toast.success(val === null ? `HPP SS Online "${row.name}" direset${labelTanggal}` : `HPP SS Online "${row.name}" diset ke ${rupiah(val)}${labelTanggal}`)
      } else {
        // Auto update Mitra HPP (+10%)
        const mitraVal = val === null ? null : Math.round(val * 1.1)
        const payload = outlets.map(o => {
          const existing = allOutletPrices.find(p => p.menu_item_id === row.id && p.outlet_id === o.id)
          return {
            menu_item_id: row.id,
            outlet_id: o.id,
            is_available: existing ? existing.is_available : true,
            price: existing ? existing.price : null,
            hpp_override: mitraVal
          }
        })
        
        const { error: mitraError } = await supabase.from('menu_outlet_prices').upsert(payload, { onConflict: 'menu_item_id,outlet_id' })
        if (mitraError) console.error("Gagal auto-update HPP Mitra", mitraError)

        toast.success(val === null ? `HPP Pusat untuk "${row.name}" direset ke BOM${labelTanggal}` : `HPP Pusat "${row.name}" diset ke ${rupiah(val)}, HPP Mitra otomatis disesuaikan (+10%)${labelTanggal}`)
      }
      await revalidateOwnerDashboardCache()
```
5. Di tombol edit (onClick yang memanggil `setEditingPusatId(editKey); setPusatHppValue(...)`), tambahkan reset tanggal:
```tsx
onClick={() => { setEditingPusatId(editKey); setPusatHppValue(ch.hppPusat !== null ? String(ch.hppPusat) : ''); setBerlakuMulai(hariIniWib()); }}
```
6. Di editor inline, tepat setelah `<input type="number" ... />`, tambahkan:
```tsx
                                    <input
                                      type="date"
                                      value={berlakuMulai}
                                      min={batasAwalBerlaku(hariIniWib())}
                                      max={hariIniWib()}
                                      onChange={(e) => setBerlakuMulai(e.target.value)}
                                      title="Berlaku mulai (HPP penjualan sebelum tanggal ini tidak berubah)"
                                      className="w-[7.5rem] px-1 py-0.5 text-[10px] border rounded focus:ring-1 focus:ring-suka-primary"
                                    />
```

- [ ] **Step 2: `HppDashboardView.tsx` (manager)** — terapkan butir 1–6 yang sama, **kecuali**: jangan import dan jangan panggil `revalidateOwnerDashboardCache` (tidak ada di app manager; cache Owner Dashboard kedaluwarsa sendiri ≤ 1 jam). Verifikasi:
```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps"
diff admin-dashboard/src/app/dashboard/resep/HppDashboardView.tsx manager/src/app/resep/HppDashboardView.tsx
```
Expected: beda hanya baris import `revalidateOwnerDashboardCache` dan baris `await revalidateOwnerDashboardCache()`.

- [ ] **Step 3: `ResepEditor.tsx` (keduanya, identik)** — ganti blok baris 147–160:
```ts
      // Update Harga Jual and HPP Override in menu_items
      const overrideVal = hppOverride.trim() === '' ? null : Number(hppOverride)
      if (overrideVal !== menu.hpp_override) {
        // HPP lewat RPC riwayat (berlaku hari ini). Perubahan mundur dilakukan di layar HPP.
        const { error: hppError } = await supabase.rpc('ubah_hpp_menu', {
          p_menu_item_id: menu.id,
          p_perubahan: { hpp_override: overrideVal },
        })
        if (hppError) throw hppError
      }
      if (hargaJual !== Number(menu.price) || overrideVal !== menu.hpp_override) {
        const { error: menuError } = await supabase
          .from('menu_items')
          .update({
            price: hargaJual,
            updated_by: userUpdater,
            updated_at: new Date().toISOString()
          })
          .eq('id', menu.id)
        if (menuError) throw menuError
      }
```
Verifikasi: `diff "apps/admin-dashboard/src/app/dashboard/resep/[menu_id]/ResepEditor.tsx" "apps/manager/src/app/resep/[menu_id]/ResepEditor.tsx" && echo IDENTIK` → `IDENTIK`.

- [ ] **Step 4: Pastikan tak ada lagi tulisan HPP langsung di layar yang hidup**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps"
grep -n "update({[^}]*\(hpp_override\|channel_hpp\)" admin-dashboard/src/app/dashboard/resep/HppDashboardView.tsx manager/src/app/resep/HppDashboardView.tsx "admin-dashboard/src/app/dashboard/resep/[menu_id]/ResepEditor.tsx" "manager/src/app/resep/[menu_id]/ResepEditor.tsx"
grep -n -A4 "from('menu_items')" admin-dashboard/src/app/dashboard/resep/HppDashboardView.tsx | grep -n "hpp_override\|channel_hpp"
```
Expected: kedua perintah kosong (penulisan `menu_outlet_prices.hpp_override` tidak termasuk — itu tabel lain).

- [ ] **Step 5: Type-check & build**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check 2>&1 | grep -E "HppDashboardView|ResepEditor|batasBerlakuHpp" ; yarn build
cd ../manager && yarn type-check 2>&1 | grep -E "HppDashboardView|ResepEditor|batasBerlakuHpp" ; yarn build
```
Expected: tak ada error di berkas yang disentuh; kedua build sukses.

- [ ] **Step 6: Commit**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && git rev-parse --abbrev-ref HEAD
git add apps/admin-dashboard/src/app/dashboard/resep apps/manager/src/app/resep
git commit -m "feat(hpp): layar HPP menyimpan lewat ubah_hpp_menu dengan tanggal berlaku

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Verifikasi akhir & catatan sesi

**Files:**
- Modify: `CLAUDE.md` (tambah entri Session 2026-09-25 sebelum baris `**Last updated:**`, dan ubah tanggal Last updated)

- [ ] **Step 1: Ulangi seluruh uji DB**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
for f in t1_tabel_rpc_trigger t2_mitra t3_owner_summary; do supabase db query --linked -f supabase/verifikasi/riwayat_hpp/$f.sql; done
supabase db query --linked -f supabase/verifikasi/riwayat_hpp/baseline_owner.sql > /tmp/o.txt && diff supabase/verifikasi/riwayat_hpp/baseline-sebelum-owner.txt /tmp/o.txt && echo OWNER_IDENTIK
supabase db query --linked -f supabase/verifikasi/riwayat_hpp/baseline_mitra.sql > /tmp/m.txt && diff supabase/verifikasi/riwayat_hpp/baseline-sebelum-mitra.txt /tmp/m.txt && echo MITRA_IDENTIK
supabase db query "SELECT sumber, count(*) FROM menu_hpp_riwayat GROUP BY 1 ORDER BY 1;" --linked
```
Expected: `T1 LULUS`, `T2 LULUS`, `T3 LULUS`, `OWNER_IDENTIK`, `MITRA_IDENTIK`; baris riwayat hanya `awal` (plus `trigger`/`layar` hanya bila ada perubahan HPP nyata sejak Task 2 — laporkan bila ada).

- [ ] **Step 2: Test & build tiga app**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn vitest run src/lib/hpp && yarn build
cd ../finance && yarn build
cd ../manager && yarn build
```
Expected: semua sukses.

- [ ] **Step 3: Tambah catatan sesi di `CLAUDE.md`**

Sisipkan sebelum `**Last updated:**` dan ubah tanggalnya ke `2026-09-25`:

```markdown
## Session 2026-09-25: Riwayat HPP Override dengan Tanggal Berlaku (DB + admin-dashboard, finance, manager)

**Status:** DB LIVE — 3 migration applied & terstempel (`20260925150000_riwayat_hpp_menu`,
`20260925151000_hpp_mitra_per_tanggal`, `20260925152000_owner_summary_hpp_per_tanggal`).
Kode di branch `feat/riwayat-hpp-override`. ⚠️ **Perlu merge + redeploy `admin-dashboard`, `finance`,
`manager`.** Spec: `docs/superpowers/specs/2026-09-25-riwayat-hpp-override-design.md`.

### Masalah
Laporan membaca `menu_items.hpp_override`/`channel_hpp` HARI INI untuk penjualan tanggal berapa pun →
mengganti HPP di tengah bulan menggeser HPP seluruh bulan (dan bulan yang sudah ditutup). Pemicu: owner
dapat info (25 Sep) bahwa HPP berubah mulai **19 Sep**.

### Model
`menu_hpp_riwayat` — satu baris = satu angka (`kunci` = `'hpp_override'` atau kunci `channel_hpp`) +
`berlaku_mulai` (WIB). Seed `'2000-01-01'` = angka saat migration → nol pergeseran (diverifikasi `diff`
baseline owner & mitra). `menu_hpp_pada(menu, tanggal)` merekonstruksi. Tulis: RPC `ubah_hpp_menu`
(owner/admin, batas mundur: bulan berjalan; bulan lalu s/d tgl 10) + trigger jaring pengaman untuk tulisan
langsung ke `menu_items`.

### ⚠️ Gotcha
- **Aturan HPP tiap laporan SENGAJA berbeda dan tidak disatukan** (owner summary mengabaikan `channel_hpp`;
  mitra rekursif). Yang diganti hanya sumber angkanya.
- **Per kunci, bukan snapshot** — snapshot membuat perubahan mundur dikalahkan baris kanal yang lebih baru.
- Select bersarang `menu_items(...)`/`component:...` **wajib ber-`id`**, kalau tidak objek diam-diam memakai
  angka hari ini.
- `useHpp` menyimpan periode tertutup di localStorage tanpa batas → kunci cache memuat versi riwayat
  (`dicatat_at` terbaru).
- Layar HPP yang hidup = `HppDashboardView.tsx`. `HPPView.tsx` & `OutletPricingView.tsx` kode mati.
- Fungsi mitra & owner summary juga didefinisikan migration 2030 → replay dari nol menimpa versi baru.

### 📝 Next
- Merge, redeploy 3 app, lalu owner/admin memasukkan HPP baru di layar HPP dengan **Berlaku mulai =
  19 Sep 2026** — paling lambat **10 Oktober** (batas mundur September).
- Smoke test: ubah satu menu berlaku kemarin → Owner Dashboard/Rangkuman Penjualan hari sebelumnya tidak
  berubah, hari itu berubah.
```

- [ ] **Step 4: Commit**

```bash
cd "/d/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && git rev-parse --abbrev-ref HEAD
git add CLAUDE.md
git commit -m "docs: catatan sesi riwayat HPP override bertanggal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Laporkan ke user (jangan push/merge sendiri)**

Ringkas: hasil T1–T3, hasil `diff` baseline, waktu owner summary sebelum/sesudah, build 3 app, dan langkah yang tersisa (merge, redeploy, input HPP 19 Sep sebelum 10 Oktober).
