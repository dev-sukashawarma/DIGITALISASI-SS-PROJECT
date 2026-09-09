# Perbaikan Konversi Satuan Waterfall + Bersih-bersih SJ FOIL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup bug limpahan waterfall yang memotong stok bahan pengganti sebesar rasio faktor antar-bahan, lalu membersihkan surat jalan FOIL basi — dua prasyarat sebelum FOIL boleh dipecah jadi dua varian.

**Architecture:** Satu migration `CREATE OR REPLACE` pada `process_waterfall_deduction`, mengubah satuan pelacak sisa potongan dari "satuan besar bahan utama" menjadi **satuan kecil** (basis yang dipakai bersama utama & pengganti), sehingga tiap bahan mengonversi ke skala ledger-nya sendiri. Plus satu migration data untuk membatalkan SJ FOIL basi.

**Tech Stack:** PostgreSQL/PL-pgSQL (Supabase), diterapkan lewat RPC `exec_sql` + stempel manual `schema_migrations` (CLI tanpa kredensial di mesin ini).

**Spec:** `docs/superpowers/specs/2026-09-09-foil-dua-ukuran-design.md` (§3 dan §6)

## Global Constraints

- **Semua perubahan stok WAJIB lewat `ledger_stok`.** Jangan pernah `UPDATE`/`INSERT` `stok_balance` langsung (SOP 2026-07-08).
- **Verifikasi ground-truth di DB live**, jangan percaya status `migration list` (pelajaran 2026-07-08 & 2026-07-14).
- **Migration idempoten**, dan menyertakan blok `-- DOWN:` sebagai komentar.
- **Jangan sentuh kerja developer lain** yang belum di-commit di working tree (`apps/manager/`, `apps/finance/`, `apps/admin-dashboard/` yang sudah `M`).
- **Metode basis harga tidak berubah** — harga penerimaan terakhir. Tidak ada FIFO/WAC.
- **`faktor penuh` sebuah bahan = `bahan_baku.faktor_tampilan`** (dengan `COALESCE(...,1)`), konsisten dengan `to_ledger_scale()` yang sudah ada. Rencana ini **tidak** menyentuh perbedaan `faktor_tampilan` vs `faktor_konversi` yang dipakai `trg_process_bom_stok` — di luar lingkup.
- **Nol perubahan kode aplikasi.** Tidak ada app yang perlu redeploy karena rencana ini.

---

## Keputusan yang sudah diambil (jangan dibuka ulang saat eksekusi)

### K1 — Koreksi mundur 24.001 g SAOS TOMAT KOMPAN DIBATALKAN

Spec §5 langkah 2 semula meminta koreksi ledger untuk kelebihan potong historis.
**Diverifikasi di DB live 9 Sep: tidak perlu, dan akan merusak.**

Kelima outlet terdampak menjalankan opname pada bahan ini hampir tiap hari, dan tiap
`opname_selisih` menyetel saldo ke hitungan fisik:

| Outlet | Saldo kini | Koreksi terakhir |
|---|---:|---|
| DEPOK SUKMAJAYA | 10.093,75 | `opname_selisih` 8, 7, 6, 5 Sep |
| PALEDANG | 16.500 | `opname_selisih` 7, 5, 4 Sep |
| BEJI | 0 | `opname_selisih` 4 Sep |
| EMPANG | 0 | `opname_selisih` 28 Agu |
| KALISARI | 0 | `opname_selisih` 24 Agu |

Kelebihan potong tidak pernah menumpuk — ia dihapus tiap opname. Menyuntik
`adjustment` sekarang justru menambah stok hantu di atas saldo yang sudah benar.

Baris `pemakaian` historis dibiarkan apa adanya: itu jejak audit, dan `opname_selisih`
di sebelahnya sudah mengimbanginya. HPP tidak terpengaruh — `get_hpp_periode`
menghitung dari resep × penjualan, bukan dari ledger.

### K2 — Timestamp 2026, bukan 2030, dengan utang yang dicatat

