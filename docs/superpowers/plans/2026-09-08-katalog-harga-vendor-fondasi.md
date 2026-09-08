# Katalog Harga Vendor — Fondasi (Tahap 0 & 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun fondasi data agar sistem bisa menjawab "bahan X, dari vendor mana, satuan apa, harga berapa" — tanpa menyentuh cara harga master, HPP, atau nilai persediaan dihitung.

**Architecture:** Satu kolom turunan `bahan_baku.faktor_po` (menutup ranjau satuan PO tanpa faktor), satu penggabungan supplier duplikat, lalu satu tabel katalog `bahan_baku_supplier` beserta tabel riwayatnya. Semua perubahan DB **aditif**; tidak ada fungsi existing yang di-`CREATE OR REPLACE`. Fungsi murni TypeScript ditulis TDD lebih dulu supaya aturan konversi punya satu definisi yang teruji.

**Tech Stack:** PostgreSQL (Supabase), SQL migration, TypeScript, Vitest, Next.js App Router (apps/admin-dashboard).

**Spec:** `docs/superpowers/specs/2026-09-08-katalog-harga-vendor-design.md`

**Lingkup:** Tahap 0 dan 1 saja (§7 spec). Tahap 2–4 (layar pembanding, wiring form PO, tulis-balik dari `verifikasi_terima_po`) mendapat plan terpisah setelah katalog berisi data nyata.

## Global Constraints

- **Harga master TIDAK berubah.** `bahan_baku_harga`, `verifikasi_terima_po`, dan guard `20260904120000_guard_harga_master_salah_satuan.sql` tidak boleh disentuh oleh plan ini.
- **Semua migration aditif dan idempoten.** Boleh dijalankan dua kali tanpa efek berbeda. Tidak ada `DROP`, tidak ada `CREATE OR REPLACE` atas fungsi yang sudah ada.
- **Timestamp migration = tanggal hari ini** (`20260908…`). CI menjalankan `scripts/migration-timestamp-lint.mjs` yang **menolak timestamp jauh ke depan** — jangan pakai `2030…` meski file 2030 sudah banyak di repo. Aman secara urutan karena semua objek di plan ini **baru sama sekali**.
- **Basis satuan kanonik:** `faktor_tampilan` = jumlah satuan kecil dalam 1 satuan besar. Katalog dijangkar ke **satuan kecil**, tidak pernah ke satuan besar.
- **Jangan percaya `supabase migration list`.** DB ini dipakai bersama; verifikasi ground-truth lewat katalog sistem (`information_schema`, `pg_get_functiondef`, `pg_policies`) setiap kali selesai apply.
- **Jangan jalankan `supabase migration repair` untuk timestamp milik orang lain.** Hanya untuk migration yang ditulis plan ini.
- Perintah verifikasi baca: `supabase db query "<sql>" --linked`.

---

## Preflight (kerjakan sebelum Task 1)

- [ ] **P1: Rekam baseline test**

Suite ini punya kegagalan pre-existing. Tanpa baseline, mustahil membedakan regresi dari kerusakan lama.

```bash
cd "apps/admin-dashboard" && yarn test 2>&1 | tail -20 > /tmp/baseline-test.txt
cd "apps/admin-dashboard" && yarn type-check 2>&1 | tail -20 > /tmp/baseline-types.txt
cat /tmp/baseline-test.txt /tmp/baseline-types.txt
```

Catat angkanya. Di akhir setiap task, bandingkan terhadap angka ini — **jangan pernah mengklaim "0 error" tanpa membandingkan ke baseline.**

- [ ] **P2: Pastikan nama objek belum terpakai**

```bash
grep -rn "faktor_po\|bahan_baku_supplier\|sync_faktor_po" supabase/migrations/
```

Expected: hanya menemukan file dari plan ini (awalnya: nol hasil). Kalau ada hasil lain, **berhenti** dan laporkan — berarti ada kerja paralel dengan nama yang sama.

- [ ] **P3: Rekam keadaan DB sebelum diubah**

```bash
supabase db query "select (select count(*) from supplier) n_supplier, (select count(*) from purchase_order where supplier_id='6645d9b3-f3e9-45d6-a95b-a01de2941807') n_po_duplikat, (select count(*) from bahan_baku where is_active) n_bahan_aktif;" --linked
```

Expected: `n_supplier=25`, `n_po_duplikat=0`, `n_bahan_aktif=52`. Kalau berbeda, DB sudah berubah sejak plan ditulis — laporkan sebelum lanjut.

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `apps/admin-dashboard/src/lib/satuanPo.ts` (baru) | Fungsi murni `hitungFaktorPo` — satu-satunya definisi aturan turunan satuan PO |
| `apps/admin-dashboard/src/lib/satuanPo.test.ts` (baru) | Tes untuk di atas, termasuk regresi "tidak boleh diam-diam 1" |
| `apps/admin-dashboard/src/lib/katalogVendor.ts` (baru) | Fungsi murni katalog: konversi, penyetaraan harga antar vendor, kelayakan prefill |
| `apps/admin-dashboard/src/lib/katalogVendor.test.ts` (baru) | Tes untuk di atas |
| `supabase/migrations/20260908230000_bahan_baku_faktor_po.sql` (baru) | Kolom `faktor_po` + seed + trigger sinkron |
| `supabase/migrations/20260908231000_merge_supplier_lettuce_pak_aziz.sql` (baru) | Gabung 2 baris supplier duplikat |
| `supabase/migrations/20260908232000_bahan_baku_supplier.sql` (baru) | Tabel katalog + riwayat + RLS + trigger riwayat |
| `supabase/migrations/20260908233000_seed_bahan_baku_supplier.sql` (baru) | Seed katalog dari riwayat PO + array supplier |

---

## Task 1: Fungsi murni `hitungFaktorPo`

**Files:**
- Create: `apps/admin-dashboard/src/lib/satuanPo.ts`
- Test: `apps/admin-dashboard/src/lib/satuanPo.test.ts`

**Interfaces:**
- Consumes: tidak ada.
- Produces: `type BahanSatuan`, `hitungFaktorPo(b: BahanSatuan): number | null`. Task 2 memakai aturan yang sama dalam bentuk SQL; Task 6 memakai tipenya.

