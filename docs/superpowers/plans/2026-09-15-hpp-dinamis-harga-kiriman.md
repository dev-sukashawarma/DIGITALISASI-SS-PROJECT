# HPP Dinamis berbasis Harga Kiriman Gudang — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HPP per outlet mengikuti harga kiriman gudang (vendor yang dipilih gudang), tampil berdampingan dengan `hpp_override` di papan HPP Menu app stok, tanpa mengganti satu laporan pun.

**Architecture:** Harga diselesaikan **saat dibaca** lewat fungsi SQL `harga_bahan_efektif(outlet, bahan, tanggal)` bertingkat (kiriman → drop-ship → riwayat master → master sekarang). Dua RPC baru membaca ledger `pemakaian` (aktual, grain outlet×bahan) dan resep×penjualan (teoritis, grain menu). Tidak ada kolom baru di `ledger_stok`, trigger BOM tidak disentuh. Jalur PO memberi makan katalog vendor supaya snapshot kiriman berikutnya mengikuti harga yang benar-benar dibayar.

**Tech Stack:** Supabase/Postgres (plpgsql, SECURITY DEFINER), Next.js app router (`apps/stok`), React Query, vitest.

**Spec:** `docs/superpowers/specs/2026-09-15-hpp-dinamis-harga-kiriman-design.md`

## Global Constraints

- Pelaporan (Profit, Owner Dashboard, Finance, mitra) **tetap `hpp_override`**. Nol perubahan di `apps/admin-dashboard`, `apps/finance`, `apps/manager`. Pemeriksaan wajib di akhir: `git diff --name-only main...HEAD | grep -E '^apps/(admin-dashboard|finance|manager|pos-kasir)/'` harus kosong.
- Tidak menyentuh `trg_process_bom_stok`, `process_waterfall_deduction`, `ledger_stok` (skema), `get_hpp_periode`, `get_waste_periode`, `bahan_baku_harga.kemasan_qty`.
- Semua harga per **satuan besar**; pembagi ke satuan kecil = `bahan_baku_harga.kemasan_qty`, fallback `CASE WHEN faktor_tengah IS NOT NULL AND faktor_tampilan IS NOT NULL THEN faktor_tampilan ELSE faktor_konversi END`, fallback 1.
- Skala qty ledger: `saldo_is_gram(sb)` true → qty satuan kecil; false/tak ada baris → qty satuan besar.
- Timestamp migration `20260915HHMMSS`. Sebelum menulis: `ls supabase/migrations | cut -c1-14 | sort | uniq -d` harus kosong.
- Setiap migration: `DO`-block assertion **plus kontrol negatif yang benar-benar melempar** (`RAISE EXCEPTION` di baris terakhir uji, bukti kanal bisa gagal), lalu verifikasi ground-truth `pg_get_functiondef` / katalog.
- Apply migration: `supabase db query --linked -f <file>` (**bukan** inline; inline diam-diam tidak menjalankan DDL). Setelah apply: `INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES (...) ON CONFLICT DO NOTHING`.
- Uji SQL: file di `supabase/verifikasi/hpp_dinamis/tN_*.sql`, pola `BEGIN; DO $$ ... RAISE EXCEPTION 'HASIL TN: LULUS (...)'; END $$; ROLLBACK;` — hasil "LULUS" muncul sebagai error yang disengaja; ROLLBACK menjamin nol perubahan.
- Fungsi baru: `SECURITY DEFINER SET search_path = public`; `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated`.
- Role gate RPC HPP dinamis (dari `canViewVendorPrices` app stok): `kitchen, purchasing, admin_finance, admin, owner, spv, regional_manager, leader, area_manager, developer`.
- Branch: `feat/hpp-dinamis-harga-kiriman`. **Working tree `main` saat ini memuat kerja lain yang belum di-commit (retur/refund, manager approvals)** — kerjakan di worktree terpisah (`superpowers:using-git-worktrees`), jangan `git add -A`.
- Outlet tes (`outlets.type='test'`) tidak masuk perhitungan: RPC memakai `outlet_ids_terhitung()`.

---

## File Structure

| Path | Tanggung jawab |
|---|---|
| `supabase/migrations/20260915200000_nyalakan_bom_tiga_outlet.sql` | `is_bom_enabled=true` Cicurug/Sentul/Cileungsi + pre-check stok_balance |
| `supabase/migrations/20260915201000_pamulang_type_mitra.sql` | `type='mitra'` MITRA PAMULANG (apply setelah laporan dampak disetujui owner) |
| `supabase/migrations/20260915210000_pengerasan_harga.sql` | DROP `po_on_verified`; waste `hpp_kecil` → `kemasan_qty`; `fill_harga_snapshot` → `kemasan_qty` |
| `supabase/migrations/20260915220000_harga_bahan_efektif.sql` | fungsi harga bertingkat + `can_view_hpp_dinamis()` |
| `supabase/migrations/20260915230000_katalog_tulis_dari_po.sql` | `katalog_tulis_dari_po()` + `verifikasi_terima_po` memanggilnya saat guard lolos |
| `supabase/migrations/20260915233000_rpc_hpp_dinamis.sql` | `get_hpp_dinamis_bahan`, `get_hpp_dinamis_menu` |
| `supabase/verifikasi/hpp_dinamis/t0_prasyarat.sql` … `t4_rpc.sql` | uji SQL per migration |
| `apps/stok/src/lib/stok/hppDinamis.ts` (+ `.test.ts`) | fungsi murni: ringkasan, porsi sumber, selisih %, label |
| `apps/stok/src/app/actions/hppDinamis.ts` | server action memanggil 2 RPC lewat client ber-cookie (gate RPC berlaku) |
| `apps/stok/src/hooks/useHPPDinamis.ts` | React Query wrapper |
| `apps/stok/src/components/hpp/HPPDinamisPanel.tsx` | panel outlet+periode, 3 tabel |
| `apps/stok/src/app/stok/hpp-menu/page.tsx` | pasang panel di bawah `HPPMenuBoard` |
| `SS COGS SET/pemantau-hpp-dinamis-2026-09.sql` | 4 kueri pemantau owner |
| `CLAUDE.md` | entri sesi |

---

### Task 1: Prasyarat data — nyalakan BOM tiga outlet, koreksi tipe Pamulang

**Files:**
- Create: `supabase/migrations/20260915200000_nyalakan_bom_tiga_outlet.sql`
- Create: `supabase/migrations/20260915201000_pamulang_type_mitra.sql`
- Create: `supabase/verifikasi/hpp_dinamis/t0_prasyarat.sql`

**Interfaces:**
- Consumes: `outlets.is_bom_enabled`, `outlets.type`, `stok_balance`, `resep_item`, `saldo_is_gram(stok_balance)`.
- Produces: tiga outlet mulai menulis `ledger_stok.tipe='pemakaian'` tiap order `completed`.

- [ ] **Step 1: Cek prasyarat ketiga outlet (baca saja)**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
cat > "$TEMP/cek_bom.sql" <<'EOF'
SELECT o.name,
  (SELECT count(*) FROM stok_balance sb WHERE sb.outlet_id=o.id
     AND sb.bahan_baku_id IN (SELECT DISTINCT bahan_baku_id FROM resep_item)) AS sb_bahan_resep,
  (SELECT count(DISTINCT bahan_baku_id) FROM resep_item ri JOIN bahan_baku b ON b.id=ri.bahan_baku_id WHERE b.is_active) AS bahan_resep_total,
  (SELECT count(*) FROM stok_balance sb WHERE sb.outlet_id=o.id AND saldo_is_gram(sb)) AS baris_gram,
  (SELECT count(*) FROM stok_balance sb WHERE sb.outlet_id=o.id AND NOT saldo_is_gram(sb)) AS baris_besar
FROM outlets o WHERE o.name IN ('MITRA CICURUG','MITRA SENTUL','MITRA CILEUNGSI');
EOF
supabase db query --linked -f "$TEMP/cek_bom.sql"
```
Expected: `sb_bahan_resep` mendekati `bahan_resep_total` (≥ 40). Catat `baris_gram` vs `baris_besar`: kalau campur, itu kondisi yang sama dengan 18 outlet lain (bukan pemblokir), tapi tulis angkanya di laporan Task ini.

- [ ] **Step 2: Tulis migration nyalakan BOM**

```sql
-- supabase/migrations/20260915200000_nyalakan_bom_tiga_outlet.sql
-- Spec: docs/superpowers/specs/2026-09-15-hpp-dinamis-harga-kiriman-design.md §5.1
-- Tiga outlet mitra dibuat 17-31 Jul 2026 dengan is_bom_enabled=false (semua
-- outlet lain true, termasuk Pamulang 8 Sep). 3.676 order September mereka
-- tidak pernah memotong stok; satu-satunya pergerakan keluar = opname_selisih.
-- Tidak ada koreksi mundur (aturan owner: Agustus dilewati; saldo hari ini
-- dijaga opname harian). Mulai apply, order completed memotong stok.
BEGIN;

DO $$
DECLARE v_n int;
BEGIN
  -- Pra-cek: tiap outlet punya stok_balance untuk bahan resep
  SELECT count(*) INTO v_n FROM outlets o
  WHERE o.name IN ('MITRA CICURUG','MITRA SENTUL','MITRA CILEUNGSI')
    AND (SELECT count(*) FROM stok_balance sb WHERE sb.outlet_id=o.id
           AND sb.bahan_baku_id IN (SELECT bahan_baku_id FROM resep_item)) < 30;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'PRA-CEK GAGAL: % outlet punya <30 baris stok_balance bahan resep', v_n;
  END IF;
END $$;

UPDATE public.outlets
   SET is_bom_enabled = true
 WHERE name IN ('MITRA CICURUG','MITRA SENTUL','MITRA CILEUNGSI')
   AND is_bom_enabled = false;

DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM outlets
  WHERE type IN ('outlet','mitra') AND is_active AND COALESCE(is_bom_enabled,false) = false;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: masih % outlet aktif dengan BOM mati', v_n;
  END IF;
END $$;

COMMIT;
```

- [ ] **Step 3: Inventarisasi pembaca `type = 'mitra'` (untuk Pamulang)**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
grep -rn "type *= *'mitra'\|type IN ('mitra'\|'mitra'::text" supabase/migrations/20300109000002_get_owner_dashboard_summary.sql supabase/migrations/20300125000000_fix_mitra_pnl_omzet_acuan.sql supabase/migrations/20260911140100_omzet_kotor_acuan_tunggal.sql supabase/migrations/20300115000001_scope_owner_dashboard_rpc.sql
grep -rn "type === 'mitra'\|type == 'mitra'\|\.eq('type', *'mitra')" apps --include=*.ts --include=*.tsx | grep -v node_modules | grep -v .claude
```
Expected: sedikitnya markup HPP 1,1× di `get_owner_dashboard_summary` (baris ~104, ~109). Tulis ringkasan 3–6 baris: "Mengubah Pamulang ke mitra akan: (1) COGS Pamulang di Owner Dashboard dikali 1,1 seperti mitra lain; (2) …". Ringkasan ini dilaporkan ke owner **sebelum** Step 5.

- [ ] **Step 4: Tulis migration Pamulang**

```sql
-- supabase/migrations/20260915201000_pamulang_type_mitra.sql
-- Spec §5.2. MITRA PAMULANG (dibuat 2026-09-08) tercatat type='outlet'.
-- Konfirmasi owner 2026-09-15: "pamulang itu mitra".
-- JANGAN di-apply sebelum laporan dampak (Task 1 Step 3) disetujui owner.
BEGIN;
UPDATE public.outlets SET type = 'mitra'
 WHERE name = 'MITRA PAMULANG' AND type = 'outlet';
DO $$
BEGIN
  IF (SELECT type FROM outlets WHERE name='MITRA PAMULANG') <> 'mitra' THEN
    RAISE EXCEPTION 'ASERSI GAGAL: Pamulang belum mitra';
  END IF;
END $$;
COMMIT;
```