`process_waterfall_deduction` terakhir didefinisikan `20300105000017`. Migration
bertanggal hari ini **akan ditimpa** kalau seluruh riwayat di-replay dari nol.
Tapi `scripts/migration-timestamp-lint.mjs` menolak timestamp >2 hari ke depan
(`FUTURE_WINDOW_DAYS = 2`) — `20300105000018` gagal CI.

**Putusan: pakai timestamp hari ini.** Ketiga migration 2030 itu sudah applied &
ter-stempel di DB produksi, jadi `db push` tidak akan menjalankannya lagi; urutan file
hanya menggigit pada environment baru dari nol, yang tidak ada di proyek ini.
Preseden sama dipakai 2026-09-07. Konsekuensinya ditulis di header migration
**dan** di §Utang Teknis CLAUDE.md pada Task 4.

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `supabase/migrations/20260909170000_fix_waterfall_konversi_satuan.sql` | `CREATE OR REPLACE process_waterfall_deduction` — sisa dilacak dalam satuan kecil |
| `supabase/migrations/20260909180000_batalkan_sj_foil_basi.sql` | Batalkan SJ FOIL Jul–Agu, daftar id eksplisit |
| `SS COGS SET/verifikasi-waterfall-2026-09-09.sql` | Skrip read-only: bukti sebelum, verifikasi sesudah |
| `docs/superpowers/specs/2026-09-09-foil-dua-ukuran-design.md` | Dikoreksi: §5 langkah 2 dicoret (K1) |
| `CLAUDE.md` | Entri sesi + utang teknis timestamp |

---

## Task 1: Bukti terukur sebelum perbaikan (read-only)

Menghasilkan angka acuan yang harus berubah setelah Task 2. Tanpa ini, "sudah
diperbaiki" tidak bisa dibuktikan.

**Files:**
- Create: `SS COGS SET/verifikasi-waterfall-2026-09-09.sql`

**Interfaces:**
- Produces: berkas SQL berisi 3 query bernama (`Q1`, `Q2`, `Q3`) yang dipakai Task 3.

- [ ] **Step 1: Tulis skrip verifikasi**

```sql
-- verifikasi-waterfall-2026-09-09.sql
-- READ-ONLY. Dijalankan SEBELUM dan SESUDAH 20260909170000.
--
-- Konteks: process_waterfall_deduction melimpahkan sisa potongan ke bahan
-- pengganti tanpa mengonversi satuan. SAOS TOMAT POUCH (12.000 g/Dus) ->
-- SAOS TOMAT KOMPAN (16.500 g/Dus) berasio 1,375.

-- Q1: rasio faktor tiap pasangan substitusi. Pasangan berasio <> 1 = terdampak.
SELECT u.nama AS utama,
       p.nama AS pengganti,
       u.faktor_tampilan AS faktor_utama,
       p.faktor_tampilan AS faktor_pengganti,
       ROUND(p.faktor_tampilan / u.faktor_tampilan, 6) AS rasio_salah_potong
  FROM public.bahan_baku_substitusi s
  JOIN public.bahan_baku u ON u.id = s.bahan_baku_utama_id
  JOIN public.bahan_baku p ON p.id = s.bahan_baku_pengganti_id
 ORDER BY 1, 2;

-- Q2: sidik jari limpahan. Baris pemakaian di bahan PENGGANTI yang nilainya
-- kelipatan rasio dari gram resep (30 -> 41,25 / 50 -> 68,75 / 60 -> 82,5).
-- Setelah perbaikan, baris BARU harus bernilai bulat sesuai resep (30/50/60).
SELECT l.created_at::date AS tanggal,
       o.name            AS outlet,
       b.nama            AS bahan_pengganti,
       l.qty,
       l.catatan
  FROM public.ledger_stok l
  JOIN public.bahan_baku b ON b.id = l.bahan_baku_id
  JOIN public.outlets   o ON o.id = l.outlet_id
 WHERE l.tipe = 'pemakaian'
   AND l.catatan LIKE 'Penjualan%'
   AND l.bahan_baku_id IN (SELECT bahan_baku_pengganti_id FROM public.bahan_baku_substitusi)
   AND l.created_at >= NOW() - INTERVAL '2 days'
 ORDER BY l.created_at DESC
 LIMIT 30;

-- Q3: total limpahan & besar kelebihannya, sepanjang riwayat.
SELECT b.nama AS bahan_pengganti,
       COUNT(*)                                   AS baris,
       ROUND(SUM(l.qty), 2)                       AS total_dipotong,
       ROUND(SUM(l.qty) * (1 - u.faktor_tampilan / p.faktor_tampilan), 2) AS kelebihan
  FROM public.ledger_stok l
  JOIN public.bahan_baku_substitusi s ON s.bahan_baku_pengganti_id = l.bahan_baku_id
  JOIN public.bahan_baku u ON u.id = s.bahan_baku_utama_id
  JOIN public.bahan_baku p ON p.id = s.bahan_baku_pengganti_id
  JOIN public.bahan_baku b ON b.id = l.bahan_baku_id
 WHERE l.tipe = 'pemakaian'
   AND l.catatan LIKE 'Penjualan%'
 GROUP BY b.nama, u.faktor_tampilan, p.faktor_tampilan
 ORDER BY 1;
```