**Kenapa `null`, bukan `1`, saat tidak ada tingkat yang cocok.** `getDistribusiFactor()` di `apps/stok/src/lib/format/compositeUnit.ts:212` mengembalikan `1` saat tak ada label yang cocok. Untuk FOIL itu berarti diam-diam salah 48×. Fungsi ini **wajib** mengembalikan `null` supaya kesalahan terlihat.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `apps/admin-dashboard/src/lib/satuanPo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { hitungFaktorPo, type BahanSatuan } from './satuanPo'

const bahan = (o: Partial<BahanSatuan>): BahanSatuan => ({
  satuan: null,
  satuan_po: null,
  satuan_tengah: null,
  faktor_tengah: null,
  satuan_kecil: null,
  faktor_tampilan: null,
  ...o,
})

describe('hitungFaktorPo', () => {
  it('satuan_po = satuan besar, ada satuan kecil -> faktor_tampilan (AYAM)', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Kg', satuan_po: 'kg', satuan_kecil: 'Gram', faktor_tampilan: 1000,
    }))).toBe(1000)
  })

  it('satuan_po = satuan tengah -> faktor_tampilan / faktor_tengah (FOIL)', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Dus', satuan_po: 'roll',
      satuan_tengah: 'Roll', faktor_tengah: 48,
      satuan_kecil: 'cm', faktor_tampilan: 36480,
    }))).toBe(760)
  })

  it('satuan_po = satuan tengah, PLASTIK BESAR -> 50', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Ikat', satuan_po: 'pack',
      satuan_tengah: 'Pack', faktor_tengah: 5,
      satuan_kecil: 'Lembar', faktor_tampilan: 250,
    }))).toBe(50)
  })

  it('satuan_po = satuan kecil -> 1 (MIE)', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Dus', satuan_po: 'bungkus',
      satuan_kecil: 'Bungkus', faktor_tampilan: 40,
    }))).toBe(1)
  })

  it('tanpa satuan kecil, satuan besar adalah satuan terkecil -> 1 (PLASTIK 24)', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Pack', satuan_po: 'pack',
    }))).toBe(1)
  })

  it('satuan_kecil bertanda "-" diperlakukan kosong -> 1', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Unit', satuan_po: 'unit', satuan_kecil: '-',
    }))).toBe(1)
  })

  it('mengenali sinonim bks <-> bungkus', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Dus', satuan_po: 'bks',
      satuan_kecil: 'Bungkus', faktor_tampilan: 40,
    }))).toBe(1)
  })

  it('label satuan_po tidak dikenal -> null, BUKAN 1', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Dus', satuan_po: 'karung',
      satuan_tengah: 'Roll', faktor_tengah: 48,
      satuan_kecil: 'cm', faktor_tampilan: 36480,
    }))).toBeNull()
  })

  it('cocok satuan tengah tapi faktor_tengah kosong -> null', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Dus', satuan_po: 'roll',
      satuan_tengah: 'Roll', faktor_tengah: null,
      satuan_kecil: 'cm', faktor_tampilan: 36480,
    }))).toBeNull()
  })

  it('cocok satuan besar, ada satuan kecil tapi faktor_tampilan kosong -> null', () => {
    expect(hitungFaktorPo(bahan({
      satuan: 'Kg', satuan_po: 'kg', satuan_kecil: 'Gram', faktor_tampilan: null,
    }))).toBeNull()
  })

  it('satuan_po kosong -> null', () => {
    expect(hitungFaktorPo(bahan({ satuan: 'Kg', satuan_po: null }))).toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan tes, pastikan GAGAL**

```bash
cd "apps/admin-dashboard" && yarn vitest run src/lib/satuanPo.test.ts
```

Expected: FAIL — `Failed to resolve import "./satuanPo"`.

- [ ] **Step 3: Tulis implementasi minimal**

Buat `apps/admin-dashboard/src/lib/satuanPo.ts`:

```ts
/**
 * Aturan turunan `bahan_baku.faktor_po` — berapa satuan KECIL dalam 1 satuan PO.
 *
 * Sengaja mengembalikan null (bukan 1) saat tidak ada tingkat yang cocok.
 * getDistribusiFactor() di apps/stok mengembalikan 1 dalam keadaan itu, dan
 * untuk FOIL artinya diam-diam salah 48x. Kesalahan harus terlihat.
 */
export type BahanSatuan = {
  satuan: string | null
  satuan_po: string | null
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  faktor_tampilan: number | null
}

const SINONIM: Record<string, string> = { bks: 'bungkus' }

function canon(s: string | null | undefined): string {
  const n = (s ?? '').trim().toLowerCase()
  const bersih = n === '-' ? '' : n
  return SINONIM[bersih] ?? bersih
}

export function hitungFaktorPo(b: BahanSatuan): number | null {
  const po = canon(b.satuan_po)
  if (!po) return null

  if (po === canon(b.satuan)) {
    // Tanpa satuan kecil, satuan besar ADALAH satuan terkecil.
    if (!canon(b.satuan_kecil)) return 1
    return b.faktor_tampilan && b.faktor_tampilan > 0 ? b.faktor_tampilan : null
  }

  const tengah = canon(b.satuan_tengah)
  if (tengah && po === tengah) {
    if (!b.faktor_tampilan || b.faktor_tampilan <= 0) return null
    if (!b.faktor_tengah || b.faktor_tengah <= 0) return null
    return b.faktor_tampilan / b.faktor_tengah
  }

  const kecil = canon(b.satuan_kecil)
  if (kecil && po === kecil) return 1

  return null
}
```

- [ ] **Step 4: Jalankan tes, pastikan LULUS**

```bash
cd "apps/admin-dashboard" && yarn vitest run src/lib/satuanPo.test.ts
```

Expected: PASS, 11 tes.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/satuanPo.ts apps/admin-dashboard/src/lib/satuanPo.test.ts
git commit -m "feat(admin-dashboard): aturan turunan faktor satuan PO

Mengembalikan null (bukan 1) saat label satuan tidak dikenal, supaya
kesalahan konversi terlihat alih-alih tersamar seperti pada
getDistribusiFactor().

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Kolom `bahan_baku.faktor_po` + trigger sinkron

**Files:**
- Create: `supabase/migrations/20260908230000_bahan_baku_faktor_po.sql`

**Interfaces:**
- Consumes: aturan dari Task 1 (diterjemahkan ke SQL — harus memberi hasil identik).
- Produces: kolom `bahan_baku.faktor_po numeric`, fungsi `public.hitung_faktor_po(...)`, trigger `trg_bahan_baku_faktor_po`. Task 4 dan 5 memakai `faktor_po` sebagai default.

**Catatan tambahan di luar spec — perlu persetujuan reviewer.** Spec §3.1 hanya meminta kolom + seed. Plan ini menambahkan **trigger** yang menghitung ulang `faktor_po` setiap kolom satuan berubah. Alasannya: FOIL berubah satuan besar **hari ini juga** (`20260908103000`), jadi nilai turunan yang hanya di-seed sekali pasti basi dalam hitungan minggu. Kalau reviewer menolak trigger, buang bagian trigger dan jalankan ulang blok `UPDATE` setiap kali satuan berubah — tapi ketahui bahwa itu bergantung pada seseorang mengingatnya.

- [ ] **Step 1: Tulis migration**

Buat `supabase/migrations/20260908230000_bahan_baku_faktor_po.sql`:

```sql
-- 20260908230000_bahan_baku_faktor_po.sql
-- Menutup ranjau: satuan_po sudah terisi untuk 52 bahan aktif tetapi TIDAK ADA
-- kolom yang menyimpan konversinya ke satuan kecil. Untuk FOIL / MIE /
-- PLASTIK BESAR, satuan_po bukan satuan master (48x / 40x / 5x), jadi begitu
-- ada yang mewirekan satuan_po ke form PO sebagai label, qty masuk berlipat.
--
-- Aditif & idempoten. Tidak menyentuh harga, ledger, atau fungsi yang ada.

ALTER TABLE public.bahan_baku
  ADD COLUMN IF NOT EXISTS faktor_po numeric;

