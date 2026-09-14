# Laporan Kiriman per Vendor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Halaman `/stok/kiriman-vendor` (Rincian + Rekap kiriman surat jalan per vendor) dan label vendor di layar verifikasi terima outlet.

**Architecture:** Dua RPC `SECURITY DEFINER` di atas satu fungsi baris internal (aturan vendor fallback, qty acuan, nilai, outlet tes) → hook react-query → board di app stok. Label vendor di distribusi memakai helper murni atas data `useSuratJalanDetail` yang sudah memuat `vendor`.

**Tech Stack:** Supabase Postgres (plpgsql/sql), Next.js app router, React Query, Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-14-laporan-kiriman-vendor-design.md`

## Global Constraints

- Role laporan: `kitchen, purchasing, admin, owner, admin_finance, spv, regional_manager` — SAMA di RPC dan TS.
- Status dihitung: `NOT IN ('draft','dibatalkan')`. Tanggal = `created_at` WIB.
- Rentang wajib, maks 93 hari (`p_sampai - p_dari <= 92`). `p_limit` rincian maks 200.
- Outlet `type='test'` tampil di Rincian, dikecualikan dari Rekap.
- Nama vendor tampil: buang `\s*-\s*Tempo\s*\d+\s*$` (case-insensitive).
- DB bersama produksi: DDL via `supabase db query --linked -f <file>`, verifikasi ke katalog, stempel `schema_migrations` manual. Uji SQL dalam `BEGIN…ROLLBACK`, jalankan SEBELUM apply (harus gagal).
- `min(uuid)` tidak ada di Postgres → `min(x::text)::uuid`.
- Commit hanya file sendiri; kerja di worktree `.worktrees/kiriman-vendor` (branch `feat/laporan-kiriman-vendor`).

---

### Task 1: RPC laporan + uji SQL

**Files:**
- Create: `supabase/migrations/20260914160000_laporan_kiriman_vendor.sql`
- Create: `supabase/verifikasi/kiriman_vendor/t1_laporan.sql`

**Interfaces:**
- Produces: `laporan_kiriman_vendor_rincian(p_dari date, p_sampai date, p_outlet uuid, p_bahan uuid, p_vendor uuid, p_limit int, p_offset int)` → kolom spec §4.3 (+`total_count bigint`); `laporan_kiriman_vendor_rekap(p_dari, p_sampai, p_outlet, p_bahan, p_vendor)` → `vendor_id uuid, vendor_nama text, bahan_baku_id uuid, bahan_nama text, satuan text, outlet_id uuid, outlet_nama text, qty numeric, nilai numeric, harga_rata numeric, jumlah_sj bigint, ada_belum_diterima boolean`.

- [ ] **Step 1: Tulis uji** `t1_laporan.sql`:

```sql
BEGIN;
DO $$
DECLARE v_kitchen uuid; v_crew uuid; v_n bigint; v_tot bigint; v_a numeric; v_b numeric; v_vendor uuid; v_ok boolean;
  c_dari date := '2026-09-12'; c_sampai date := '2026-09-14';