- [ ] **Step 2: Jalankan Q1–Q3, simpan hasilnya**

`exec_sql` mengembalikan `null` untuk `SELECT` (fungsinya `RETURNS void`) — jalankan
lewat klien PostgREST/`supabase-js` dengan service role, bukan `exec_sql`.

Nilai yang harus tercatat sebagai baseline:
- Q1 → `SAOS TOMAT POUCH → SAOS TOMAT KOMPAN` rasio **1,375**; `SAOS CABE POUCH → SAOS CABE` rasio **1,375** (dorman: utama nol stok & nol resep aktif).
- Q2 → baris KOMPAN bernilai **−41,25 / −68,75 / −82,5** (bukan −30 / −50 / −60).
- Q3 → KOMPAN: **2.185 baris, −88.003,61, kelebihan −24.000,98**.

Kalau Q2 tidak mengembalikan baris (2 hari terakhir sepi), longgarkan ke
`INTERVAL '7 days'` — jangan lanjut tanpa satu pun baris pembanding.

- [ ] **Step 3: Commit**

```bash
git add "SS COGS SET/verifikasi-waterfall-2026-09-09.sql"
git commit -m "chore(stok): skrip verifikasi konversi satuan waterfall"
```

---

## Task 2: Migration — sisa potongan dilacak dalam satuan kecil

**Files:**
- Create: `supabase/migrations/20260909170000_fix_waterfall_konversi_satuan.sql`

**Interfaces:**
- Consumes: `saldo_is_gram(stok_balance)`, `bahan_baku.faktor_tampilan`, `bahan_baku_substitusi`
- Produces: `process_waterfall_deduction(uuid, uuid, numeric, text, uuid) RETURNS void` — signature TIDAK berubah; `trg_process_bom_stok` tidak perlu disentuh.

- [ ] **Step 1: Tulis migration**