COMMENT ON COLUMN public.bahan_baku.faktor_po IS
  'Jumlah satuan KECIL dalam 1 satuan_po. Turunan dari satuan_po vs '
  'satuan/satuan_tengah/satuan_kecil. NULL = label satuan_po tidak dikenal '
  '(sengaja: kesalahan harus terlihat, jangan diasumsikan 1).';

-- Aturan turunan, kembar dengan hitungFaktorPo() di
-- apps/admin-dashboard/src/lib/satuanPo.ts
CREATE OR REPLACE FUNCTION public.hitung_faktor_po(
  p_satuan          text,
  p_satuan_po       text,
  p_satuan_tengah   text,
  p_faktor_tengah   numeric,
  p_satuan_kecil    text,
  p_faktor_tampilan numeric
) RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  WITH c AS (
    SELECT
      NULLIF(lower(btrim(coalesce(p_satuan_po, ''))),      '-') AS po,
      NULLIF(lower(btrim(coalesce(p_satuan, ''))),         '-') AS besar,
      NULLIF(lower(btrim(coalesce(p_satuan_tengah, ''))),  '-') AS tengah,
      NULLIF(lower(btrim(coalesce(p_satuan_kecil, ''))),   '-') AS kecil
  ), n AS (
    SELECT
      CASE WHEN po     = 'bks' THEN 'bungkus' ELSE NULLIF(po, '')     END AS po,
      CASE WHEN besar  = 'bks' THEN 'bungkus' ELSE NULLIF(besar, '')  END AS besar,
      CASE WHEN tengah = 'bks' THEN 'bungkus' ELSE NULLIF(tengah, '') END AS tengah,
      CASE WHEN kecil  = 'bks' THEN 'bungkus' ELSE NULLIF(kecil, '')  END AS kecil
    FROM c
  )
  SELECT CASE
    WHEN n.po IS NULL THEN NULL
    WHEN n.po = n.besar THEN
      CASE
        WHEN n.kecil IS NULL THEN 1
        WHEN coalesce(p_faktor_tampilan, 0) > 0 THEN p_faktor_tampilan
        ELSE NULL
      END
    WHEN n.tengah IS NOT NULL AND n.po = n.tengah THEN
      CASE
        WHEN coalesce(p_faktor_tampilan, 0) > 0 AND coalesce(p_faktor_tengah, 0) > 0
          THEN p_faktor_tampilan / p_faktor_tengah
        ELSE NULL
      END
    WHEN n.kecil IS NOT NULL AND n.po = n.kecil THEN 1
    ELSE NULL
  END
  FROM n;
$$;

-- Seed nilai awal
UPDATE public.bahan_baku b
SET faktor_po = public.hitung_faktor_po(
      b.satuan, b.satuan_po, b.satuan_tengah, b.faktor_tengah,
      b.satuan_kecil, b.faktor_tampilan)
WHERE b.faktor_po IS DISTINCT FROM public.hitung_faktor_po(
      b.satuan, b.satuan_po, b.satuan_tengah, b.faktor_tengah,
      b.satuan_kecil, b.faktor_tampilan);

-- Jaga agar tidak basi saat satuan bahan diubah (FOIL berubah 8 Sep 2026)
CREATE OR REPLACE FUNCTION public.bahan_baku_sync_faktor_po()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.faktor_po := public.hitung_faktor_po(
    NEW.satuan, NEW.satuan_po, NEW.satuan_tengah, NEW.faktor_tengah,
    NEW.satuan_kecil, NEW.faktor_tampilan);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bahan_baku_faktor_po ON public.bahan_baku;
CREATE TRIGGER trg_bahan_baku_faktor_po
  BEFORE INSERT OR UPDATE OF satuan, satuan_po, satuan_tengah,
                             faktor_tengah, satuan_kecil, faktor_tampilan
  ON public.bahan_baku
  FOR EACH ROW EXECUTE FUNCTION public.bahan_baku_sync_faktor_po();

ALTER TABLE public.bahan_baku
  DROP CONSTRAINT IF EXISTS bahan_baku_faktor_po_positif;
ALTER TABLE public.bahan_baku
  ADD CONSTRAINT bahan_baku_faktor_po_positif
  CHECK (faktor_po IS NULL OR faktor_po > 0);

-- DOWN:
-- DROP TRIGGER IF EXISTS trg_bahan_baku_faktor_po ON public.bahan_baku;
-- DROP FUNCTION IF EXISTS public.bahan_baku_sync_faktor_po();
-- DROP FUNCTION IF EXISTS public.hitung_faktor_po(text,text,text,numeric,text,numeric);
-- ALTER TABLE public.bahan_baku DROP CONSTRAINT IF EXISTS bahan_baku_faktor_po_positif;
-- ALTER TABLE public.bahan_baku DROP COLUMN IF EXISTS faktor_po;
```

- [ ] **Step 2: Lint timestamp**

```bash
node scripts/migration-timestamp-lint.mjs supabase/migrations/20260908230000_bahan_baku_faktor_po.sql
```

Expected: exit 0.

- [ ] **Step 3: Apply**

```bash
supabase db push
```

Kalau gagal karena drift migration remote-only milik dev lain (sering terjadi di repo ini), **jangan** `migration repair` migration orang lain. Pakai jalur alternatif:

```bash
node -e "const fs=require('fs');const{createClient}=require('@supabase/supabase-js');require('dotenv').config({path:'apps/stok/.env.local'});const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);sb.rpc('exec_sql',{sql:fs.readFileSync('supabase/migrations/20260908230000_bahan_baku_faktor_po.sql','utf8')}).then(r=>console.log(r.error||'ok'))"
```

lalu stempel sendiri:

```bash
supabase db query "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260908230000','bahan_baku_faktor_po') ON CONFLICT (version) DO NOTHING;" --linked
```

- [ ] **Step 4: Verifikasi ground-truth**

`exec_sql` mengembalikan `void` — "tidak ada error" bukan bukti. Cek katalog sistem:

```bash
supabase db query "select count(*) total, count(faktor_po) terisi, count(*) filter (where faktor_po is null) gagal from bahan_baku where is_active;" --linked
```

Expected: `total=52, terisi=52, gagal=0`.

```bash
supabase db query "select nama, satuan_po, faktor_po from bahan_baku where nama in ('FOIL','MIE','PLASTIK BESAR','AYAM','PLASTIK 24') order by nama;" --linked
```

Expected persis: AYAM `kg` **1000** · FOIL `roll` **760** · MIE `bungkus` **1** · PLASTIK 24 `pack` **1** · PLASTIK BESAR `pack` **50**.

Kalau ada yang berbeda, **berhenti** — jangan lanjut ke Task 3.

- [ ] **Step 5: Verifikasi trigger benar-benar terpasang**

```bash
supabase db query "select tgname, tgenabled from pg_trigger where tgrelid = 'public.bahan_baku'::regclass and tgname = 'trg_bahan_baku_faktor_po';" --linked
```

Expected: satu baris, `tgenabled = 'O'`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260908230000_bahan_baku_faktor_po.sql
git commit -m "feat(db): kolom bahan_baku.faktor_po + trigger sinkron

satuan_po sudah terisi 52/52 bahan tanpa kolom faktor pendamping. Untuk
FOIL/MIE/PLASTIK BESAR satuan_po bukan satuan master (48x/40x/5x), jadi
mewirekannya ke form PO tanpa konversi akan melipatgandakan qty ledger.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Gabungkan supplier duplikat `Lettuce (Pak Aziz)`

**Files:**
- Create: `supabase/migrations/20260908231000_merge_supplier_lettuce_pak_aziz.sql`

**Interfaces:**
- Consumes: tidak ada.
- Produces: `supplier` tanpa duplikat nama — prasyarat agar `UNIQUE (bahan_baku_id, supplier_id)` di Task 4 bermakna.

**Konteks.** Dua baris, kontak sama (`+62 838-7686-5070`), alamat & kategori sama-sama kosong. Hanya `purchase_order` yang mereferensikan `supplier.id` (diverifikasi lewat `information_schema`), jadi penggabungan ini sempit.

| id | dibuat | termin | PO | bahan di array |
|---|---|---|---|---|
| `c364abe8-9b00-4b66-b7c1-15746c32b500` | 14 Agu 13:58 | 30 | **1** | 1 |
| `6645d9b3-f3e9-45d6-a95b-a01de2941807` | 14 Agu 15:36 | 10 | 0 | 2 |

**Keputusan owner (8 Sep):** pertahankan baris ber-PO (`c364abe8`) **dengan termin 30 apa adanya**; termin yang benar dikonfirmasi ke Pak Aziz belakangan. Jangan menebak.

- [ ] **Step 1: Tulis migration**

Buat `supabase/migrations/20260908231000_merge_supplier_lettuce_pak_aziz.sql`:

```sql
-- 20260908231000_merge_supplier_lettuce_pak_aziz.sql
-- Satu-satunya duplikat supplier tersisa per 8 Sep 2026. Tanpa ini, katalog
-- harga vendor pecah dua baris untuk vendor yang sama dan pembandingnya bohong.
--
-- Yang dipertahankan: c364abe8 (dibuat lebih dulu, punya 1 PO nyata).
-- Termin SENGAJA tidak diubah (30 vs 10 belum dikonfirmasi ke Pak Aziz).
-- Idempoten: tidak melakukan apa pun kalau baris kedua sudah tidak ada.