- [ ] **Step 5: Apply keduanya (Pamulang hanya setelah owner OK), stempel, verifikasi**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
supabase db query --linked -f supabase/migrations/20260915200000_nyalakan_bom_tiga_outlet.sql
supabase db query --linked -f supabase/migrations/20260915201000_pamulang_type_mitra.sql
supabase db query --linked "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260915200000','nyalakan_bom_tiga_outlet'),('20260915201000','pamulang_type_mitra') ON CONFLICT (version) DO NOTHING"
supabase db query --linked "SELECT name, type, is_bom_enabled FROM outlets WHERE name IN ('MITRA CICURUG','MITRA SENTUL','MITRA CILEUNGSI','MITRA PAMULANG')"
```
Expected: 3 outlet `is_bom_enabled=true`; Pamulang `type=mitra`.

- [ ] **Step 6: Bukti perilaku — pemakaian pertama muncul**

Tunggu ≥1 order `completed` di salah satu dari tiga outlet, lalu:
```bash
supabase db query --linked "SELECT o.name, count(*) FROM ledger_stok l JOIN outlets o ON o.id=l.outlet_id WHERE l.tipe='pemakaian' AND o.name IN ('MITRA CICURUG','MITRA SENTUL','MITRA CILEUNGSI') AND l.created_at > now() - interval '1 day' GROUP BY 1"
```
Expected: ≥1 baris per outlet yang sudah ada order. Kalau setelah 1 hari kerja masih 0 untuk outlet yang ber-order, hentikan dan selidiki sebelum lanjut.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260915200000_nyalakan_bom_tiga_outlet.sql supabase/migrations/20260915201000_pamulang_type_mitra.sql
git commit -m "fix(db): nyalakan BOM Cicurug/Sentul/Cileungsi, Pamulang type=mitra

Tiga outlet mitra dibuat Juli 2026 dengan is_bom_enabled=false; 3.676 order
September tidak pernah memotong stok. Pamulang tercatat outlet padahal mitra.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Pengerasan — zombie `po_on_verified`, pembagi waste & snapshot ke `kemasan_qty`

**Files:**
- Create: `supabase/migrations/20260915210000_pengerasan_harga.sql`
- Create: `supabase/verifikasi/hpp_dinamis/t1_pengerasan.sql`
- Read: `supabase/migrations/20300132000000_laporan_kecualikan_outlet_tes.sql:232-450` (badan `get_waste_breakdown`, `get_waste_incidents`, `get_waste_summary_v2`), `supabase/migrations/20260912100000_fix_harga_snapshot_satuan_vendor.sql:40-71` (`fill_harga_snapshot`)

**Interfaces:**
- Consumes: badan fungsi di atas, disalin **utuh** lalu hanya ekspresi `hpp_kecil` / konversi katalog yang diganti.
- Produces: `get_waste_periode` **tidak berubah** (total waste Profit/mitra tetap); `po_on_verified` hilang.

- [ ] **Step 1: Ukur baseline sebelum apply (simpan angkanya)**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
cat > "$TEMP/baseline_waste.sql" <<'EOF'
SELECT 'waste_periode_agu' k, sum(w.waste)::text v FROM get_waste_periode('2026-08-01','2026-08-31') w
UNION ALL SELECT 'waste_periode_sep', sum(w.waste)::text FROM get_waste_periode('2026-09-01','2026-09-14') w
UNION ALL SELECT 'breakdown_sep_sum_nilai', sum(nilai)::text FROM get_waste_breakdown('2026-09-01','2026-09-14')
UNION ALL SELECT 'po_on_verified_ada', (SELECT count(*)::text FROM pg_proc WHERE proname='po_on_verified')
UNION ALL SELECT 'trigger_po_on_verified_ada', (SELECT count(*)::text FROM pg_trigger WHERE tgname ILIKE '%po_on_verified%');
EOF
supabase db query --linked -f "$TEMP/baseline_waste.sql"
```
Expected: `po_on_verified_ada=1`, `trigger_po_on_verified_ada=0`. Catat ketiga angka waste — harus identik setelah apply (Step 5). Kalau `get_waste_periode`/`get_waste_breakdown` butuh role owner/admin, jalankan dengan `SET LOCAL ROLE` + jwt claims seperti pola `t1_skema.sql` di `supabase/verifikasi/saldo_vendor/`.

- [ ] **Step 2: Tulis migration**

Struktur file (badan fungsi waste disalin persis dari `20300132000000` — jangan menulis ulang dari ingatan):

```sql
-- supabase/migrations/20260915210000_pengerasan_harga.sql
-- Spec §6. Tiga hal:
-- (1) DROP po_on_verified(): zombie dari 20300105000017, tanpa guard PO uji &
--     salah satuan; triggernya di-drop 20260828114500. Kalau dipasang ulang
--     akan menembus semua perlindungan 4/8 Sep.
-- (2) get_waste_breakdown / _incidents / _summary_v2: hpp_kecil dari
--     harga_beli/faktor_konversi -> harga_beli/kemasan_qty (basis kanonik
--     2 Sep). get_waste_periode TIDAK disentuh (qty x harga_beli, satuan besar).
-- (3) fill_harga_snapshot: konversi katalog -> satuan besar pakai kemasan_qty
--     (fallback faktor_tampilan), selaras dengan get_hpp_periode.
-- ⚠️ 20300132000000 terurut SETELAH file ini; replay dari nol memulihkan
--     pembagi lama. Produksi aman (terstempel). Preseden 2026-09-09.
BEGIN;

DROP FUNCTION IF EXISTS public.po_on_verified();

-- (2) salin CREATE OR REPLACE FUNCTION public.get_waste_breakdown(...) dari
--     20300132000000 baris 232-277 UTUH, ganti hanya ekspresi hpp_kecil:
--   LAMA: bh.harga_beli / NULLIF(b.faktor_konversi, 0)
--   BARU: bh.harga_beli / COALESCE(NULLIF(bh.kemasan_qty,0),
--           NULLIF(CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
--                       THEN b.faktor_tampilan ELSE b.faktor_konversi END,0), 1)
-- (ulangi untuk get_waste_incidents dan get_waste_summary_v2; cari pola
--  'faktor_konversi' di badan masing-masing — kalau ada di tempat lain selain
--  hpp_kecil, JANGAN diganti, laporkan)

-- (3) fill_harga_snapshot: salin dari 20260912100000 baris 40-71, ganti
--   LAMA: SELECT bs.harga * b.faktor_tampilan / bs.isi_satuan_kecil
--         ... JOIN public.bahan_baku b ON b.id = bs.bahan_baku_id
--         ... AND COALESCE(b.faktor_tampilan, 0) > 0
--   BARU: SELECT bs.harga * COALESCE(NULLIF(bh.kemasan_qty,0), b.faktor_tampilan) / bs.isi_satuan_kecil
--         ... JOIN public.bahan_baku b ON b.id = bs.bahan_baku_id
--         LEFT JOIN public.bahan_baku_harga bh ON bh.bahan_baku_id = bs.bahan_baku_id
--         ... AND COALESCE(NULLIF(bh.kemasan_qty,0), b.faktor_tampilan, 0) > 0

DO $$
DECLARE v_def text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='po_on_verified') THEN
    RAISE EXCEPTION 'ASERSI GAGAL: po_on_verified masih ada';
  END IF;
  FOR v_def IN SELECT pg_get_functiondef(oid) FROM pg_proc
    WHERE pronamespace='public'::regnamespace
      AND proname IN ('get_waste_breakdown','get_waste_incidents','get_waste_summary_v2')
  LOOP
    IF v_def NOT LIKE '%kemasan_qty%' THEN
      RAISE EXCEPTION 'ASERSI GAGAL: fungsi waste belum memakai kemasan_qty';
    END IF;
    IF v_def NOT LIKE '%is_owner_or_admin%' THEN
      RAISE EXCEPTION 'ASERSI GAGAL: gate is_owner_or_admin hilang saat salin';
    END IF;
  END LOOP;
  SELECT pg_get_functiondef('public.fill_harga_snapshot'::regproc) INTO v_def;
  IF v_def NOT LIKE '%kemasan_qty%' OR v_def NOT LIKE '%vendor_induk%' THEN
    RAISE EXCEPTION 'ASERSI GAGAL: fill_harga_snapshot salah salin';
  END IF;
END $$;

COMMIT;
```

- [ ] **Step 3: Tulis uji t1 (kontrol negatif wajib)**

```sql
-- supabase/verifikasi/hpp_dinamis/t1_pengerasan.sql
-- Harapan: "HASIL T1: LULUS ..."
BEGIN;
DO $$
DECLARE v_keju uuid; v_kecil_baru numeric; v_kecil_manual numeric; v_ok boolean;
        v_owner uuid; v_n int;
BEGIN
  SELECT id INTO v_owner FROM outlet_staff WHERE role='owner' AND status='active' LIMIT 1;
  SELECT id INTO v_keju FROM bahan_baku WHERE nama='KEJU';  -- bahan 3 tingkat
  IF v_owner IS NULL OR v_keju IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner,'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- (a) hpp_kecil KEJU di breakdown = harga_beli / kemasan_qty
  SELECT bh.harga_beli / bh.kemasan_qty INTO v_kecil_manual FROM bahan_baku_harga bh WHERE bh.bahan_baku_id=v_keju;
  SELECT max(hpp_kecil) INTO v_kecil_baru FROM get_waste_breakdown('2026-08-01','2026-09-14') WHERE bahan_baku_id = v_keju;
  IF v_kecil_baru IS NOT NULL AND abs(v_kecil_baru - v_kecil_manual) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (a): hpp_kecil KEJU % <> %', v_kecil_baru, v_kecil_manual;
  END IF;
  EXECUTE 'RESET ROLE';

  -- (b) po_on_verified tidak ada
  SELECT count(*) INTO v_n FROM pg_proc WHERE proname='po_on_verified';
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (b): po_on_verified ada'; END IF;

  -- (c) kontrol negatif: asersi yang PASTI salah harus melempar
  v_ok := false;
  BEGIN
    IF v_kecil_manual = v_kecil_manual THEN RAISE EXCEPTION 'KONTROL'; END IF;
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): kontrol negatif tidak melempar'; END IF;

  RAISE EXCEPTION 'HASIL T1: LULUS (hpp_kecil kemasan_qty, po_on_verified hilang, kontrol negatif)';
END $$;
ROLLBACK;
```
Catatan: bila KEJU tidak punya baris waste pada rentang itu, `v_kecil_baru` NULL dan (a) lolos kosong — ganti bahan dengan yang punya waste (`SELECT b.nama FROM stok_waste_reports w JOIN bahan_baku b ON b.id=w.bahan_baku_id WHERE b.faktor_tengah IS NOT NULL LIMIT 3`).

- [ ] **Step 4: Apply migration**

```bash
supabase db query --linked -f supabase/migrations/20260915210000_pengerasan_harga.sql
supabase db query --linked "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260915210000','pengerasan_harga') ON CONFLICT (version) DO NOTHING"
```
Expected: tanpa error (asersi di dalam file diam).

- [ ] **Step 5: Regresi baseline + uji t1**

```bash
supabase db query --linked -f "$TEMP/baseline_waste.sql"
supabase db query --linked -f supabase/verifikasi/hpp_dinamis/t1_pengerasan.sql
```
Expected: `waste_periode_agu`, `waste_periode_sep` **identik** dengan Step 1 (20 desimal). `breakdown_sep_sum_nilai` identik (nilai = qty×harga_beli, tak tergantung pembagi). `po_on_verified_ada=0`. t1 berakhir dengan error berbunyi `HASIL T1: LULUS`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260915210000_pengerasan_harga.sql supabase/verifikasi/hpp_dinamis/t1_pengerasan.sql
git commit -m "fix(db): drop zombie po_on_verified, seragamkan pembagi hpp_kecil & snapshot ke kemasan_qty

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `harga_bahan_efektif()` + `can_view_hpp_dinamis()`