```sql
-- 20260909170000_fix_waterfall_konversi_satuan.sql
-- process_waterfall_deduction: sisa potongan dilacak dalam SATUAN KECIL.
--
-- BUG YANG DITUTUP
--   Versi sebelumnya (20300105000017) menyimpan sisa potongan dalam satuan
--   BESAR bahan UTAMA, lalu saat melimpah ke bahan pengganti mengalikannya
--   dengan faktor_tampilan si PENGGANTI. Kalau kedua bahan beda faktor, potongan
--   meleset sebesar rasionya.
--
--   Terbukti hidup di produksi: SAOS TOMAT POUCH (12.000 g/Dus) -> SAOS TOMAT
--   KOMPAN (16.500 g/Dus), rasio 1,375. Resep 30 gram memotong 41,25 gram.
--   2.185 baris sejak 2 Agustus, 88.003,61 g dipotong, 24.000,98 g di antaranya
--   tidak pernah benar-benar terpakai.
--
--   Saldo outlet TIDAK dikoreksi mundur: kelima outlet terdampak melakukan
--   opname hampir harian, dan tiap opname_selisih sudah menyetelnya ke hitungan
--   fisik. Menyuntik adjustment sekarang akan menambah stok hantu.
--
-- CARA PERBAIKANNYA
--   Satuan kecil (gram/cm) adalah basis yang dipakai BERSAMA oleh bahan utama
--   dan penggantinya -- itulah sebabnya substitusi hanya sah bila satuan
--   kecilnya sama. Sisa potongan kini dilacak di situ, dan tiap bahan
--   mengonversi ke skala ledger-nya SENDIRI saat menulis baris.
--
-- YANG SENGAJA TIDAK BERUBAH
--   - Signature & tipe balik (trg_process_bom_stok tak perlu disentuh).
--   - Kontrak masukan: p_total_deduction tetap dalam satuan BESAR bahan utama.
--   - Bahan TANPA pengganti tetap menghasilkan SATU baris ledger dan tetap
--     boleh minus -- perilaku lama, dan ini jalur mayoritas tiap order.
--   - Urutan pengganti tetap bahan_baku_substitusi.urutan ASC.
--   - Sisa yang tak tertutup tetap dipaksa ke bahan utama (boleh minus).
--   - SECURITY DEFINER + search_path + REVOKE dipertahankan.
--
-- PERBAIKAN IKUTAN
--   Versi lama membaca faktor bahan utama lewat JOIN ke stok_balance; kalau
--   outlet belum pernah punya baris untuk bahan itu, faktornya NULL dan
--   perhitungan diam-diam jatuh ke besar-scale. Kini faktor bahan utama dibaca
--   langsung dari bahan_baku, jadi selalu ada.
--
-- ⚠️ UTANG TIMESTAMP
--   Fungsi ini juga didefinisikan 20300103000010 / 20300104000005 /
--   20300105000017 yang bertimestamp 2030. Pada replay riwayat dari nol,
--   ketiganya jalan SETELAH file ini dan akan menimpanya. Timestamp 2030
--   TIDAK dipakai di sini karena scripts/migration-timestamp-lint.mjs menolak
--   timestamp >2 hari ke depan (FUTURE_WINDOW_DAYS = 2). Ketiga migration itu
--   sudah applied & ter-stempel di DB produksi sehingga db push tak akan
--   menjalankannya lagi -- risikonya hanya pada environment baru dari nol.
--   Kalau suatu hari ranjau 2030 dibereskan, pindahkan fix ini ke urutan
--   setelahnya.
--
-- Idempoten (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.process_waterfall_deduction(
  p_outlet_id       uuid,
  p_bahan_baku_id   uuid,
  p_total_deduction numeric,
  p_catatan         text,
  p_ref_order_id    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_faktor_utama  NUMERIC;
  v_sisa_kecil    NUMERIC;   -- SELALU dalam satuan kecil
  v_ada_pengganti BOOLEAN;
  v_stock         NUMERIC;
  v_is_gram       BOOLEAN;
  v_faktor        NUMERIC;
  v_stock_kecil   NUMERIC;
  v_ambil_kecil   NUMERIC;
  v_qty_ledger    NUMERIC;
  sub_rec         RECORD;
BEGIN
  IF p_total_deduction IS NULL OR p_total_deduction <= 0 THEN
    RETURN;
  END IF;

  SELECT NULLIF(COALESCE(b.faktor_tampilan, 1), 0)
    INTO v_faktor_utama
    FROM public.bahan_baku b
   WHERE b.id = p_bahan_baku_id;
  v_faktor_utama := COALESCE(v_faktor_utama, 1);

  v_sisa_kecil := p_total_deduction * v_faktor_utama;

  SELECT EXISTS (
    SELECT 1 FROM public.bahan_baku_substitusi
     WHERE bahan_baku_utama_id = p_bahan_baku_id
  ) INTO v_ada_pengganti;

  -- ---------- bahan utama ----------
  SELECT sb.saldo, saldo_is_gram(sb), NULLIF(COALESCE(b.faktor_tampilan, 1), 0)
    INTO v_stock, v_is_gram, v_faktor
    FROM public.stok_balance sb
    JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
   WHERE sb.outlet_id = p_outlet_id
     AND sb.bahan_baku_id = p_bahan_baku_id;

  IF NOT FOUND THEN
    v_stock := 0; v_is_gram := false; v_faktor := v_faktor_utama;
  END IF;
  v_stock   := COALESCE(v_stock, 0);
  v_is_gram := COALESCE(v_is_gram, false);
  v_faktor  := COALESCE(v_faktor, 1);

  v_stock_kecil := CASE WHEN v_is_gram THEN v_stock ELSE v_stock * v_faktor END;

  IF NOT v_ada_pengganti OR v_stock_kecil >= v_sisa_kecil THEN
    -- tanpa pengganti: ambil semua (boleh minus) -- perilaku lama
    v_ambil_kecil := v_sisa_kecil;
    v_sisa_kecil  := 0;
  ELSIF v_stock_kecil > 0 THEN
    v_ambil_kecil := v_stock_kecil;
    v_sisa_kecil  := v_sisa_kecil - v_stock_kecil;
  ELSE
    v_ambil_kecil := 0;
  END IF;

  IF v_ambil_kecil > 0 THEN
    v_qty_ledger := CASE WHEN v_is_gram THEN v_ambil_kecil ELSE v_ambil_kecil / v_faktor END;
    INSERT INTO public.ledger_stok (
      outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
    ) VALUES (
      p_outlet_id, p_bahan_baku_id, 'pemakaian', -v_qty_ledger, p_catatan, p_ref_order_id, NOW()
    );
  END IF;

  -- ---------- bahan pengganti, urut prioritas ----------
  FOR sub_rec IN
    SELECT bahan_baku_pengganti_id
      FROM public.bahan_baku_substitusi
     WHERE bahan_baku_utama_id = p_bahan_baku_id
     ORDER BY urutan ASC
  LOOP
    EXIT WHEN v_sisa_kecil <= 0;

    SELECT sb.saldo, saldo_is_gram(sb), NULLIF(COALESCE(b.faktor_tampilan, 1), 0)
      INTO v_stock, v_is_gram, v_faktor
      FROM public.stok_balance sb
      JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
     WHERE sb.outlet_id = p_outlet_id
       AND sb.bahan_baku_id = sub_rec.bahan_baku_pengganti_id;

    CONTINUE WHEN NOT FOUND;

    v_stock   := COALESCE(v_stock, 0);
    v_is_gram := COALESCE(v_is_gram, false);
    v_faktor  := COALESCE(v_faktor, 1);

    v_stock_kecil := CASE WHEN v_is_gram THEN v_stock ELSE v_stock * v_faktor END;
    CONTINUE WHEN v_stock_kecil <= 0;

    v_ambil_kecil := LEAST(v_stock_kecil, v_sisa_kecil);
    v_sisa_kecil  := v_sisa_kecil - v_ambil_kecil;

    v_qty_ledger := CASE WHEN v_is_gram THEN v_ambil_kecil ELSE v_ambil_kecil / v_faktor END;
    INSERT INTO public.ledger_stok (
      outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
    ) VALUES (
      p_outlet_id, sub_rec.bahan_baku_pengganti_id, 'pemakaian', -v_qty_ledger,
      p_catatan, p_ref_order_id, NOW()
    );
  END LOOP;

  -- ---------- sisa dipaksa ke bahan utama (boleh minus) ----------
  IF v_sisa_kecil > 0 THEN
    SELECT saldo_is_gram(sb), NULLIF(COALESCE(b.faktor_tampilan, 1), 0)
      INTO v_is_gram, v_faktor
      FROM public.stok_balance sb
      JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
     WHERE sb.outlet_id = p_outlet_id
       AND sb.bahan_baku_id = p_bahan_baku_id;

    IF NOT FOUND THEN
      v_is_gram := false; v_faktor := v_faktor_utama;
    END IF;
    v_is_gram := COALESCE(v_is_gram, false);
    v_faktor  := COALESCE(v_faktor, 1);

    v_qty_ledger := CASE WHEN v_is_gram THEN v_sisa_kecil ELSE v_sisa_kecil / v_faktor END;
    INSERT INTO public.ledger_stok (
      outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
    ) VALUES (
      p_outlet_id, p_bahan_baku_id, 'pemakaian', -v_qty_ledger, p_catatan, p_ref_order_id, NOW()
    );
    v_sisa_kecil := 0;
  END IF;
END;
$function$;

-- CREATE OR REPLACE tidak mereset hak akses, tapi ditegaskan ulang agar
-- migration ini aman dijalankan di environment yang belum pernah kena
-- 20300104000005.
REVOKE ALL ON FUNCTION public.process_waterfall_deduction(uuid, uuid, numeric, text, uuid)
  FROM PUBLIC, anon, authenticated;

-- DOWN:
-- Jalankan ulang blok CREATE OR REPLACE dari
-- supabase/migrations/20300105000017_scale_aware_ledger_writers.sql.
-- Itu mengembalikan bug 1,375x -- hanya lakukan bila perbaikan ini terbukti
-- merusak sesuatu yang lebih besar.
```