DO $$
DECLARE
  v_keep uuid := 'c364abe8-9b00-4b66-b7c1-15746c32b500';
  v_drop uuid := '6645d9b3-f3e9-45d6-a95b-a01de2941807';
  v_nama text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.supplier WHERE id = v_drop) THEN
    RAISE NOTICE 'Baris duplikat sudah tidak ada, lewati.';
    RETURN;
  END IF;

  SELECT nama INTO v_nama FROM public.supplier WHERE id = v_keep;
  IF v_nama IS NULL THEN
    RAISE EXCEPTION 'Baris yang dipertahankan (%) tidak ditemukan — hentikan.', v_keep;
  END IF;

  -- Pindahkan PO (jumlahnya 0 saat plan ditulis; tetap ditulis agar aman)
  UPDATE public.purchase_order
     SET supplier_id = v_keep, supplier_nama = v_nama
   WHERE supplier_id = v_drop;

  -- Satukan daftar bahan tanpa duplikat
  UPDATE public.supplier k
     SET bahan_baku_ids = (
           SELECT coalesce(array_agg(DISTINCT x), '{}'::uuid[])
             FROM unnest(coalesce(k.bahan_baku_ids, '{}'::uuid[])
                      || coalesce(d.bahan_baku_ids, '{}'::uuid[])) AS x
         )
    FROM public.supplier d
   WHERE k.id = v_keep AND d.id = v_drop;

  DELETE FROM public.supplier WHERE id = v_drop;
END $$;

-- DOWN: tidak ada. Penggabungan data tidak dibalik otomatis; pulihkan dari backup.
```

- [ ] **Step 2: Lint timestamp**

```bash
node scripts/migration-timestamp-lint.mjs supabase/migrations/20260908231000_merge_supplier_lettuce_pak_aziz.sql
```

Expected: exit 0.

- [ ] **Step 3: Apply**

```bash
supabase db push
```

Kalau gagal karena drift migration remote-only milik dev lain, **jangan** `migration repair` milik orang lain. Pakai jalur alternatif:

```bash
node -e "const fs=require('fs');const{createClient}=require('@supabase/supabase-js');require('dotenv').config({path:'apps/stok/.env.local'});const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);sb.rpc('exec_sql',{sql:fs.readFileSync('supabase/migrations/20260908231000_merge_supplier_lettuce_pak_aziz.sql','utf8')}).then(r=>console.log(r.error||'ok'))"
```

lalu stempel sendiri:

```bash
supabase db query "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260908231000','merge_supplier_lettuce_pak_aziz') ON CONFLICT (version) DO NOTHING;" --linked
```

- [ ] **Step 4: Verifikasi ground-truth**

```bash
supabase db query "select (select count(*) from supplier) n_supplier, (select count(*) from (select lower(btrim(nama)) n from supplier group by 1 having count(*)>1) d) n_duplikat, (select coalesce(array_length(bahan_baku_ids,1),0) from supplier where id='c364abe8-9b00-4b66-b7c1-15746c32b500') n_bahan_gabungan, (select count(*) from supplier where id='6645d9b3-f3e9-45d6-a95b-a01de2941807') sisa_duplikat;" --linked
```

Expected: `n_supplier=24`, `n_duplikat=0`, `n_bahan_gabungan=3`, `sisa_duplikat=0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260908231000_merge_supplier_lettuce_pak_aziz.sql
git commit -m "fix(db): gabungkan supplier duplikat Lettuce (Pak Aziz)

Termin sengaja tidak diubah (30 vs 10 belum dikonfirmasi ke supplier).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Tabel `bahan_baku_supplier` + riwayat + RLS

**Files:**
- Create: `supabase/migrations/20260908232000_bahan_baku_supplier.sql`

**Interfaces:**
- Consumes: `bahan_baku.faktor_po` (Task 2), `supplier` bebas duplikat (Task 3).
- Produces: tabel `public.bahan_baku_supplier` dan `public.bahan_baku_supplier_history`. Task 5 mengisinya; plan Tahap 2–4 membacanya.

- [ ] **Step 1: Tulis migration**

Buat `supabase/migrations/20260908232000_bahan_baku_supplier.sql`:

```sql
-- 20260908232000_bahan_baku_supplier.sql
-- Katalog harga vendor: satu baris per pasangan (bahan, vendor).
-- Lapisan REFERENSI PEMBELIAN. Tidak mengubah harga master, HPP, atau nilai
-- persediaan. Spec: docs/superpowers/specs/2026-09-08-katalog-harga-vendor-design.md

CREATE TABLE IF NOT EXISTS public.bahan_baku_supplier (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bahan_baku_id          uuid NOT NULL REFERENCES public.bahan_baku(id) ON DELETE CASCADE,
  supplier_id            uuid NOT NULL REFERENCES public.supplier(id)   ON DELETE CASCADE,

  -- Harga apa adanya sesuai nota vendor
  satuan_beli            text    NOT NULL,
  isi_satuan_kecil       numeric NOT NULL CHECK (isi_satuan_kecil > 0),
  harga                  numeric NOT NULL DEFAULT 0 CHECK (harga >= 0),

  -- Satu-satunya angka yang boleh dibandingkan antar vendor
  harga_per_satuan_kecil numeric GENERATED ALWAYS AS (harga / isi_satuan_kecil) STORED,

  kode_vendor            text,
  is_preferred           boolean NOT NULL DEFAULT false,
  is_active              boolean NOT NULL DEFAULT true,
  sumber                 text    NOT NULL DEFAULT 'manual'
                                 CHECK (sumber IN ('po', 'manual')),
  perlu_ditinjau         boolean NOT NULL DEFAULT false,

  ref_po_id              uuid REFERENCES public.purchase_order(id) ON DELETE SET NULL,
  harga_updated_at       timestamptz,
  updated_by             uuid REFERENCES public.outlet_staff(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bbs_unik_pasangan UNIQUE (bahan_baku_id, supplier_id)
);

COMMENT ON COLUMN public.bahan_baku_supplier.isi_satuan_kecil IS
  'Jumlah satuan KECIL bahan dalam 1 satuan_beli. Dijangkar ke satuan kecil, '
  'bukan satuan besar, supaya baris tetap benar saat satuan besar bahan '
  'berubah (FOIL Roll->Dus, 8 Sep 2026).';

COMMENT ON COLUMN public.bahan_baku_supplier.perlu_ditinjau IS
  'true = angka berasal dari periode sebelum guard salah-satuan 4 Sep 2026, '
  'atau belum pernah diverifikasi. Tidak boleh dipakai prefill PO.';

CREATE INDEX IF NOT EXISTS idx_bbs_bahan    ON public.bahan_baku_supplier(bahan_baku_id);
CREATE INDEX IF NOT EXISTS idx_bbs_supplier ON public.bahan_baku_supplier(supplier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bbs_satu_preferred
  ON public.bahan_baku_supplier(bahan_baku_id) WHERE is_preferred;

-- ── Riwayat ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bahan_baku_supplier_history (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bahan_baku_supplier_id  uuid REFERENCES public.bahan_baku_supplier(id) ON DELETE SET NULL,
  bahan_baku_id           uuid NOT NULL,
  supplier_id             uuid NOT NULL,
  harga_lama              numeric,
  harga_baru              numeric NOT NULL,
  satuan_beli             text,
  isi_satuan_kecil        numeric,
  sumber                  text,
  ref_po_id               uuid REFERENCES public.purchase_order(id) ON DELETE SET NULL,
  catatan                 text,
  changed_by              uuid REFERENCES public.outlet_staff(id),
  changed_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bbsh_bahan
  ON public.bahan_baku_supplier_history(bahan_baku_id, changed_at DESC);

-- ── Trigger: updated_at + tulis riwayat ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bbs_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_bbs_updated_at ON public.bahan_baku_supplier;
CREATE TRIGGER trg_bbs_updated_at
  BEFORE UPDATE ON public.bahan_baku_supplier
  FOR EACH ROW EXECUTE FUNCTION public.bbs_set_updated_at();

CREATE OR REPLACE FUNCTION public.bbs_tulis_riwayat()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.harga            IS NOT DISTINCT FROM OLD.harga
     AND NEW.satuan_beli      IS NOT DISTINCT FROM OLD.satuan_beli
     AND NEW.isi_satuan_kecil IS NOT DISTINCT FROM OLD.isi_satuan_kecil THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.bahan_baku_supplier_history (
    bahan_baku_supplier_id, bahan_baku_id, supplier_id,
    harga_lama, harga_baru, satuan_beli, isi_satuan_kecil,
    sumber, ref_po_id, changed_by
  ) VALUES (
    NEW.id, NEW.bahan_baku_id, NEW.supplier_id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.harga ELSE NULL END,
    NEW.harga, NEW.satuan_beli, NEW.isi_satuan_kecil,
    NEW.sumber, NEW.ref_po_id, NEW.updated_by
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bbs_riwayat ON public.bahan_baku_supplier;
CREATE TRIGGER trg_bbs_riwayat
  AFTER INSERT OR UPDATE ON public.bahan_baku_supplier
  FOR EACH ROW EXECUTE FUNCTION public.bbs_tulis_riwayat();

-- ── RLS: cermin kebijakan supplier (20260814110000) ───────────────────────
ALTER TABLE public.bahan_baku_supplier         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bahan_baku_supplier_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bbs_select ON public.bahan_baku_supplier;
CREATE POLICY bbs_select ON public.bahan_baku_supplier
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid()
                   AND role IN ('admin','kitchen','purchase','purchasing',
                                'admin_finance','finance','owner','developer')));

DROP POLICY IF EXISTS bbs_write ON public.bahan_baku_supplier;
CREATE POLICY bbs_write ON public.bahan_baku_supplier
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid()
                   AND role IN ('admin','kitchen','purchase','purchasing',
                                'admin_finance','finance','owner','developer')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid()
                   AND role IN ('admin','kitchen','purchase','purchasing',
                                'admin_finance','finance','owner','developer')));

DROP POLICY IF EXISTS bbsh_select ON public.bahan_baku_supplier_history;
CREATE POLICY bbsh_select ON public.bahan_baku_supplier_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid()
                   AND role IN ('admin','kitchen','purchase','purchasing',
                                'admin_finance','finance','owner','developer')));

-- Riwayat hanya ditulis trigger; tidak ada policy INSERT untuk klien.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bahan_baku_supplier         TO authenticated;
GRANT SELECT                         ON public.bahan_baku_supplier_history TO authenticated;

-- DOWN:
-- DROP TABLE IF EXISTS public.bahan_baku_supplier_history CASCADE;
-- DROP TABLE IF EXISTS public.bahan_baku_supplier CASCADE;
-- DROP FUNCTION IF EXISTS public.bbs_tulis_riwayat();
-- DROP FUNCTION IF EXISTS public.bbs_set_updated_at();
```

- [ ] **Step 2: Lint timestamp**

```bash
node scripts/migration-timestamp-lint.mjs supabase/migrations/20260908232000_bahan_baku_supplier.sql
```

Expected: exit 0.

- [ ] **Step 3: Apply**

```bash
supabase db push
```

Kalau gagal karena drift migration remote-only milik dev lain, **jangan** `migration repair` milik orang lain. Pakai jalur alternatif:

```bash
node -e "const fs=require('fs');const{createClient}=require('@supabase/supabase-js');require('dotenv').config({path:'apps/stok/.env.local'});const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);sb.rpc('exec_sql',{sql:fs.readFileSync('supabase/migrations/20260908232000_bahan_baku_supplier.sql','utf8')}).then(r=>console.log(r.error||'ok'))"
```

lalu stempel sendiri:

```bash
supabase db query "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260908232000','bahan_baku_supplier') ON CONFLICT (version) DO NOTHING;" --linked
```

- [ ] **Step 4: Verifikasi struktur benar-benar ada**

```bash
supabase db query "select table_name, count(*) n_kolom from information_schema.columns where table_schema='public' and table_name in ('bahan_baku_supplier','bahan_baku_supplier_history') group by 1 order by 1;" --linked
```

Expected: `bahan_baku_supplier` **17** kolom, `bahan_baku_supplier_history` **13** kolom.

```bash
supabase db query "select tablename, policyname, cmd from pg_policies where tablename in ('bahan_baku_supplier','bahan_baku_supplier_history') order by 1,2;" --linked
```