**Files:**
- Create: `supabase/migrations/20260915220000_harga_bahan_efektif.sql`
- Create: `supabase/verifikasi/hpp_dinamis/t2_harga_efektif.sql`

**Interfaces:**
- Consumes: `surat_jalan_item(harga_snapshot, qty_terima, verified_at)`, `surat_jalan(outlet_id, created_at, auto_verified_at)`, `terima_vendor_outlet(harga_snapshot, tanggal_terima, status)`, `bahan_baku_harga_history(harga_lama, harga_baru, changed_at)`, `bahan_baku_harga(harga_beli, kemasan_qty)`.
- Produces:
  - `public.harga_bahan_efektif(p_outlet uuid, p_bahan uuid, p_tanggal date) RETURNS TABLE(harga_besar numeric, harga_kecil numeric, sumber_harga text, ref_id uuid, ref_tanggal date)` — `sumber_harga ∈ {kiriman, drop_ship, master_historis, master_sekarang, tidak_ada}`; `harga_kecil = harga_besar / pembagi`.
  - `public.can_view_hpp_dinamis() RETURNS boolean`.

- [ ] **Step 1: Cek nilai `terima_vendor_outlet.status` yang ada**

```bash
supabase db query --linked "SELECT status, count(*) FROM terima_vendor_outlet GROUP BY 1"
grep -n "status" supabase/migrations/20260911120000_drop_ship_skema.sql | head
```
Expected: kenali nilai "ditolak"-nya (mis. `ditolak`/`rejected`). Pakai nilai itu di filter tingkat 2 di bawah (`tvo.status <> '<nilai ditolak>'`).

- [ ] **Step 2: Tulis migration**

```sql
-- supabase/migrations/20260915220000_harga_bahan_efektif.sql
-- Spec §2 (harga bertingkat) & §7. Harga diselesaikan saat DIBACA.
BEGIN;

CREATE OR REPLACE FUNCTION public.can_view_hpp_dinamis()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(auth.jwt()->>'role' = 'service_role', false)
      OR EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND status = 'active'
                   AND role IN ('kitchen','purchasing','admin_finance','admin','owner',
                                'spv','regional_manager','leader','area_manager','developer'));
$$;
REVOKE ALL ON FUNCTION public.can_view_hpp_dinamis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_hpp_dinamis() TO authenticated;

CREATE OR REPLACE FUNCTION public.harga_bahan_efektif(p_outlet uuid, p_bahan uuid, p_tanggal date)
RETURNS TABLE(harga_besar numeric, harga_kecil numeric, sumber_harga text, ref_id uuid, ref_tanggal date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pembagi AS (
    SELECT COALESCE(NULLIF(bh.kemasan_qty,0),
             NULLIF(CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
                         THEN b.faktor_tampilan ELSE b.faktor_konversi END,0), 1) AS d
    FROM public.bahan_baku b
    LEFT JOIN public.bahan_baku_harga bh ON bh.bahan_baku_id = b.id
    WHERE b.id = p_bahan
  ),
  kandidat AS (
    -- 1. kiriman terverifikasi terakhir (manusia ATAU auto) ke outlet ini
    SELECT 1 AS prio, sji.harga_snapshot AS h, 'kiriman'::text AS s, sj.id AS rid,
           (COALESCE(sji.verified_at, sj.auto_verified_at, sj.created_at) AT TIME ZONE 'Asia/Jakarta')::date AS rt,
           COALESCE(sji.verified_at, sj.auto_verified_at, sj.created_at) AS ts
    FROM public.surat_jalan_item sji
    JOIN public.surat_jalan sj ON sj.id = sji.surat_jalan_id
    WHERE sj.outlet_id = p_outlet AND sji.bahan_baku_id = p_bahan
      AND sji.qty_terima IS NOT NULL AND sji.qty_terima > 0
      AND COALESCE(sji.harga_snapshot,0) > 0
      AND (COALESCE(sji.verified_at, sj.auto_verified_at, sj.created_at) AT TIME ZONE 'Asia/Jakarta')::date <= p_tanggal
    UNION ALL
    -- 2. drop-ship vendor ke outlet ini
    SELECT 2, tvo.harga_snapshot, 'drop_ship', tvo.id, tvo.tanggal_terima, tvo.dicatat_at
    FROM public.terima_vendor_outlet tvo
    WHERE tvo.outlet_id = p_outlet AND tvo.bahan_baku_id = p_bahan
      AND COALESCE(tvo.harga_snapshot,0) > 0 AND tvo.tanggal_terima <= p_tanggal
      AND tvo.status <> 'ditolak'   -- ganti sesuai Step 1
    UNION ALL
    -- 3. riwayat master (hanya baris yang benar-benar mengubah harga)
    SELECT 3, h.harga_baru, 'master_historis', h.id,
           (h.changed_at AT TIME ZONE 'Asia/Jakarta')::date, h.changed_at
    FROM public.bahan_baku_harga_history h
    WHERE h.bahan_baku_id = p_bahan AND COALESCE(h.harga_baru,0) > 0
      AND h.harga_lama IS DISTINCT FROM h.harga_baru
      AND (h.changed_at AT TIME ZONE 'Asia/Jakarta')::date <= p_tanggal
    UNION ALL
    -- 4. master sekarang
    SELECT 4, bh.harga_beli, 'master_sekarang', NULL::uuid, NULL::date, NULL::timestamptz
    FROM public.bahan_baku_harga bh
    WHERE bh.bahan_baku_id = p_bahan AND COALESCE(bh.harga_beli,0) > 0
  ),
  pilih AS (SELECT * FROM kandidat ORDER BY prio, ts DESC NULLS LAST LIMIT 1)
  SELECT COALESCE(p.h, 0), COALESCE(p.h, 0) / pb.d, COALESCE(p.s, 'tidak_ada'), p.rid, p.rt
  FROM pembagi pb LEFT JOIN pilih p ON true;
$$;
REVOKE ALL ON FUNCTION public.harga_bahan_efektif(uuid,uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.harga_bahan_efektif(uuid,uuid,date) TO authenticated;

DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.harga_bahan_efektif'::regproc) INTO v_def;
  IF v_def NOT LIKE '%SECURITY DEFINER%' OR v_def NOT LIKE '%search_path%' THEN
    RAISE EXCEPTION 'ASERSI GAGAL: harga_bahan_efektif bukan DEFINER/search_path';
  END IF;
END $$;
COMMIT;
```

- [ ] **Step 3: Tulis uji t2 — lima tingkat + kontrol negatif**

```sql
-- supabase/verifikasi/hpp_dinamis/t2_harga_efektif.sql
-- Harapan: "HASIL T2: LULUS ..."
BEGIN;
DO $$
DECLARE v_empang uuid; v_bahan uuid; v_sj uuid; r record; v_ok boolean;
        v_bahan_tanpa_harga uuid; v_crew uuid;
BEGIN
  SELECT id INTO v_empang FROM outlets WHERE name='SUKA SHAWARMA EMPANG';
  -- bahan dengan kiriman terverifikasi ke Empang di September
  SELECT sji.bahan_baku_id, sj.id INTO v_bahan, v_sj
  FROM surat_jalan_item sji JOIN surat_jalan sj ON sj.id=sji.surat_jalan_id
  WHERE sj.outlet_id=v_empang AND sji.qty_terima>0 AND sji.harga_snapshot>0
    AND sj.created_at >= '2026-09-01' ORDER BY sj.created_at DESC LIMIT 1;
  IF v_bahan IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture kiriman Empang'; END IF;

  -- (a) tanggal hari ini -> tingkat 1 'kiriman', ref = SJ terbaru
  SELECT * INTO r FROM harga_bahan_efektif(v_empang, v_bahan, current_date);
  IF r.sumber_harga <> 'kiriman' THEN RAISE EXCEPTION 'GAGAL (a): sumber % bukan kiriman', r.sumber_harga; END IF;
  IF r.harga_besar <= 0 OR r.harga_kecil <= 0 OR r.harga_kecil > r.harga_besar THEN
    RAISE EXCEPTION 'GAGAL (a): harga besar % kecil %', r.harga_besar, r.harga_kecil; END IF;

  -- (b) tanggal 2026-08-15 (sebelum snapshot bersih) -> bukan 'kiriman' September
  SELECT * INTO r FROM harga_bahan_efektif(v_empang, v_bahan, '2026-08-15');
  IF r.ref_tanggal IS NOT NULL AND r.ref_tanggal > '2026-08-15' THEN
    RAISE EXCEPTION 'GAGAL (b): memakai referensi masa depan %', r.ref_tanggal; END IF;

  -- (c) outlet tanpa kiriman bahan ini (Gudang Pusat sendiri) -> master_historis/master_sekarang
  SELECT * INTO r FROM harga_bahan_efektif('d23e11b3-23f1-4f9a-b428-cc73e1aa9b90', v_bahan, current_date);
  IF r.sumber_harga NOT IN ('master_historis','master_sekarang','drop_ship') THEN
    RAISE EXCEPTION 'GAGAL (c): sumber % untuk gudang', r.sumber_harga; END IF;

  -- (d) bahan tanpa harga master sama sekali -> 'tidak_ada', harga 0
  SELECT b.id INTO v_bahan_tanpa_harga FROM bahan_baku b
  LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id=b.id
  WHERE bh.bahan_baku_id IS NULL AND NOT EXISTS (SELECT 1 FROM bahan_baku_harga_history h WHERE h.bahan_baku_id=b.id)
  LIMIT 1;
  IF v_bahan_tanpa_harga IS NOT NULL THEN
    SELECT * INTO r FROM harga_bahan_efektif(v_empang, v_bahan_tanpa_harga, current_date);
    IF r.sumber_harga <> 'tidak_ada' OR r.harga_besar <> 0 THEN
      RAISE EXCEPTION 'GAGAL (d): % / %', r.sumber_harga, r.harga_besar; END IF;
  END IF;

  -- (e) crew tidak boleh memanggil can_view_hpp_dinamis = true
  SELECT id INTO v_crew FROM outlet_staff WHERE role='crew' AND status='active' LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew,'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF public.can_view_hpp_dinamis() THEN RAISE EXCEPTION 'GAGAL (e): crew lolos gate'; END IF;
  EXECUTE 'RESET ROLE';

  -- (f) kontrol negatif
  v_ok := false;
  BEGIN
    SELECT * INTO r FROM harga_bahan_efektif(v_empang, v_bahan, current_date);
    IF r.sumber_harga = 'kiriman' THEN RAISE EXCEPTION 'KONTROL'; END IF;
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f): kontrol negatif tidak melempar'; END IF;

  RAISE EXCEPTION 'HASIL T2: LULUS (kiriman, batas tanggal, gudang fallback, tidak_ada, gate crew, kontrol negatif)';
END $$;
ROLLBACK;
```

- [ ] **Step 4: Apply + stempel + uji**

```bash
supabase db query --linked -f supabase/migrations/20260915220000_harga_bahan_efektif.sql
supabase db query --linked "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260915220000','harga_bahan_efektif') ON CONFLICT (version) DO NOTHING"
supabase db query --linked -f supabase/verifikasi/hpp_dinamis/t2_harga_efektif.sql
```
Expected: t2 berakhir `HASIL T2: LULUS`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260915220000_harga_bahan_efektif.sql supabase/verifikasi/hpp_dinamis/t2_harga_efektif.sql
git commit -m "feat(db): harga_bahan_efektif bertingkat (kiriman > drop-ship > riwayat > master) + gate HPP dinamis

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: PO memberi makan katalog vendor