- [ ] **Step 2: Lint timestamp**

```bash
node scripts/migration-timestamp-lint.mjs supabase/migrations/20260909170000_fix_waterfall_konversi_satuan.sql
```
Harapan: `✓ 1 migration file timestamp wajar.` (exit 0).

- [ ] **Step 3: Commit (belum di-apply)**

```bash
git add supabase/migrations/20260909170000_fix_waterfall_konversi_satuan.sql
git commit -m "fix(db): waterfall lacak sisa potongan dalam satuan kecil"
```

---

## Task 3: Terapkan & verifikasi ke DB live

**Files:**
- Modify: tidak ada berkas repo; ini penerapan + pembuktian.

**Interfaces:**
- Consumes: `SS COGS SET/verifikasi-waterfall-2026-09-09.sql` (Task 1), migration Task 2.

- [ ] **Step 1: Terapkan lewat `exec_sql`**

Pola yang dipakai proyek ini (CLI Supabase tanpa kredensial, `gh` tak terpasang):
skrip Node di root repo, `dotenv` dari `.env.local`, `supabase-js` service role,
`rpc('exec_sql', { sql })` dengan isi berkas migration. Hapus skrip setelah selesai.

- [ ] **Step 2: Verifikasi ground-truth definisi fungsi**

Jangan percaya "sukses" dari `exec_sql`. Baca kembali definisi live dan pastikan
mengandung `v_sisa_kecil` serta `prosecdef = true`:

```sql
SELECT prosecdef, pg_get_functiondef(oid) LIKE '%v_sisa_kecil%' AS sudah_terpasang
  FROM pg_proc
 WHERE proname = 'process_waterfall_deduction';
```
Harapan: `prosecdef = true`, `sudah_terpasang = true`.

- [ ] **Step 3: Stempel `schema_migrations`**

```sql
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('20260909170000')
ON CONFLICT (version) DO NOTHING;
```

- [ ] **Step 4: Verifikasi perilaku pada order nyata**

Jalankan **Q2** dari Task 1 lagi. Baris limpahan **baru** (setelah waktu penerapan)
di SAOS TOMAT KOMPAN harus bernilai bulat sesuai resep — **−30 / −50 / −60** —
bukan −41,25 / −68,75 / −82,5.

Depok Sukmajaya & Paledang memicu limpahan beberapa kali sehari, jadi baris
pembanding biasanya muncul dalam hitungan jam. **Jangan tandai task ini selesai
sebelum ada minimal satu baris limpahan baru yang terbukti bulat.** Kalau sampai
akhir hari belum ada, catat itu sebagai verifikasi tertunda di CLAUDE.md — jangan
mengaku sudah terverifikasi.

- [ ] **Step 5: Verifikasi tidak ada regresi pada jalur mayoritas**

Bahan tanpa pengganti adalah jalur mayoritas tiap order, dan perbaikan ini secara
aljabar tidak boleh mengubahnya sama sekali. Uji dengan membandingkan **himpunan
nilai qty** sebelum vs sesudah waktu penerapan untuk satu bahan tanpa pengganti
yang ramai — FOIL:

```sql
SELECT l.created_at < TIMESTAMPTZ '<WAKTU_PENERAPAN>' AS sebelum_fix,
       l.qty,
       COUNT(*) AS baris
  FROM public.ledger_stok l
  JOIN public.bahan_baku b ON b.id = l.bahan_baku_id
 WHERE l.tipe = 'pemakaian'
   AND l.catatan LIKE 'Penjualan%'
   AND b.nama = 'FOIL'
   AND l.created_at >= NOW() - INTERVAL '2 days'
 GROUP BY 1, 2
 ORDER BY 2, 1;
```

Harapan: setiap nilai `qty` yang muncul **sesudah** juga muncul **sebelum**, dan
tidak ada nilai baru. Nilai FOIL berasal dari resep 35–50 cm dibagi
`faktor_tampilan` 36.480, jadi himpunannya kecil dan mudah dibandingkan.

⚠️ **Jangan** menguji ini dengan `HAVING COUNT(*) > 1` per `(ref_order_id, bahan)` —
satu order yang memuat dua menu berbahan sama memang menghasilkan dua baris
`pemakaian`, jadi uji semacam itu akan berbunyi walau tak ada regresi.

---

## Task 4: Batalkan surat jalan FOIL basi

Prasyarat FOIL dipecah (spec §6): 21 SJ Juli–Agustus berisi 1–4 Roll yang tidak akan
pernah diverifikasi. Kalau dibiarkan sampai `faktor_tampilan` FOIL berubah, artinya
ikut bergeser.

**⚠️ Gerbang persetujuan owner.** Task ini membatalkan dokumen operasional nyata.
Susun daftarnya, tunjukkan ke owner, baru terapkan. **Jangan** ikut menyentuh 5 SJ
September (Cileungsi, Cirendeu, Cibinong, dan 2 draft 9 Sep) — itu barang yang
kemungkinan sudah sampai di outlet dan harus diverifikasi, bukan dibatalkan.

**Files:**
- Create: `supabase/migrations/20260909180000_batalkan_sj_foil_basi.sql`

- [ ] **Step 1: Susun daftar terkini**

```sql
SELECT sj.id,
       sj.document_number,
       o.name AS outlet,
       sj.created_at::date AS tanggal,
       sj.status,
       sji.qty_dikirim AS qty_dus,
       ROUND(sji.qty_dikirim * b.faktor_tengah, 2) AS kira_kira_roll
  FROM public.surat_jalan_item sji
  JOIN public.surat_jalan sj ON sj.id = sji.surat_jalan_id
  JOIN public.outlets     o  ON o.id = sj.outlet_id
  JOIN public.bahan_baku  b  ON b.id = sji.bahan_baku_id
 WHERE b.nama = 'FOIL'
   AND sj.status IN ('draft', 'dikirim')
   AND sj.created_at < DATE '2026-09-01'
 ORDER BY sj.created_at;
```
Harapan saat rencana ini ditulis: **21 baris**, Jul–Agu, 0,0009–0,08 Dus.

- [ ] **Step 2: Tunjukkan daftar ke owner, tunggu persetujuan**

Sajikan sebagai tabel (nomor SJ, outlet, tanggal, perkiraan Roll). Tanpa persetujuan
eksplisit, hentikan di sini dan lanjutkan ke Task 5.

- [ ] **Step 3: Tulis migration dengan id eksplisit**

Daftar id di-hardcode (bukan predikat tanggal) supaya idempoten dan supaya SJ baru
yang kebetulan cocok predikat tidak ikut terbatalkan — pola yang sama dipakai
`20260908103000`.