Expected: 3 policy — `bbs_select` (SELECT), `bbs_write` (ALL), `bbsh_select` (SELECT).

- [ ] **Step 5: Uji trigger riwayat dengan satu baris sementara**

```bash
supabase db query "with b as (select id from bahan_baku where nama='FOIL' limit 1), s as (select id from supplier limit 1) insert into bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga) select b.id, s.id, 'UJI', 10, 1000 from b, s returning id, harga_per_satuan_kecil;" --linked
```

Expected: satu baris, `harga_per_satuan_kecil = 100`.

```bash
supabase db query "select count(*) n_riwayat from bahan_baku_supplier_history where satuan_beli='UJI';" --linked
```

Expected: `n_riwayat = 1`.

Bersihkan:

```bash
supabase db query "delete from bahan_baku_supplier where satuan_beli='UJI'; delete from bahan_baku_supplier_history where satuan_beli='UJI';" --linked
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260908232000_bahan_baku_supplier.sql
git commit -m "feat(db): tabel katalog harga vendor bahan_baku_supplier

Lapisan referensi pembelian. Harga master, HPP, dan nilai persediaan
tidak disentuh.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Seed katalog

**Files:**
- Create: `supabase/migrations/20260908233000_seed_bahan_baku_supplier.sql`

**Interfaces:**
- Consumes: tabel dari Task 4, `faktor_po` dari Task 2, supplier bersih dari Task 3.
- Produces: sekitar 71 baris katalog, di antaranya **15** dengan `perlu_ditinjau = false`.

**🔴 Jebakan yang harus dipahami sebelum menulis kode.** `purchase_order_item.harga_terima` disimpan dalam **satuan besar kanonik bahan**, BUKAN dalam `satuan_po`. Untuk FOIL / MIE / PLASTIK BESAR keduanya berbeda (48× / 40× / 5×). Karena itu seed **wajib** memakai:

- `satuan_beli` = `bahan_baku.satuan` (satuan besar), **bukan** `satuan_po`
- `isi_satuan_kecil` = `faktor_tampilan` (atau `1` bila bahan tidak punya satuan kecil), **bukan** `faktor_po`

Memakai `satuan_po`/`faktor_po` di sini akan menyalahkan harga FOIL sebesar 48× — persis kesalahan yang plan ini dibuat untuk mencegah. `faktor_po` baru dipakai saat operator memilih satuan vendor di form (Tahap 3–4).

**Catatan `kemasan_qty`.** `bahan_baku_harga.kemasan_qty` juga mengklaim "satuan kecil per satuan besar", tapi **tidak sepakat dengan `faktor_tampilan` untuk PLASTIK BESAR** (100 vs 250 — diverifikasi 8 Sep 2026). Seed memakai `faktor_tampilan` karena itu yang dipakai skala ledger dan yang cocok dengan `MASTER-SATUAN-PO-DAN-DISTRIBUSI.md` (1 Ikat = 5 Pack = 250 Lembar). Ketidaksepakatan itu dilaporkan ke owner, tidak diperbaiki oleh plan ini.

- [ ] **Step 1: Tulis migration**

Buat `supabase/migrations/20260908233000_seed_bahan_baku_supplier.sql`:

```sql
-- 20260908233000_seed_bahan_baku_supplier.sql
-- Seed katalog dari dua sumber. Idempoten (ON CONFLICT DO NOTHING).
--
-- PENTING: harga_terima PO tersimpan dalam SATUAN BESAR, bukan satuan_po.
-- Jadi seed memakai satuan besar + faktor_tampilan. Memakai satuan_po di sini
-- akan menyalahkan harga FOIL 48x.

-- Sumber 1: riwayat PO (44 pasangan). Ambil PO terverifikasi TERAKHIR per pasangan.
WITH terakhir AS (
  SELECT DISTINCT ON (poi.bahan_baku_id, po.supplier_id)
         poi.bahan_baku_id,
         po.supplier_id,
         po.id                AS po_id,
         po.diverifikasi_at,
         COALESCE(poi.harga_terima, poi.harga_pesan, 0) AS harga
    FROM public.purchase_order_item poi
    JOIN public.purchase_order po ON po.id = poi.purchase_order_id
   WHERE po.supplier_id IS NOT NULL
   ORDER BY poi.bahan_baku_id, po.supplier_id,
            po.diverifikasi_at DESC NULLS LAST, po.tanggal_po DESC
)
INSERT INTO public.bahan_baku_supplier (
  bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil,
  harga, sumber, perlu_ditinjau, ref_po_id, harga_updated_at
)
SELECT t.bahan_baku_id,
       t.supplier_id,
       COALESCE(NULLIF(btrim(b.satuan), ''), 'Unit'),
       CASE WHEN NULLIF(btrim(COALESCE(b.satuan_kecil, '')), '') IS NULL
                 OR btrim(COALESCE(b.satuan_kecil, '')) = '-'
            THEN 1
            ELSE COALESCE(NULLIF(b.faktor_tampilan, 0), 1)
       END,
       -- Harga hanya disimpan bila PO-nya diverifikasi SETELAH guard salah-satuan.
       -- Sebelum itu basis satuannya campur, DAN definisi satuan besar bahan bisa
       -- sudah berubah sejak PO tsb (FOIL Roll->Dus, 8 Sep 2026) sehingga angkanya
       -- salah skala. Angka aslinya tidak hilang: ref_po_id menunjuk ke PO-nya.
       CASE WHEN t.diverifikasi_at IS NOT NULL
                 AND t.diverifikasi_at >= TIMESTAMPTZ '2026-09-04 00:00:00+07'
            THEN t.harga ELSE 0 END,
       'po',
       -- Hanya PO yang diverifikasi SETELAH guard salah-satuan yang dipercaya
       (t.diverifikasi_at IS NULL OR t.diverifikasi_at < TIMESTAMPTZ '2026-09-04 00:00:00+07'),
       t.po_id,
       t.diverifikasi_at
  FROM terakhir t
  JOIN public.bahan_baku b ON b.id = t.bahan_baku_id
ON CONFLICT (bahan_baku_id, supplier_id) DO NOTHING;

-- Sumber 2: supplier.bahan_baku_ids yang belum punya jejak PO.
-- Tidak ada harga yang bisa dipercaya -> harga 0, wajib ditinjau.
INSERT INTO public.bahan_baku_supplier (
  bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil,
  harga, sumber, perlu_ditinjau
)
SELECT b.id,
       s.id,
       COALESCE(NULLIF(btrim(b.satuan), ''), 'Unit'),
       CASE WHEN NULLIF(btrim(COALESCE(b.satuan_kecil, '')), '') IS NULL
                 OR btrim(COALESCE(b.satuan_kecil, '')) = '-'
            THEN 1
            ELSE COALESCE(NULLIF(b.faktor_tampilan, 0), 1)
       END,
       0,
       'manual',
       true
  FROM public.supplier s
  CROSS JOIN LATERAL unnest(COALESCE(s.bahan_baku_ids, '{}'::uuid[])) AS bb(id)
  JOIN public.bahan_baku b ON b.id = bb.id
ON CONFLICT (bahan_baku_id, supplier_id) DO NOTHING;