**Files:**
- Create: `supabase/migrations/20260915230000_katalog_tulis_dari_po.sql`
- Create: `supabase/verifikasi/hpp_dinamis/t3_katalog_po.sql`
- Read: `supabase/migrations/20260908150000_guard_harga_master_po_uji_coba.sql:29-317` (badan `verifikasi_terima_po` — **pendefinisi terakhir**, sudah dicek: tidak ada file bernomor lebih besar yang mendefinisikannya ulang; cek lagi dengan `grep -ln "FUNCTION public.verifikasi_terima_po" supabase/migrations/* | sort | tail -1`)

**Interfaces:**
- Consumes: `bahan_baku_supplier` (UNIQUE `(bahan_baku_id, supplier_id)`, `satuan_beli`, `isi_satuan_kecil > 0`, `harga >= 0`, `sumber ∈ {po, manual}`, `perlu_ditinjau`, `ref_po_id`, `harga_updated_at`), trigger `trg_bbs_normalisasi_satuan` (lowercase+trim), `bbs_tulis_riwayat` (DEFINER).
- Produces: `public.katalog_tulis_dari_po(p_bahan uuid, p_supplier uuid, p_harga_besar numeric, p_po_id uuid) RETURNS void`; `verifikasi_terima_po` memanggilnya di cabang guard-lolos.

- [ ] **Step 1: Tulis migration**

```sql
-- supabase/migrations/20260915230000_katalog_tulis_dari_po.sql
-- Spec §3. Katalog = "harga terakhir per vendor". Hanya ditulis bila kedua
-- guard verifikasi_terima_po lolos (PO uji coba, salah satuan) — sama seperti
-- master. Harga disimpan per satuan_beli katalog (FOIL: roll, bukan Dus).
BEGIN;

CREATE OR REPLACE FUNCTION public.katalog_tulis_dari_po(
  p_bahan uuid, p_supplier uuid, p_harga_besar numeric, p_po_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pembagi numeric;   -- satuan kecil per satuan besar (kemasan_qty / faktor penuh)
  v_isi     numeric;   -- satuan kecil per satuan_beli katalog
  v_harga   numeric;
  v_satuan  text;
BEGIN
  IF p_supplier IS NULL OR p_bahan IS NULL OR COALESCE(p_harga_besar,0) <= 0 THEN RETURN; END IF;

  SELECT COALESCE(NULLIF(bh.kemasan_qty,0),
           NULLIF(CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
                       THEN b.faktor_tampilan ELSE b.faktor_konversi END,0), 1),
         lower(btrim(b.satuan))
    INTO v_pembagi, v_satuan
  FROM public.bahan_baku b LEFT JOIN public.bahan_baku_harga bh ON bh.bahan_baku_id = b.id
  WHERE b.id = p_bahan;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT bs.isi_satuan_kecil INTO v_isi
  FROM public.bahan_baku_supplier bs WHERE bs.bahan_baku_id = p_bahan AND bs.supplier_id = p_supplier;

  IF FOUND THEN
    -- harga per satuan_beli = harga per satuan kecil x isi satuan_beli
    IF COALESCE(v_isi,0) <= 0 THEN RETURN; END IF;   -- tidak bisa dikonversi: diam
    v_harga := p_harga_besar / v_pembagi * v_isi;
    UPDATE public.bahan_baku_supplier
       SET harga = v_harga, harga_updated_at = now(), ref_po_id = p_po_id,
           sumber = 'po', perlu_ditinjau = false, is_active = true,
           updated_by = auth.uid()
     WHERE bahan_baku_id = p_bahan AND supplier_id = p_supplier;
  ELSE
    INSERT INTO public.bahan_baku_supplier
      (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga,
       sumber, perlu_ditinjau, ref_po_id, harga_updated_at, updated_by)
    VALUES (p_bahan, p_supplier, v_satuan, v_pembagi, p_harga_besar,
            'po', false, p_po_id, now(), auth.uid());
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.katalog_tulis_dari_po(uuid,uuid,numeric,uuid) FROM PUBLIC, anon, authenticated;
-- hanya dipanggil dari verifikasi_terima_po (DEFINER); tidak perlu GRANT ke authenticated

-- verifikasi_terima_po: salin badan UTUH dari 20260908150000 baris 29-317, lalu
-- (1) tambah di DECLARE:      v_supplier_id UUID;
-- (2) setelah "SELECT status, nomor_po INTO v_status, v_nomor_po ..." tambah:
--     SELECT supplier_id INTO v_supplier_id FROM public.purchase_order WHERE id = p_po_id;
-- (3) di cabang ELSE (guard lolos), TEPAT SETELAH blok
--     "INSERT INTO public.bahan_baku_harga (...) ON CONFLICT ... DO UPDATE ...;"
--     tambah satu baris:
--     PERFORM public.katalog_tulis_dari_po(v_bb_id, v_supplier_id, v_harga_trima, p_po_id);
-- Tidak ada baris lain yang berubah.

DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.verifikasi_terima_po'::regproc) INTO v_def;
  IF v_def NOT LIKE '%GUARD PO UJI COBA%' OR v_def NOT LIKE '%GUARD SALAH SATUAN%' THEN
    RAISE EXCEPTION 'ASERSI GAGAL: guard hilang saat menyalin verifikasi_terima_po';
  END IF;
  IF v_def NOT LIKE '%katalog_tulis_dari_po%' THEN
    RAISE EXCEPTION 'ASERSI GAGAL: verifikasi_terima_po tidak memanggil katalog';
  END IF;
  IF v_def NOT LIKE '%can_manage_po%' OR v_def NOT LIKE '%to_ledger_scale%' THEN
    RAISE EXCEPTION 'ASERSI GAGAL: badan verifikasi_terima_po tidak utuh';
  END IF;
END $$;
COMMIT;
```

- [ ] **Step 2: Tulis uji t3 (dalam transaksi, ROLLBACK)**

```sql
-- supabase/verifikasi/hpp_dinamis/t3_katalog_po.sql
-- Harapan: "HASIL T3: LULUS ..."
BEGIN;
DO $$
DECLARE v_foil uuid; v_eka uuid; v_kentang uuid; v_agro uuid; v_kitchen uuid;
        v_po uuid; v_poi uuid; v_isi numeric; v_harga_katalog numeric; v_harga_master numeric;
        v_n int; v_ok boolean; v_n_hist int;
BEGIN
  SELECT id INTO v_foil FROM bahan_baku WHERE nama='FOIL';
  SELECT id INTO v_kentang FROM bahan_baku WHERE nama='KENTANG';
  SELECT s.id INTO v_eka FROM supplier s WHERE s.nama ILIKE 'Ekadharma%' LIMIT 1;
  SELECT s.id INTO v_agro FROM supplier s WHERE s.nama ILIKE '%Agro Boga%' LIMIT 1;
  SELECT id INTO v_kitchen FROM outlet_staff WHERE role='kitchen' AND status='active' LIMIT 1;
  IF v_foil IS NULL OR v_eka IS NULL OR v_kentang IS NULL OR v_agro IS NULL OR v_kitchen IS NULL THEN
    RAISE EXCEPTION 'GAGAL: fixture'; END IF;

  -- (a) FOIL/Ekadharma: satuan_beli 'roll' (isi 760), master Dus (kemasan_qty 36480).
  --     Harga besar 554.592/Dus harus jadi 11.554/roll — BUKAN 554.592.
  SELECT isi_satuan_kecil INTO v_isi FROM bahan_baku_supplier WHERE bahan_baku_id=v_foil AND supplier_id=v_eka;
  IF v_isi IS NULL THEN RAISE EXCEPTION 'GAGAL (a): katalog FOIL/Eka tak ada'; END IF;
  PERFORM public.katalog_tulis_dari_po(v_foil, v_eka, 554592, NULL);
  SELECT harga INTO v_harga_katalog FROM bahan_baku_supplier WHERE bahan_baku_id=v_foil AND supplier_id=v_eka;
  IF abs(v_harga_katalog - 554592.0/36480*v_isi) > 0.5 THEN
    RAISE EXCEPTION 'GAGAL (a): FOIL katalog % (harap ~% per roll)', v_harga_katalog, 554592.0/36480*v_isi; END IF;

  -- (b) KENTANG/Agro: satuan_beli = satuan master -> harga apa adanya
  PERFORM public.katalog_tulis_dari_po(v_kentang, v_agro, 251000, NULL);
  SELECT harga, perlu_ditinjau INTO v_harga_katalog, v_ok FROM bahan_baku_supplier WHERE bahan_baku_id=v_kentang AND supplier_id=v_agro;
  IF v_harga_katalog <> 251000 OR v_ok THEN RAISE EXCEPTION 'GAGAL (b): % / ditinjau=%', v_harga_katalog, v_ok; END IF;

  -- (c) pasangan baru (KENTANG/Ekadharma) -> INSERT dengan satuan master
  PERFORM public.katalog_tulis_dari_po(v_kentang, v_eka, 240000, NULL);
  SELECT count(*) INTO v_n FROM bahan_baku_supplier WHERE bahan_baku_id=v_kentang AND supplier_id=v_eka AND sumber='po' AND harga=240000;
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL (c): baris baru tidak dibuat'; END IF;

  -- (d) riwayat katalog ikut bertambah (trigger bbs_tulis_riwayat)
  SELECT count(*) INTO v_n_hist FROM bahan_baku_supplier_history h
   JOIN bahan_baku_supplier bs ON bs.id=h.bahan_baku_supplier_id
  WHERE bs.bahan_baku_id=v_kentang AND bs.supplier_id=v_agro;
  IF v_n_hist < 1 THEN RAISE EXCEPTION 'GAGAL (d): riwayat katalog tidak ditulis'; END IF;

  -- (e) PO uji coba lewat verifikasi_terima_po TIDAK menulis katalog
  --     buat PO uji + item KENTANG/Agro, verifikasi sebagai kitchen
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kitchen,'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO purchase_order (nomor_po, supplier_id, supplier_nama, status, created_by)
  VALUES ('TEST/PO/T3', v_agro, 'Agro', 'dikirim_ke_supplier', v_kitchen) RETURNING id INTO v_po;
  INSERT INTO purchase_order_item (purchase_order_id, bahan_baku_id, qty_pesan, harga_pesan)
  VALUES (v_po, v_kentang, 1, 999999) RETURNING id INTO v_poi;
  PERFORM public.verifikasi_terima_po(v_po, jsonb_build_array(jsonb_build_object('id', v_poi, 'qty_datang', 1, 'harga_terima', 999999)));
  EXECUTE 'RESET ROLE';
  SELECT harga INTO v_harga_katalog FROM bahan_baku_supplier WHERE bahan_baku_id=v_kentang AND supplier_id=v_agro;
  IF v_harga_katalog = 999999 THEN RAISE EXCEPTION 'GAGAL (e): PO uji menulis katalog'; END IF;
  SELECT harga_beli INTO v_harga_master FROM bahan_baku_harga WHERE bahan_baku_id=v_kentang;
  IF v_harga_master = 999999 THEN RAISE EXCEPTION 'GAGAL (e): PO uji menulis master (guard lama rusak!)'; END IF;

  -- (f) kontrol negatif
  v_ok := false;
  BEGIN IF v_harga_katalog <> 999999 THEN RAISE EXCEPTION 'KONTROL'; END IF;
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f): kontrol negatif'; END IF;

  RAISE EXCEPTION 'HASIL T3: LULUS (FOIL per roll, KENTANG apa adanya, pasangan baru, riwayat, PO uji ditolak, kontrol negatif)';
END $$;
ROLLBACK;
```
Kolom `purchase_order`/`purchase_order_item` yang NOT NULL mungkin lebih banyak dari yang ditulis di (e) — cek `\d` lewat `information_schema.columns WHERE is_nullable='NO'` dan lengkapi INSERT-nya; jangan ubah asersinya.

- [ ] **Step 3: Apply + stempel + uji**