BEGIN
  SELECT id INTO v_kitchen FROM outlet_staff WHERE role='kitchen' AND status='active' LIMIT 1;
  SELECT id INTO v_crew FROM outlet_staff WHERE role='crew' AND status='active' LIMIT 1;
  -- draft ada di rentang → filter status bermakna
  IF NOT EXISTS (SELECT 1 FROM surat_jalan WHERE status IN ('draft','dibatalkan') AND created_at >= '2026-09-12') THEN
    RAISE EXCEPTION 'GAGAL fixture: tak ada draft/dibatalkan'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN PERFORM * FROM laporan_kiriman_vendor_rincian(c_dari, c_sampai, NULL, NULL, NULL, 50, 0);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (a): crew boleh membaca'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kitchen, 'role','authenticated')::text, true);
  SELECT count(*), max(total_count) INTO v_n, v_tot FROM laporan_kiriman_vendor_rincian(c_dari, c_sampai, NULL, NULL, NULL, 200, 0);
  IF v_n = 0 THEN RAISE EXCEPTION 'GAGAL (b): rincian kosong'; END IF;
  RESET ROLE;

  -- (c) total_count = jumlah baris dasar; tanpa draft/dibatalkan
  IF v_tot <> (SELECT count(*) FROM _kiriman_vendor_baris(c_dari, c_sampai, NULL, NULL, NULL)) THEN
    RAISE EXCEPTION 'GAGAL (c): total_count % beda', v_tot; END IF;
  IF EXISTS (SELECT 1 FROM _kiriman_vendor_baris(c_dari, c_sampai, NULL, NULL, NULL) WHERE status IN ('draft','dibatalkan')) THEN
    RAISE EXCEPTION 'GAGAL (c): draft ikut'; END IF;

  -- (d) Σ rekap = Σ baris non-tes
  SELECT COALESCE(sum(nilai),0) INTO v_a FROM laporan_kiriman_vendor_rekap(c_dari, c_sampai, NULL, NULL, NULL);
  SELECT COALESCE(sum(nilai),0) INTO v_b FROM _kiriman_vendor_baris(c_dari, c_sampai, NULL, NULL, NULL) WHERE NOT outlet_tes;
  IF abs(v_a - v_b) > 0.01 THEN RAISE EXCEPTION 'GAGAL (d): rekap % vs rincian %', v_a, v_b; END IF;
  IF EXISTS (SELECT 1 FROM laporan_kiriman_vendor_rekap(c_dari, c_sampai, NULL, NULL, NULL) r JOIN outlets o ON o.id=r.outlet_id WHERE o.type='test') THEN
    RAISE EXCEPTION 'GAGAL (d): outlet tes masuk rekap'; END IF;

  -- (e) fallback katalog terisi & bertanda
  IF NOT EXISTS (SELECT 1 FROM _kiriman_vendor_baris(c_dari, c_sampai, NULL, NULL, NULL) WHERE vendor_otomatis AND vendor_id IS NOT NULL) THEN
    RAISE EXCEPTION 'GAGAL (e): tak ada fallback vendor katalog'; END IF;

  -- (f) filter vendor
  SELECT vendor_id INTO v_vendor FROM _kiriman_vendor_baris(c_dari, c_sampai, NULL, NULL, NULL) WHERE vendor_id IS NOT NULL LIMIT 1;
  IF EXISTS (SELECT 1 FROM laporan_kiriman_vendor_rincian(c_dari, c_sampai, NULL, NULL, v_vendor, 200, 0) WHERE vendor_id IS DISTINCT FROM v_vendor) THEN
    RAISE EXCEPTION 'GAGAL (f): filter vendor bocor'; END IF;

  -- (g) rentang > 93 hari ditolak
  v_ok := false;
  BEGIN PERFORM * FROM laporan_kiriman_vendor_rekap('2026-01-01', '2026-09-14', NULL, NULL, NULL);
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (g): rentang panjang lolos'; END IF;

  RAISE EXCEPTION 'HASIL KV1: LULUS (akses, total, status, rekap=rincian non-tes, fallback, filter, rentang)';
END $$;
ROLLBACK;
```

- [ ] **Step 2: Jalankan sebelum migration** — `supabase db query --linked -f supabase/verifikasi/kiriman_vendor/t1_laporan.sql`. Expected: ERROR `function … does not exist`.

- [ ] **Step 3: Tulis migration**:

```sql
SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public._cek_laporan_kiriman_vendor(p_dari date, p_sampai date)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role','') <> 'service_role'
     AND COALESCE(public.peran_saya(),'') NOT IN ('kitchen','purchasing','admin','owner','admin_finance','spv','regional_manager') THEN
    RAISE EXCEPTION 'Tidak berhak melihat laporan kiriman vendor' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_dari IS NULL OR p_sampai IS NULL OR p_sampai < p_dari THEN
    RAISE EXCEPTION 'Rentang tanggal tidak valid' USING ERRCODE = 'check_violation';
  END IF;
  IF p_sampai - p_dari > 92 THEN
    RAISE EXCEPTION 'Rentang tanggal maksimal 93 hari' USING ERRCODE = 'check_violation';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._kiriman_vendor_baris(p_dari date, p_sampai date, p_outlet uuid, p_bahan uuid, p_vendor uuid)