-- DOWN:
-- DELETE FROM public.bahan_baku_supplier_history;
-- DELETE FROM public.bahan_baku_supplier;
```

- [ ] **Step 2: Lint timestamp**

```bash
node scripts/migration-timestamp-lint.mjs supabase/migrations/20260908233000_seed_bahan_baku_supplier.sql
```

Expected: exit 0.

- [ ] **Step 3: Apply**

```bash
supabase db push
```

Kalau gagal karena drift migration remote-only milik dev lain, **jangan** `migration repair` milik orang lain. Pakai jalur alternatif:

```bash
node -e "const fs=require('fs');const{createClient}=require('@supabase/supabase-js');require('dotenv').config({path:'apps/stok/.env.local'});const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);sb.rpc('exec_sql',{sql:fs.readFileSync('supabase/migrations/20260908233000_seed_bahan_baku_supplier.sql','utf8')}).then(r=>console.log(r.error||'ok'))"
```

lalu stempel sendiri:

```bash
supabase db query "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260908233000','seed_bahan_baku_supplier') ON CONFLICT (version) DO NOTHING;" --linked
```

- [ ] **Step 4: Verifikasi jumlah dan pembagiannya**

```bash
supabase db query "select count(*) total, count(*) filter (where sumber='po') dari_po, count(*) filter (where sumber='manual') dari_array, count(*) filter (where not perlu_ditinjau) siap_prefill, count(*) filter (where isi_satuan_kecil is null or isi_satuan_kecil <= 0) rusak from bahan_baku_supplier;" --linked
```

Expected: `total ≈ 71`, `dari_po = 44`, `siap_prefill = 15`, **`rusak = 0`**.

Kalau `rusak > 0`, **berhenti** — ada bahan tanpa faktor yang layak.

- [ ] **Step 5: Verifikasi silang harga FOIL tidak tergeser 48×**

```bash
supabase db query "select s.nama vendor, bs.satuan_beli, bs.isi_satuan_kecil, bs.harga, bs.harga_per_satuan_kecil, bs.perlu_ditinjau from bahan_baku_supplier bs join bahan_baku b on b.id=bs.bahan_baku_id join supplier s on s.id=bs.supplier_id where b.nama='FOIL' order by s.nama;" --linked
```

Expected untuk **kedua** baris FOIL: `satuan_beli = 'Dus'`, `isi_satuan_kecil = 36480`, `harga = 0`, `perlu_ditinjau = true`.

Kalau `satuan_beli` terbaca `roll` atau `isi_satuan_kecil` terbaca `760`, seed memakai kolom yang salah (`satuan_po`/`faktor_po` alih-alih `satuan`/`faktor_tampilan`) — **rollback dan perbaiki.**

**Kenapa `harga = 0` dan bukan angka PO-nya.** Kedua PO FOIL diverifikasi sebelum guard 4 Sep, jadi tercatat dalam satuan besar yang berlaku **saat itu** (Roll), bukan yang berlaku sekarang (Dus, sejak `20260908103000` hari ini). Menyimpan `11.554` sebagai "harga per Dus" adalah pernyataan yang salah 48×. Diverifikasi di DB: rasio harga master terhadap harga PO Altindo persis **48,000**, dan POLYBAG persis **0,040** (= 1/25, faktor Bal vs Pack). Karena itu aturannya seragam: **harga hanya terisi untuk baris pasca-guard.** Angka aslinya tetap bisa ditelusuri lewat `ref_po_id`.

- [ ] **Step 6: Verifikasi riwayat ikut terisi oleh trigger**

```bash
supabase db query "select count(*) n from bahan_baku_supplier_history;" --linked
```

Expected: sama dengan `total` di Step 4 (setiap INSERT menulis 1 baris riwayat).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260908233000_seed_bahan_baku_supplier.sql
git commit -m "feat(db): seed katalog harga vendor dari riwayat PO

Baris pra-guard 4 Sep ditandai perlu_ditinjau: basis satuannya campur,
jadi tidak boleh dipakai prefill. Seed memakai satuan besar, bukan
satuan_po -- harga_terima PO tersimpan dalam satuan besar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Fungsi murni katalog

**Files:**
- Create: `apps/admin-dashboard/src/lib/katalogVendor.ts`
- Test: `apps/admin-dashboard/src/lib/katalogVendor.test.ts`

**Interfaces:**
- Consumes: `BahanSatuan` dari Task 1 (tidak wajib diimpor; tipe di bawah berdiri sendiri).
- Produces: `type BarisKatalog`, `konversiKeSatuanKecil()`, `bolehPrefill()`, `setarakanHargaAntarVendor()`. Plan Tahap 2 memakai ketiganya untuk layar pembanding dan prefill PO.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `apps/admin-dashboard/src/lib/katalogVendor.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  konversiKeSatuanKecil,
  bolehPrefill,
  setarakanHargaAntarVendor,
  type BarisKatalog,
} from './katalogVendor'

const baris = (o: Partial<BarisKatalog>): BarisKatalog => ({
  supplier_id: 's1',
  supplier_nama: 'Vendor A',
  satuan_beli: 'Dus',
  isi_satuan_kecil: 36480,
  harga: 421977.6,
  is_active: true,
  perlu_ditinjau: false,
  ...o,
})

describe('konversiKeSatuanKecil', () => {
  it('mengalikan qty dengan isi satuan kecil', () => {
    expect(konversiKeSatuanKecil(2, 760)).toBe(1520)
  })

  it('qty nol tetap nol', () => {
    expect(konversiKeSatuanKecil(0, 760)).toBe(0)
  })

  it('isi tidak sah -> null, bukan diam-diam qty apa adanya', () => {
    expect(konversiKeSatuanKecil(2, 0)).toBeNull()
    expect(konversiKeSatuanKecil(2, -1)).toBeNull()
  })
})

describe('bolehPrefill', () => {
  it('baris sehat boleh', () => {
    expect(bolehPrefill(baris({}))).toBe(true)
  })

  it('perlu ditinjau -> tidak boleh', () => {
    expect(bolehPrefill(baris({ perlu_ditinjau: true }))).toBe(false)
  })

  it('nonaktif -> tidak boleh', () => {
    expect(bolehPrefill(baris({ is_active: false }))).toBe(false)
  })

  it('harga nol -> tidak boleh', () => {
    expect(bolehPrefill(baris({ harga: 0 }))).toBe(false)
  })
})