```bash
supabase db query --linked -f supabase/migrations/20260915230000_katalog_tulis_dari_po.sql
supabase db query --linked "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260915230000','katalog_tulis_dari_po') ON CONFLICT (version) DO NOTHING"
supabase db query --linked -f supabase/verifikasi/hpp_dinamis/t3_katalog_po.sql
supabase db query --linked "SELECT count(*) FROM bahan_baku_supplier WHERE sumber='po' AND ref_po_id IS NOT NULL AND harga_updated_at > now() - interval '5 minutes'"
```
Expected: t3 `HASIL T3: LULUS`; kueri terakhir **0** (ROLLBACK benar-benar membuang tulisan uji).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260915230000_katalog_tulis_dari_po.sql supabase/verifikasi/hpp_dinamis/t3_katalog_po.sql
git commit -m "feat(db): verifikasi PO menulis harga ke katalog vendor bila guard lolos

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: RPC `get_hpp_dinamis_bahan` & `get_hpp_dinamis_menu`

**Files:**
- Create: `supabase/migrations/20260915233000_rpc_hpp_dinamis.sql`
- Create: `supabase/verifikasi/hpp_dinamis/t4_rpc.sql`

**Interfaces:**
- Consumes: `harga_bahan_efektif`, `can_view_hpp_dinamis`, `outlet_ids_terhitung()`, `accessible_outlet_ids()`, `saldo_is_gram(stok_balance)`, `ledger_stok`, `orders`/`order_items`, `resep`/`resep_item`, `menu_items(hpp_override, price, name)`.
- Produces (dipakai Task 7 apa adanya):
  ```
  get_hpp_dinamis_bahan(p_outlet uuid, p_from date, p_to date) RETURNS TABLE(
    bahan_baku_id uuid, nama_bahan text, satuan text, satuan_kecil text, is_gram boolean,
    qty_pemakaian numeric,          -- skala ledger (kecil bila is_gram, besar bila tidak)
    nilai numeric,                  -- Rp
    sumber_harga_terakhir text, ref_id_terakhir uuid, ref_tanggal_terakhir date,
    nilai_kiriman numeric, nilai_drop_ship numeric, nilai_master_historis numeric,
    nilai_master_sekarang numeric, nilai_tidak_ada numeric)
  get_hpp_dinamis_menu(p_outlet uuid, p_from date, p_to date) RETURNS TABLE(
    menu_item_id uuid, menu_nama text, harga_jual numeric, qty_terjual numeric,
    punya_resep boolean, hpp_override_unit numeric, hpp_override_total numeric,
    hpp_teoritis_total numeric, hpp_teoritis_unit numeric)
  ```

- [ ] **Step 1: Tulis migration**

```sql
-- supabase/migrations/20260915233000_rpc_hpp_dinamis.sql
-- Spec §2 (grain), §7. Harga diselesaikan saat dibaca; ledger tidak disentuh.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_hpp_dinamis_bahan(p_outlet uuid, p_from date, p_to date)
RETURNS TABLE(
  bahan_baku_id uuid, nama_bahan text, satuan text, satuan_kecil text, is_gram boolean,
  qty_pemakaian numeric, nilai numeric,
  sumber_harga_terakhir text, ref_id_terakhir uuid, ref_tanggal_terakhir date,
  nilai_kiriman numeric, nilai_drop_ship numeric, nilai_master_historis numeric,
  nilai_master_sekarang numeric, nilai_tidak_ada numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.can_view_hpp_dinamis() THEN
    RAISE EXCEPTION 'Tidak berwenang melihat HPP dinamis' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_outlet NOT IN (SELECT public.outlet_ids_terhitung())
     OR p_outlet NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Outlet di luar cakupan' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_to < p_from OR p_to - p_from > 92 THEN
    RAISE EXCEPTION 'Rentang maksimal 92 hari';
  END IF;

  -- #variable_conflict use_column: kolom OUT (bahan_baku_id, nilai, satuan, ...)
  -- bernama sama dengan kolom CTE; tanpa ini plpgsql melempar "ambiguous".
  RETURN QUERY
  WITH pem AS (
    -- pemakaian BOM + adjustment pembalik void (ref_order_id), net per bahan per hari
    SELECT l.bahan_baku_id, (l.created_at AT TIME ZONE 'Asia/Jakarta')::date AS tgl, -SUM(l.qty) AS qty
    FROM public.ledger_stok l
    WHERE l.outlet_id = p_outlet AND l.ref_order_id IS NOT NULL
      AND l.tipe IN ('pemakaian','adjustment')
      AND (l.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
    GROUP BY 1, 2
  ),
  skala AS (
    SELECT sb.bahan_baku_id, public.saldo_is_gram(sb) AS g FROM public.stok_balance sb WHERE sb.outlet_id = p_outlet
  ),
  harian AS (
    SELECT p.bahan_baku_id, p.tgl, p.qty, COALESCE(s.g, false) AS g,
           h.harga_besar, h.harga_kecil, h.sumber_harga, h.ref_id, h.ref_tanggal,
           CASE WHEN COALESCE(s.g,false) THEN p.qty * h.harga_kecil ELSE p.qty * h.harga_besar END AS nilai_hari
    FROM pem p
    LEFT JOIN skala s ON s.bahan_baku_id = p.bahan_baku_id
    CROSS JOIN LATERAL public.harga_bahan_efektif(p_outlet, p.bahan_baku_id, p.tgl) h
  )
  SELECT hr.bahan_baku_id, b.nama, b.satuan, b.satuan_kecil, bool_or(hr.g),
         SUM(hr.qty), SUM(hr.nilai_hari),
         (array_agg(hr.sumber_harga ORDER BY hr.tgl DESC))[1],
         (array_agg(hr.ref_id ORDER BY hr.tgl DESC))[1],
         (array_agg(hr.ref_tanggal ORDER BY hr.tgl DESC))[1],
         SUM(hr.nilai_hari) FILTER (WHERE hr.sumber_harga = 'kiriman'),
         SUM(hr.nilai_hari) FILTER (WHERE hr.sumber_harga = 'drop_ship'),
         SUM(hr.nilai_hari) FILTER (WHERE hr.sumber_harga = 'master_historis'),
         SUM(hr.nilai_hari) FILTER (WHERE hr.sumber_harga = 'master_sekarang'),
         SUM(hr.nilai_hari) FILTER (WHERE hr.sumber_harga = 'tidak_ada')
  FROM harian hr JOIN public.bahan_baku b ON b.id = hr.bahan_baku_id
  GROUP BY hr.bahan_baku_id, b.nama, b.satuan, b.satuan_kecil
  ORDER BY SUM(hr.nilai_hari) DESC NULLS LAST;
END $$;

CREATE OR REPLACE FUNCTION public.get_hpp_dinamis_menu(p_outlet uuid, p_from date, p_to date)
RETURNS TABLE(
  menu_item_id uuid, menu_nama text, harga_jual numeric, qty_terjual numeric,
  punya_resep boolean, hpp_override_unit numeric, hpp_override_total numeric,
  hpp_teoritis_total numeric, hpp_teoritis_unit numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.can_view_hpp_dinamis() THEN
    RAISE EXCEPTION 'Tidak berwenang melihat HPP dinamis' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_outlet NOT IN (SELECT public.outlet_ids_terhitung())
     OR p_outlet NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Outlet di luar cakupan' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_to < p_from OR p_to - p_from > 92 THEN
    RAISE EXCEPTION 'Rentang maksimal 92 hari';
  END IF;

  RETURN QUERY
  WITH terjual AS (
    SELECT oi.menu_item_id, (o.created_at AT TIME ZONE 'Asia/Jakarta')::date AS tgl, SUM(oi.quantity) AS qty
    FROM public.orders o JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.outlet_id = p_outlet AND o.status = 'completed' AND oi.menu_item_id IS NOT NULL
      AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
    GROUP BY 1, 2
  ),
  resep_terpilih AS (
    SELECT DISTINCT ON (t.menu_item_id) t.menu_item_id, r.id AS resep_id
    FROM (SELECT DISTINCT tj.menu_item_id FROM terjual tj) t
    JOIN public.resep r ON r.menu_item_ref = t.menu_item_id::text AND r.is_active
     AND ((r.scope = 'outlet' AND r.outlet_id = p_outlet) OR r.scope = 'global')
    ORDER BY t.menu_item_id, CASE WHEN r.scope = 'outlet' THEN 1 ELSE 2 END
  ),
  teoritis AS (
    SELECT t.menu_item_id, SUM(t.qty * ri.qty_per_porsi * h.harga_kecil) AS total
    FROM terjual t
    JOIN resep_terpilih rt ON rt.menu_item_id = t.menu_item_id
    JOIN public.resep_item ri ON ri.resep_id = rt.resep_id
    CROSS JOIN LATERAL public.harga_bahan_efektif(p_outlet, ri.bahan_baku_id, t.tgl) h
    GROUP BY t.menu_item_id
  ),
  agg AS (SELECT tj.menu_item_id, SUM(tj.qty) AS qty FROM terjual tj GROUP BY tj.menu_item_id)
  SELECT a.menu_item_id, m.name, COALESCE(m.price,0), a.qty,
         (rt.resep_id IS NOT NULL),
         COALESCE(m.hpp_override,0), COALESCE(m.hpp_override,0) * a.qty,
         te.total, CASE WHEN a.qty > 0 THEN te.total / a.qty END
  FROM agg a
  JOIN public.menu_items m ON m.id = a.menu_item_id
  LEFT JOIN resep_terpilih rt ON rt.menu_item_id = a.menu_item_id
  LEFT JOIN teoritis te ON te.menu_item_id = a.menu_item_id
  ORDER BY a.qty DESC;
END $$;

REVOKE ALL ON FUNCTION public.get_hpp_dinamis_bahan(uuid,date,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_hpp_dinamis_menu(uuid,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hpp_dinamis_bahan(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hpp_dinamis_menu(uuid,date,date) TO authenticated;

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_proc WHERE proname IN ('get_hpp_dinamis_bahan','get_hpp_dinamis_menu') AND prosecdef) <> 2 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: RPC HPP dinamis tidak terpasang sebagai DEFINER';
  END IF;
END $$;
COMMIT;
```

- [ ] **Step 2: Tulis uji t4**