RETURNS TABLE(surat_jalan_item_id uuid, surat_jalan_id uuid, tanggal date, document_number text, status text,
  outlet_id uuid, outlet_nama text, outlet_tes boolean, bahan_baku_id uuid, bahan_nama text, satuan text,
  vendor_id uuid, vendor_nama text, vendor_otomatis boolean, qty_dikirim numeric, qty_terima numeric,
  qty_acuan numeric, belum_diterima boolean, harga numeric, nilai numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (
    SELECT i.id AS iid, s.id AS sid, (s.created_at AT TIME ZONE 'Asia/Jakarta')::date AS tgl,
           s.document_number::text AS doc, s.status::text AS st, s.outlet_id AS oid, o.name::text AS onama,
           COALESCE(o.type = 'test', false) AS otes, i.bahan_baku_id AS bid, b.nama::text AS bnama, b.satuan::text AS sat,
           COALESCE(i.vendor_id, f.vid) AS vid, (i.vendor_id IS NULL AND f.vid IS NOT NULL) AS votomatis,
           i.qty_dikirim::numeric AS qd, i.qty_terima::numeric AS qt, i.harga_snapshot::numeric AS hg
      FROM surat_jalan s
      JOIN surat_jalan_item i ON i.surat_jalan_id = s.id
      JOIN outlets o ON o.id = s.outlet_id
      JOIN bahan_baku b ON b.id = i.bahan_baku_id
      LEFT JOIN LATERAL (
        SELECT CASE WHEN count(*) = 1 THEN min(v::text)::uuid END AS vid
          FROM public.vendor_bahan(i.bahan_baku_id) AS v
      ) f ON i.vendor_id IS NULL
     WHERE s.status NOT IN ('draft','dibatalkan')
       AND s.created_at >= (p_dari::timestamp AT TIME ZONE 'Asia/Jakarta')
       AND s.created_at <  ((p_sampai + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
       AND (p_outlet IS NULL OR s.outlet_id = p_outlet)
       AND (p_bahan IS NULL OR i.bahan_baku_id = p_bahan)
  )
  SELECT d.iid, d.sid, d.tgl, d.doc, d.st, d.oid, d.onama, d.otes, d.bid, d.bnama, d.sat,
         d.vid, regexp_replace(sp.nama, '\s*-\s*Tempo\s*\d+\s*$', '', 'i'), COALESCE(d.votomatis, false),
         d.qd, d.qt, COALESCE(d.qt, d.qd), d.qt IS NULL, d.hg, COALESCE(d.qt, d.qd) * d.hg
    FROM d LEFT JOIN supplier sp ON sp.id = d.vid
   WHERE p_vendor IS NULL OR d.vid = p_vendor
$$;

CREATE OR REPLACE FUNCTION public.laporan_kiriman_vendor_rincian(
  p_dari date, p_sampai date, p_outlet uuid DEFAULT NULL, p_bahan uuid DEFAULT NULL,
  p_vendor uuid DEFAULT NULL, p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS TABLE(surat_jalan_item_id uuid, surat_jalan_id uuid, tanggal date, document_number text, status text,
  outlet_id uuid, outlet_nama text, outlet_tes boolean, bahan_baku_id uuid, bahan_nama text, satuan text,
  vendor_id uuid, vendor_nama text, vendor_otomatis boolean, qty_dikirim numeric, qty_terima numeric,
  qty_acuan numeric, belum_diterima boolean, harga numeric, nilai numeric, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  PERFORM public._cek_laporan_kiriman_vendor(p_dari, p_sampai);
  RETURN QUERY
    SELECT b.*, count(*) OVER ()
      FROM public._kiriman_vendor_baris(p_dari, p_sampai, p_outlet, p_bahan, p_vendor) b
     ORDER BY b.tanggal DESC, b.document_number DESC NULLS LAST, b.bahan_nama, b.surat_jalan_item_id
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END $$;

CREATE OR REPLACE FUNCTION public.laporan_kiriman_vendor_rekap(
  p_dari date, p_sampai date, p_outlet uuid DEFAULT NULL, p_bahan uuid DEFAULT NULL, p_vendor uuid DEFAULT NULL)
RETURNS TABLE(vendor_id uuid, vendor_nama text, bahan_baku_id uuid, bahan_nama text, satuan text,
  outlet_id uuid, outlet_nama text, qty numeric, nilai numeric, harga_rata numeric, jumlah_sj bigint,
  ada_belum_diterima boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  PERFORM public._cek_laporan_kiriman_vendor(p_dari, p_sampai);
  RETURN QUERY
    SELECT b.vendor_id, max(b.vendor_nama), b.bahan_baku_id, max(b.bahan_nama), max(b.satuan),
           b.outlet_id, max(b.outlet_nama), sum(b.qty_acuan), sum(b.nilai),
           sum(b.nilai) / NULLIF(sum(b.qty_acuan) FILTER (WHERE b.harga IS NOT NULL), 0),
           count(DISTINCT b.surat_jalan_id), bool_or(b.belum_diterima)
      FROM public._kiriman_vendor_baris(p_dari, p_sampai, p_outlet, p_bahan, p_vendor) b
     WHERE NOT b.outlet_tes
     GROUP BY b.vendor_id, b.bahan_baku_id, b.outlet_id
     ORDER BY max(b.vendor_nama) NULLS LAST, max(b.bahan_nama), max(b.outlet_nama);
END $$;

REVOKE ALL ON FUNCTION public._cek_laporan_kiriman_vendor(date,date),
  public._kiriman_vendor_baris(date,date,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.laporan_kiriman_vendor_rincian(date,date,uuid,uuid,uuid,int,int),
  public.laporan_kiriman_vendor_rekap(date,date,uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.laporan_kiriman_vendor_rincian(date,date,uuid,uuid,uuid,int,int),
  public.laporan_kiriman_vendor_rekap(date,date,uuid,uuid,uuid) TO authenticated, service_role;
```

- [ ] **Step 4: Apply** (`supabase db query --linked -f …`, ulangi bila lock timeout), verifikasi katalog: keempat fungsi ada, `prosecdef`, `has_function_privilege('anon', …rincian…, 'EXECUTE') = false`, `has_function_privilege('authenticated', '_kiriman_vendor_baris(...)', 'EXECUTE') = false`.
- [ ] **Step 5: Jalankan uji** → `HASIL KV1: LULUS`. Stempel `schema_migrations ('20260914160000','laporan_kiriman_vendor')`.
- [ ] **Step 6: Commit** migration + uji.

---

### Task 2: Fungsi murni laporan (stok)

**Files:**
- Create: `apps/stok/src/lib/stok/kirimanVendor.ts`, `apps/stok/src/lib/stok/kirimanVendor.test.ts`

**Interfaces:**
- Produces: `ROLE_LAPORAN_KIRIMAN_VENDOR`, `canLihatKirimanVendor(role)`, `labelVendor(nama: string|null, otomatis: boolean): string`, `rentangDefault(now: Date): {dari: string; sampai: string}`, `type BarisRekap`, `type BarisRincian`, `kelompokkanRekap(rows: BarisRekap[]): RingkasanRekap`.

- [ ] **Step 1: Tes gagal**:

```ts
import { describe, it, expect } from 'vitest'
import { canLihatKirimanVendor, labelVendor, rentangDefault, kelompokkanRekap, type BarisRekap } from './kirimanVendor'

const r = (p: Partial<BarisRekap>): BarisRekap => ({
  vendor_id: 'v1', vendor_nama: 'Djafafood', bahan_baku_id: 'b1', bahan_nama: 'SAPI', satuan: 'Blok',
  outlet_id: 'o1', outlet_nama: 'BEJI', qty: 1, nilai: 100, harga_rata: 100, jumlah_sj: 1, ada_belum_diterima: false, ...p,
})

describe('canLihatKirimanVendor', () => {
  it('role berhak', () => { for (const x of ['kitchen','purchasing','admin','owner','admin_finance','spv','regional_manager']) expect(canLihatKirimanVendor(x)).toBe(true) })
  it('role lain', () => { for (const x of ['crew','leader','admin_hr','developer',null,undefined]) expect(canLihatKirimanVendor(x)).toBe(false) })
})

describe('labelVendor', () => {
  it('kosong → belum tercatat', () => expect(labelVendor(null, false)).toBe('Belum tercatat'))
  it('otomatis → (katalog)', () => expect(labelVendor('Meyer', true)).toBe('Meyer (katalog)'))
  it('biasa', () => expect(labelVendor('Djafafood', false)).toBe('Djafafood'))
})

describe('rentangDefault', () => {
  it('7 hari terakhir berdasar tanggal WIB', () => {
    // 2026-09-13 18:30 UTC = 2026-09-14 01:30 WIB
    expect(rentangDefault(new Date('2026-09-13T18:30:00Z'))).toEqual({ dari: '2026-09-08', sampai: '2026-09-14' })
  })
})

describe('kelompokkanRekap', () => {
  it('kelompok vendor → bahan → outlet dengan subtotal, vendor kosong di akhir', () => {
    const hasil = kelompokkanRekap([
      r({ outlet_id: 'o1', qty: 2, nilai: 200 }),
      r({ outlet_id: 'o2', outlet_nama: 'CIBINONG', qty: 3, nilai: 300 }),
      r({ vendor_id: null, vendor_nama: null, bahan_baku_id: 'b2', bahan_nama: 'AYAM', satuan: 'Kg', qty: 5, nilai: null }),
      r({ vendor_id: 'v2', vendor_nama: 'Agro', bahan_baku_id: 'b3', bahan_nama: 'KENTANG', satuan: 'Dus', qty: 1, nilai: 50 }),
    ])
    expect(hasil.total).toBe(550)
    expect(hasil.vendor.map(v => v.vendor_nama)).toEqual(['Agro', 'Djafafood', 'Belum tercatat'])
    const dj = hasil.vendor[1]
    expect(dj.nilai).toBe(500)
    expect(dj.bahan).toHaveLength(1)
    expect(dj.bahan[0]).toMatchObject({ bahan_nama: 'SAPI', qty: 5, nilai: 500 })
    expect(dj.bahan[0].outlet).toHaveLength(2)
    expect(hasil.vendor[2].nilai).toBe(0)
  })
})
```

- [ ] **Step 2:** `./node_modules/.bin/vitest run src/lib/stok/kirimanVendor.test.ts` → FAIL (modul tidak ada).
- [ ] **Step 3: Implementasi**:

```ts
// Laporan kiriman surat jalan per vendor. Spec: docs/superpowers/specs/2026-09-14-laporan-kiriman-vendor-design.md
// Penjaga akses sebenarnya di RPC (_cek_laporan_kiriman_vendor); daftar role WAJIB sama.
export const ROLE_LAPORAN_KIRIMAN_VENDOR = ['kitchen', 'purchasing', 'admin', 'owner', 'admin_finance', 'spv', 'regional_manager'] as const

export function canLihatKirimanVendor(role: string | null | undefined): boolean {
  return (ROLE_LAPORAN_KIRIMAN_VENDOR as readonly string[]).includes(role ?? '')
}

export type BarisRincian = {
  surat_jalan_item_id: string; surat_jalan_id: string; tanggal: string; document_number: string | null; status: string
  outlet_id: string; outlet_nama: string; outlet_tes: boolean; bahan_baku_id: string; bahan_nama: string; satuan: string
  vendor_id: string | null; vendor_nama: string | null; vendor_otomatis: boolean
  qty_dikirim: number; qty_terima: number | null; qty_acuan: number; belum_diterima: boolean
  harga: number | null; nilai: number | null; total_count: number
}

export type BarisRekap = {
  vendor_id: string | null; vendor_nama: string | null; bahan_baku_id: string; bahan_nama: string; satuan: string
  outlet_id: string; outlet_nama: string; qty: number; nilai: number | null; harga_rata: number | null
  jumlah_sj: number; ada_belum_diterima: boolean
}

export type KelompokBahan = { bahan_baku_id: string; bahan_nama: string; satuan: string; qty: number; nilai: number; outlet: BarisRekap[] }
export type KelompokVendor = { vendor_id: string | null; vendor_nama: string; nilai: number; bahan: KelompokBahan[] }
export type RingkasanRekap = { total: number; vendor: KelompokVendor[] }

export function labelVendor(nama: string | null, otomatis: boolean): string {
  if (!nama) return 'Belum tercatat'
  return otomatis ? `${nama} (katalog)` : nama
}

const tanggalWib = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d)

export function rentangDefault(now: Date): { dari: string; sampai: string } {
  const sampai = tanggalWib(now)
  const dari = new Date(`${sampai}T00:00:00Z`)
  dari.setUTCDate(dari.getUTCDate() - 6)
  return { dari: dari.toISOString().slice(0, 10), sampai }
}

export function kelompokkanRekap(rows: BarisRekap[]): RingkasanRekap {
  const vendors = new Map<string, KelompokVendor>()
  for (const row of rows) {
    const vk = row.vendor_id ?? '__kosong__'
    let v = vendors.get(vk)
    if (!v) { v = { vendor_id: row.vendor_id, vendor_nama: labelVendor(row.vendor_nama, false), nilai: 0, bahan: [] }; vendors.set(vk, v) }
    let b = v.bahan.find((x) => x.bahan_baku_id === row.bahan_baku_id)
    if (!b) { b = { bahan_baku_id: row.bahan_baku_id, bahan_nama: row.bahan_nama, satuan: row.satuan, qty: 0, nilai: 0, outlet: [] }; v.bahan.push(b) }
    b.qty += Number(row.qty ?? 0)
    b.nilai += Number(row.nilai ?? 0)
    b.outlet.push(row)
    v.nilai += Number(row.nilai ?? 0)
  }
  const vendor = [...vendors.values()].sort((a, b) =>
    (a.vendor_id === null ? 1 : 0) - (b.vendor_id === null ? 1 : 0) || a.vendor_nama.localeCompare(b.vendor_nama))
  for (const v of vendor) v.bahan.sort((a, b) => a.bahan_nama.localeCompare(b.bahan_nama))
  return { total: vendor.reduce((s, v) => s + v.nilai, 0), vendor }
}
```

- [ ] **Step 4:** tes → PASS.
- [ ] **Step 5: Commit.**

---

### Task 3: Halaman, board, sidebar (stok)

**Files:**
- Create: `apps/stok/src/hooks/useKirimanVendor.ts`
- Create: `apps/stok/src/components/stok/KirimanVendorBoard.tsx`
- Create: `apps/stok/src/app/stok/kiriman-vendor/page.tsx`
- Modify: `apps/stok/src/components/layout/AppSidebar.tsx` (grup UTAMA, setelah "Nilai Persediaan")

**Interfaces:**
- Consumes: Task 1 RPC, Task 2 lib.
- Produces: `useRincianKirimanVendor(filter, page)`, `useRekapKirimanVendor(filter, enabled)`; `type FilterKirimanVendor = { dari: string; sampai: string; outlet: string|null; bahan: string|null; vendor: string|null }`.

- [ ] **Step 1: Hook**:

```ts
'use client'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { BarisRekap, BarisRincian } from '@/lib/stok/kirimanVendor'

export type FilterKirimanVendor = { dari: string; sampai: string; outlet: string | null; bahan: string | null; vendor: string | null }
export const UKURAN_HALAMAN = 50
export const BATAS_REKAP = 1000

const params = (f: FilterKirimanVendor) => ({ p_dari: f.dari, p_sampai: f.sampai, p_outlet: f.outlet, p_bahan: f.bahan, p_vendor: f.vendor })

export function useRincianKirimanVendor(filter: FilterKirimanVendor, page: number, enabled: boolean) {
  return useQuery({
    queryKey: ['kiriman-vendor', 'rincian', filter, page],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await createClient().rpc('laporan_kiriman_vendor_rincian', {
        ...params(filter), p_limit: UKURAN_HALAMAN, p_offset: page * UKURAN_HALAMAN,
      })
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as BarisRincian[]
      return { rows, total: rows.length ? Number(rows[0].total_count) : 0 }
    },
  })
}

export function useRekapKirimanVendor(filter: FilterKirimanVendor, enabled: boolean) {
  return useQuery({
    queryKey: ['kiriman-vendor', 'rekap', filter],
    enabled,
    queryFn: async () => {
      const { data, error } = await createClient().rpc('laporan_kiriman_vendor_rekap', params(filter))
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as BarisRekap[]
      return { rows, terpotong: rows.length >= BATAS_REKAP }
    },
  })
}
```

- [ ] **Step 2: Board** `KirimanVendorBoard.tsx` — state `filter` (awal `rentangDefault(new Date())`, lainnya null), `tab: 'rincian'|'rekap'`, `page`. Daftar outlet: `useQuery(['outlets-kiriman-vendor'], () => createClient().from('outlets').select('id, name').order('name'))`; bahan: `useBahanBaku()`; vendor: pilihan dari data rekap tanpa filter vendor (`useRekapKirimanVendor({...filter, vendor: null}, true)` → daftar unik `vendor_id/vendor_nama` non-null) ditambah vendor terpilih. Ubah filter → `setPage(0)`. Tampilkan:
  - pita info "Data vendor tercatat mulai 12 September 2026" + galat RPC (merah) bila ada;
  - **Rincian**: kartu per baris — baris 1 `tanggal · document_number · outlet_nama` (+ badge "TES" bila `outlet_tes`); baris 2 `bahan_nama` tebal; baris 3 `labelVendor(vendor_nama, vendor_otomatis)`; baris 4 `qty_acuan satuan` (+ "belum diterima" bila `belum_diterima`, + `dikirim X` bila `qty_terima` ≠ `qty_dikirim`) dan kanan `formatRupiah(nilai)` atau "—"; navigasi "Sebelumnya / Berikutnya" + "hal X dari Y · N baris".
  - **Rekap**: `kelompokkanRekap(rows)` → total rupiah di atas; per vendor kartu (judul + rupiah), per bahan sub-judul `bahan_nama — qty satuan · rupiah`, per outlet baris `outlet_nama · qty satuan · rupiah · jumlah_sj SJ` (+ "belum diterima" bila `ada_belum_diterima`); banner amber bila `terpotong`.
  - Format rupiah: `new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })`; qty `toLocaleString('id-ID', { maximumFractionDigits: 2 })`.
  - Gaya mengikuti `NotaVendorBoard`/halaman stok lain (`bg-white rounded-2xl border border-[#d9c2b2]/45`, teks `#701604`/`#544437`), mobile-first.
- [ ] **Step 3: Page** — pola `nota-vendor/page.tsx`: guard `outletStaff` loading, guard `canLihatKirimanVendor(role)` dengan pesan "Halaman ini untuk kitchen, purchasing, admin, owner, admin finance, SPV, dan regional manager.", header "Kiriman per Vendor" + subjudul "Vendor yang dikirim ke tiap outlet, dari surat jalan", `<KirimanVendorBoard />`.
- [ ] **Step 4: Sidebar** — `const canLihatKiriman = canLihatKirimanVendor(role)`; item `{ label: 'Kiriman per Vendor', href: '/stok/kiriman-vendor', icon: Truck }` di grup UTAMA setelah Nilai Persediaan (import `canLihatKirimanVendor`).
- [ ] **Step 5:** `yarn type-check`, vitest, `next build --webpack` (stok) → hijau.
- [ ] **Step 6: Commit.**

---

### Task 4: Label vendor di VerifikasiForm (distribusi)

**Files:**
- Create: `apps/distribusi/src/lib/labelVendor.ts`, `apps/distribusi/src/lib/labelVendor.test.ts`
- Modify: `apps/distribusi/src/components/distribusi/VerifikasiForm.tsx` (baris ~620, ~630, ~716)

**Interfaces:**
- Produces: `namaVendorTampil(nama: string): string`, `labelNamaBahan(items: ItemLabel[]): Record<string, string>` dengan `type ItemLabel = { id: string; bahan_baku_id: string; bahan_baku?: { nama?: string | null } | null; vendor?: { nama?: string | null } | null }`.

- [ ] **Step 1: Tes gagal**:

```ts
import { describe, it, expect } from 'vitest'
import { labelNamaBahan, namaVendorTampil } from './labelVendor'

describe('namaVendorTampil', () => {
  it('buang akhiran Tempo', () => expect(namaVendorTampil('Lettuce (Pak Aziz) - Tempo 15')).toBe('Lettuce (Pak Aziz)'))
})

describe('labelNamaBahan', () => {
  it('bahan ganda diberi vendor, tunggal tidak', () => {
    expect(labelNamaBahan([
      { id: '1', bahan_baku_id: 's', bahan_baku: { nama: 'SAPI' }, vendor: { nama: 'Djafafood' } },
      { id: '2', bahan_baku_id: 's', bahan_baku: { nama: 'SAPI' }, vendor: { nama: 'Lettuce (Pak Aziz) - Tempo 10' } },
      { id: '3', bahan_baku_id: 'k', bahan_baku: { nama: 'KENTANG' }, vendor: { nama: 'Agro' } },
    ])).toEqual({ '1': 'SAPI · Djafafood', '2': 'SAPI · Lettuce (Pak Aziz)', '3': 'KENTANG' })
  })
  it('bahan ganda tanpa vendor tetap nama saja', () => {
    expect(labelNamaBahan([
      { id: '1', bahan_baku_id: 's', bahan_baku: { nama: 'SAPI' }, vendor: null },
      { id: '2', bahan_baku_id: 's', bahan_baku: { nama: 'SAPI' }, vendor: null },
    ])).toEqual({ '1': 'SAPI', '2': 'SAPI' })
  })
})
```

- [ ] **Step 2:** vitest → FAIL.
- [ ] **Step 3: Implementasi**:

```ts
// Label nama bahan di layar verifikasi terima: bahan yang dipecah beberapa vendor
// dalam satu surat jalan diberi nama vendor supaya crew tak melihat baris kembar.
export type ItemLabel = { id: string; bahan_baku_id: string; bahan_baku?: { nama?: string | null } | null; vendor?: { nama?: string | null } | null }

export function namaVendorTampil(nama: string): string {
  return nama.replace(/\s*-\s*Tempo\s*\d+\s*$/i, '')
}

export function labelNamaBahan(items: ItemLabel[]): Record<string, string> {
  const jumlah = new Map<string, number>()
  for (const it of items) jumlah.set(it.bahan_baku_id, (jumlah.get(it.bahan_baku_id) ?? 0) + 1)
  const hasil: Record<string, string> = {}
  for (const it of items) {
    const nama = it.bahan_baku?.nama ?? ''
    const vendor = it.vendor?.nama
    hasil[it.id] = (jumlah.get(it.bahan_baku_id) ?? 0) > 1 && vendor ? `${nama} · ${namaVendorTampil(vendor)}` : nama
  }
  return hasil
}
```

- [ ] **Step 4:** Di `VerifikasiForm.tsx`: import `labelNamaBahan`; setelah `items` useMemo tambahkan `const labelBahan = useMemo(() => labelNamaBahan(items), [items])` (sebelum early-return mana pun — React #310); ganti tiga `item.bahan_baku?.nama` / `currentItem?.bahan_baku?.nama` yang tampil sebagai teks/alt dengan `labelBahan[item.id] ?? item.bahan_baku?.nama` (dan `currentItem ? labelBahan[currentItem.id] : ''`).
- [ ] **Step 5:** type-check, vitest, `next build --webpack` (distribusi) → hijau.
- [ ] **Step 6: Commit.**

---

### Task 5: Verifikasi akhir & serah

- [ ] `supabase db query` uji KV1 sekali lagi → LULUS; cek `supabase/verifikasi/saldo_vendor/t5_penyesuaian.sql` tetap LULUS.
- [ ] Ringkas ke owner; merge ke `main` + push **hanya setelah izin** (memicu deploy stok & distribusi).