describe('setarakanHargaAntarVendor', () => {
  it('menyetarakan vendor yang satuan belinya berbeda', () => {
    // Ekadharma per Roll (760 cm) vs Altindo per Dus (36.480 cm)
    const hasil = setarakanHargaAntarVendor([
      baris({ supplier_id: 'eka', supplier_nama: 'Ekadharma',
              satuan_beli: 'Roll', isi_satuan_kecil: 760, harga: 8791.2 }),
      baris({ supplier_id: 'alt', supplier_nama: 'Altindo',
              satuan_beli: 'Dus', isi_satuan_kecil: 36480, harga: 421977.6 }),
    ])

    // Sengaja TIDAK menguji urutannya: kedua harga setara secara matematis,
    // jadi mana yang dianggap termurah bergantung galat pembulatan float.
    const eka = hasil.find(h => h.supplier_id === 'eka')!
    const alt = hasil.find(h => h.supplier_id === 'alt')!

    expect(hasil).toHaveLength(2)
    expect(eka.hargaPerSatuanKecil).toBeCloseTo(11.5674, 4)
    expect(alt.hargaPerSatuanKecil).toBeCloseTo(11.5674, 4)
    expect(eka.selisihPersen).toBeCloseTo(0, 6)
    expect(alt.selisihPersen).toBeCloseTo(0, 6)
  })

  it('mengurutkan termurah lebih dulu dan menghitung selisih terhadapnya', () => {
    const hasil = setarakanHargaAntarVendor([
      baris({ supplier_id: 'mahal', harga: 110, isi_satuan_kecil: 1 }),
      baris({ supplier_id: 'murah', harga: 100, isi_satuan_kecil: 1 }),
    ])

    expect(hasil[0].supplier_id).toBe('murah')
    expect(hasil[0].selisihPersen).toBe(0)
    expect(hasil[1].selisihPersen).toBeCloseTo(10, 6)
  })

  it('baris perlu ditinjau tetap tampil tapi tidak jadi acuan termurah', () => {
    const hasil = setarakanHargaAntarVendor([
      baris({ supplier_id: 'ragu', harga: 1, isi_satuan_kecil: 1, perlu_ditinjau: true }),
      baris({ supplier_id: 'sah', harga: 100, isi_satuan_kecil: 1 }),
    ])

    expect(hasil.find(h => h.supplier_id === 'ragu')).toBeDefined()
    expect(hasil.find(h => h.supplier_id === 'sah')!.selisihPersen).toBe(0)
    expect(hasil.find(h => h.supplier_id === 'ragu')!.selisihPersen).toBeNull()
  })

  it('tidak ada baris sah -> semua selisih null, tidak melempar', () => {
    const hasil = setarakanHargaAntarVendor([
      baris({ supplier_id: 'a', perlu_ditinjau: true }),
    ])
    expect(hasil[0].selisihPersen).toBeNull()
  })

  it('daftar kosong -> array kosong', () => {
    expect(setarakanHargaAntarVendor([])).toEqual([])
  })
})
```

- [ ] **Step 2: Jalankan tes, pastikan GAGAL**

```bash
cd "apps/admin-dashboard" && yarn vitest run src/lib/katalogVendor.test.ts
```

Expected: FAIL — `Failed to resolve import "./katalogVendor"`.

- [ ] **Step 3: Tulis implementasi minimal**

Buat `apps/admin-dashboard/src/lib/katalogVendor.ts`:

```ts
/**
 * Fungsi murni katalog harga vendor.
 * Satu-satunya angka yang boleh dibandingkan antar vendor adalah harga per
 * SATUAN KECIL — vendor bisa menota dalam kemasan yang berbeda.
 */
export type BarisKatalog = {
  supplier_id: string
  supplier_nama: string
  satuan_beli: string
  isi_satuan_kecil: number
  harga: number
  is_active: boolean
  perlu_ditinjau: boolean
}

export type BarisSetara = BarisKatalog & {
  hargaPerSatuanKecil: number | null
  /** Persen di atas vendor sah termurah. null = tidak dipakai sebagai acuan. */
  selisihPersen: number | null
}

export function konversiKeSatuanKecil(qty: number, isiSatuanKecil: number): number | null {
  if (!Number.isFinite(isiSatuanKecil) || isiSatuanKecil <= 0) return null
  return qty * isiSatuanKecil
}

export function bolehPrefill(b: BarisKatalog): boolean {
  return b.is_active && !b.perlu_ditinjau && b.harga > 0 && b.isi_satuan_kecil > 0
}

export function setarakanHargaAntarVendor(rows: BarisKatalog[]): BarisSetara[] {
  const dihitung = rows.map((b) => ({
    ...b,
    hargaPerSatuanKecil:
      b.isi_satuan_kecil > 0 ? b.harga / b.isi_satuan_kecil : null,
  }))

  const sah = dihitung.filter(
    (b) => bolehPrefill(b) && b.hargaPerSatuanKecil !== null,
  )
  const termurah = sah.length
    ? Math.min(...sah.map((b) => b.hargaPerSatuanKecil as number))
    : null

  return dihitung
    .map((b) => ({
      ...b,
      selisihPersen:
        termurah !== null && termurah > 0 && bolehPrefill(b) && b.hargaPerSatuanKecil !== null
          ? ((b.hargaPerSatuanKecil - termurah) / termurah) * 100
          : null,
    }))
    .sort((a, z) => {
      const av = a.selisihPersen
      const zv = z.selisihPersen
      if (av === null && zv === null) return 0
      if (av === null) return 1
      if (zv === null) return -1
      return av - zv
    })
}
```

- [ ] **Step 4: Jalankan tes, pastikan LULUS**

```bash
cd "apps/admin-dashboard" && yarn vitest run src/lib/katalogVendor.test.ts
```

Expected: PASS, 13 tes.

- [ ] **Step 5: Bandingkan seluruh suite terhadap baseline**

```bash
cd "apps/admin-dashboard" && yarn test 2>&1 | tail -20
cd "apps/admin-dashboard" && yarn type-check 2>&1 | tail -20
```

Expected: jumlah kegagalan **sama persis** dengan `/tmp/baseline-test.txt` dan `/tmp/baseline-types.txt`, dengan jumlah tes lulus bertambah 24. Nol regresi. Jangan menuliskan "0 error" kalau baseline-nya tidak nol.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/lib/katalogVendor.ts apps/admin-dashboard/src/lib/katalogVendor.test.ts
git commit -m "feat(admin-dashboard): fungsi murni penyetaraan harga antar vendor

Perbandingan selalu per satuan kecil; baris perlu_ditinjau tampil tapi
tidak dipakai sebagai acuan termurah.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Setelah semua task selesai

- [ ] **Laporkan ke owner, jangan diperbaiki sendiri:**
  1. **Termin Pak Aziz** — 30 vs 10 hari, masih perlu dikonfirmasi ke supplier.
  2. **PLASTIK BESAR: `kemasan_qty` 100 vs `faktor_tampilan` 250** — beda 2,5×. Dokumen master memihak 250. Perlu keputusan mana yang dikoreksi.
  3. **Jumlah baris `perlu_ditinjau`** — berapa pasangan yang harus disunting manual sebelum prefill PO berguna.
- [ ] **Tidak perlu redeploy.** Tahap 0–1 murni DB + fungsi murni yang belum dipanggil UI mana pun.
- [ ] **`supplier.bahan_baku_ids` masih hidup dan masih ditulis** oleh halaman supplier. Spec §4.4 memensiunkannya, tapi itu baru berlaku di Tahap 2 saat halaman supplier pindah membaca katalog. Sampai itu terjadi, keduanya berdampingan — dan katalog **tidak** otomatis ikut berubah kalau seseorang menyunting daftar bahan di halaman supplier. Jalankan ulang Task 5 (idempoten) untuk menyerap pasangan baru.
- [ ] Plan Tahap 2–4 (layar pembanding, wiring form PO, tulis-balik `verifikasi_terima_po`) ditulis setelah isi katalog dilihat.