```sql
-- supabase/verifikasi/hpp_dinamis/t4_rpc.sql
-- Harapan: "HASIL T4: LULUS ..."
BEGIN;
DO $$
DECLARE v_empang uuid; v_tes uuid; v_kitchen uuid; v_crew uuid;
        v_n int; v_nilai numeric; v_qty numeric; v_ok boolean; r record;
        v_teoritis numeric; v_periode numeric;
BEGIN
  SELECT id INTO v_empang FROM outlets WHERE name='SUKA SHAWARMA EMPANG';
  SELECT id INTO v_tes FROM outlets WHERE type='test' LIMIT 1;
  SELECT id INTO v_kitchen FROM outlet_staff WHERE role='kitchen' AND status='active' LIMIT 1;
  SELECT id INTO v_crew FROM outlet_staff WHERE role='crew' AND status='active' LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kitchen,'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- (a) bahan Empang 1-14 Sep: ada baris, nilai > 0, porsi kiriman > 0
  SELECT count(*), SUM(nilai), SUM(nilai_kiriman) INTO v_n, v_nilai, v_qty
  FROM get_hpp_dinamis_bahan(v_empang, '2026-09-01', '2026-09-14');
  IF v_n < 10 OR v_nilai <= 0 OR COALESCE(v_qty,0) <= 0 THEN
    RAISE EXCEPTION 'GAGAL (a): n=% nilai=% kiriman=%', v_n, v_nilai, v_qty; END IF;

  -- (b) porsi sumber menjumlah ke nilai (tidak ada sumber di luar 5 kategori)
  SELECT SUM(nilai) - SUM(COALESCE(nilai_kiriman,0)+COALESCE(nilai_drop_ship,0)+COALESCE(nilai_master_historis,0)
                        +COALESCE(nilai_master_sekarang,0)+COALESCE(nilai_tidak_ada,0)) INTO v_nilai
  FROM get_hpp_dinamis_bahan(v_empang, '2026-09-01', '2026-09-14');
  IF abs(v_nilai) > 0.01 THEN RAISE EXCEPTION 'GAGAL (b): porsi sumber tidak menjumlah, selisih %', v_nilai; END IF;

  -- (c) menu Empang: menu ber-resep punya hpp_teoritis_total > 0; tanpa resep NULL
  SELECT count(*) INTO v_n FROM get_hpp_dinamis_menu(v_empang, '2026-09-01', '2026-09-14')
  WHERE punya_resep AND COALESCE(hpp_teoritis_total,0) <= 0;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (c): % menu ber-resep tanpa HPP teoritis', v_n; END IF;
  SELECT count(*) INTO v_n FROM get_hpp_dinamis_menu(v_empang, '2026-09-01', '2026-09-14')
  WHERE NOT punya_resep AND hpp_teoritis_total IS NOT NULL;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (c): menu tanpa resep dapat HPP teoritis'; END IF;

  -- (d) sanity vs get_hpp_periode (harga master hari ini): teoritis dinamis
  --     harus dalam ±40% dari HPP periode (bukan 10x / 0.1x = salah skala)
  SELECT SUM(hpp_teoritis_total) INTO v_teoritis FROM get_hpp_dinamis_menu(v_empang, '2026-09-01', '2026-09-14');
  SELECT hpp INTO v_periode FROM get_hpp_periode('2026-09-01', '2026-09-14') WHERE outlet_id = v_empang;
  IF v_periode > 0 AND (v_teoritis / v_periode < 0.6 OR v_teoritis / v_periode > 1.4) THEN
    RAISE EXCEPTION 'GAGAL (d): teoritis dinamis % vs periode % — cek skala', v_teoritis, v_periode; END IF;

  -- (e) outlet tes ditolak
  v_ok := false;
  BEGIN PERFORM get_hpp_dinamis_bahan(v_tes, '2026-09-01', '2026-09-14');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (e): outlet tes ikut terhitung'; END IF;

  -- (f) rentang > 92 hari ditolak
  v_ok := false;
  BEGIN PERFORM get_hpp_dinamis_menu(v_empang, '2026-01-01', '2026-09-14');
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f): rentang panjang lolos'; END IF;
  EXECUTE 'RESET ROLE';

  -- (g) crew ditolak
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew,'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_ok := false;
  BEGIN PERFORM get_hpp_dinamis_bahan(v_empang, '2026-09-01', '2026-09-14');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (g): crew bisa baca HPP dinamis'; END IF;
  EXECUTE 'RESET ROLE';

  -- (h) kontrol negatif
  v_ok := false;
  BEGIN IF v_teoritis > 0 THEN RAISE EXCEPTION 'KONTROL'; END IF;
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (h)'; END IF;

  RAISE EXCEPTION 'HASIL T4: LULUS (bahan, porsi sumber, menu, sanity skala, outlet tes, rentang, crew, kontrol negatif)';
END $$;
ROLLBACK;
```

- [ ] **Step 3: Apply + stempel + uji + ukur waktu**

```bash
supabase db query --linked -f supabase/migrations/20260915233000_rpc_hpp_dinamis.sql
supabase db query --linked "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260915233000','rpc_hpp_dinamis') ON CONFLICT (version) DO NOTHING"
supabase db query --linked -f supabase/verifikasi/hpp_dinamis/t4_rpc.sql
supabase db query --linked "EXPLAIN ANALYZE SELECT * FROM get_hpp_dinamis_bahan((SELECT id FROM outlets WHERE name='SUKA SHAWARMA EMPANG'), '2026-09-01','2026-09-14')"
```
Expected: t4 `HASIL T4: LULUS`. EXPLAIN ANALYZE total < 3 detik untuk 14 hari Empang (≈22.700 baris pemakaian → ≈600 pasangan bahan×hari → 600 panggilan `harga_bahan_efektif`). Kalau > 3 detik: tambah index `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_sji_bahan_sj ON surat_jalan_item(bahan_baku_id, surat_jalan_id)` dan `ix_ledger_outlet_order_created ON ledger_stok(outlet_id, created_at) WHERE ref_order_id IS NOT NULL` sebagai migration terpisah `20260915233500`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260915233000_rpc_hpp_dinamis.sql supabase/verifikasi/hpp_dinamis/t4_rpc.sql
git commit -m "feat(db): RPC get_hpp_dinamis_bahan (aktual, ledger pemakaian) & get_hpp_dinamis_menu (teoritis)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Fungsi murni `hppDinamis.ts` (TDD)

**Files:**
- Create: `apps/stok/src/lib/stok/hppDinamis.ts`
- Create: `apps/stok/src/lib/stok/hppDinamis.test.ts`

**Interfaces:**
- Produces (dipakai Task 7 & 8):
  ```ts
  export type SumberHarga = 'kiriman' | 'drop_ship' | 'master_historis' | 'master_sekarang' | 'tidak_ada'
  export interface HppDinamisBahanRow { bahan_baku_id: string; nama_bahan: string; satuan: string; satuan_kecil: string | null; is_gram: boolean; qty_pemakaian: number; nilai: number; sumber_harga_terakhir: SumberHarga; ref_id_terakhir: string | null; ref_tanggal_terakhir: string | null; nilai_kiriman: number | null; nilai_drop_ship: number | null; nilai_master_historis: number | null; nilai_master_sekarang: number | null; nilai_tidak_ada: number | null }
  export interface HppDinamisMenuRow { menu_item_id: string; menu_nama: string; harga_jual: number; qty_terjual: number; punya_resep: boolean; hpp_override_unit: number; hpp_override_total: number; hpp_teoritis_total: number | null; hpp_teoritis_unit: number | null }
  export interface RingkasanHppDinamis { totalOverride: number; totalTeoritis: number; totalAktual: number; porsi: Record<SumberHarga, number>; /* 0..100 */ menuTanpaResep: number; selisihTeoritisVsOverridePct: number | null; selisihAktualVsTeoritisPct: number | null }
  export function ringkasHppDinamis(menu: HppDinamisMenuRow[], bahan: HppDinamisBahanRow[]): RingkasanHppDinamis
  export function selisihPct(nilai: number, acuan: number): number | null   // null bila acuan <= 0
  export const LABEL_SUMBER: Record<SumberHarga, string>
  export function periodeSebelumSnapshot(from: string): boolean  // from < '2026-09-01'
  ```

- [ ] **Step 1: Tulis test yang gagal**

```ts
// apps/stok/src/lib/stok/hppDinamis.test.ts
import { describe, it, expect } from 'vitest'
import { ringkasHppDinamis, selisihPct, periodeSebelumSnapshot, LABEL_SUMBER, type HppDinamisBahanRow, type HppDinamisMenuRow } from './hppDinamis'

const bahan = (o: Partial<HppDinamisBahanRow>): HppDinamisBahanRow => ({
  bahan_baku_id: 'b', nama_bahan: 'SAPI', satuan: 'Blok', satuan_kecil: 'gram', is_gram: true,
  qty_pemakaian: 100, nilai: 1000, sumber_harga_terakhir: 'kiriman', ref_id_terakhir: null, ref_tanggal_terakhir: null,
  nilai_kiriman: 1000, nilai_drop_ship: null, nilai_master_historis: null, nilai_master_sekarang: null, nilai_tidak_ada: null, ...o,
})
const menu = (o: Partial<HppDinamisMenuRow>): HppDinamisMenuRow => ({
  menu_item_id: 'm', menu_nama: 'Sapi Jumbo', harga_jual: 42000, qty_terjual: 10, punya_resep: true,
  hpp_override_unit: 24000, hpp_override_total: 240000, hpp_teoritis_total: 195640, hpp_teoritis_unit: 19564, ...o,
})

describe('selisihPct', () => {
  it('menghitung persen terhadap acuan', () => { expect(selisihPct(120, 100)).toBe(20) })
  it('null bila acuan nol/negatif', () => { expect(selisihPct(10, 0)).toBeNull(); expect(selisihPct(10, -1)).toBeNull() })
})

describe('periodeSebelumSnapshot', () => {
  it('true sebelum 1 Sep 2026', () => { expect(periodeSebelumSnapshot('2026-08-31')).toBe(true) })
  it('false mulai 1 Sep 2026', () => { expect(periodeSebelumSnapshot('2026-09-01')).toBe(false) })
})

describe('ringkasHppDinamis', () => {
  it('menjumlah override, teoritis, aktual dan porsi sumber', () => {
    const r = ringkasHppDinamis(
      [menu({}), menu({ menu_item_id: 'x', punya_resep: false, hpp_teoritis_total: null, hpp_override_total: 50000 })],
      [bahan({ nilai: 600, nilai_kiriman: 600 }), bahan({ bahan_baku_id: 'c', nilai: 400, nilai_kiriman: null, nilai_master_sekarang: 400, sumber_harga_terakhir: 'master_sekarang' })],
    )
    expect(r.totalOverride).toBe(290000)
    expect(r.totalTeoritis).toBe(195640)
    expect(r.totalAktual).toBe(1000)
    expect(r.porsi.kiriman).toBe(60)
    expect(r.porsi.master_sekarang).toBe(40)
    expect(r.porsi.tidak_ada).toBe(0)
    expect(r.menuTanpaResep).toBe(1)
  })
  it('selisih teoritis vs override hanya dari menu ber-resep', () => {
    const r = ringkasHppDinamis([menu({}), menu({ menu_item_id: 'x', punya_resep: false, hpp_teoritis_total: null, hpp_override_total: 50000 })], [])
    // 195640 vs 240000 (override menu ber-resep saja) = -18.48%
    expect(r.selisihTeoritisVsOverridePct).toBeCloseTo(-18.48, 1)
  })
  it('porsi nol & selisih null bila tidak ada data', () => {
    const r = ringkasHppDinamis([], [])
    expect(r.totalAktual).toBe(0)
    expect(r.porsi.kiriman).toBe(0)
    expect(r.selisihAktualVsTeoritisPct).toBeNull()
  })
  it('label sumber lengkap', () => {
    expect(Object.keys(LABEL_SUMBER)).toEqual(['kiriman', 'drop_ship', 'master_historis', 'master_sekarang', 'tidak_ada'])
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/stok" && ./node_modules/.bin/vitest run src/lib/stok/hppDinamis.test.ts
```
Expected: FAIL — modul `./hppDinamis` tidak ditemukan. (`npx` rusak di repo ini; pakai `./node_modules/.bin/vitest`, kalau tidak ada pakai `../../node_modules/.bin/vitest`.)

- [ ] **Step 3: Implementasi**

