# Drop-Ship Sayur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crew outlet mencatat sayur yang diantar langsung Pak Aziz (stok bertambah saat itu juga), dan purchasing/kitchen/admin mengesahkan nota gabungan tiap tanggal 10/20/akhir bulan menjadi utang vendor.

**Architecture:** Dua tabel baru (`terima_vendor_outlet`, `nota_vendor` + `nota_vendor_rincian`). Stok ditulis oleh trigger yang merekonsiliasi target vs baris ledger yang sudah ada (pola `sync_waste_ledger`). Semua penulisan lewat RPC `SECURITY DEFINER` yang memeriksa peran **di dalam fungsi** dan dipanggil dengan sesi user (bukan service-role). Pengesahan membuat PO berstatus `diterima_lengkap` lewat INSERT supaya utang muncul di layar finance yang sudah ada — tanpa pernah lewat `verifikasi_terima_po`.

**Tech Stack:** Supabase Postgres (PL/pgSQL, RLS, storage), Next.js app router `apps/stok`, React Query, `@suka/auth`, `@suka/design-system`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-11-drop-ship-sayur-design.md` — baca §2 (keputusan owner), §4.3 (tiga larangan), §6 (otorisasi), §11 (verifikasi wajib) sebelum mulai.

## Global Constraints

- **Target:** Task 1–6 hidup sebelum **opname sayur 20 September 2026 malam**; Task 7–8 sebelum **30 September 2026** (nota pertama). Task 9 menyusul. Task 10 = runbook 20–21 September.
- **Branch:** kerjakan di `feat/drop-ship-sayur`. Tepat sebelum **setiap** commit jalankan `git branch --show-current` — otomasi repo memindahkan HEAD di tengah sesi. Jangan pernah commit ke branch sesi lain.
- **Timestamp migration:** `20260911120000`, `20260911121000`, `20260911122000`, `20260911123000`. `20260911100000` sudah dipakai `app_banners`. Bila eksekusi jatuh di hari lain, ganti ke tanggal eksekusi dengan nomor lebih besar dari migration terbaru di `supabase/migrations/` — `scripts/migration-timestamp-lint.mjs` menolak timestamp >2 hari ke depan.
- **Menerapkan DDL:** `supabase db query --linked -f <file>`. **Jangan** bentuk inline `"<sql>"` untuk DDL — ia bisa balas sukses tanpa menjalankan apa pun. Setelah apply, verifikasi ke katalog (`pg_proc`, `pg_class`, `pg_policies`), lalu stempel:
  `INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('<ts>', '<nama>') ON CONFLICT (version) DO NOTHING;`
- **Asersi berbatas dua sisi** (tahan minus **dan** yang mustahil besar) + **kontrol negatif** di tiap blok uji: jalankan sekali dengan `RAISE EXCEPTION` sengaja di baris terakhir untuk membuktikan jalan senyap = lulus.
- **Uji perilaku sebagai user asli** di dalam `BEGIN … ROLLBACK`: `set_config('request.jwt.claims', json_build_object('sub', <uuid>, 'role','authenticated')::text, true)` + `SET LOCAL ROLE authenticated`. `supabase db query` menelan `RAISE NOTICE` — laporkan hasil lewat `RAISE EXCEPTION 'HASIL: …'`.
- **Peran:** pencatat = staff aktif dengan `outlet_staff.outlet_id` terisi, outletnya **selalu** `outlet_staff.outlet_id` (bukan `accessible_outlet_ids()`). Pengesah = `purchasing`, `kitchen`, `admin`. Pembaca nota = pengesah + `owner`, `admin_finance`.
- **Tiga larangan (spec §4.3):** (1) jangan lewat `verifikasi_terima_po`; (2) jangan mengesahkan dengan UPDATE status PO (`po_status_transition_guard` tak memuat purchasing); (3) pemeriksa PO-tanpa-ledger wajib mengecualikan `nota_vendor_id IS NOT NULL`.
- **Tidak ada policy `USING(true)`.** Cabut grant tulis tabel baru dari `anon` dan `authenticated`; semua tulis lewat RPC.
- **Satuan:** `qty` selalu **satuan besar** (kg untuk sayur); `harga` per satuan besar. Ledger ditulis lewat `to_ledger_scale(outlet, bahan, qty)`.
- **Perintah uji app stok:** `cd apps/stok && yarn test <path>`; type-check `cd apps/stok && yarn type-check`.

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `apps/stok/src/lib/stok/periodeTagihan.ts` (+ `.test.ts`) | Aturan periode 10/20/akhir bulan — cermin fungsi SQL `periode_tagihan` |
| `apps/stok/src/lib/stok/dropShip.ts` (+ `.test.ts`) | Fungsi murni: konversi qty ke satuan besar, ambang konfirmasi, selisih nota, daftar tanggal tagihan |
| `apps/stok/src/lib/stok/approver.ts` (modify) + `approver.test.ts` (create) | Predikat peran `canCatatTerimaVendor`, `canSahkanNotaVendor` |
| `supabase/migrations/20260911120000_drop_ship_skema.sql` | Tabel, kolom rujukan, `periode_tagihan()`, RLS, bucket `drop-ship` |
| `supabase/migrations/20260911121000_drop_ship_catat_terima.sql` | Trigger sinkron stok + RPC `info_terima_vendor`, `catat_terima_vendor`, `koreksi_terima_vendor`, `daftar_terima_vendor_saya` |
| `supabase/migrations/20260911122000_drop_ship_sahkan_nota.sql` | RPC `ringkasan_nota_vendor`, `sahkan_nota_vendor`, `tolak_terima_vendor` |
| `supabase/migrations/20260911123000_drop_ship_laporan.sql` | View `nilai_masuk_drop_ship_harian` |
| `supabase/verifikasi/drop_ship/*.sql` | Uji perilaku BEGIN/ROLLBACK per task + pemantau pasca-rilis (bukan migration — nama folder sengaja bukan `tests/` agar tak diambil `supabase test db`) |
| `apps/stok/src/hooks/useTerimaVendor.ts` | React Query: RPC sisi crew |
| `apps/stok/src/hooks/useNotaVendor.ts` | React Query: RPC sisi pengesah |
| `apps/stok/src/components/stok/TerimaVendorForm.tsx` | Form crew |
| `apps/stok/src/app/stok/terima-vendor/page.tsx` | Halaman crew |
| `apps/stok/src/components/stok/NotaVendorBoard.tsx` | Layar pencocokan nota |
| `apps/stok/src/app/stok/nota-vendor/page.tsx` | Halaman pengesah |
| `apps/stok/src/components/layout/AppSidebar.tsx` (modify) | Dua entri nav |

---

### Task 1: Aturan periode tagihan (TS)

**Files:**
- Create: `apps/stok/src/lib/stok/periodeTagihan.ts`
- Test: `apps/stok/src/lib/stok/periodeTagihan.test.ts`

**Interfaces:**
- Produces: `periodeTagihan(tanggalISO: string): { mulai: string; akhir: string; tanggalTagihan: string }` (semua `YYYY-MM-DD`); `daftarTanggalTagihan(hariIniISO: string, jumlah: number): string[]` (tanggal tagihan terbaru dulu, termasuk periode berjalan).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { periodeTagihan, daftarTanggalTagihan } from './periodeTagihan'

// Keputusan owner 2026-09-11: nota Pak Aziz tiap tgl 10, 20, dan HARI TERAKHIR
// bulan (tgl 31 ikut periode 21-31; Februari ditagih 28/29). Spec §4.4.
describe('periodeTagihan', () => {
  it('tgl 1-10 -> ditagih tgl 10', () => {
    expect(periodeTagihan('2026-09-03')).toEqual({ mulai: '2026-09-01', akhir: '2026-09-10', tanggalTagihan: '2026-09-10' })
    expect(periodeTagihan('2026-09-10').tanggalTagihan).toBe('2026-09-10')
  })
  it('tgl 11-20 -> ditagih tgl 20', () => {
    expect(periodeTagihan('2026-09-11')).toEqual({ mulai: '2026-09-11', akhir: '2026-09-20', tanggalTagihan: '2026-09-20' })
  })
  it('tgl 21+ -> hari terakhir bulan', () => {
    expect(periodeTagihan('2026-09-21')).toEqual({ mulai: '2026-09-21', akhir: '2026-09-30', tanggalTagihan: '2026-09-30' })
    expect(periodeTagihan('2026-10-31').tanggalTagihan).toBe('2026-10-31')
  })
  it('Februari: 28 di tahun biasa, 29 di tahun kabisat', () => {
    expect(periodeTagihan('2027-02-25').tanggalTagihan).toBe('2027-02-28')
    expect(periodeTagihan('2028-02-29').tanggalTagihan).toBe('2028-02-29')
  })
  it('menerima timestamp ISO penuh', () => {
    expect(periodeTagihan('2026-09-21T23:10:00+07:00').tanggalTagihan).toBe('2026-09-30')
  })
  it('menolak tanggal tak valid', () => {
    expect(() => periodeTagihan('bukan-tanggal')).toThrow()
  })
})

describe('daftarTanggalTagihan', () => {
  it('periode berjalan dulu, lalu mundur', () => {
    expect(daftarTanggalTagihan('2026-09-25', 4)).toEqual(['2026-09-30', '2026-09-20', '2026-09-10', '2026-08-31'])
  })
  it('melintasi tahun', () => {
    expect(daftarTanggalTagihan('2027-01-05', 2)).toEqual(['2027-01-10', '2026-12-31'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/stok && yarn test src/lib/stok/periodeTagihan.test.ts`
Expected: FAIL — `Failed to resolve import "./periodeTagihan"`

- [ ] **Step 3: Write minimal implementation**

```ts
// Periode tagihan tetap kalender untuk vendor drop-ship (spec §4.4).
// CERMIN fungsi SQL public.periode_tagihan() di migration 20260911120000 —
// ubah keduanya bersamaan. Task 2 memuat uji kesetaraan kasus-kasus di bawah.
export type PeriodeTagihan = { mulai: string; akhir: string; tanggalTagihan: string }

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function hariTerakhir(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate() // m 1-based: hari 0 bulan berikut
}

export function periodeTagihan(tanggalISO: string): PeriodeTagihan {
  const [y, m, d] = tanggalISO.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d || m > 12 || d > 31) throw new Error(`Tanggal tidak valid: ${tanggalISO}`)
  if (d <= 10) return { mulai: iso(y, m, 1), akhir: iso(y, m, 10), tanggalTagihan: iso(y, m, 10) }
  if (d <= 20) return { mulai: iso(y, m, 11), akhir: iso(y, m, 20), tanggalTagihan: iso(y, m, 20) }
  const last = hariTerakhir(y, m)
  return { mulai: iso(y, m, 21), akhir: iso(y, m, last), tanggalTagihan: iso(y, m, last) }
}

export function daftarTanggalTagihan(hariIniISO: string, jumlah: number): string[] {
  const hasil: string[] = []
  let cursor = periodeTagihan(hariIniISO)
  while (hasil.length < jumlah) {
    hasil.push(cursor.tanggalTagihan)
    const [y, m, d] = cursor.mulai.split('-').map(Number)
    const sebelum = new Date(Date.UTC(y, m - 1, d - 1)) // sehari sebelum periode ini mulai
    cursor = periodeTagihan(sebelum.toISOString())
  }
  return hasil
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/stok && yarn test src/lib/stok/periodeTagihan.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # harus feat/drop-ship-sayur
git add apps/stok/src/lib/stok/periodeTagihan.ts apps/stok/src/lib/stok/periodeTagihan.test.ts
git commit -m "feat(stok): aturan periode tagihan tetap 10/20/akhir bulan"
```

---

### Task 2: Skema database drop-ship

**Files:**
- Create: `supabase/migrations/20260911120000_drop_ship_skema.sql`
- Test: `supabase/verifikasi/drop_ship/t2_skema.sql`

**Interfaces:**
- Consumes: aturan Task 1 (dicerminkan di SQL).
- Produces: tabel `terima_vendor_outlet`, `nota_vendor`, `nota_vendor_rincian`; kolom `ledger_stok.ref_terima_vendor_id`, `purchase_order.nota_vendor_id`; fungsi `periode_tagihan(date) RETURNS TABLE(mulai date, akhir date, tanggal_tagihan date)`; fungsi `peran_saya() RETURNS text`; bucket `drop-ship`.

- [ ] **Step 1: Write the failing test**

`supabase/verifikasi/drop_ship/t2_skema.sql`:

```sql
-- Uji Task 2. Jalankan: supabase db query --linked -f supabase/verifikasi/drop_ship/t2_skema.sql
-- Harapan: error P0001 berbunyi "HASIL T2: LULUS ..." (bukan pesan galat lain).
BEGIN;
DO $$
DECLARE r record; v int;
BEGIN
  -- tabel & kolom ada
  PERFORM 1 FROM pg_class WHERE relname = 'terima_vendor_outlet' AND relnamespace = 'public'::regnamespace;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: tabel terima_vendor_outlet tidak ada'; END IF;
  PERFORM 1 FROM pg_class WHERE relname = 'nota_vendor' AND relnamespace = 'public'::regnamespace;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: tabel nota_vendor tidak ada'; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_name='ledger_stok' AND column_name='ref_terima_vendor_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: ledger_stok.ref_terima_vendor_id tidak ada'; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_name='purchase_order' AND column_name='nota_vendor_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: purchase_order.nota_vendor_id tidak ada'; END IF;

  -- kesetaraan dengan periodeTagihan.ts (kasus identik dengan Task 1)
  FOR r IN SELECT * FROM (VALUES
      ('2026-09-03'::date, '2026-09-01'::date, '2026-09-10'::date, '2026-09-10'::date),
      ('2026-09-10', '2026-09-01', '2026-09-10', '2026-09-10'),
      ('2026-09-11', '2026-09-11', '2026-09-20', '2026-09-20'),
      ('2026-09-21', '2026-09-21', '2026-09-30', '2026-09-30'),
      ('2026-10-31', '2026-10-21', '2026-10-31', '2026-10-31'),
      ('2027-02-25', '2027-02-21', '2027-02-28', '2027-02-28'),
      ('2028-02-29', '2028-02-21', '2028-02-29', '2028-02-29')) AS k(tgl, mulai, akhir, tagih)
  LOOP
    PERFORM 1 FROM public.periode_tagihan(r.tgl) p
      WHERE p.mulai = r.mulai AND p.akhir = r.akhir AND p.tanggal_tagihan = r.tagih;
    IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: periode_tagihan(%) tidak sama dengan TS', r.tgl; END IF;
  END LOOP;

  -- tidak ada USING(true) di tabel baru
  SELECT count(*) INTO v FROM pg_policies
   WHERE tablename IN ('terima_vendor_outlet','nota_vendor','nota_vendor_rincian')
     AND (qual = 'true' OR with_check = 'true');
  IF v > 0 THEN RAISE EXCEPTION 'GAGAL: % policy USING(true)', v; END IF;

  -- tulis langsung dicabut (dua sisi: SELECT tetap ada lewat policy, tulis tidak)
  IF has_table_privilege('authenticated', 'public.terima_vendor_outlet', 'INSERT') THEN
    RAISE EXCEPTION 'GAGAL: authenticated masih bisa INSERT langsung';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.terima_vendor_outlet', 'SELECT') THEN
    RAISE EXCEPTION 'GAGAL: authenticated kehilangan SELECT -- layar crew akan kosong';
  END IF;

  PERFORM 1 FROM storage.buckets WHERE id = 'drop-ship';
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: bucket drop-ship tidak ada'; END IF;

  RAISE EXCEPTION 'HASIL T2: LULUS (skema, kesetaraan periode 7 kasus, RLS, grant, bucket)';
END $$;
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `supabase db query --linked -f supabase/verifikasi/drop_ship/t2_skema.sql`
Expected: `ERROR: P0001: GAGAL: tabel terima_vendor_outlet tidak ada`

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260911120000_drop_ship_skema.sql`:

```sql
-- 20260911120000_drop_ship_skema.sql
-- Skema drop-ship: vendor mengantar LANGSUNG ke outlet (sayur/Pak Aziz).
-- Spec: docs/superpowers/specs/2026-09-11-drop-ship-sayur-design.md
-- Belum ada penulis stok di migration ini -- trigger & RPC di 20260911121000.

-- Peran pemanggil, satu tempat. NULL bila bukan staff aktif.
CREATE OR REPLACE FUNCTION public.peran_saya()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.role FROM public.outlet_staff s WHERE s.id = auth.uid() AND s.status = 'active'
$$;
REVOKE ALL ON FUNCTION public.peran_saya() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peran_saya() TO authenticated, service_role;

-- Periode tagihan tetap: 1-10 -> tgl 10, 11-20 -> tgl 20, 21-akhir -> hari terakhir.
-- CERMIN apps/stok/src/lib/stok/periodeTagihan.ts -- ubah keduanya bersamaan.
CREATE OR REPLACE FUNCTION public.periode_tagihan(p_tanggal date)
RETURNS TABLE(mulai date, akhir date, tanggal_tagihan date)
LANGUAGE sql IMMUTABLE AS $$
  WITH b AS (SELECT date_trunc('month', p_tanggal)::date AS awal,
                    (date_trunc('month', p_tanggal) + interval '1 month - 1 day')::date AS akhir_bulan,
                    extract(day FROM p_tanggal)::int AS hari)
  SELECT CASE WHEN hari <= 10 THEN awal WHEN hari <= 20 THEN awal + 10 ELSE awal + 20 END,
         CASE WHEN hari <= 10 THEN awal + 9 WHEN hari <= 20 THEN awal + 19 ELSE akhir_bulan END,
         CASE WHEN hari <= 10 THEN awal + 9 WHEN hari <= 20 THEN awal + 19 ELSE akhir_bulan END
    FROM b
$$;

CREATE TABLE IF NOT EXISTS public.nota_vendor (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      uuid NOT NULL REFERENCES public.supplier(id),
  periode_mulai    date NOT NULL,
  periode_akhir    date NOT NULL,
  tanggal_tagihan  date NOT NULL,
  total_kg_nota    numeric NOT NULL CHECK (total_kg_nota > 0),
  total_rupiah_nota numeric NOT NULL CHECK (total_rupiah_nota > 0),
  foto_nota_url    text NOT NULL CHECK (length(btrim(foto_nota_url)) > 0),
  status           text NOT NULL DEFAULT 'disahkan' CHECK (status IN ('disahkan','dibatalkan')),
  disahkan_oleh    uuid REFERENCES public.outlet_staff(id),
  disahkan_at      timestamptz NOT NULL DEFAULT now(),
  purchase_order_id uuid REFERENCES public.purchase_order(id),
  catatan_selisih  text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
-- Satu nota sah per vendor per periode.
CREATE UNIQUE INDEX IF NOT EXISTS nota_vendor_unik_periode
  ON public.nota_vendor (supplier_id, tanggal_tagihan) WHERE status = 'disahkan';

CREATE TABLE IF NOT EXISTS public.nota_vendor_rincian (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_vendor_id  uuid NOT NULL REFERENCES public.nota_vendor(id) ON DELETE CASCADE,
  outlet_id       uuid NOT NULL REFERENCES public.outlets(id),
  tanggal_kirim   date,
  qty_kg          numeric NOT NULL CHECK (qty_kg > 0)
);

CREATE TABLE IF NOT EXISTS public.terima_vendor_outlet (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id       uuid NOT NULL REFERENCES public.outlets(id),
  supplier_id     uuid NOT NULL REFERENCES public.supplier(id),
  bahan_baku_id   uuid NOT NULL REFERENCES public.bahan_baku(id),
  qty             numeric NOT NULL CHECK (qty > 0),           -- SATUAN BESAR
  harga_snapshot  numeric NOT NULL DEFAULT 0 CHECK (harga_snapshot >= 0),
  tanggal_terima  date NOT NULL,
  status          text NOT NULL DEFAULT 'dicatat' CHECK (status IN ('dicatat','disahkan','ditolak')),
  nota_vendor_id  uuid REFERENCES public.nota_vendor(id),
  catatan         text,
  foto_url        text,
  dicatat_oleh    uuid NOT NULL REFERENCES public.outlet_staff(id),
  dicatat_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tvo_periode ON public.terima_vendor_outlet (supplier_id, tanggal_terima);
CREATE INDEX IF NOT EXISTS tvo_outlet  ON public.terima_vendor_outlet (outlet_id, tanggal_terima);

ALTER TABLE public.ledger_stok
  ADD COLUMN IF NOT EXISTS ref_terima_vendor_id uuid REFERENCES public.terima_vendor_outlet(id);
CREATE INDEX IF NOT EXISTS ledger_ref_terima_vendor ON public.ledger_stok (ref_terima_vendor_id)
  WHERE ref_terima_vendor_id IS NOT NULL;

ALTER TABLE public.purchase_order
  ADD COLUMN IF NOT EXISTS nota_vendor_id uuid REFERENCES public.nota_vendor(id);

-- RLS: baca ber-scope, tulis HANYA lewat RPC.
ALTER TABLE public.terima_vendor_outlet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nota_vendor          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nota_vendor_rincian  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tvo_select ON public.terima_vendor_outlet;
CREATE POLICY tvo_select ON public.terima_vendor_outlet FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids())
         OR public.peran_saya() IN ('purchasing','kitchen','admin','owner','admin_finance'));

DROP POLICY IF EXISTS nv_select ON public.nota_vendor;
CREATE POLICY nv_select ON public.nota_vendor FOR SELECT TO authenticated
  USING (public.peran_saya() IN ('purchasing','kitchen','admin','owner','admin_finance'));

DROP POLICY IF EXISTS nvr_select ON public.nota_vendor_rincian;
CREATE POLICY nvr_select ON public.nota_vendor_rincian FOR SELECT TO authenticated
  USING (public.peran_saya() IN ('purchasing','kitchen','admin','owner','admin_finance'));

REVOKE ALL ON public.terima_vendor_outlet, public.nota_vendor, public.nota_vendor_rincian FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.terima_vendor_outlet, public.nota_vendor, public.nota_vendor_rincian FROM authenticated;
GRANT SELECT ON public.terima_vendor_outlet, public.nota_vendor, public.nota_vendor_rincian TO authenticated;

-- Bucket foto: nota (pengesah) & bukti terima opsional (crew).
-- po-invoices tidak dipakai: INSERT-nya hanya admin & kitchen, purchasing ditolak.
INSERT INTO storage.buckets (id, name, public) VALUES ('drop-ship', 'drop-ship', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS drop_ship_insert ON storage.objects;
CREATE POLICY drop_ship_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'drop-ship' AND public.peran_saya() IS NOT NULL);
DROP POLICY IF EXISTS drop_ship_select ON storage.objects;
CREATE POLICY drop_ship_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'drop-ship' AND public.peran_saya() IS NOT NULL);

-- DOWN:
-- DROP POLICY IF EXISTS drop_ship_select ON storage.objects;
-- DROP POLICY IF EXISTS drop_ship_insert ON storage.objects;
-- ALTER TABLE public.purchase_order DROP COLUMN IF EXISTS nota_vendor_id;
-- ALTER TABLE public.ledger_stok DROP COLUMN IF EXISTS ref_terima_vendor_id;
-- DROP TABLE IF EXISTS public.terima_vendor_outlet, public.nota_vendor_rincian, public.nota_vendor;
-- DROP FUNCTION IF EXISTS public.periode_tagihan(date), public.peran_saya();
```

- [ ] **Step 4: Apply, verify, stamp**

```bash
supabase db query --linked -f supabase/migrations/20260911120000_drop_ship_skema.sql
supabase db query --linked -f supabase/verifikasi/drop_ship/t2_skema.sql
```
Expected: `ERROR: P0001: HASIL T2: LULUS (skema, kesetaraan periode 7 kasus, RLS, grant, bucket)`

Kontrol negatif: salin `t2_skema.sql` ke scratchpad, ubah satu tanggal harapan (mis. `'2026-09-30'` → `'2026-09-29'` di baris `2026-09-21`), jalankan. Expected: `GAGAL: periode_tagihan(2026-09-21) tidak sama dengan TS`. Buang salinannya.

Stempel:
```sql
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260911120000','drop_ship_skema') ON CONFLICT (version) DO NOTHING;
```
(simpan sebagai file di scratchpad, jalankan dengan `-f`)

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add supabase/migrations/20260911120000_drop_ship_skema.sql supabase/verifikasi/drop_ship/t2_skema.sql
git commit -m "feat(db): skema drop-ship vendor ke outlet (tabel, periode_tagihan, RLS, bucket)"
```

---

### Task 3: Trigger stok + RPC pencatatan crew

**Files:**
- Create: `supabase/migrations/20260911121000_drop_ship_catat_terima.sql`
- Test: `supabase/verifikasi/drop_ship/t3_catat.sql`

**Interfaces:**
- Consumes: tabel & `peran_saya()` (Task 2), `to_ledger_scale(uuid, uuid, numeric)`, `bahan_baku_supplier`, `bahan_baku_harga`.
- Produces (semua `SECURITY DEFINER`, dipanggil sesi user):
  - `info_terima_vendor(p_bahan_baku_id uuid) RETURNS TABLE(supplier_id uuid, supplier_nama text, harga_snapshot numeric, rata_pakai_harian numeric)`
  - `catat_terima_vendor(p_bahan_baku_id uuid, p_supplier_id uuid, p_qty numeric, p_tanggal date, p_catatan text DEFAULT NULL, p_foto_url text DEFAULT NULL) RETURNS uuid`
  - `koreksi_terima_vendor(p_id uuid, p_qty numeric) RETURNS void`
  - `daftar_terima_vendor_saya(p_dari date, p_sampai date) RETURNS TABLE(id uuid, tanggal_terima date, bahan_nama text, satuan text, supplier_nama text, qty numeric, harga_snapshot numeric, status text, dicatat_at timestamptz)`

- [ ] **Step 1: Write the failing test**

`supabase/verifikasi/drop_ship/t3_catat.sql`:

```sql
-- Uji Task 3 sebagai crew asli outlet tes. Semua di-ROLLBACK.
-- Harapan: "HASIL T3: LULUS ..."
BEGIN;
DO $$
DECLARE
  v_crew uuid; v_outlet uuid; v_lain uuid; v_bahan uuid; v_sup uuid;
  v_id uuid; v_ledger numeric; v_saldo0 numeric; v_saldo1 numeric; v_ok boolean;
BEGIN
  SELECT s.id, s.outlet_id INTO v_crew, v_outlet FROM public.outlet_staff s
    JOIN public.outlets o ON o.id = s.outlet_id
   WHERE o.type = 'test' AND s.role = 'crew' AND s.status = 'active' LIMIT 1;
  SELECT id INTO v_lain FROM public.outlets WHERE type = 'outlet' AND id <> v_outlet LIMIT 1;
  SELECT id INTO v_bahan FROM public.bahan_baku WHERE nama ILIKE '%lettuce%' LIMIT 1;
  SELECT id INTO v_sup FROM public.supplier WHERE nama = 'Lettuce (Pak Aziz) - Tempo 10';
  IF v_crew IS NULL OR v_bahan IS NULL OR v_sup IS NULL THEN
    RAISE EXCEPTION 'GAGAL: data uji tak ketemu (crew %, bahan %, supplier %)', v_crew, v_bahan, v_sup;
  END IF;

  SELECT COALESCE(saldo,0) INTO v_saldo0 FROM public.stok_balance WHERE outlet_id=v_outlet AND bahan_baku_id=v_bahan;
  v_saldo0 := COALESCE(v_saldo0, 0);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- (a) catat 5 kg -> stok outlet SENDIRI naik tepat to_ledger_scale(5)
  v_id := public.catat_terima_vendor(v_bahan, v_sup, 5, current_date, 'uji', NULL);
  SELECT sum(qty) INTO v_ledger FROM public.ledger_stok WHERE ref_terima_vendor_id = v_id;
  IF v_ledger IS DISTINCT FROM public.to_ledger_scale(v_outlet, v_bahan, 5) THEN
    RAISE EXCEPTION 'GAGAL (a): ledger % <> to_ledger_scale(5)', v_ledger;
  END IF;
  PERFORM 1 FROM public.terima_vendor_outlet WHERE id = v_id AND outlet_id = v_outlet AND harga_snapshot > 0;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL (a): outlet salah atau harga_snapshot 0'; END IF;

  -- (b) koreksi 5 -> 3: ledger bersih = to_ledger_scale(3), tak ada baris ganda
  PERFORM public.koreksi_terima_vendor(v_id, 3);
  SELECT sum(qty) INTO v_ledger FROM public.ledger_stok WHERE ref_terima_vendor_id = v_id;
  IF v_ledger IS DISTINCT FROM public.to_ledger_scale(v_outlet, v_bahan, 3) THEN
    RAISE EXCEPTION 'GAGAL (b): ledger % <> to_ledger_scale(3)', v_ledger;
  END IF;

  -- (c) batas atas: nilai > Rp 10 jt ditolak (tiga ton daging pernah lolos tanpa penjaga)
  v_ok := false;
  BEGIN PERFORM public.catat_terima_vendor(v_bahan, v_sup, 5000, current_date, NULL, NULL);
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): 5000 kg lolos'; END IF;

  -- (d) batas bawah: 0 ditolak
  v_ok := false;
  BEGIN PERFORM public.catat_terima_vendor(v_bahan, v_sup, 0, current_date, NULL, NULL);
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (d): qty 0 lolos'; END IF;

  -- (e) crew tidak bisa menulis tabel langsung
  v_ok := false;
  BEGIN INSERT INTO public.terima_vendor_outlet (outlet_id, supplier_id, bahan_baku_id, qty, tanggal_terima, dicatat_oleh)
        VALUES (v_lain, v_sup, v_bahan, 1, current_date, v_crew);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (e): INSERT langsung ke outlet lain lolos'; END IF;

  -- (f) crew tidak bisa mengoreksi catatan milik orang/outlet lain -- diuji lewat id acak
  v_ok := false;
  BEGIN PERFORM public.koreksi_terima_vendor(gen_random_uuid(), 1);
  EXCEPTION WHEN no_data_found THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f): koreksi id asing tidak ditolak'; END IF;

  -- (g) info untuk form
  PERFORM 1 FROM public.info_terima_vendor(v_bahan) WHERE supplier_id = v_sup AND harga_snapshot > 0;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL (g): info_terima_vendor tidak memuat Tempo 10'; END IF;

  -- (h) jalur mayoritas: pemakaian BOM tidak terganggu trigger baru
  INSERT INTO public.ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
  VALUES (v_outlet, v_bahan, 'pemakaian', -1, 'UJI jalur mayoritas');

  -- (i) user TANPA baris staff aktif tidak bisa mengoreksi catatan orang lain
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_ok := false;
  BEGIN PERFORM public.koreksi_terima_vendor(v_id, 1);
  EXCEPTION WHEN no_data_found THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (i): non-staff bisa mengoreksi -- celah NULL di pemeriksaan peran'; END IF;

  RAISE EXCEPTION 'HASIL T3: LULUS (catat, koreksi, batas atas & bawah, tulis langsung ditolak, id asing ditolak, info, pemakaian utuh, non-staff ditolak)';
END $$;
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `supabase db query --linked -f supabase/verifikasi/drop_ship/t3_catat.sql`
Expected: `ERROR: function public.catat_terima_vendor(...) does not exist`

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260911121000_drop_ship_catat_terima.sql`:

```sql
-- 20260911121000_drop_ship_catat_terima.sql
-- Penulis stok drop-ship + RPC sisi crew. Spec §4.1, §5.1, §6.

-- Trigger sinkron stok -- pola sync_waste_ledger: target vs yang sudah tercatat.
-- Idempoten; koreksi qty sebelum disahkan menyesuaikan stok otomatis.
-- Delta negatif memakai tipe 'rejected_kiriman': 'adjustment' diblokir penjaga
-- anti-minus di ledger_stamp_saldo, padahal sayur biasanya sudah terpakai
-- sebelum catatan dikoreksi/ditolak -- pembalikan akan GAGAL kalau pakai adjustment.
CREATE OR REPLACE FUNCTION public.sync_terima_vendor_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_target numeric; v_sudah numeric; v_delta numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.outlet_id IS DISTINCT FROM OLD.outlet_id
                           OR NEW.bahan_baku_id IS DISTINCT FROM OLD.bahan_baku_id) THEN
    RAISE EXCEPTION 'Outlet/bahan catatan terima vendor tidak boleh diubah' USING ERRCODE = 'check_violation';
  END IF;

  v_target := CASE WHEN NEW.status IN ('dicatat','disahkan')
                   THEN public.to_ledger_scale(NEW.outlet_id, NEW.bahan_baku_id, NEW.qty) ELSE 0 END;
  SELECT COALESCE(sum(qty), 0) INTO v_sudah FROM public.ledger_stok WHERE ref_terima_vendor_id = NEW.id;
  v_delta := v_target - v_sudah;
  IF abs(v_delta) < 0.000001 THEN RETURN NULL; END IF;

  INSERT INTO public.ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, ref_terima_vendor_id, created_by)
  VALUES (NEW.outlet_id, NEW.bahan_baku_id,
          CASE WHEN v_delta > 0 THEN 'pembelian_supplier' ELSE 'rejected_kiriman' END,
          v_delta,
          CASE WHEN v_sudah = 0 THEN 'Terima langsung vendor'
               WHEN NEW.status = 'ditolak' THEN 'Terima vendor ditolak Pusat'
               ELSE 'Koreksi terima vendor (qty jadi ' || NEW.qty || ')' END,
          NEW.id, NEW.dicatat_oleh);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_terima_vendor_ledger ON public.terima_vendor_outlet;
CREATE TRIGGER trg_sync_terima_vendor_ledger
  AFTER INSERT OR UPDATE ON public.terima_vendor_outlet
  FOR EACH ROW EXECUTE FUNCTION public.sync_terima_vendor_ledger();

-- Harga dikunci saat dicatat: katalog vendor bila > 0, selain itu master. Spec §4.1.
CREATE OR REPLACE FUNCTION public._harga_snapshot_vendor(p_supplier uuid, p_bahan uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT NULLIF(bs.harga, 0) FROM public.bahan_baku_supplier bs
      WHERE bs.supplier_id = p_supplier AND bs.bahan_baku_id = p_bahan AND bs.is_active),
    (SELECT bh.harga_beli FROM public.bahan_baku_harga bh WHERE bh.bahan_baku_id = p_bahan),
    0)
$$;

CREATE OR REPLACE FUNCTION public.info_terima_vendor(p_bahan_baku_id uuid)
RETURNS TABLE(supplier_id uuid, supplier_nama text, harga_snapshot numeric, rata_pakai_harian numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_outlet uuid; v_faktor numeric; v_rata numeric;
BEGIN
  SELECT s.outlet_id INTO v_outlet FROM public.outlet_staff s WHERE s.id = auth.uid() AND s.status = 'active';
  IF v_outlet IS NULL THEN RAISE EXCEPTION 'Akun tidak terhubung ke outlet' USING ERRCODE = 'insufficient_privilege'; END IF;
  v_faktor := NULLIF(public.to_ledger_scale(v_outlet, p_bahan_baku_id, 1), 0);
  SELECT (-sum(l.qty) / 7.0) / v_faktor INTO v_rata FROM public.ledger_stok l
   WHERE l.outlet_id = v_outlet AND l.bahan_baku_id = p_bahan_baku_id AND l.tipe = 'pemakaian'
     AND l.created_at >= now() - interval '7 days';
  RETURN QUERY
    SELECT s.id, s.nama, public._harga_snapshot_vendor(s.id, p_bahan_baku_id), v_rata
      FROM public.bahan_baku_supplier bs JOIN public.supplier s ON s.id = bs.supplier_id
     WHERE bs.bahan_baku_id = p_bahan_baku_id AND bs.is_active AND COALESCE(s.is_active, true)
     ORDER BY s.nama;
END $$;

CREATE OR REPLACE FUNCTION public.catat_terima_vendor(
  p_bahan_baku_id uuid, p_supplier_id uuid, p_qty numeric, p_tanggal date,
  p_catatan text DEFAULT NULL, p_foto_url text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_staff uuid := auth.uid(); v_outlet uuid; v_harga numeric; v_id uuid;
BEGIN
  -- Outlet SELALU outlet_staff.outlet_id sendiri -- bukan accessible_outlet_ids()
  -- (yang mengembalikan semua outlet untuk kitchen; itu lubang opname 2026-08-13).
  SELECT s.outlet_id INTO v_outlet FROM public.outlet_staff s WHERE s.id = v_staff AND s.status = 'active';
  IF v_outlet IS NULL THEN RAISE EXCEPTION 'Akun tidak terhubung ke outlet' USING ERRCODE = 'insufficient_privilege'; END IF;

  PERFORM 1 FROM public.bahan_baku_supplier bs
   WHERE bs.supplier_id = p_supplier_id AND bs.bahan_baku_id = p_bahan_baku_id AND bs.is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vendor ini tidak terdaftar untuk bahan tersebut' USING ERRCODE = 'check_violation'; END IF;

  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Jumlah harus lebih dari 0' USING ERRCODE = 'check_violation';
  END IF;
  IF p_tanggal IS NULL OR p_tanggal > current_date OR p_tanggal < current_date - 3 THEN
    RAISE EXCEPTION 'Tanggal terima harus hari ini atau paling lama 3 hari lalu' USING ERRCODE = 'check_violation';
  END IF;

  v_harga := public._harga_snapshot_vendor(p_supplier_id, p_bahan_baku_id);
  -- Batas atas mutlak (dua sisi). Rp 10 jt = ~450 kg sayur -- mustahil untuk satu kiriman harian.
  IF p_qty * v_harga > 10000000 THEN
    RAISE EXCEPTION 'Nilai kiriman Rp % tidak wajar untuk satu catatan. Periksa satuan (kg, bukan gram).',
      round(p_qty * v_harga) USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.terima_vendor_outlet
    (outlet_id, supplier_id, bahan_baku_id, qty, harga_snapshot, tanggal_terima, catatan, foto_url, dicatat_oleh)
  VALUES (v_outlet, p_supplier_id, p_bahan_baku_id, p_qty, v_harga, p_tanggal,
          NULLIF(btrim(p_catatan), ''), NULLIF(btrim(p_foto_url), ''), v_staff)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.koreksi_terima_vendor(p_id uuid, p_qty numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.terima_vendor_outlet; v_peran text := public.peran_saya();
BEGIN
  SELECT * INTO r FROM public.terima_vendor_outlet WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Catatan tidak ditemukan' USING ERRCODE = 'no_data_found'; END IF;
  -- Pencatat sendiri, atau pengesah.
  -- COALESCE wajib: bila pemanggil bukan staff aktif, v_peran NULL dan
  -- (false OR NULL) = NULL -> IF NOT (NULL) TIDAK menolak. Kelas bug yang sama
  -- dengan penjaga yang lolos diam-diam di proyek ini.
  IF NOT (r.dicatat_oleh = auth.uid() OR COALESCE(v_peran, '') IN ('purchasing','kitchen','admin')) THEN
    RAISE EXCEPTION 'Catatan tidak ditemukan' USING ERRCODE = 'no_data_found';  -- sengaja sama: jangan bocorkan keberadaan
  END IF;
  IF r.status <> 'dicatat' THEN
    RAISE EXCEPTION 'Catatan sudah % -- tidak bisa dikoreksi', r.status USING ERRCODE = 'check_violation';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 OR p_qty * r.harga_snapshot > 10000000 THEN
    RAISE EXCEPTION 'Jumlah koreksi tidak wajar' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.terima_vendor_outlet SET qty = p_qty, updated_at = now() WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.daftar_terima_vendor_saya(p_dari date, p_sampai date)
RETURNS TABLE(id uuid, tanggal_terima date, bahan_nama text, satuan text, supplier_nama text,
              qty numeric, harga_snapshot numeric, status text, dicatat_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.tanggal_terima, b.nama, b.satuan, s.nama, t.qty, t.harga_snapshot, t.status, t.dicatat_at
    FROM public.terima_vendor_outlet t
    JOIN public.bahan_baku b ON b.id = t.bahan_baku_id
    JOIN public.supplier s ON s.id = t.supplier_id
   WHERE t.outlet_id = (SELECT s2.outlet_id FROM public.outlet_staff s2 WHERE s2.id = auth.uid() AND s2.status = 'active')
     AND t.tanggal_terima BETWEEN p_dari AND p_sampai
   ORDER BY t.dicatat_at DESC
$$;

REVOKE ALL ON FUNCTION public.sync_terima_vendor_ledger(), public._harga_snapshot_vendor(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.info_terima_vendor(uuid), public.catat_terima_vendor(uuid,uuid,numeric,date,text,text),
  public.koreksi_terima_vendor(uuid,numeric), public.daftar_terima_vendor_saya(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.info_terima_vendor(uuid), public.catat_terima_vendor(uuid,uuid,numeric,date,text,text),
  public.koreksi_terima_vendor(uuid,numeric), public.daftar_terima_vendor_saya(date,date) TO authenticated, service_role;

-- DOWN:
-- DROP TRIGGER IF EXISTS trg_sync_terima_vendor_ledger ON public.terima_vendor_outlet;
-- DROP FUNCTION IF EXISTS public.daftar_terima_vendor_saya(date,date), public.koreksi_terima_vendor(uuid,numeric),
--   public.catat_terima_vendor(uuid,uuid,numeric,date,text,text), public.info_terima_vendor(uuid),
--   public._harga_snapshot_vendor(uuid,uuid), public.sync_terima_vendor_ledger();
```

- [ ] **Step 4: Apply, run test, negative control, stamp**

```bash
supabase db query --linked -f supabase/migrations/20260911121000_drop_ship_catat_terima.sql
supabase db query --linked -f supabase/verifikasi/drop_ship/t3_catat.sql
```
Expected: `ERROR: P0001: HASIL T3: LULUS (...)`

Kontrol negatif: salin ke scratchpad, ganti `(a)`'s `5` pada pengecekan jadi `6` (`to_ledger_scale(v_outlet, v_bahan, 6)`), jalankan → harus `GAGAL (a)`. Buang salinan.

Periksa katalog: `SELECT tgname FROM pg_trigger WHERE tgname='trg_sync_terima_vendor_ledger';` → 1 baris. Stempel `('20260911121000','drop_ship_catat_terima')`.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add supabase/migrations/20260911121000_drop_ship_catat_terima.sql supabase/verifikasi/drop_ship/t3_catat.sql
git commit -m "feat(db): trigger stok + RPC pencatatan terima vendor oleh crew"
```

---

### Task 4: Fungsi murni drop-ship + predikat peran

**Files:**
- Create: `apps/stok/src/lib/stok/dropShip.ts`, `apps/stok/src/lib/stok/dropShip.test.ts`, `apps/stok/src/lib/stok/approver.test.ts`
- Modify: `apps/stok/src/lib/stok/approver.ts` (tambah di akhir file)

**Interfaces:**
- Produces:
  - `keSatuanBesar(qty: number, tingkat: 'besar'|'tengah'|'kecil', b: { faktor_tengah: number|null; faktor_tampilan: number|null }): number`
  - `perluKonfirmasiJumlah(a: { qtyBesar: number; hargaSnapshot: number; rataPakaiHarian: number|null }): boolean`
  - `hitungSelisihNota(totalCrew: number, totalNota: number): { selisih: number; persen: number; perluCatatan: boolean }`
  - `BATAS_SELISIH_PERSEN = 0.5` (harus sama dengan SQL Task 7)
  - `canCatatTerimaVendor(outletId: string|null|undefined): boolean`, `canSahkanNotaVendor(role): boolean`, `canLihatNotaVendor(role): boolean`

- [ ] **Step 1: Write the failing tests**

`apps/stok/src/lib/stok/dropShip.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { keSatuanBesar, perluKonfirmasiJumlah, hitungSelisihNota, BATAS_SELISIH_PERSEN } from './dropShip'

const sayur = { faktor_tengah: null, faktor_tampilan: 1000 } // kg, kecil = gram

describe('keSatuanBesar', () => {
  it('gram ke kg', () => expect(keSatuanBesar(2496, 'kecil', sayur)).toBeCloseTo(2.496, 6))
  it('besar tetap', () => expect(keSatuanBesar(5, 'besar', sayur)).toBe(5))
  it('tengah dibagi faktor_tengah', () => expect(keSatuanBesar(24, 'tengah', { faktor_tengah: 48, faktor_tampilan: 36480 })).toBe(0.5))
  it('tingkat tanpa faktor jatuh ke besar, bukan salah 1000x diam-diam', () =>
    expect(() => keSatuanBesar(3, 'tengah', sayur)).toThrow())
})

// Laporan waste Sayur Beji: 8x "2.496 kg" -> crew memilih kg lalu mengetik gram.
describe('perluKonfirmasiJumlah', () => {
  it('2.496 kg sayur (Rp 54,9 jt) wajib konfirmasi', () =>
    expect(perluKonfirmasiJumlah({ qtyBesar: 2496, hargaSnapshot: 22000, rataPakaiHarian: 4.4 })).toBe(true))
  it('5 kg normal tidak mengganggu', () =>
    expect(perluKonfirmasiJumlah({ qtyBesar: 5, hargaSnapshot: 22000, rataPakaiHarian: 4.4 })).toBe(false))
  it('> 5x rata-rata harian wajib konfirmasi', () =>
    expect(perluKonfirmasiJumlah({ qtyBesar: 25, hargaSnapshot: 22000, rataPakaiHarian: 4.4 })).toBe(true))
  it('tanpa riwayat: hanya ambang rupiah', () => {
    expect(perluKonfirmasiJumlah({ qtyBesar: 20, hargaSnapshot: 22000, rataPakaiHarian: null })).toBe(false)
    expect(perluKonfirmasiJumlah({ qtyBesar: 100, hargaSnapshot: 22000, rataPakaiHarian: null })).toBe(true)
  })
})

describe('hitungSelisihNota', () => {
  it('cocok persis', () => expect(hitungSelisihNota(42, 42)).toEqual({ selisih: 0, persen: 0, perluCatatan: false }))
  it('crew 50 vs nota 42 -> wajib catatan', () => {
    const r = hitungSelisihNota(50, 42)
    expect(r.selisih).toBe(8)
    expect(r.perluCatatan).toBe(true)
  })
  it('di bawah ambang tidak wajib', () => expect(hitungSelisihNota(100.3, 100).perluCatatan).toBe(false))
  it('ambang sama dengan SQL', () => expect(BATAS_SELISIH_PERSEN).toBe(0.5))
})
```

`apps/stok/src/lib/stok/approver.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { canCatatTerimaVendor, canSahkanNotaVendor, canLihatNotaVendor } from './approver'

describe('drop-ship: peran', () => {
  it('pengesah = purchasing, kitchen, admin (keputusan owner 2026-09-11)', () => {
    for (const r of ['purchasing', 'kitchen', 'admin']) expect(canSahkanNotaVendor(r)).toBe(true)
    for (const r of ['owner', 'admin_finance', 'crew', 'leader', 'spv', null]) expect(canSahkanNotaVendor(r)).toBe(false)
  })
  it('owner & admin_finance boleh melihat, tidak mengesahkan', () => {
    expect(canLihatNotaVendor('owner')).toBe(true)
    expect(canLihatNotaVendor('admin_finance')).toBe(true)
    expect(canLihatNotaVendor('crew')).toBe(false)
  })
  it('pencatat = siapa pun yang punya outlet sendiri', () => {
    expect(canCatatTerimaVendor('d23e11b3-0000-0000-0000-000000000000')).toBe(true)
    expect(canCatatTerimaVendor(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/stok && yarn test src/lib/stok/dropShip.test.ts src/lib/stok/approver.test.ts`
Expected: FAIL — `Failed to resolve import "./dropShip"` dan `canSahkanNotaVendor is not a function`

- [ ] **Step 3: Write minimal implementation**

`apps/stok/src/lib/stok/dropShip.ts`:

```ts
// Fungsi murni drop-ship vendor -> outlet. Spec: docs/superpowers/specs/2026-09-11-drop-ship-sayur-design.md

type FaktorBahan = { faktor_tengah: number | null; faktor_tampilan: number | null }

// Konversi input crew ke SATUAN BESAR (kontrak kolom qty). Pola WasteModal, tapi
// MELEMPAR bila tingkat yang dipilih tak punya faktor -- jangan diam-diam
// menganggap 1 (FOIL pernah salah 48x karena fallback semacam itu).
export function keSatuanBesar(qty: number, tingkat: 'besar' | 'tengah' | 'kecil', b: FaktorBahan): number {
  if (tingkat === 'besar') return qty
  const faktor = tingkat === 'kecil' ? b.faktor_tampilan : b.faktor_tengah
  if (!faktor || faktor <= 0) throw new Error(`Bahan ini tidak punya satuan ${tingkat}`)
  return qty / faktor
}

export const AMBANG_RUPIAH_KONFIRMASI = 2_000_000
export const KELIPATAN_RATA_KONFIRMASI = 5

// Konfirmasi di form, bukan penolakan. Penolakan mutlak (> Rp 10 jt) ada di RPC.
export function perluKonfirmasiJumlah(a: { qtyBesar: number; hargaSnapshot: number; rataPakaiHarian: number | null }): boolean {
  if (!(a.qtyBesar > 0)) return false
  if (a.qtyBesar * a.hargaSnapshot > AMBANG_RUPIAH_KONFIRMASI) return true
  if (a.rataPakaiHarian != null && a.rataPakaiHarian > 0) return a.qtyBesar > KELIPATAN_RATA_KONFIRMASI * a.rataPakaiHarian
  return false
}

// SAMA dengan konstanta di RPC sahkan_nota_vendor (migration 20260911122000).
export const BATAS_SELISIH_PERSEN = 0.5

export function hitungSelisihNota(totalCrew: number, totalNota: number): { selisih: number; persen: number; perluCatatan: boolean } {
  const selisih = Math.round((totalCrew - totalNota) * 1000) / 1000
  const persen = totalNota > 0 ? Math.abs(selisih) / totalNota * 100 : (selisih === 0 ? 0 : 100)
  return { selisih, persen, perluCatatan: persen > BATAS_SELISIH_PERSEN }
}
```

Tambahkan di akhir `apps/stok/src/lib/stok/approver.ts`:

```ts
// Drop-ship vendor -> outlet (spec 2026-09-11 §6). Satu sumber untuk UI; RPC
// memeriksa ulang di DB (peran_saya()) karena guard UI tidak melindungi apa pun.
const NOTA_VENDOR_PENGESAH = ['purchasing', 'kitchen', 'admin'] as const
const NOTA_VENDOR_PEMBACA = [...NOTA_VENDOR_PENGESAH, 'owner', 'admin_finance'] as const

export function canSahkanNotaVendor(role: string | null | undefined): boolean {
  return !!role && (NOTA_VENDOR_PENGESAH as readonly string[]).includes(role)
}

export function canLihatNotaVendor(role: string | null | undefined): boolean {
  return !!role && (NOTA_VENDOR_PEMBACA as readonly string[]).includes(role)
}

// Pencatat: siapa pun yang terhubung ke SATU outlet (outlet_staff.outlet_id).
export function canCatatTerimaVendor(outletId: string | null | undefined): boolean {
  return !!outletId
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/stok && yarn test src/lib/stok/dropShip.test.ts src/lib/stok/approver.test.ts`
Expected: PASS (15 tests)

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add apps/stok/src/lib/stok/dropShip.ts apps/stok/src/lib/stok/dropShip.test.ts apps/stok/src/lib/stok/approver.ts apps/stok/src/lib/stok/approver.test.ts
git commit -m "feat(stok): fungsi murni & predikat peran drop-ship"
```

---

### Task 5: Hook data sisi crew

**Files:**
- Create: `apps/stok/src/hooks/useTerimaVendor.ts`

**Interfaces:**
- Consumes: RPC Task 3.
- Produces: `useInfoTerimaVendor(bahanBakuId: string|null)`, `useDaftarTerimaVendorSaya(dari: string, sampai: string)`, `useCatatTerimaVendor()` (mutation `{ bahanBakuId, supplierId, qty, tanggal, catatan?, fotoUrl? } → string`), `useKoreksiTerimaVendor()` (mutation `{ id, qty } → void`). Query key root: `['terima-vendor']`.

- [ ] **Step 1: Write the hook**

Tidak ada logika murni di file ini (semua keputusan di RPC & `dropShip.ts`) — ujinya adalah type-check + uji perilaku Task 3 + smoke test Task 6.

```ts
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'

// Semua otorisasi ada di RPC (SECURITY DEFINER + auth.uid()). Jangan panggil
// lewat service-role: auth.uid() jadi NULL dan pemeriksaan outlet sendiri gagal.
const supabase = createSupabaseBrowserClient()

export type InfoVendor = { supplier_id: string; supplier_nama: string; harga_snapshot: number; rata_pakai_harian: number | null }
export type TerimaVendorBaris = {
  id: string; tanggal_terima: string; bahan_nama: string; satuan: string; supplier_nama: string
  qty: number; harga_snapshot: number; status: 'dicatat' | 'disahkan' | 'ditolak'; dicatat_at: string
}

export function useInfoTerimaVendor(bahanBakuId: string | null) {
  return useQuery<InfoVendor[]>({
    queryKey: ['terima-vendor', 'info', bahanBakuId],
    enabled: !!bahanBakuId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('info_terima_vendor', { p_bahan_baku_id: bahanBakuId })
      if (error) throw new Error(error.message)
      return (data ?? []) as InfoVendor[]
    },
  })
}

export function useDaftarTerimaVendorSaya(dari: string, sampai: string) {
  return useQuery<TerimaVendorBaris[]>({
    queryKey: ['terima-vendor', 'saya', dari, sampai],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('daftar_terima_vendor_saya', { p_dari: dari, p_sampai: sampai })
      if (error) throw new Error(error.message)
      return (data ?? []) as TerimaVendorBaris[]
    },
  })
}

export function useCatatTerimaVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: { bahanBakuId: string; supplierId: string; qty: number; tanggal: string; catatan?: string; fotoUrl?: string }) => {
      const { data, error } = await supabase.rpc('catat_terima_vendor', {
        p_bahan_baku_id: a.bahanBakuId, p_supplier_id: a.supplierId, p_qty: a.qty,
        p_tanggal: a.tanggal, p_catatan: a.catatan ?? null, p_foto_url: a.fotoUrl ?? null,
      })
      if (error) throw new Error(error.message)
      return data as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['terima-vendor'] }),
  })
}

export function useKoreksiTerimaVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: { id: string; qty: number }) => {
      const { error } = await supabase.rpc('koreksi_terima_vendor', { p_id: a.id, p_qty: a.qty })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['terima-vendor'] }),
  })
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: tidak ada error baru yang menyebut `useTerimaVendor.ts` (catat jumlah error sebelum task sebagai baseline; jumlahnya harus sama).

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add apps/stok/src/hooks/useTerimaVendor.ts
git commit -m "feat(stok): hook data terima vendor sisi crew"
```

---

### Task 6: Layar crew "Terima dari Vendor" + entri nav

**Files:**
- Create: `apps/stok/src/components/stok/TerimaVendorForm.tsx`, `apps/stok/src/app/stok/terima-vendor/page.tsx`
- Modify: `apps/stok/src/components/layout/AppSidebar.tsx` (grup `OPERASIONAL DAPUR`, sesudah `Penerimaan PO (Inbound)`)

**Interfaces:**
- Consumes: `useBahanBaku()` (`apps/stok/src/hooks/useBahanBaku.ts`), `BahanBaku` (`apps/stok/src/types/stok.ts`), hook Task 5, `keSatuanBesar`/`perluKonfirmasiJumlah` (Task 4), `canCatatTerimaVendor`/`canLihatNotaVendor` (Task 4), `useAuth()` dari `@suka/auth`.
- Produces: rute `/stok/terima-vendor`.

- [ ] **Step 1: Write the form component**

`apps/stok/src/components/stok/TerimaVendorForm.tsx`:

```tsx
'use client'
import { useMemo, useState } from 'react'
import { Button, Input } from '@suka/design-system'
import { toast } from 'sonner'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { useInfoTerimaVendor, useCatatTerimaVendor } from '@/hooks/useTerimaVendor'
import { keSatuanBesar, perluKonfirmasiJumlah } from '@/lib/stok/dropShip'

type Tingkat = 'besar' | 'tengah' | 'kecil'
const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const hariIni = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10) // WIB

export function TerimaVendorForm({ outletId }: { outletId: string }) {
  const { bahanBaku } = useBahanBaku()
  // Hanya bahan yang punya vendor aktif di katalog -- hari ini praktis cuma sayur.
  const [bahanId, setBahanId] = useState<string>('')
  const bahan = bahanBaku.find((b) => b.id === bahanId) ?? null
  const { data: vendors = [] } = useInfoTerimaVendor(bahanId || null)
  const [supplierId, setSupplierId] = useState<string>('')
  const vendor = vendors.find((v) => v.supplier_id === supplierId) ?? (vendors.length === 1 ? vendors[0] : null)

  const [tingkat, setTingkat] = useState<Tingkat>('besar')
  const [qty, setQty] = useState('')
  const [catatan, setCatatan] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [konfirmasi, setKonfirmasi] = useState(false)
  const catat = useCatatTerimaVendor()

  const qtyBesar = useMemo(() => {
    const n = Number(qty)
    if (!bahan || !(n > 0)) return 0
    try { return keSatuanBesar(n, tingkat, bahan) } catch { return 0 }
  }, [qty, tingkat, bahan])

  const nilai = vendor ? qtyBesar * vendor.harga_snapshot : 0
  const butuhKonfirmasi = vendor
    ? perluKonfirmasiJumlah({ qtyBesar, hargaSnapshot: vendor.harga_snapshot, rataPakaiHarian: vendor.rata_pakai_harian })
    : false

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bahan || !vendor || !(qtyBesar > 0)) { toast.error('Lengkapi bahan, vendor, dan jumlah'); return }
    if (butuhKonfirmasi && !konfirmasi) { toast.error('Jumlah ini tidak biasa — centang konfirmasi dulu'); return }
    try {
      let fotoUrl: string | undefined
      if (file) {
        const supabase = createSupabaseBrowserClient()
        const path = `terima/${outletId}/${Date.now()}.${file.name.split('.').pop()}`
        const { data, error } = await supabase.storage.from('drop-ship').upload(path, file)
        if (error) throw new Error('Gagal mengunggah foto: ' + error.message)
        fotoUrl = supabase.storage.from('drop-ship').getPublicUrl(data.path).data.publicUrl
      }
      await catat.mutateAsync({ bahanBakuId: bahan.id, supplierId: vendor.supplier_id, qty: qtyBesar, tanggal: hariIni(), catatan, fotoUrl })
      toast.success(`Tercatat ${qtyBesar} ${bahan.satuan} — stok outlet sudah bertambah`)
      setQty(''); setCatatan(''); setFile(null); setKonfirmasi(false)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Daftar bahan lengkap; vendor yang sah ditentukan info_terima_vendor (katalog aktif).
  const bahanDenganVendor = bahanBaku

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl p-5 border border-[#d9c2b2]/50 space-y-4">
      <label className="block text-xs font-bold text-[#544437] uppercase">Bahan</label>
      <select value={bahanId} onChange={(e) => { setBahanId(e.target.value); setSupplierId(''); setTingkat('besar') }}
        className="w-full rounded-xl border border-[#d9c2b2] p-2 text-sm">
        <option value="">Pilih bahan…</option>
        {bahanDenganVendor.map((b) => <option key={b.id} value={b.id}>{b.nama}</option>)}
      </select>

      {bahanId && vendors.length === 0 && (
        <p className="text-xs text-red-600">Bahan ini tidak punya vendor kiriman langsung. Minta Pusat mendaftarkannya di Katalog Harga Vendor.</p>
      )}

      {vendors.length > 1 && (
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full rounded-xl border border-[#d9c2b2] p-2 text-sm">
          <option value="">Pilih vendor…</option>
          {vendors.map((v) => <option key={v.supplier_id} value={v.supplier_id}>{v.supplier_nama}</option>)}
        </select>
      )}
      {vendor && <p className="text-xs text-[#544437]">Vendor: <b>{vendor.supplier_nama}</b></p>}

      {bahan && (
        <>
          <label className="block text-xs font-bold text-[#544437] uppercase">Jumlah diterima</label>
          <div className="flex gap-2">
            <Input type="number" inputMode="decimal" step="any" value={qty} onChange={(e: any) => setQty(e.target.value)} placeholder="Misal: 5" />
            <select value={tingkat} onChange={(e) => setTingkat(e.target.value as Tingkat)} className="rounded-xl border border-[#d9c2b2] p-2 text-sm">
              <option value="besar">{bahan.satuan}</option>
              {bahan.satuan_tengah && bahan.faktor_tengah ? <option value="tengah">{bahan.satuan_tengah}</option> : null}
              {bahan.satuan_kecil && bahan.faktor_tampilan ? <option value="kecil">{bahan.satuan_kecil}</option> : null}
            </select>
          </div>
        </>
      )}

      {qtyBesar > 0 && vendor && (
        <div className={`rounded-xl p-3 text-sm ${butuhKonfirmasi ? 'bg-red-50 border border-red-300' : 'bg-[#f7f0ea]'}`}>
          <div className="flex justify-between"><span>Akan tercatat</span><b>{qtyBesar.toLocaleString('id-ID')} {bahan?.satuan}</b></div>
          <div className="flex justify-between"><span>Nilai (harga terkunci)</span><b>{rupiah(nilai)}</b></div>
          {butuhKonfirmasi && (
            <label className="flex items-start gap-2 mt-2 text-red-700 text-xs font-semibold">
              <input type="checkbox" checked={konfirmasi} onChange={(e) => setKonfirmasi(e.target.checked)} />
              Jumlah ini jauh di atas biasanya. Saya sudah cek satuannya ({bahan?.satuan}, bukan {bahan?.satuan_kecil ?? 'satuan kecil'}) dan jumlahnya benar.
            </label>
          )}
        </div>
      )}

      <Input value={catatan} onChange={(e: any) => setCatatan(e.target.value)} placeholder="Catatan (opsional)" />
      <input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
      <p className="text-[11px] text-[#544437]/70">Foto bukti terima opsional. Harga tidak perlu diisi — sudah dikunci sistem.</p>

      <Button type="submit" disabled={catat.isPending || !(qtyBesar > 0) || !vendor}>
        {catat.isPending ? 'Menyimpan…' : 'Catat Terima'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Write the page**

`apps/stok/src/app/stok/terima-vendor/page.tsx`:

```tsx
'use client'
import { useAuth } from '@suka/auth'
import { TerimaVendorForm } from '@/components/stok/TerimaVendorForm'
import { useDaftarTerimaVendorSaya, useKoreksiTerimaVendor } from '@/hooks/useTerimaVendor'
import { canCatatTerimaVendor } from '@/lib/stok/approver'
import { toast } from 'sonner'

const hari = (offset: number) => new Date(Date.now() + 7 * 3600 * 1000 - offset * 86400000).toISOString().slice(0, 10)

export default function TerimaVendorPage() {
  const { outletStaff } = useAuth()
  // Selalu outlet SENDIRI -- sengaja tidak memakai OutletSwitcher (useOutletScope):
  // RPC mencatat ke outlet_staff.outlet_id apa pun yang dipilih di UI.
  const outletId = outletStaff?.outlet_id ?? null
  const { data: baris = [] } = useDaftarTerimaVendorSaya(hari(6), hari(0))
  const koreksi = useKoreksiTerimaVendor()

  if (!outletStaff) return <div className="text-center py-20 text-xs font-bold text-gray-500 animate-pulse">Memuat…</div>
  if (!canCatatTerimaVendor(outletId)) return <div className="text-center py-20 text-xs font-bold text-gray-500">Akun tidak terhubung ke outlet mana pun</div>

  const ubah = async (id: string, qtyLama: number) => {
    const s = window.prompt('Jumlah yang benar (satuan besar):', String(qtyLama))
    if (s == null) return
    try { await koreksi.mutateAsync({ id, qty: Number(s) }); toast.success('Dikoreksi — stok ikut menyesuaikan') }
    catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] pb-12">
      <header className="px-4 py-4 border-b border-[#d9c2b2]/30">
        <h1 className="font-bold text-sm text-[#701604] uppercase">Terima dari Vendor</h1>
        <p className="text-xs text-[#544437]/80">Catat setiap kali vendor mengantar langsung ke outlet (mis. sayur Pak Aziz).</p>
      </header>
      <main className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
        <TerimaVendorForm outletId={outletId!} />
        <section>
          <h2 className="text-xs font-bold uppercase text-[#544437] mb-2">7 hari terakhir</h2>
          <ul className="space-y-2">
            {baris.map((b) => (
              <li key={b.id} className="bg-white rounded-xl p-3 border border-[#d9c2b2]/40 flex justify-between text-sm">
                <span>{b.tanggal_terima} · {b.bahan_nama} · {b.qty} {b.satuan}</span>
                <span className="flex gap-2 items-center">
                  <span className="text-xs">{b.status === 'dicatat' ? 'Menunggu nota' : b.status === 'disahkan' ? 'Disahkan' : 'Ditolak'}</span>
                  {b.status === 'dicatat' && <button type="button" className="text-xs text-[#904d00] underline" onClick={() => ubah(b.id, b.qty)}>Koreksi</button>}
                </span>
              </li>
            ))}
            {baris.length === 0 && <li className="text-xs text-gray-500">Belum ada catatan.</li>}
          </ul>
        </section>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Add nav entry**

Di `apps/stok/src/components/layout/AppSidebar.tsx`, sesudah baris `const canViewNilaiPersediaan = …` tambahkan:

```ts
  const canCatatVendor = canCatatTerimaVendor(outletStaff?.outlet_id)
  const canNotaVendor = canLihatNotaVendor(role)
```

Tambahkan import di atas file (gabungkan dengan import `isApproverRole` yang sudah ada dari `@/lib/stok/approver`):

```ts
import { isApproverRole, canCatatTerimaVendor, canLihatNotaVendor } from '@/lib/stok/approver'
```

Di grup `OPERASIONAL DAPUR`, tepat setelah blok `...(canReceivePO ? [...] : [])`, sisipkan:

```ts
        ...(canCatatVendor
          ? [{ label: 'Terima dari Vendor', href: '/stok/terima-vendor', icon: Truck }]
          : []),
        ...(canNotaVendor
          ? [{ label: 'Cocokkan Nota Vendor', href: '/stok/nota-vendor', icon: ClipboardList }]
          : []),
```

(`Truck` dan `ClipboardList` sudah diimpor file ini.)

- [ ] **Step 4: Type-check + smoke test**

Run: `cd apps/stok && yarn type-check` → jumlah error sama dengan baseline Task 5.
Run: `cd apps/stok && yarn test` → semua test Task 1 & 4 lulus, jumlah gagal lain = baseline.

Smoke test (dev lokal menunjuk **DB produksi** — pakai `outlet tes`, akun crew `devai_outlet_tes`):
1. Buka `http://localhost:3001/stok/terima-vendor`, pilih Sayur (lettuce), vendor otomatis `Lettuce (Pak Aziz) - Tempo 10`.
2. Isi `2496` dengan satuan `gram` → "Akan tercatat 2,496 kg", tanpa kotak merah.
3. Ganti satuan ke `kg` → kotak merah + checkbox wajib; tombol menolak sebelum dicentang.
4. Isi `3` kg, simpan → toast sukses, baris muncul "Menunggu nota".
5. Bersihkan: `koreksi` tidak cukup untuk menghapus — catat id baris itu lalu minta pengesah menolaknya di Task 8, **atau** jalankan sebagai postgres: `UPDATE public.terima_vendor_outlet SET status='ditolak' WHERE id='<id>';` (trigger membalik stoknya). Verifikasi `SELECT sum(qty) FROM ledger_stok WHERE ref_terima_vendor_id='<id>'` = 0.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add apps/stok/src/components/stok/TerimaVendorForm.tsx apps/stok/src/app/stok/terima-vendor/page.tsx apps/stok/src/components/layout/AppSidebar.tsx
git commit -m "feat(stok): layar crew Terima dari Vendor + nav"
```

---

### Task 7: RPC pengesahan nota

**Files:**
- Create: `supabase/migrations/20260911122000_drop_ship_sahkan_nota.sql`
- Test: `supabase/verifikasi/drop_ship/t7_sahkan.sql`

**Interfaces:**
- Consumes: Task 2 & 3.
- Produces:
  - `ringkasan_nota_vendor(p_supplier_id uuid, p_tanggal_tagihan date) RETURNS TABLE(outlet_id uuid, outlet_nama text, bahan_baku_id uuid, bahan_nama text, jumlah_catatan int, total_qty numeric, total_nilai numeric)` — hanya catatan `dicatat`
  - `sahkan_nota_vendor(p_supplier_id uuid, p_tanggal_tagihan date, p_total_kg numeric, p_total_rupiah numeric, p_foto_nota_url text, p_catatan_selisih text DEFAULT NULL, p_rincian jsonb DEFAULT '[]') RETURNS uuid` (id nota). `p_rincian` = `[{"outlet_id": "...", "tanggal_kirim": "YYYY-MM-DD"|null, "qty_kg": n}]`
  - `tolak_terima_vendor(p_id uuid, p_alasan text) RETURNS void`

- [ ] **Step 1: Write the failing test**

`supabase/verifikasi/drop_ship/t7_sahkan.sql`:

```sql
-- Uji Task 7: crew mencatat, purchasing mengesahkan. ROLLBACK.
-- Harapan: "HASIL T7: LULUS ..."
BEGIN;
DO $$
DECLARE
  v_crew uuid; v_outlet uuid; v_purch uuid; v_bahan uuid; v_sup uuid;
  v_t1 uuid; v_t2 uuid; v_nota uuid; v_po uuid; v_ledger_sebelum int; v_ledger_sesudah int;
  v_tagih date := (SELECT tanggal_tagihan FROM public.periode_tagihan(current_date));
  v_harga_lama numeric; v_harga_baru numeric; v_ok boolean;
BEGIN
  SELECT s.id, s.outlet_id INTO v_crew, v_outlet FROM public.outlet_staff s JOIN public.outlets o ON o.id=s.outlet_id
   WHERE o.type='test' AND s.role='crew' AND s.status='active' LIMIT 1;
  SELECT id INTO v_purch FROM public.outlet_staff WHERE role='purchasing' AND status='active' LIMIT 1;
  SELECT id INTO v_bahan FROM public.bahan_baku WHERE nama ILIKE '%lettuce%' LIMIT 1;
  SELECT id INTO v_sup FROM public.supplier WHERE nama='Lettuce (Pak Aziz) - Tempo 10';
  SELECT harga_beli INTO v_harga_lama FROM public.bahan_baku_harga WHERE bahan_baku_id=v_bahan;

  -- crew mencatat 2 kiriman
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_t1 := public.catat_terima_vendor(v_bahan, v_sup, 4, current_date, NULL, NULL);
  v_t2 := public.catat_terima_vendor(v_bahan, v_sup, 6, current_date, NULL, NULL);

  -- (a) crew TIDAK boleh mengesahkan
  v_ok := false;
  BEGIN PERFORM public.sahkan_nota_vendor(v_sup, v_tagih, 10, 230000, 'https://x/nota.jpg');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (a): crew bisa mengesahkan'; END IF;

  -- ganti ke purchasing
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_purch, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- (b) ringkasan memuat 10 kg dari outlet tes
  PERFORM 1 FROM public.ringkasan_nota_vendor(v_sup, v_tagih) r WHERE r.outlet_id=v_outlet AND r.total_qty >= 10;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL (b): ringkasan tidak memuat catatan crew'; END IF;

  -- (c) tanggal bukan tanggal tagihan ditolak
  v_ok := false;
  BEGIN PERFORM public.sahkan_nota_vendor(v_sup, v_tagih - 1, 10, 230000, 'https://x/nota.jpg');
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): tanggal tagihan palsu lolos'; END IF;

  -- (d) selisih tanpa catatan ditolak (nota 8 kg vs crew >= 10 kg)
  v_ok := false;
  BEGIN PERFORM public.sahkan_nota_vendor(v_sup, v_tagih, 8, 184000, 'https://x/nota.jpg');
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (d): selisih tanpa catatan lolos'; END IF;

  -- (e) sahkan: total crew periode ini (termasuk catatan lain yang mungkin ada)
  SELECT count(*) INTO v_ledger_sebelum FROM public.ledger_stok;
  v_nota := public.sahkan_nota_vendor(v_sup, v_tagih,
              (SELECT sum(qty) FROM public.terima_vendor_outlet t, public.periode_tagihan(v_tagih) p
                WHERE t.supplier_id=v_sup AND t.status='dicatat' AND t.tanggal_terima BETWEEN p.mulai AND p.akhir),
              (SELECT sum(qty) FROM public.terima_vendor_outlet t, public.periode_tagihan(v_tagih) p
                WHERE t.supplier_id=v_sup AND t.status='dicatat' AND t.tanggal_terima BETWEEN p.mulai AND p.akhir) * 23000,
              'https://x/nota.jpg', NULL,
              jsonb_build_array(jsonb_build_object('outlet_id', v_outlet, 'tanggal_kirim', current_date, 'qty_kg', 10)));
  SELECT count(*) INTO v_ledger_sesudah FROM public.ledger_stok;

  -- (f) LARANGAN 1: pengesahan menulis NOL baris stok
  IF v_ledger_sesudah <> v_ledger_sebelum THEN RAISE EXCEPTION 'GAGAL (f): pengesahan menulis % baris ledger', v_ledger_sesudah - v_ledger_sebelum; END IF;

  -- (g) PO utang tercipta benar
  SELECT purchase_order_id INTO v_po FROM public.nota_vendor WHERE id=v_nota;
  PERFORM 1 FROM public.purchase_order WHERE id=v_po AND status='diterima_lengkap' AND payment_status='unpaid'
     AND jatuh_tempo=v_tagih AND nota_vendor_id=v_nota AND supplier_id=v_sup;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL (g): PO utang tidak sesuai'; END IF;

  -- (h) catatan crew terkunci
  PERFORM 1 FROM public.terima_vendor_outlet WHERE id IN (v_t1, v_t2) AND (status<>'disahkan' OR nota_vendor_id IS DISTINCT FROM v_nota);
  IF FOUND THEN RAISE EXCEPTION 'GAGAL (h): catatan crew belum disahkan/terhubung'; END IF;

  -- (i) harga master ikut nota (23.000) + riwayat
  SELECT harga_beli INTO v_harga_baru FROM public.bahan_baku_harga WHERE bahan_baku_id=v_bahan;
  IF v_harga_baru <> 23000 THEN RAISE EXCEPTION 'GAGAL (i): harga master % (harapan 23000, lama %)', v_harga_baru, v_harga_lama; END IF;
  PERFORM 1 FROM public.bahan_baku_harga_history WHERE bahan_baku_id=v_bahan AND ref_po_id=v_po AND harga_baru=23000;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL (i): riwayat harga tidak ditulis'; END IF;

  -- (j) nota ganda periode sama ditolak
  v_ok := false;
  BEGIN PERFORM public.sahkan_nota_vendor(v_sup, v_tagih, 1, 23000, 'https://x/nota.jpg', 'uji');
  EXCEPTION WHEN unique_violation OR check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (j): nota ganda lolos'; END IF;

  RAISE EXCEPTION 'HASIL T7: LULUS (crew ditolak, ringkasan, tgl palsu, selisih, nol ledger, PO utang, terkunci, harga+riwayat, anti-ganda)';
END $$;
ROLLBACK;
```

Uji tambahan penjaga rasio-faktor, `supabase/verifikasi/drop_ship/t7b_rasio.sql`:

```sql
-- Harga nota yang rasionya PERSIS faktor konversi bahan (sidik jari salah satuan)
-- tidak boleh menimpa master. Sayur: faktor_tampilan 1000 -> harga/kg 22 (per gram) ditahan.
BEGIN;
DO $$
DECLARE v_crew uuid; v_purch uuid; v_bahan uuid; v_sup uuid; v_tagih date; v_lama numeric; v_baru numeric; v_q numeric;
BEGIN
  SELECT s.id INTO v_crew FROM public.outlet_staff s JOIN public.outlets o ON o.id=s.outlet_id WHERE o.type='test' AND s.role='crew' AND s.status='active' LIMIT 1;
  SELECT id INTO v_purch FROM public.outlet_staff WHERE role='purchasing' AND status='active' LIMIT 1;
  SELECT id INTO v_bahan FROM public.bahan_baku WHERE nama ILIKE '%lettuce%' LIMIT 1;
  SELECT id INTO v_sup FROM public.supplier WHERE nama='Lettuce (Pak Aziz) - Tempo 10';
  SELECT tanggal_tagihan INTO v_tagih FROM public.periode_tagihan(current_date);
  SELECT harga_beli INTO v_lama FROM public.bahan_baku_harga WHERE bahan_baku_id=v_bahan;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.catat_terima_vendor(v_bahan, v_sup, 10, current_date, NULL, NULL);
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_purch, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT sum(qty) INTO v_q FROM public.terima_vendor_outlet t, public.periode_tagihan(v_tagih) p
   WHERE t.supplier_id=v_sup AND t.status='dicatat' AND t.tanggal_terima BETWEEN p.mulai AND p.akhir;
  PERFORM public.sahkan_nota_vendor(v_sup, v_tagih, v_q, v_q * (v_lama / 1000), 'https://x/nota.jpg');
  SELECT harga_beli INTO v_baru FROM public.bahan_baku_harga WHERE bahan_baku_id=v_bahan;
  IF v_baru <> v_lama THEN RAISE EXCEPTION 'GAGAL: harga salah-satuan menimpa master (% -> %)', v_lama, v_baru; END IF;
  PERFORM 1 FROM public.bahan_baku_harga_history WHERE bahan_baku_id=v_bahan AND catatan LIKE 'DITOLAK (dugaan salah satuan)%';
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: penolakan tidak dicatat di riwayat'; END IF;
  RAISE EXCEPTION 'HASIL T7b: LULUS (harga per-gram ditahan, master tetap %)', v_lama;
END $$;
ROLLBACK;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `supabase db query --linked -f supabase/verifikasi/drop_ship/t7_sahkan.sql`
Expected: `ERROR: function public.sahkan_nota_vendor(...) does not exist`

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260911122000_drop_ship_sahkan_nota.sql`:

```sql
-- 20260911122000_drop_ship_sahkan_nota.sql
-- Pengesahan nota vendor drop-ship -> utang (PO). Spec §4.2, §4.3, §5.2.
--
-- TIGA LARANGAN (spec §4.3), dijaga di sini:
--  1. Tidak memanggil verifikasi_terima_po (menulis stok ke Gudang Pusat).
--     Stok SUDAH masuk ke outlet lewat trigger catatan crew. Fungsi ini menulis
--     NOL baris ledger -- diuji t7 (f).
--  2. PO dibuat lewat INSERT berstatus diterima_lengkap, BUKAN UPDATE status:
--     po_status_transition_guard (BEFORE UPDATE) hanya mengizinkan
--     kitchen/admin/owner, sedangkan purchasing boleh mengesahkan (K2).
--  3. PO membawa nota_vendor_id supaya pemeriksa PO-tanpa-ledger bisa
--     mengecualikannya.

CREATE OR REPLACE FUNCTION public.ringkasan_nota_vendor(p_supplier_id uuid, p_tanggal_tagihan date)
RETURNS TABLE(outlet_id uuid, outlet_nama text, bahan_baku_id uuid, bahan_nama text,
              jumlah_catatan int, total_qty numeric, total_nilai numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  IF public.peran_saya() NOT IN ('purchasing','kitchen','admin','owner','admin_finance') OR public.peran_saya() IS NULL THEN
    RAISE EXCEPTION 'Hanya purchasing/kitchen/admin yang bisa melihat nota vendor' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO p FROM public.periode_tagihan(p_tanggal_tagihan);
  RETURN QUERY
    SELECT t.outlet_id, o.name, t.bahan_baku_id, b.nama, count(*)::int, sum(t.qty), sum(t.qty * t.harga_snapshot)
      FROM public.terima_vendor_outlet t
      JOIN public.outlets o ON o.id = t.outlet_id
      JOIN public.bahan_baku b ON b.id = t.bahan_baku_id
     -- Outlet tes SENGAJA ikut tampil: catatan yang harus disahkan tak boleh
     -- disembunyikan. Aturan "outlet tes jangan dihitung" ditegakkan di laporan.
     WHERE t.supplier_id = p_supplier_id AND t.status = 'dicatat'
       AND t.tanggal_terima BETWEEN p.mulai AND p.akhir
     GROUP BY t.outlet_id, o.name, t.bahan_baku_id, b.nama
     ORDER BY o.name;
END $$;

CREATE OR REPLACE FUNCTION public.sahkan_nota_vendor(
  p_supplier_id uuid, p_tanggal_tagihan date, p_total_kg numeric, p_total_rupiah numeric,
  p_foto_nota_url text, p_catatan_selisih text DEFAULT NULL, p_rincian jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c_batas_persen CONSTANT numeric := 0.5;   -- SAMA dengan BATAS_SELISIH_PERSEN di dropShip.ts
  v_staff uuid := auth.uid(); v_peran text := public.peran_saya();
  p record; v_crew numeric; v_bahan uuid; v_n_bahan int; v_harga numeric;
  v_nota uuid; v_po uuid; v_supplier_nama text; v_nomor text; r jsonb;
  v_old numeric; v_rasio numeric; v_faktor numeric; v_salah boolean := false;
BEGIN
  IF v_peran IS NULL OR v_peran NOT IN ('purchasing','kitchen','admin') THEN
    RAISE EXCEPTION 'Hanya purchasing, kitchen, atau admin yang boleh mengesahkan nota vendor'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO p FROM public.periode_tagihan(p_tanggal_tagihan);
  IF p.tanggal_tagihan <> p_tanggal_tagihan THEN
    RAISE EXCEPTION 'Tanggal % bukan tanggal tagihan (seharusnya %)', p_tanggal_tagihan, p.tanggal_tagihan
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_total_kg IS NULL OR p_total_kg <= 0 OR p_total_rupiah IS NULL OR p_total_rupiah <= 0 THEN
    RAISE EXCEPTION 'Total kg dan total rupiah nota wajib diisi' USING ERRCODE = 'check_violation';
  END IF;
  IF p_foto_nota_url IS NULL OR btrim(p_foto_nota_url) = '' THEN
    RAISE EXCEPTION 'Foto nota wajib' USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(DISTINCT t.bahan_baku_id), min(t.bahan_baku_id::text)::uuid, COALESCE(sum(t.qty), 0)
    INTO v_n_bahan, v_bahan, v_crew
    FROM public.terima_vendor_outlet t
   WHERE t.supplier_id = p_supplier_id AND t.status = 'dicatat'
     AND t.tanggal_terima BETWEEN p.mulai AND p.akhir;
  IF v_n_bahan = 0 THEN
    RAISE EXCEPTION 'Tidak ada catatan terima crew di periode % s/d %', p.mulai, p.akhir USING ERRCODE = 'check_violation';
  END IF;
  IF v_n_bahan > 1 THEN
    -- YAGNI: Tempo 10 hanya sayur. Nota multi-bahan butuh rincian per bahan -- belum didukung.
    RAISE EXCEPTION 'Nota multi-bahan belum didukung (% bahan di periode ini)', v_n_bahan USING ERRCODE = 'check_violation';
  END IF;
  IF abs(v_crew - p_total_kg) / p_total_kg * 100 > c_batas_persen
     AND (p_catatan_selisih IS NULL OR btrim(p_catatan_selisih) = '') THEN
    RAISE EXCEPTION 'Catatan crew % kg vs nota % kg -- selisih wajib dijelaskan', v_crew, p_total_kg
      USING ERRCODE = 'check_violation';
  END IF;

  v_harga := p_total_rupiah / p_total_kg;
  SELECT nama INTO v_supplier_nama FROM public.supplier WHERE id = p_supplier_id;

  INSERT INTO public.nota_vendor (supplier_id, periode_mulai, periode_akhir, tanggal_tagihan,
      total_kg_nota, total_rupiah_nota, foto_nota_url, disahkan_oleh, catatan_selisih)
  VALUES (p_supplier_id, p.mulai, p.akhir, p.tanggal_tagihan, p_total_kg, p_total_rupiah,
      btrim(p_foto_nota_url), v_staff, NULLIF(btrim(p_catatan_selisih), ''))
  RETURNING id INTO v_nota;       -- unique index nota_vendor_unik_periode menolak nota ganda

  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rincian, '[]'::jsonb)) LOOP
    INSERT INTO public.nota_vendor_rincian (nota_vendor_id, outlet_id, tanggal_kirim, qty_kg)
    VALUES (v_nota, (r->>'outlet_id')::uuid, NULLIF(r->>'tanggal_kirim','')::date, (r->>'qty_kg')::numeric);
  END LOOP;

  -- Nomor sendiri, deterministik & unik per vendor per periode (bukan generate_nomor_po,
  -- yang selalu berawalan PO/KITCHEN/).
  v_nomor := 'NV/' || to_char(p.tanggal_tagihan, 'YYYYMMDD') || '/' || left(p_supplier_id::text, 8);

  INSERT INTO public.purchase_order (nomor_po, supplier_id, supplier_nama, tanggal_po, status, payment_status,
      jatuh_tempo, dibuat_oleh, diverifikasi_oleh, diverifikasi_at, invoice_urls, nota_vendor_id, catatan)
  VALUES (v_nomor, p_supplier_id, v_supplier_nama, p.tanggal_tagihan, 'diterima_lengkap', 'unpaid',
      p.tanggal_tagihan, v_staff, v_staff, now(), ARRAY[btrim(p_foto_nota_url)], v_nota,
      'Nota drop-ship periode ' || p.mulai || ' s/d ' || p.akhir)
  RETURNING id INTO v_po;

  INSERT INTO public.purchase_order_item (purchase_order_id, bahan_baku_id, qty_pesan, harga_pesan,
      qty_terima, harga_terima, kondisi, catatan)
  VALUES (v_po, v_bahan, p_total_kg, v_harga, p_total_kg, v_harga, 'baik', 'Dari nota drop-ship');

  UPDATE public.nota_vendor SET purchase_order_id = v_po WHERE id = v_nota;

  -- Kunci catatan crew. Trigger sinkron melihat target tak berubah -> nol baris ledger.
  UPDATE public.terima_vendor_outlet SET status = 'disahkan', nota_vendor_id = v_nota, updated_at = now()
   WHERE supplier_id = p_supplier_id AND status = 'dicatat' AND tanggal_terima BETWEEN p.mulai AND p.akhir;

  -- Harga master ikut nota (keputusan owner 2026-09-11) -- dengan penjaga rasio-faktor
  -- yang SAMA dengan verifikasi_terima_po: rasio harga baru/lama yang persis sama dengan
  -- salah satu faktor konversi = sidik jari salah satuan.
  SELECT harga_beli INTO v_old FROM public.bahan_baku_harga WHERE bahan_baku_id = v_bahan;
  IF v_old IS NOT NULL AND v_old > 0 THEN
    v_rasio := v_harga / v_old; IF v_rasio < 1 THEN v_rasio := 1 / v_rasio; END IF;
    FOR v_faktor IN
      SELECT f FROM (
        SELECT b.faktor_tengah::numeric AS f FROM public.bahan_baku b WHERE b.id = v_bahan
        UNION ALL SELECT b.faktor_tampilan::numeric FROM public.bahan_baku b WHERE b.id = v_bahan
        UNION ALL SELECT b.faktor_konversi::numeric FROM public.bahan_baku b WHERE b.id = v_bahan
        UNION ALL SELECT b.faktor_tampilan::numeric / NULLIF(b.faktor_tengah, 0) FROM public.bahan_baku b WHERE b.id = v_bahan
      ) k WHERE f IS NOT NULL AND f >= 2
    LOOP
      IF abs(v_rasio - v_faktor) / v_faktor <= 0.01 THEN v_salah := true; EXIT; END IF;
    END LOOP;
  END IF;

  IF v_salah THEN
    INSERT INTO public.bahan_baku_harga_history (bahan_baku_id, harga_lama, harga_baru, ref_po_id, catatan, changed_by, changed_at)
    VALUES (v_bahan, v_old, v_old, v_po,
      'DITOLAK (dugaan salah satuan): nota ' || v_nomor || ' Rp ' || round(v_harga, 2) || ', rasio '
      || round(v_rasio, 2) || 'x terhadap master Rp ' || v_old || '. Harga master dipertahankan.', v_staff, now());
  ELSE
    INSERT INTO public.bahan_baku_harga (bahan_baku_id, harga_beli, harga_beli_display, harga_updated_at, updated_by)
    VALUES (v_bahan, v_harga, v_harga, now(), v_staff)
    ON CONFLICT (bahan_baku_id) DO UPDATE SET harga_beli = EXCLUDED.harga_beli, harga_beli_display = EXCLUDED.harga_beli_display,
      harga_updated_at = EXCLUDED.harga_updated_at, updated_by = EXCLUDED.updated_by;
    IF v_old IS DISTINCT FROM v_harga THEN
      INSERT INTO public.bahan_baku_harga_history (bahan_baku_id, harga_lama, harga_baru, ref_po_id, catatan, changed_by, changed_at)
      VALUES (v_bahan, v_old, v_harga, v_po, 'Update dari nota drop-ship ' || v_nomor, v_staff, now());
    END IF;
    UPDATE public.bahan_baku_supplier SET harga = v_harga, perlu_ditinjau = false, sumber = 'po', ref_po_id = v_po,
      harga_updated_at = now(), updated_by = v_staff
     WHERE supplier_id = p_supplier_id AND bahan_baku_id = v_bahan;
  END IF;

  RETURN v_nota;
END $$;

CREATE OR REPLACE FUNCTION public.tolak_terima_vendor(p_id uuid, p_alasan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.peran_saya() IS NULL OR public.peran_saya() NOT IN ('purchasing','kitchen','admin') THEN
    RAISE EXCEPTION 'Hanya purchasing, kitchen, atau admin yang boleh menolak' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_alasan IS NULL OR btrim(p_alasan) = '' THEN
    RAISE EXCEPTION 'Alasan penolakan wajib' USING ERRCODE = 'check_violation';
  END IF;
  -- Trigger sinkron membalik stok lewat 'rejected_kiriman' (lolos penjaga anti-minus).
  UPDATE public.terima_vendor_outlet
     SET status = 'ditolak', catatan = COALESCE(catatan || ' | ', '') || 'Ditolak: ' || btrim(p_alasan), updated_at = now()
   WHERE id = p_id AND status = 'dicatat';
  IF NOT FOUND THEN RAISE EXCEPTION 'Catatan tidak ditemukan atau sudah diproses' USING ERRCODE = 'no_data_found'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.ringkasan_nota_vendor(uuid,date),
  public.sahkan_nota_vendor(uuid,date,numeric,numeric,text,text,jsonb),
  public.tolak_terima_vendor(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ringkasan_nota_vendor(uuid,date),
  public.sahkan_nota_vendor(uuid,date,numeric,numeric,text,text,jsonb),
  public.tolak_terima_vendor(uuid,text) TO authenticated, service_role;

-- DOWN:
-- DROP FUNCTION IF EXISTS public.tolak_terima_vendor(uuid,text),
--   public.sahkan_nota_vendor(uuid,date,numeric,numeric,text,text,jsonb), public.ringkasan_nota_vendor(uuid,date);
```

- [ ] **Step 4: Apply, run tests, negative control, stamp**

```bash
supabase db query --linked -f supabase/migrations/20260911122000_drop_ship_sahkan_nota.sql
supabase db query --linked -f supabase/verifikasi/drop_ship/t7_sahkan.sql
supabase db query --linked -f supabase/verifikasi/drop_ship/t7b_rasio.sql
```
Expected: `HASIL T7: LULUS (...)` lalu `HASIL T7b: LULUS (...)`.

Sebelum apply, periksa trigger yang akan tersentuh (pelajaran 2026-09-10): `SELECT tgrelid::regclass, tgname FROM pg_trigger WHERE tgrelid IN ('public.purchase_order'::regclass,'public.purchase_order_item'::regclass,'public.bahan_baku_harga'::regclass,'public.bahan_baku_supplier'::regclass) AND NOT tgisinternal;` — catat hasilnya; bila ada trigger baru yang menulis `ledger_stok`, **berhenti** dan laporkan.

Kontrol negatif: salin `t7_sahkan.sql`, ubah harapan `(i)` jadi `22999`, jalankan → `GAGAL (i)`. Buang salinan. Stempel `('20260911122000','drop_ship_sahkan_nota')`.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add supabase/migrations/20260911122000_drop_ship_sahkan_nota.sql supabase/verifikasi/drop_ship/t7_sahkan.sql supabase/verifikasi/drop_ship/t7b_rasio.sql
git commit -m "feat(db): RPC pengesahan nota vendor drop-ship -> PO utang"
```

---

### Task 8: Layar "Cocokkan Nota Vendor"

**Files:**
- Create: `apps/stok/src/hooks/useNotaVendor.ts`, `apps/stok/src/components/stok/NotaVendorBoard.tsx`, `apps/stok/src/app/stok/nota-vendor/page.tsx`

**Interfaces:**
- Consumes: RPC Task 7, `daftarTanggalTagihan` (Task 1), `hitungSelisihNota`/`BATAS_SELISIH_PERSEN` (Task 4), `canSahkanNotaVendor`/`canLihatNotaVendor` (Task 4).
- Produces: rute `/stok/nota-vendor`.

- [ ] **Step 1: Write the hook**

`apps/stok/src/hooks/useNotaVendor.ts`:

```ts
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'

const supabase = createSupabaseBrowserClient()

export type RingkasanBaris = {
  outlet_id: string; outlet_nama: string; bahan_baku_id: string; bahan_nama: string
  jumlah_catatan: number; total_qty: number; total_nilai: number
}
export type VendorDropShip = { id: string; nama: string; termin_hari: number | null }

export function useVendorDropShip() {
  return useQuery<VendorDropShip[]>({
    queryKey: ['nota-vendor', 'vendor'],
    queryFn: async () => {
      const { data, error } = await supabase.from('supplier').select('id, nama, termin_hari')
        .eq('is_active', true).order('nama')
      if (error) throw new Error(error.message)
      return (data ?? []) as VendorDropShip[]
    },
  })
}

export function useRingkasanNota(supplierId: string | null, tanggalTagihan: string | null) {
  return useQuery<RingkasanBaris[]>({
    queryKey: ['nota-vendor', 'ringkasan', supplierId, tanggalTagihan],
    enabled: !!supplierId && !!tanggalTagihan,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ringkasan_nota_vendor', { p_supplier_id: supplierId, p_tanggal_tagihan: tanggalTagihan })
      if (error) throw new Error(error.message)
      return (data ?? []) as RingkasanBaris[]
    },
  })
}

export function useSahkanNota() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: { supplierId: string; tanggalTagihan: string; totalKg: number; totalRupiah: number;
      fotoNotaUrl: string; catatanSelisih?: string; rincian: { outlet_id: string; tanggal_kirim: string | null; qty_kg: number }[] }) => {
      const { data, error } = await supabase.rpc('sahkan_nota_vendor', {
        p_supplier_id: a.supplierId, p_tanggal_tagihan: a.tanggalTagihan, p_total_kg: a.totalKg,
        p_total_rupiah: a.totalRupiah, p_foto_nota_url: a.fotoNotaUrl,
        p_catatan_selisih: a.catatanSelisih ?? null, p_rincian: a.rincian,
      })
      if (error) throw new Error(error.message)
      return data as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nota-vendor'] }),
  })
}

export function useTolakTerimaVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: { id: string; alasan: string }) => {
      const { error } = await supabase.rpc('tolak_terima_vendor', { p_id: a.id, p_alasan: a.alasan })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nota-vendor'] }); qc.invalidateQueries({ queryKey: ['terima-vendor'] }) },
  })
}
```

- [ ] **Step 2: Write the board**

`apps/stok/src/components/stok/NotaVendorBoard.tsx`:

```tsx
'use client'
import { useMemo, useState } from 'react'
import { Button, Input } from '@suka/design-system'
import { toast } from 'sonner'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useVendorDropShip, useRingkasanNota, useSahkanNota } from '@/hooks/useNotaVendor'
import { daftarTanggalTagihan } from '@/lib/stok/periodeTagihan'
import { hitungSelisihNota, BATAS_SELISIH_PERSEN } from '@/lib/stok/dropShip'

const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const hariIni = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)

export function NotaVendorBoard({ bolehSahkan }: { bolehSahkan: boolean }) {
  const { data: vendors = [] } = useVendorDropShip()
  const [supplierId, setSupplierId] = useState('')
  const pilihanTanggal = useMemo(() => daftarTanggalTagihan(hariIni(), 6), [])
  const [tanggal, setTanggal] = useState(pilihanTanggal[0])
  const { data: ringkasan = [], isLoading } = useRingkasanNota(supplierId || null, tanggal)

  const [totalKg, setTotalKg] = useState('')
  const [totalRupiah, setTotalRupiah] = useState('')
  const [catatanSelisih, setCatatanSelisih] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [rincian, setRincian] = useState<Record<string, string>>({}) // outlet_id -> kg dari catatan Pak Aziz
  const sahkan = useSahkanNota()

  const totalCrew = ringkasan.reduce((s, r) => s + Number(r.total_qty), 0)
  const kg = Number(totalKg)
  const selisih = kg > 0 ? hitungSelisihNota(totalCrew, kg) : null

  const submit = async () => {
    if (!supplierId || !(kg > 0) || !(Number(totalRupiah) > 0) || !foto) { toast.error('Isi total kg, total rupiah, dan foto nota'); return }
    if (selisih?.perluCatatan && !catatanSelisih.trim()) { toast.error(`Selisih ${selisih.selisih} kg (> ${BATAS_SELISIH_PERSEN}%) wajib dijelaskan`); return }
    try {
      const supabase = createSupabaseBrowserClient()
      const path = `nota/${supplierId}/${tanggal}-${Date.now()}.${foto.name.split('.').pop()}`
      const up = await supabase.storage.from('drop-ship').upload(path, foto)
      if (up.error) throw new Error('Gagal mengunggah foto nota: ' + up.error.message)
      const fotoNotaUrl = supabase.storage.from('drop-ship').getPublicUrl(up.data.path).data.publicUrl
      await sahkan.mutateAsync({
        supplierId, tanggalTagihan: tanggal, totalKg: kg, totalRupiah: Number(totalRupiah), fotoNotaUrl,
        catatanSelisih: catatanSelisih || undefined,
        rincian: Object.entries(rincian).filter(([, v]) => Number(v) > 0).map(([outlet_id, v]) => ({ outlet_id, tanggal_kirim: null, qty_kg: Number(v) })),
      })
      toast.success('Nota disahkan — utang vendor tercatat')
      setTotalKg(''); setTotalRupiah(''); setCatatanSelisih(''); setFoto(null); setRincian({})
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="flex-1 rounded-xl border border-[#d9c2b2] p-2 text-sm">
          <option value="">Pilih vendor…</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.nama}</option>)}
        </select>
        <select value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="rounded-xl border border-[#d9c2b2] p-2 text-sm">
          {pilihanTanggal.map((t) => <option key={t} value={t}>Tagihan {t}</option>)}
        </select>
      </div>

      {supplierId && (
        <table className="w-full text-sm bg-white rounded-xl overflow-hidden">
          <thead className="bg-[#f7f0ea] text-xs uppercase"><tr>
            <th className="p-2 text-left">Outlet</th><th className="p-2 text-right">Catatan crew</th>
            <th className="p-2 text-right">Kg (crew)</th><th className="p-2 text-right">Kg (catatan Pak Aziz)</th>
          </tr></thead>
          <tbody>
            {ringkasan.map((r) => {
              const v = Number(rincian[r.outlet_id] ?? '')
              const beda = v > 0 && Math.abs(v - Number(r.total_qty)) > 0.001
              return (
                <tr key={r.outlet_id + r.bahan_baku_id} className={beda ? 'bg-red-50' : ''}>
                  <td className="p-2">{r.outlet_nama}</td>
                  <td className="p-2 text-right">{r.jumlah_catatan}</td>
                  <td className="p-2 text-right">{Number(r.total_qty).toLocaleString('id-ID')}</td>
                  <td className="p-2 text-right">
                    <input type="number" step="any" className="w-20 rounded border border-[#d9c2b2] p-1 text-right"
                      value={rincian[r.outlet_id] ?? ''} onChange={(e) => setRincian({ ...rincian, [r.outlet_id]: e.target.value })} />
                  </td>
                </tr>
              )
            })}
            {!isLoading && ringkasan.length === 0 && <tr><td colSpan={4} className="p-3 text-xs text-gray-500">Tidak ada catatan crew di periode ini.</td></tr>}
          </tbody>
          <tfoot><tr className="font-bold"><td className="p-2">Total</td><td /><td className="p-2 text-right">{totalCrew.toLocaleString('id-ID')}</td><td /></tr></tfoot>
        </table>
      )}

      {bolehSahkan && supplierId && ringkasan.length > 0 && (
        <div className="bg-white rounded-xl p-4 space-y-3 border border-[#d9c2b2]/50">
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" step="any" placeholder="Total kg di nota" value={totalKg} onChange={(e: any) => setTotalKg(e.target.value)} />
            <Input type="number" step="any" placeholder="Total rupiah di nota" value={totalRupiah} onChange={(e: any) => setTotalRupiah(e.target.value)} />
          </div>
          {kg > 0 && Number(totalRupiah) > 0 && (
            <p className="text-xs">Harga per kg dari nota: <b>{rupiah(Number(totalRupiah) / kg)}</b></p>
          )}
          {selisih && (
            <p className={`text-sm font-semibold ${selisih.perluCatatan ? 'text-red-700' : 'text-green-700'}`}>
              Crew {totalCrew} kg vs nota {kg} kg — selisih {selisih.selisih} kg ({selisih.persen.toFixed(2)}%)
            </p>
          )}
          {selisih?.perluCatatan && (
            <Input placeholder="Jelaskan selisihnya (wajib)" value={catatanSelisih} onChange={(e: any) => setCatatanSelisih(e.target.value)} />
          )}
          <label className="block text-xs">Foto nota (dari WhatsApp Pak Aziz) — wajib
            <input type="file" accept="image/*" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} className="block mt-1" />
          </label>
          <Button onClick={submit} disabled={sahkan.isPending}>{sahkan.isPending ? 'Mengesahkan…' : 'Sahkan Nota'}</Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write the page**

`apps/stok/src/app/stok/nota-vendor/page.tsx`:

```tsx
'use client'
import { useAuth } from '@suka/auth'
import { NotaVendorBoard } from '@/components/stok/NotaVendorBoard'
import { canLihatNotaVendor, canSahkanNotaVendor } from '@/lib/stok/approver'

export default function NotaVendorPage() {
  const { outletStaff } = useAuth()
  const role = outletStaff?.role
  if (!outletStaff) return <div className="text-center py-20 text-xs font-bold text-gray-500 animate-pulse">Memuat…</div>
  // Guard UI saja -- RPC memeriksa ulang peran di DB.
  if (!canLihatNotaVendor(role)) return <div className="text-center py-20 text-xs font-bold text-gray-500">Halaman ini untuk purchasing, kitchen, dan admin.</div>
  return (
    <div className="min-h-screen bg-[#fff8f1] pb-12">
      <header className="px-4 py-4 border-b border-[#d9c2b2]/30">
        <h1 className="font-bold text-sm text-[#701604] uppercase">Cocokkan Nota Vendor</h1>
        <p className="text-xs text-[#544437]/80">Tiap tanggal 10, 20, dan akhir bulan: cocokkan catatan crew dengan nota vendor, lalu sahkan jadi utang.</p>
        {!canSahkanNotaVendor(role) && <p className="text-xs text-amber-700 mt-1">Mode pantau — pengesahan hanya purchasing, kitchen, admin.</p>}
      </header>
      <main className="max-w-4xl mx-auto px-4 mt-6">
        <NotaVendorBoard bolehSahkan={canSahkanNotaVendor(role)} />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Type-check + smoke test**

Run: `cd apps/stok && yarn type-check` → sama dengan baseline. `cd apps/stok && yarn test` → baseline + test Task 1/4 lulus.

Smoke test sebagai purchasing (`purchasing`) di **outlet tes**:
1. Buat 2 catatan terima di outlet tes (Task 6).
2. Buka `/stok/nota-vendor`, pilih `Lettuce (Pak Aziz) - Tempo 10`, tanggal tagihan berjalan → tabel memuat outlet tes dengan total yang benar.
3. Isi total kg **berbeda** tanpa catatan → toast menolak. Isi catatan → lolos ke RPC.
4. **Jangan menekan Sahkan di produksi** kecuali memang uji penuh yang disengaja; bila disengaja, bersihkan: set `nota_vendor.status='dibatalkan'`, hapus PO `NV/…` dan itemnya, kembalikan catatan crew ke `dicatat` — semuanya dijalankan sebagai postgres dan diverifikasi `ledger_stok` tak bertambah.
5. Login sebagai `owner` → layar tampil dengan "Mode pantau", form sahkan tersembunyi.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add apps/stok/src/hooks/useNotaVendor.ts apps/stok/src/components/stok/NotaVendorBoard.tsx apps/stok/src/app/stok/nota-vendor/page.tsx
git commit -m "feat(stok): layar Cocokkan Nota Vendor untuk pengesah"
```

---

### Task 9: Laporan & pemantau

**Files:**
- Create: `supabase/migrations/20260911123000_drop_ship_laporan.sql`, `supabase/verifikasi/drop_ship/pemantau.sql`

**Interfaces:**
- Produces: view `nilai_masuk_drop_ship_harian(outlet_id uuid, tanggal date, nilai_masuk numeric)` (`security_invoker = true`).

- [ ] **Step 1: Write the view migration**

```sql
-- 20260911123000_drop_ship_laporan.sql
-- Saudara hpp_barang_masuk_harian_spv (yang HANYA membaca surat jalan, sehingga
-- sayur drop-ship tak pernah terhitung). Dipakai rekonsiliasi "nilai keluar
-- terkunci vs BOM terpakai". Spec §8.
CREATE OR REPLACE VIEW public.nilai_masuk_drop_ship_harian
WITH (security_invoker = true) AS
SELECT t.outlet_id, t.tanggal_terima AS tanggal, sum(t.qty * t.harga_snapshot) AS nilai_masuk
  FROM public.terima_vendor_outlet t
 WHERE t.status IN ('dicatat','disahkan')
 GROUP BY t.outlet_id, t.tanggal_terima;
REVOKE ALL ON public.nilai_masuk_drop_ship_harian FROM PUBLIC, anon;
GRANT SELECT ON public.nilai_masuk_drop_ship_harian TO authenticated, service_role;
-- DOWN: DROP VIEW IF EXISTS public.nilai_masuk_drop_ship_harian;
```

- [ ] **Step 2: Write the monitoring script**

`supabase/verifikasi/drop_ship/pemantau.sql`:

```sql
-- Pemantau drop-ship. Jalankan tiap tanggal tagihan & sesudahnya.
-- Q1: catatan crew yang lewat tanggal tagihan tapi belum disahkan (antrean macet)
SELECT s.nama AS vendor, (public.periode_tagihan(t.tanggal_terima)).tanggal_tagihan AS tagihan,
       count(*) AS catatan, sum(t.qty) AS kg
  FROM public.terima_vendor_outlet t JOIN public.supplier s ON s.id = t.supplier_id
 WHERE t.status = 'dicatat' AND (public.periode_tagihan(t.tanggal_terima)).tanggal_tagihan < current_date
 GROUP BY 1, 2 ORDER BY 2;

-- Q2: LARANGAN 3 — PO diterima tanpa ledger, SUDAH mengecualikan PO nota drop-ship
SELECT po.nomor_po, po.supplier_nama, po.tanggal_po
  FROM public.purchase_order po
 WHERE po.status = 'diterima_lengkap' AND po.nota_vendor_id IS NULL
   AND po.tanggal_po >= DATE '2026-09-01'
   AND NOT EXISTS (SELECT 1 FROM public.ledger_stok l WHERE l.ref_po_id = po.id);

-- Q3: invarian stok — ledger tiap catatan = target trigger (harus 0 baris)
SELECT t.id, t.status, t.qty, COALESCE(sum(l.qty),0) AS ledger,
       CASE WHEN t.status IN ('dicatat','disahkan') THEN public.to_ledger_scale(t.outlet_id, t.bahan_baku_id, t.qty) ELSE 0 END AS target
  FROM public.terima_vendor_outlet t LEFT JOIN public.ledger_stok l ON l.ref_terima_vendor_id = t.id
 GROUP BY t.id
HAVING abs(COALESCE(sum(l.qty),0) - CASE WHEN t.status IN ('dicatat','disahkan')
          THEN public.to_ledger_scale(t.outlet_id, t.bahan_baku_id, t.qty) ELSE 0 END) > 0.000001;

-- Q4: sayur masih dicatat lewat adjustment manual setelah go-live (harus mendekati 0)
SELECT o.name, count(*) FROM public.ledger_stok l
  JOIN public.bahan_baku b ON b.id = l.bahan_baku_id JOIN public.outlets o ON o.id = l.outlet_id
 WHERE b.nama ILIKE '%lettuce%' AND l.tipe = 'adjustment' AND l.qty > 0
   AND l.catatan NOT ILIKE 'Pengembalian Void%' AND l.created_at >= TIMESTAMPTZ '2026-09-21 00:00+07'
 GROUP BY o.name;
```

- [ ] **Step 3: Apply, verify, stamp**

```bash
supabase db query --linked -f supabase/migrations/20260911123000_drop_ship_laporan.sql
supabase db query --linked -f supabase/verifikasi/drop_ship/pemantau.sql
```
Expected: view ada (`SELECT count(*) FROM pg_views WHERE viewname='nilai_masuk_drop_ship_harian'` = 1); Q3 **0 baris**. Stempel `('20260911123000','drop_ship_laporan')`.

- [ ] **Step 4: Commit**

```bash
git branch --show-current
git add supabase/migrations/20260911123000_drop_ship_laporan.sql supabase/verifikasi/drop_ship/pemantau.sql
git commit -m "feat(db): view nilai masuk drop-ship + skrip pemantau"
```

---

### Task 10: Runbook go-live 20–21 September

**Files:**
- Modify: `CLAUDE.md` (entri sesi baru), memori `drop-ship-sayur-pak-aziz.md`

- [ ] **Step 1: Sebelum 20 Sep** — pastikan Task 1–6 sudah di `main` dan app `stok` **di-redeploy** di Coolify. Hard refresh tab lama (ID Server Action berubah tiap build).
- [ ] **Step 2: 20 Sep sore** — kabari semua outlet: mulai besok sayur dicatat di **Terima dari Vendor**, bukan penyesuaian manual. Malam ini opname sayur wajib diisi (bukan dikosongkan).
- [ ] **Step 3: 21 Sep pagi** — verifikasi baseline: `SELECT o.name, sb.saldo FROM stok_balance sb JOIN bahan_baku b ON b.id=sb.bahan_baku_id JOIN outlets o ON o.id=sb.outlet_id WHERE b.nama ILIKE '%lettuce%' ORDER BY o.name;` — tidak ada outlet operasional yang minus sesudah opname 20 Sep malam.
- [ ] **Step 4: 21–30 Sep** — tiap pagi jalankan `pemantau.sql` Q3 (harus 0) dan Q4 (adjustment manual sayur harus menurun ke 0).
- [ ] **Step 5: 30 Sep** — nota pertama disahkan di `/stok/nota-vendor`; periksa PO `NV/20260930/…` muncul di layar utang finance dengan jatuh tempo 30 Sep.
- [ ] **Step 6: Catat & commit** — tambah entri sesi di `CLAUDE.md` (apa yang hidup, angka baseline, hasil nota pertama), perbarui memori, `git branch --show-current`, commit, **tanyakan owner sebelum push** bila `main` memuat commit sesi lain.

---

## Self-Review

**Spec coverage:** §1 masalah → konteks; §2 K1–K6 → Task 3 (crew catat, stok harian), Task 7 (pengesah 3 peran, cocok nota, tanggal tetap), Task 8 (rincian per outlet); §3 prinsip → arsitektur; §4.1 → Task 2+3; §4.2 → Task 2+7; §4.3 tiga larangan → Task 7 (uji f, INSERT PO, `nota_vendor_id`) + Task 9 Q2; §4.4 → Task 1+2 (uji kesetaraan); §5.1 → Task 6; §5.2 → Task 8 + harga master Task 7 (i) & rasio-faktor t7b; §6 → Global Constraints + RPC + t3 (e)(f) + t7 (a); §7 tidak disentuh → larangan eksplisit; §8 → Task 9; §9 keputusan → Task 1 (akhir bulan), Task 10 (21 Sep, opname 20 malam), Task 7 (harga ikut nota), Task 8 (foto WA wajib), Task 6 (foto crew opsional); §11 → Global Constraints.

**Placeholder scan:** tidak ada TBD/TODO. Tinjauan diri menangkap tiga cacat dan memperbaikinya langsung di rencana: klausa `WHERE` ber-`OR` tanpa kurung di `ringkasan_nota_vendor`; celah `NULL` di pemeriksaan peran `koreksi_terima_vendor` (kini `COALESCE` + uji t3 (i)); dan `is_active` yang tak ada di tipe `BahanBaku`.

**Type consistency:** `BATAS_SELISIH_PERSEN = 0.5` ↔ `c_batas_persen 0.5`; `periodeTagihan` ↔ `periode_tagihan` (7 kasus identik); nama RPC & parameter di hook (Task 5, 8) = definisi SQL (Task 3, 7); `canSahkanNotaVendor`/`canLihatNotaVendor`/`canCatatTerimaVendor` dipakai sama di Task 6 & 8; kolom `terima_vendor_outlet` sama di Task 2, 3, 7, 9.