```sql
-- 20260909180000_batalkan_sj_foil_basi.sql
-- Batalkan surat jalan FOIL Juli-Agustus yang tak akan pernah diverifikasi.
-- Disetujui owner <TANGGAL>. Daftar id eksplisit: idempoten, dan SJ baru tidak
-- ikut tersapu.
--
-- Kenapa sekarang: qty_dikirim tersimpan dalam satuan BESAR dan baru dikalikan
-- faktor_tampilan saat verifikasi. Pemecahan FOIL akan mengubah faktor itu,
-- sehingga dokumen yang menggantung berpindah arti -- kelas kesalahan yang sama
-- dengan insiden 8 September.
--
-- TIDAK menyentuh SJ September: itu barang yang kemungkinan sudah di outlet dan
-- harus diverifikasi, bukan dibatalkan.
-- TIDAK menulis ledger: SJ berstatus draft/dikirim belum pernah mengkredit stok
-- outlet, jadi pembatalannya tidak menggeser saldo mana pun.

UPDATE public.surat_jalan
   SET status = 'dibatalkan',
       notes  = COALESCE(NULLIF(notes, ''), '') || ' [Dibatalkan: SJ FOIL basi, 2026-09-09]',
       updated_at = NOW()
 WHERE id IN (
   -- <TEMPEL id dari Step 1 di sini, satu per baris dengan komentar nomor SJ>
 )
   AND status IN ('draft', 'dikirim');

-- DOWN:
-- UPDATE public.surat_jalan SET status = 'dikirim' WHERE id IN (<daftar id yang sama>);
-- (status asal per baris ada di hasil Step 1 -- draft vs dikirim berbeda; catat
--  saat menyusun daftar.)
```

- [ ] **Step 4: Terapkan, lalu verifikasi**

```sql
SELECT status, COUNT(*)
  FROM public.surat_jalan
 WHERE id IN (<daftar id yang sama>)
 GROUP BY status;
```
Harapan: seluruhnya `dibatalkan`.

Verifikasi juga **nol** baris ledger baru yang terkait — pembatalan SJ tidak boleh
menggeser stok:

```sql
SELECT COUNT(*) FROM public.ledger_stok
 WHERE ref_shipment_id IN (<daftar id yang sama>);
```
Harapan: sama dengan sebelum penerapan (catat angkanya di Step 1).

- [ ] **Step 5: Stempel & commit**

```bash
git add supabase/migrations/20260909180000_batalkan_sj_foil_basi.sql
git commit -m "chore(db): batalkan surat jalan FOIL basi Juli-Agustus"
```

---

## Task 5: Koreksi spec & catatan sesi

**Files:**
- Modify: `docs/superpowers/specs/2026-09-09-foil-dua-ukuran-design.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Koreksi §5 spec**

Ganti baris langkah 2 pada tabel §5 menjadi dicoret dengan alasannya, dan tambahkan
paragraf singkat berisi tabel bukti dari K1 (saldo kini + tanggal `opname_selisih`
terakhir tiap outlet). Sesuaikan juga §3 (bagian "Perbaikan yang diperlukan") agar
menyebut bahwa sisa dilacak dalam satuan kecil, bukan dikalikan rasio faktor —
rumusannya berubah setelah membaca definisi live `20300105000017`.

- [ ] **Step 2: Tambah entri sesi di CLAUDE.md**

Isi minimal:
- bug 1,375× beserta bukti order #38 dan angka 2.185 / 88.003,61 / 24.000,98;
- **K1** — kenapa koreksi mundur dibatalkan (opname harian sudah menghapusnya);
- **K2** — utang timestamp: fix bertanggal 2026 sementara fungsi juga didefinisikan
  tiga migration 2030; aman selama tak ada replay dari nol;
- catatan bahwa **nol app perlu redeploy**;
- status verifikasi Step 4 Task 3 (terbukti / masih tertunda).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-09-foil-dua-ukuran-design.md CLAUDE.md
git commit -m "docs: koreksi spec FOIL dua ukuran + catatan sesi waterfall"
```

---

## Selesai

Setelah Task 5, hentikan. **Jangan lanjut memecah FOIL** — langkah 4–8 spec menunggu
hitung fisik Gudang Pusat yang memisahkan roll 7,6 m dan 5 m, dan hitungan itu
sekaligus menjawab pertanyaan terbuka "1 Dus Altindo isi berapa roll?".