```ts
// apps/stok/src/lib/stok/hppDinamis.ts
// Fungsi murni untuk panel HPP Dinamis (spec 2026-09-15 §4). Tanpa I/O.

export type SumberHarga = 'kiriman' | 'drop_ship' | 'master_historis' | 'master_sekarang' | 'tidak_ada'

export const SUMBER_URUT: SumberHarga[] = ['kiriman', 'drop_ship', 'master_historis', 'master_sekarang', 'tidak_ada']

export const LABEL_SUMBER: Record<SumberHarga, string> = {
  kiriman: 'Kiriman gudang',
  drop_ship: 'Drop-ship vendor',
  master_historis: 'Harga master (riwayat)',
  master_sekarang: 'Harga master (sekarang)',
  tidak_ada: 'Tanpa harga',
}

/** Batas jujur data snapshot kiriman — sebelum ini HPP praktis memakai harga master. */
export const TANGGAL_MULAI_SNAPSHOT = '2026-09-01'

export interface HppDinamisBahanRow {
  bahan_baku_id: string
  nama_bahan: string
  satuan: string
  satuan_kecil: string | null
  is_gram: boolean
  qty_pemakaian: number
  nilai: number
  sumber_harga_terakhir: SumberHarga
  ref_id_terakhir: string | null
  ref_tanggal_terakhir: string | null
  nilai_kiriman: number | null
  nilai_drop_ship: number | null
  nilai_master_historis: number | null
  nilai_master_sekarang: number | null
  nilai_tidak_ada: number | null
}

export interface HppDinamisMenuRow {
  menu_item_id: string
  menu_nama: string
  harga_jual: number
  qty_terjual: number
  punya_resep: boolean
  hpp_override_unit: number
  hpp_override_total: number
  hpp_teoritis_total: number | null
  hpp_teoritis_unit: number | null
}

export interface RingkasanHppDinamis {
  totalOverride: number
  totalTeoritis: number
  totalAktual: number
  porsi: Record<SumberHarga, number>
  menuTanpaResep: number
  selisihTeoritisVsOverridePct: number | null
  selisihAktualVsTeoritisPct: number | null
}

export function selisihPct(nilai: number, acuan: number): number | null {
  if (!(acuan > 0)) return null
  return ((nilai - acuan) / acuan) * 100
}

export function periodeSebelumSnapshot(from: string): boolean {
  return from < TANGGAL_MULAI_SNAPSHOT
}

const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function ringkasHppDinamis(menu: HppDinamisMenuRow[], bahan: HppDinamisBahanRow[]): RingkasanHppDinamis {
  const totalOverride = menu.reduce((s, m) => s + n(m.hpp_override_total), 0)
  const berResep = menu.filter((m) => m.punya_resep)
  const totalTeoritis = berResep.reduce((s, m) => s + n(m.hpp_teoritis_total), 0)
  const overrideBerResep = berResep.reduce((s, m) => s + n(m.hpp_override_total), 0)
  const totalAktual = bahan.reduce((s, b) => s + n(b.nilai), 0)

  const perSumber: Record<SumberHarga, number> = { kiriman: 0, drop_ship: 0, master_historis: 0, master_sekarang: 0, tidak_ada: 0 }
  for (const b of bahan) {
    perSumber.kiriman += n(b.nilai_kiriman)
    perSumber.drop_ship += n(b.nilai_drop_ship)
    perSumber.master_historis += n(b.nilai_master_historis)
    perSumber.master_sekarang += n(b.nilai_master_sekarang)
    perSumber.tidak_ada += n(b.nilai_tidak_ada)
  }
  const porsi = { ...perSumber }
  for (const k of SUMBER_URUT) porsi[k] = totalAktual > 0 ? (perSumber[k] / totalAktual) * 100 : 0

  return {
    totalOverride,
    totalTeoritis,
    totalAktual,
    porsi,
    menuTanpaResep: menu.length - berResep.length,
    selisihTeoritisVsOverridePct: selisihPct(totalTeoritis, overrideBerResep),
    selisihAktualVsTeoritisPct: selisihPct(totalAktual, totalTeoritis),
  }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/stok" && ./node_modules/.bin/vitest run src/lib/stok/hppDinamis.test.ts
```
Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/lib/stok/hppDinamis.ts apps/stok/src/lib/stok/hppDinamis.test.ts
git commit -m "feat(stok): fungsi murni ringkasan HPP dinamis (porsi sumber, selisih)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Server action + hook `useHPPDinamis`

**Files:**
- Create: `apps/stok/src/app/actions/hppDinamis.ts`
- Create: `apps/stok/src/hooks/useHPPDinamis.ts`
- Read: `apps/stok/src/app/actions/hppMenu.ts:1-25` (pola `getAuthedClient`)

**Interfaces:**
- Consumes: RPC Task 5; tipe Task 6.
- Produces:
  ```ts
  // actions
  export async function fetchHPPDinamis(outletId: string, from: string, to: string): Promise<{ menu: HppDinamisMenuRow[]; bahan: HppDinamisBahanRow[] }>
  // hook
  export function useHPPDinamis(outletId: string | null, from: string, to: string)  // useQuery, enabled bila outletId && from && to
  ```

- [ ] **Step 1: Server action (client ber-cookie, BUKAN service-role — gate RPC harus berlaku)**

```ts
// apps/stok/src/app/actions/hppDinamis.ts
'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import type { HppDinamisBahanRow, HppDinamisMenuRow } from '@/lib/stok/hppDinamis'

async function getAuthedClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options as any)),
  })
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// SENGAJA memakai client ber-sesi, bukan makeServiceClient(): RPC-nya memeriksa
// role (can_view_hpp_dinamis) dan cakupan outlet (accessible_outlet_ids) —
// service-role akan melewati keduanya (pelajaran Session 2026-07-20).
export async function fetchHPPDinamis(
  outletId: string,
  from: string,
  to: string,
): Promise<{ menu: HppDinamisMenuRow[]; bahan: HppDinamisBahanRow[] }> {
  if (!outletId || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    throw new Error('Parameter outlet/periode tidak valid')
  }
  const supabase = await getAuthedClient()
  const [menuRes, bahanRes] = await Promise.all([
    supabase.rpc('get_hpp_dinamis_menu', { p_outlet: outletId, p_from: from, p_to: to }),
    supabase.rpc('get_hpp_dinamis_bahan', { p_outlet: outletId, p_from: from, p_to: to }),
  ])
  if (menuRes.error) throw new Error(menuRes.error.message)
  if (bahanRes.error) throw new Error(bahanRes.error.message)

  const num = (v: unknown) => (v == null ? null : Number(v))
  const menu = (menuRes.data ?? []).map((r: any): HppDinamisMenuRow => ({
    menu_item_id: r.menu_item_id,
    menu_nama: r.menu_nama,
    harga_jual: Number(r.harga_jual ?? 0),
    qty_terjual: Number(r.qty_terjual ?? 0),
    punya_resep: !!r.punya_resep,
    hpp_override_unit: Number(r.hpp_override_unit ?? 0),
    hpp_override_total: Number(r.hpp_override_total ?? 0),
    hpp_teoritis_total: num(r.hpp_teoritis_total),
    hpp_teoritis_unit: num(r.hpp_teoritis_unit),
  }))
  const bahan = (bahanRes.data ?? []).map((r: any): HppDinamisBahanRow => ({
    bahan_baku_id: r.bahan_baku_id,
    nama_bahan: r.nama_bahan,
    satuan: r.satuan,
    satuan_kecil: r.satuan_kecil ?? null,
    is_gram: !!r.is_gram,
    qty_pemakaian: Number(r.qty_pemakaian ?? 0),
    nilai: Number(r.nilai ?? 0),
    sumber_harga_terakhir: r.sumber_harga_terakhir,
    ref_id_terakhir: r.ref_id_terakhir ?? null,
    ref_tanggal_terakhir: r.ref_tanggal_terakhir ?? null,
    nilai_kiriman: num(r.nilai_kiriman),
    nilai_drop_ship: num(r.nilai_drop_ship),
    nilai_master_historis: num(r.nilai_master_historis),
    nilai_master_sekarang: num(r.nilai_master_sekarang),
    nilai_tidak_ada: num(r.nilai_tidak_ada),
  }))
  return { menu, bahan }
}
```

- [ ] **Step 2: Hook**

```ts
// apps/stok/src/hooks/useHPPDinamis.ts
import { useQuery } from '@tanstack/react-query'
import { fetchHPPDinamis } from '@/app/actions/hppDinamis'

export function useHPPDinamis(outletId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ['hpp-dinamis', outletId, from, to],
    queryFn: () => fetchHPPDinamis(outletId as string, from, to),
    enabled: !!outletId && !!from && !!to,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
```

- [ ] **Step 3: Type-check**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/stok" && yarn type-check
```
Expected: 0 error (bandingkan dengan `git stash`-free baseline: jalankan sebelum & sesudah, error hanya boleh pre-existing).

- [ ] **Step 4: Commit**

```bash
git add apps/stok/src/app/actions/hppDinamis.ts apps/stok/src/hooks/useHPPDinamis.ts
git commit -m "feat(stok): server action & hook HPP dinamis (client ber-sesi, gate RPC berlaku)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Panel `HPPDinamisPanel` di halaman HPP Menu

**Files:**
- Create: `apps/stok/src/components/hpp/HPPDinamisPanel.tsx`
- Modify: `apps/stok/src/app/stok/hpp-menu/page.tsx` (tambah panel di bawah `<HPPMenuBoard />`)
- Read: `apps/stok/src/hooks/useOutletScope.tsx:139` (`useOutletScope()` → `boundOutlets`, `selectedOutletId`), `apps/stok/src/components/hpp/HPPMenuBoard.tsx:1-30` (gaya kelas Tailwind `suka-*`)

**Interfaces:**
- Consumes: `useHPPDinamis`, `ringkasHppDinamis`, `LABEL_SUMBER`, `SUMBER_URUT`, `periodeSebelumSnapshot`, `selisihPct`, `useOutletScope`.
- Produces: `export function HPPDinamisPanel(): JSX.Element`.

- [ ] **Step 1: Komponen**

```tsx
// apps/stok/src/components/hpp/HPPDinamisPanel.tsx
'use client'

import React, { useMemo, useState } from 'react'
import { AlertTriangle, Info, RefreshCw } from 'lucide-react'
import { useOutletScope } from '@/hooks/useOutletScope'
import { useHPPDinamis } from '@/hooks/useHPPDinamis'
import {
  ringkasHppDinamis, selisihPct, periodeSebelumSnapshot, LABEL_SUMBER, SUMBER_URUT,
  TANGGAL_MULAI_SNAPSHOT,
} from '@/lib/stok/hppDinamis'

const rp = (v: number | null | undefined) =>
  v == null ? '—' : 'Rp' + Math.round(v).toLocaleString('id-ID')
const pct = (v: number | null) => (v == null ? 'N/A' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`)

function awalBulan(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function hariIni(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function HPPDinamisPanel() {
  const { boundOutlets, selectedOutletId } = useOutletScope()
  const [outletId, setOutletId] = useState<string | null>(selectedOutletId)
  const [from, setFrom] = useState(awalBulan())
  const [to, setTo] = useState(hariIni())
  const { data, isLoading, isFetching, error, refetch } = useHPPDinamis(outletId, from, to)

  const ringkas = useMemo(() => (data ? ringkasHppDinamis(data.menu, data.bahan) : null), [data])

  return (
    <section className="mt-10 rounded-2xl border border-suka-brown/10 bg-white p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-black text-suka-brown">HPP Dinamis (pembanding)</h2>
          <p className="text-xs text-suka-brown/60">
            Harga mengikuti kiriman gudang terakhir ke outlet. <b>Pelaporan resmi tetap memakai HPP override.</b>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-suka-brown/20 px-2 py-1.5 text-sm"
            value={outletId ?? ''}
            onChange={(e) => setOutletId(e.target.value || null)}
          >
            <option value="">Pilih outlet…</option>
            {boundOutlets.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <input type="date" className="rounded-lg border border-suka-brown/20 px-2 py-1.5 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-xs text-suka-brown/50">s/d</span>
          <input type="date" className="rounded-lg border border-suka-brown/20 px-2 py-1.5 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" onClick={() => refetch()} className="rounded-lg border border-suka-brown/20 p-2" aria-label="Muat ulang">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {periodeSebelumSnapshot(from) && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Harga kiriman belum tersedia sebelum {TANGGAL_MULAI_SNAPSHOT}. HPP periode ini memakai harga master, bukan kiriman.</span>
        </div>
      )}

      {!outletId && <p className="mt-6 text-sm text-suka-brown/60">Pilih outlet untuk mulai.</p>}
      {error && <p className="mt-6 text-sm text-red-700">{(error as Error).message}</p>}
      {outletId && isLoading && <p className="mt-6 text-sm text-suka-brown/60">Menghitung…</p>}

      {data && ringkas && (
        <>
          {/* Ringkasan outlet */}
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="HPP Override (laporan)" value={rp(ringkas.totalOverride)} />
            <Tile label="HPP Teoritis dinamis" value={rp(ringkas.totalTeoritis)} sub={`vs override menu ber-resep: ${pct(ringkas.selisihTeoritisVsOverridePct)}`} />
            <Tile label="HPP Aktual (ledger pemakaian)" value={rp(ringkas.totalAktual)} sub={`vs teoritis: ${pct(ringkas.selisihAktualVsTeoritisPct)}`} />
            <Tile label="Menu tanpa resep" value={String(ringkas.menuTanpaResep)} sub="hanya override" />
          </div>

          {/* Porsi sumber harga */}
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {SUMBER_URUT.map((s) => (
              <span key={s} className={`rounded-full px-2.5 py-1 ${s === 'tidak_ada' && ringkas.porsi[s] > 0 ? 'bg-red-100 text-red-800' : 'bg-suka-cream text-suka-brown'}`}>
                {LABEL_SUMBER[s]}: {ringkas.porsi[s].toFixed(0)}%
              </span>
            ))}
            <span className="inline-flex items-center gap-1 text-suka-brown/50"><Info className="h-3 w-3" /> porsi dari nilai HPP aktual</span>
          </div>

          {/* Per menu */}
          <h3 className="mt-8 text-sm font-bold text-suka-brown">Per menu (teoritis: resep × harga efektif outlet)</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-suka-brown/60">
                <tr><th className="py-1 pr-3">Menu</th><th className="pr-3 text-right">Terjual</th><th className="pr-3 text-right">Override/unit</th><th className="pr-3 text-right">Dinamis/unit</th><th className="pr-3 text-right">Selisih</th><th className="pr-3 text-right">Override total</th><th className="text-right">Dinamis total</th></tr>
              </thead>
              <tbody>
                {data.menu.map((m) => (
                  <tr key={m.menu_item_id} className="border-t border-suka-brown/5">
                    <td className="py-1.5 pr-3">{m.menu_nama}{!m.punya_resep && <span className="ml-1 text-[10px] text-suka-brown/40">(tanpa resep)</span>}</td>
                    <td className="pr-3 text-right">{m.qty_terjual}</td>
                    <td className="pr-3 text-right">{rp(m.hpp_override_unit)}</td>
                    <td className="pr-3 text-right">{rp(m.hpp_teoritis_unit)}</td>
                    <td className="pr-3 text-right">{m.punya_resep ? pct(selisihPct(m.hpp_teoritis_unit ?? 0, m.hpp_override_unit)) : '—'}</td>
                    <td className="pr-3 text-right">{rp(m.hpp_override_total)}</td>
                    <td className="text-right">{rp(m.hpp_teoritis_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per bahan */}
          <h3 className="mt-8 text-sm font-bold text-suka-brown">Per bahan (aktual: ledger pemakaian × harga efektif)</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-suka-brown/60">
                <tr><th className="py-1 pr-3">Bahan</th><th className="pr-3 text-right">Qty pemakaian</th><th className="pr-3">Sumber harga</th><th className="pr-3">Ref terakhir</th><th className="text-right">Nilai</th></tr>
              </thead>
              <tbody>
                {data.bahan.map((b) => (
                  <tr key={b.bahan_baku_id} className="border-t border-suka-brown/5">
                    <td className="py-1.5 pr-3">{b.nama_bahan}</td>
                    <td className="pr-3 text-right">{b.qty_pemakaian.toLocaleString('id-ID', { maximumFractionDigits: 2 })} {b.is_gram ? (b.satuan_kecil ?? '') : b.satuan}</td>
                    <td className="pr-3"><span className={b.sumber_harga_terakhir === 'tidak_ada' ? 'text-red-700 font-semibold' : ''}>{LABEL_SUMBER[b.sumber_harga_terakhir]}</span></td>
                    <td className="pr-3 text-suka-brown/60">{b.ref_tanggal_terakhir ?? '—'}{b.ref_id_terakhir ? ` · ${b.ref_id_terakhir.slice(0, 8)}` : ''}</td>
                    <td className="text-right">{rp(b.nilai)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-suka-cream p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-suka-brown/60">{label}</p>
      <p className="mt-1 text-lg font-black text-suka-brown">{value}</p>
      {sub && <p className="text-[11px] text-suka-brown/60">{sub}</p>}
    </div>
  )}
```

- [ ] **Step 2: Pasang di halaman**

Di `apps/stok/src/app/stok/hpp-menu/page.tsx`: tambah `import { HPPDinamisPanel } from '@/components/hpp/HPPDinamisPanel'` dan ubah isi `<main>` menjadi:
```tsx
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <HPPMenuBoard />
          <HPPDinamisPanel />
        </main>
```

- [ ] **Step 3: Type-check + test + build**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/stok"
yarn type-check
./node_modules/.bin/vitest run
./node_modules/.bin/next build --webpack
```
Expected: 0 error baru; semua test lulus (baseline 129 + 7); build sukses, route `/stok/hpp-menu` tetap ada. (`yarn build` polos bisa gagal Turbopack/symlink di worktree — bukan cacat produk; pakai `--webpack`.)

- [ ] **Step 4: Smoke test browser (dev server, login kitchen)**

Jalankan dev server `apps/stok` lewat Browser pane (`preview_start`), login akun kitchen, buka `/stok/hpp-menu`, pilih SUKA SHAWARMA EMPANG, periode 2026-09-01 s/d hari ini. Periksa: 4 tile terisi; porsi "Kiriman gudang" > 0%; tabel menu memuat "Original Sapi Jumbo" dengan Override/unit 24.000 dan Dinamis/unit dalam rentang 15.000–25.000; tabel bahan tanpa baris "Tanpa harga" berwarna merah (kalau ada, catat bahannya di laporan Task — itu temuan, bukan bug panel). Ambil screenshot. Ganti `from` ke 2026-08-15 → banner amber muncul.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/components/hpp/HPPDinamisPanel.tsx apps/stok/src/app/stok/hpp-menu/page.tsx
git commit -m "feat(stok): panel HPP Dinamis berdampingan dengan override di halaman HPP Menu

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Pemantau owner, dokumentasi, pemeriksaan isolasi

**Files:**
- Create: `SS COGS SET/pemantau-hpp-dinamis-2026-09.sql`
- Modify: `CLAUDE.md` (entri sesi baru sebelum "**Last updated:**")
- Modify: `docs/superpowers/specs/2026-09-15-hpp-dinamis-harga-kiriman-design.md` (status → dieksekusi, tanggal apply tiap migration)

- [ ] **Step 1: Skrip pemantau (satu kueri per giliran, pola `saldo_vendor/pemantau.sql`)**

```sql
-- SS COGS SET/pemantau-hpp-dinamis-2026-09.sql
-- Jalankan sebagai owner/admin/kitchen (RPC ber-gate). Satu blok per giliran.

-- Q1: selisih teoritis-dinamis vs override per menu, semua outlet, bulan berjalan
SELECT o.name AS outlet, m.menu_nama, m.qty_terjual,
       m.hpp_override_unit, round(m.hpp_teoritis_unit) AS hpp_dinamis_unit,
       round(100.0*(m.hpp_teoritis_unit - m.hpp_override_unit)/NULLIF(m.hpp_override_unit,0),1) AS selisih_pct
FROM outlets o
CROSS JOIN LATERAL get_hpp_dinamis_menu(o.id, date_trunc('month', current_date)::date, current_date) m
WHERE o.id IN (SELECT outlet_ids_terhitung()) AND m.punya_resep
ORDER BY abs(m.hpp_teoritis_unit - m.hpp_override_unit) * m.qty_terjual DESC
LIMIT 50;

-- Q2: porsi sumber harga per outlet (target: kiriman naik dari minggu ke minggu)
SELECT o.name AS outlet,
       round(100*SUM(b.nilai_kiriman)/NULLIF(SUM(b.nilai),0)) AS pct_kiriman,
       round(100*SUM(b.nilai_drop_ship)/NULLIF(SUM(b.nilai),0)) AS pct_drop_ship,
       round(100*(SUM(b.nilai_master_historis)+SUM(b.nilai_master_sekarang))/NULLIF(SUM(b.nilai),0)) AS pct_master,
       round(100*SUM(b.nilai_tidak_ada)/NULLIF(SUM(b.nilai),0)) AS pct_tidak_ada
FROM outlets o
CROSS JOIN LATERAL get_hpp_dinamis_bahan(o.id, current_date - 6, current_date) b
WHERE o.id IN (SELECT outlet_ids_terhitung())
GROUP BY o.name ORDER BY pct_kiriman NULLS FIRST;

-- Q3: aktual vs teoritis per outlet (selisih besar = substitusi/BOM/skala perlu dilihat)
SELECT o.name AS outlet,
       (SELECT SUM(nilai) FROM get_hpp_dinamis_bahan(o.id, date_trunc('month', current_date)::date, current_date)) AS aktual,
       (SELECT SUM(hpp_teoritis_total) FROM get_hpp_dinamis_menu(o.id, date_trunc('month', current_date)::date, current_date)) AS teoritis
FROM outlets o WHERE o.id IN (SELECT outlet_ids_terhitung())
ORDER BY 1;

-- Q4: bahan resep tanpa harga sama sekali (harus 0 baris)
SELECT DISTINCT b.nama FROM resep_item ri JOIN bahan_baku b ON b.id=ri.bahan_baku_id
LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id=b.id
WHERE b.is_active AND COALESCE(bh.harga_beli,0) = 0;

-- Q5: katalog vendor yang mulai terisi dari PO (harus naik dari 0)
SELECT count(*) FILTER (WHERE sumber='po' AND ref_po_id IS NOT NULL) AS dari_po,
       count(*) FILTER (WHERE perlu_ditinjau) AS perlu_ditinjau, count(*) AS total
FROM bahan_baku_supplier WHERE is_active;
```
Jalankan sekali: `supabase db query --linked -f "SS COGS SET/pemantau-hpp-dinamis-2026-09.sql"` (blok per blok bila CLI menolak multi-statement) dan catat angkanya sebagai baseline di entri CLAUDE.md.

- [ ] **Step 2: Pemeriksaan isolasi (Global Constraints)**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
git diff --name-only main...HEAD | grep -E '^apps/(admin-dashboard|finance|manager|pos-kasir)/' ; echo "exit=$? (1 = bersih)"
git diff --name-only main...HEAD
ls supabase/migrations | cut -c1-14 | sort | uniq -d
supabase migration list --linked 2>&1 | grep 20260915
```
Expected: grep pertama kosong (exit 1); daftar file hanya yang ada di File Structure; nol timestamp duplikat; 6 migration `20260915*` tercatat Local+Remote.

- [ ] **Step 3: Entri CLAUDE.md**

Tambahkan section `## Session 2026-09-15: HPP Dinamis berbasis Harga Kiriman (DB + apps/stok)` berisi: status (migration mana applied+terstempel, kode di branch, ⚠️ perlu redeploy `stok`), keputusan owner (10 poin grilling ringkas), definisi harga bertingkat, grain aktual vs teoritis, tiga outlet BOM dinyalakan + Pamulang, pengerasan, baseline pemantau Q1–Q5, dan "📝 Next": owner memantau sebulan → keputusan ganti laporan; kolom di Profit (admin-dashboard) sebagai sesi terpisah; `useSalesHourlyRaw` masih rawan (tak terkait). Perbarui `**Last updated:** 2026-09-15`.

- [ ] **Step 4: Commit + laporan**

```bash
git add "SS COGS SET/pemantau-hpp-dinamis-2026-09.sql" CLAUDE.md docs/superpowers/specs/2026-09-15-hpp-dinamis-harga-kiriman-design.md
git commit -m "docs: pemantau HPP dinamis, entri sesi, status spec

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
Lalu **jangan merge/push sendiri** — otomasi repo pernah men-push tanpa inisiasi; laporkan ke owner bahwa branch siap, dengan daftar: migration applied (6), redeploy `stok` diperlukan, dan angka baseline pemantau.
