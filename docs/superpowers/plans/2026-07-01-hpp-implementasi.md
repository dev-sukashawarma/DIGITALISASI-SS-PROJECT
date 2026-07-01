# HPP → Laba Owner Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hitung HPP bahan baku per outlet per periode (opname periodik, harga terakhir/snapshot) dan tampilkan Laba Kotor (Omzet−HPP) + Laba Bersih di halaman Profitabilitas admin-dashboard.

**Architecture:** Snapshot harga master ke `surat_jalan_item` via trigger SECURITY DEFINER; dua view building-block (nilai stok harian dari opname, barang masuk harian dari surat jalan) + fungsi `get_hpp_periode` (per-batas-periode, scoped `accessible_outlet_ids()`); hook `useHpp` + helper murni `computeProfit`; halaman Profitabilitas jadi tiga tingkat. Semua aditif — hanya +1 kolom di `surat_jalan_item`.

**Tech Stack:** Supabase (Postgres, RLS, PL/pgSQL), Next.js App Router, React, @tanstack/react-query v5, vitest.

**Spec:** [docs/superpowers/specs/2026-07-01-hpp-implementasi-design.md](../specs/2026-07-01-hpp-implementasi-design.md)
**ADR:** [docs/adr/0011-hpp-cogs-harga-terakhir-opname-harian.md](../../adr/0011-hpp-cogs-harga-terakhir-opname-harian.md)

---

## File Structure

**Create:**
- `supabase/migrations/20260701120000_hpp_reporting.sql` — kolom + trigger + 2 view + fungsi
- `apps/admin-dashboard/src/lib/profit.ts` — helper murni `computeProfit`
- `apps/admin-dashboard/src/lib/profit.test.ts` — unit test
- `apps/admin-dashboard/src/hooks/useHpp.ts` — hook baca `get_hpp_periode`

**Modify:**
- `apps/admin-dashboard/src/app/dashboard/owner/profit/page.tsx` — integrasi HPP (KPI, kalkulasi, tabel)

**Tidak diubah:** `SuratJalanForm.tsx` (trigger mengisi snapshot otomatis; form tetap kirim `qty_dikirim` saja).

---

## Task 1: Migration — snapshot harga + view + fungsi HPP

**Files:**
- Create: `supabase/migrations/20260701120000_hpp_reporting.sql`

- [ ] **Step 1: Tulis file migration**

```sql
-- 20260701120000_hpp_reporting.sql
-- HPP bahan baku: snapshot harga per surat jalan + view/fungsi HPP periodik.
-- Aditif. Basis ADR-011 (opname harian + harga terakhir + snapshot per Order Session).

-- 1. Kolom snapshot harga di item surat jalan.
ALTER TABLE surat_jalan_item
  ADD COLUMN IF NOT EXISTS harga_snapshot NUMERIC NOT NULL DEFAULT 0 CHECK (harga_snapshot >= 0);

-- 2. Trigger SECURITY DEFINER: isi snapshot dari harga master saat item dibuat.
--    Pembuat surat jalan (kitchen/pusat) tak boleh baca bahan_baku_harga (admin-only),
--    jadi fungsi harus DEFINER agar bisa membaca harga.
CREATE OR REPLACE FUNCTION fill_harga_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.harga_snapshot, 0) = 0 THEN
    SELECT COALESCE(harga_beli, 0) INTO NEW.harga_snapshot
    FROM bahan_baku_harga WHERE bahan_baku_id = NEW.bahan_baku_id;
    NEW.harga_snapshot := COALESCE(NEW.harga_snapshot, 0);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_fill_harga_snapshot ON surat_jalan_item;
CREATE TRIGGER trg_fill_harga_snapshot
  BEFORE INSERT ON surat_jalan_item
  FOR EACH ROW EXECUTE FUNCTION fill_harga_snapshot();

-- 3. View: nilai stok harian per outlet (opname finalized × harga snapshot terbaru <= tanggal).
CREATE OR REPLACE VIEW hpp_nilai_stok_harian_spv WITH (security_barrier = true) AS
SELECT op.outlet_id, op.tanggal, SUM(oi.qty_fisik * lp.harga) AS nilai_stok
FROM opname op
JOIN opname_item oi ON oi.opname_id = op.id
JOIN LATERAL (
  SELECT sji.harga_snapshot AS harga
  FROM surat_jalan_item sji JOIN surat_jalan sj ON sj.id = sji.surat_jalan_id
  WHERE sj.outlet_id = op.outlet_id AND sji.bahan_baku_id = oi.bahan_baku_id
    AND (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date <= op.tanggal
    AND sji.harga_snapshot > 0
  ORDER BY sj.created_at DESC LIMIT 1
) lp ON true
WHERE op.status = 'finalized' AND op.tipe = 'harian' AND oi.qty_fisik IS NOT NULL
GROUP BY op.outlet_id, op.tanggal;

GRANT SELECT ON hpp_nilai_stok_harian_spv TO authenticated;

-- 4. View: barang masuk harian per outlet (qty terverifikasi × snapshot, tanggal = surat jalan dibuat).
CREATE OR REPLACE VIEW hpp_barang_masuk_harian_spv WITH (security_barrier = true) AS
SELECT sj.outlet_id,
       (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date AS tanggal,
       SUM(sji.qty_terima * sji.harga_snapshot) AS nilai_masuk
FROM surat_jalan sj JOIN surat_jalan_item sji ON sji.surat_jalan_id = sj.id
WHERE sji.qty_terima IS NOT NULL
GROUP BY sj.outlet_id, (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date;

GRANT SELECT ON hpp_barang_masuk_harian_spv TO authenticated;

-- 5. Fungsi HPP periode (per-batas, scoped ke outlet yang boleh diakses pemanggil).
CREATE OR REPLACE FUNCTION get_hpp_periode(p_from date, p_to date)
RETURNS TABLE(outlet_id uuid, hpp numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH stok_awal AS (
    SELECT DISTINCT ON (outlet_id) outlet_id, nilai_stok
    FROM hpp_nilai_stok_harian_spv WHERE tanggal < p_from
    ORDER BY outlet_id, tanggal DESC
  ),
  stok_akhir AS (
    SELECT DISTINCT ON (outlet_id) outlet_id, nilai_stok
    FROM hpp_nilai_stok_harian_spv WHERE tanggal <= p_to
    ORDER BY outlet_id, tanggal DESC
  ),
  masuk AS (
    SELECT outlet_id, SUM(nilai_masuk) AS total
    FROM hpp_barang_masuk_harian_spv WHERE tanggal BETWEEN p_from AND p_to
    GROUP BY outlet_id
  )
  SELECT o.id,
    COALESCE(sa.nilai_stok,0) + COALESCE(m.total,0) - COALESCE(se.nilai_stok,0)
  FROM outlets o
  LEFT JOIN stok_awal sa ON sa.outlet_id = o.id
  LEFT JOIN stok_akhir se ON se.outlet_id = o.id
  LEFT JOIN masuk m ON m.outlet_id = o.id
  WHERE o.id IN (SELECT public.accessible_outlet_ids());
$$;

GRANT EXECUTE ON FUNCTION get_hpp_periode(date, date) TO authenticated;

-- DOWN:
-- DROP FUNCTION IF EXISTS get_hpp_periode(date, date);
-- DROP VIEW IF EXISTS hpp_barang_masuk_harian_spv;
-- DROP VIEW IF EXISTS hpp_nilai_stok_harian_spv;
-- DROP TRIGGER IF EXISTS trg_fill_harga_snapshot ON surat_jalan_item;
-- DROP FUNCTION IF EXISTS fill_harga_snapshot();
-- ALTER TABLE surat_jalan_item DROP COLUMN IF EXISTS harga_snapshot;
```

- [ ] **Step 2: Commit (push manual ke prod — jangan otomatis)**

```bash
git add supabase/migrations/20260701120000_hpp_reporting.sql
git commit -m "feat(hpp): snapshot harga surat jalan + view/fungsi HPP periodik"
```

Catatan: `supabase db push` ke database produksi dilakukan MANUAL oleh maintainer (cek `supabase migration list` untuk drift dulu). Jangan push otomatis dari agent.

---

## Task 2: Helper murni `computeProfit` (TDD)

**Files:**
- Create: `apps/admin-dashboard/src/lib/profit.ts`
- Test: `apps/admin-dashboard/src/lib/profit.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

```ts
// apps/admin-dashboard/src/lib/profit.test.ts
import { describe, it, expect } from 'vitest'
import { computeProfit } from './profit'

describe('computeProfit', () => {
  it('menghitung laba kotor, laba bersih, dan margin', () => {
    const r = computeProfit(10_000_000, 4_000_000, 2_000_000)
    expect(r.labaKotor).toBe(6_000_000)   // omzet - hpp
    expect(r.labaBersih).toBe(4_000_000)  // labaKotor - expenses
    expect(r.marginKotor).toBeCloseTo(60, 5)
    expect(r.marginBersih).toBeCloseTo(40, 5)
  })
  it('margin 0 saat omzet 0 (hindari bagi nol)', () => {
    const r = computeProfit(0, 0, 0)
    expect(r.marginKotor).toBe(0)
    expect(r.marginBersih).toBe(0)
  })
  it('laba kotor bisa negatif bila HPP > omzet', () => {
    const r = computeProfit(1_000_000, 1_500_000, 0)
    expect(r.labaKotor).toBe(-500_000)
    expect(r.marginKotor).toBeCloseTo(-50, 5)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/profit.test.ts`
Expected: FAIL — `Cannot find module './profit'`.

- [ ] **Step 3: Tulis implementasi**

```ts
// apps/admin-dashboard/src/lib/profit.ts
export interface ProfitResult {
  labaKotor: number
  labaBersih: number
  marginKotor: number
  marginBersih: number
}

/** Laba Kotor = Omzet − HPP; Laba Bersih = Laba Kotor − Expenses. Margin % thd omzet. */
export function computeProfit(omzet: number, hpp: number, expenses: number): ProfitResult {
  const labaKotor = omzet - hpp
  const labaBersih = labaKotor - expenses
  return {
    labaKotor,
    labaBersih,
    marginKotor: omzet > 0 ? (labaKotor / omzet) * 100 : 0,
    marginBersih: omzet > 0 ? (labaBersih / omzet) * 100 : 0,
  }
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/profit.test.ts`
Expected: PASS (3 test hijau).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/profit.ts apps/admin-dashboard/src/lib/profit.test.ts
git commit -m "feat(hpp): helper computeProfit (laba kotor/bersih + margin)"
```

---

## Task 3: Hook `useHpp`

**Files:**
- Create: `apps/admin-dashboard/src/hooks/useHpp.ts`

- [ ] **Step 1: Tulis hook**

```ts
// apps/admin-dashboard/src/hooks/useHpp.ts
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'

export interface HppRow {
  outlet_id: string
  hpp: number
}

// HPP per outlet untuk rentang periode, dari fungsi DB get_hpp_periode
// (per-batas-periode, sudah di-scope ke outlet yang boleh diakses pemanggil).
export function useHpp(filter: PeriodFilterValue) {
  const supabase = useMemo(() => createClient(), [])
  const query = useQuery<HppRow[]>({
    queryKey: ['hpp', filter.from, filter.to, filter.outletId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_hpp_periode', {
        p_from: filter.from,
        p_to: filter.to,
      })
      if (error) throw error
      let rows = (data ?? []).map((r: any) => ({
        outlet_id: r.outlet_id as string,
        hpp: Number(r.hpp),
      }))
      if (filter.outletId !== 'all') rows = rows.filter((r) => r.outlet_id === filter.outletId)
      return rows
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useHpp.ts
git commit -m "feat(hpp): hook useHpp (baca get_hpp_periode)"
```

---

## Task 4: Integrasi HPP ke halaman Profitabilitas

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/owner/profit/page.tsx`

Lakukan 5 penggantian blok berikut. Setiap blok tunjukkan versi baru lengkap.

- [ ] **Step 1: Import — tambah useHpp, computeProfit, ikon**

Ganti blok import ikon + tambah hook/helper. Cari baris:
```tsx
import { useExpenses } from '@/hooks/useExpenses'
```
Tambahkan tepat di bawahnya:
```tsx
import { useHpp } from '@/hooks/useHpp'
import { computeProfit } from '@/lib/profit'
```
Lalu ganti baris import lucide:
```tsx
import { TrendingUp, Percent, ArrowLeftRight, TrendingDown } from 'lucide-react'
```
menjadi:
```tsx
import { TrendingUp, Percent, ArrowLeftRight, TrendingDown, Boxes, Layers } from 'lucide-react'
```

- [ ] **Step 2: Hooks + kalkulasi total**

Ganti blok (dari `const sales = useSalesDaily...` s/d `const profitMargin = ...`):
```tsx
  const sales = useSalesDaily(filter, outlets)
  const expenses = useExpenses(filter)
  const hpp = useHpp(filter)

  const loading = sales.loading || expenses.loading || hpp.loading
  const error = sales.error || expenses.error || hpp.error

  // Calculations
  const totalOmzet = useMemo(() => sales.rows.reduce((sum, r) => sum + r.omzet, 0), [sales.rows])
  const totalExpenses = useMemo(() => expenses.rows.reduce((sum, r) => sum + r.amount, 0), [expenses.rows])
  const totalHpp = useMemo(() => hpp.rows.reduce((sum, r) => sum + r.hpp, 0), [hpp.rows])
  const { labaKotor, labaBersih, marginKotor, marginBersih } = computeProfit(totalOmzet, totalHpp, totalExpenses)
```

- [ ] **Step 3: outletBreakdown — tambah HPP per outlet**

Ganti seluruh blok `const outletBreakdown = useMemo(...)` menjadi:
```tsx
  const outletBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; omzet: number; expense: number; hpp: number }>()

    outlets.forEach(o => {
      map.set(o.id, { name: o.name, omzet: 0, expense: 0, hpp: 0 })
    })

    sales.rows.forEach(s => {
      const cur = map.get(s.outlet_id) ?? { name: s.outlet_name, omzet: 0, expense: 0, hpp: 0 }
      cur.omzet += s.omzet
      map.set(s.outlet_id, cur)
    })

    expenses.rows.forEach(e => {
      const cur = map.get(e.outlet_id) ?? { name: e.outlet_name, omzet: 0, expense: 0, hpp: 0 }
      cur.expense += e.amount
      map.set(e.outlet_id, cur)
    })

    hpp.rows.forEach(h => {
      const cur = map.get(h.outlet_id) ?? { name: 'Outlet Tidak Dikenal', omzet: 0, expense: 0, hpp: 0 }
      cur.hpp += h.hpp
      map.set(h.outlet_id, cur)
    })

    return [...map.entries()]
      .map(([id, val]) => {
        const net = val.omzet - val.hpp - val.expense
        const labaKotor = val.omzet - val.hpp
        const margin = val.omzet > 0 ? (net / val.omzet) * 100 : 0
        return { id, name: val.name, omzet: val.omzet, expense: val.expense, hpp: val.hpp, labaKotor, net, margin }
      })
      .filter(item => item.omzet > 0 || item.expense > 0 || item.hpp > 0)
      .sort((a, b) => b.net - a.net)
  }, [sales.rows, expenses.rows, hpp.rows, outlets])
```

- [ ] **Step 4: KPI cards — enam kartu tiga tingkat**

Ganti pembungkus grid KPI `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">` menjadi `lg:grid-cols-3`:
```tsx
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```
Susunan akhir kartu (6): Omzet(1) · **HPP(baru)** · **Laba Kotor(baru)** · Pengeluaran(2) · Laba Bersih(3) · Margin Bersih(4). Untuk itu, **sisipkan dua kartu baru tepat setelah penutup `</div>` kartu Omzet Penjualan (kartu 1)** — yaitu sebelum komentar `{/* 2. Total Pengeluaran */}`:
```tsx
            {/* HPP Bahan Baku */}
            <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-200 hover:shadow-md">
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">HPP Bahan Baku</p>
                <div className="p-2 bg-suka-brown/10 rounded-xl">
                  <Boxes className="w-5 h-5 text-suka-brown" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-suka-brown">
                  Rp <CountUp end={totalHpp} duration={1} separator="." />
                </h3>
                <p className="text-[10px] text-suka-brown font-bold mt-1 uppercase">Biaya Bahan Terjual</p>
              </div>
            </div>

            {/* Laba Kotor */}
            <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-200 hover:shadow-md">
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-suka-gray-500 uppercase tracking-wider">Laba Kotor</p>
                <div className="p-2 bg-suka-green/10 rounded-xl">
                  <Layers className="w-5 h-5 text-suka-green" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-suka-brown">
                  Rp <CountUp end={labaKotor} duration={1} separator="." />
                </h3>
                <p className="text-[10px] text-suka-green font-bold mt-1 uppercase">Omzet − HPP · {marginKotor.toFixed(1)}%</p>
              </div>
            </div>
```
Dalam kartu **Laba Bersih**: ganti `end={netProfit}` → `end={labaBersih}`, dan kondisi `netProfit >= 0` → `labaBersih >= 0` (dua tempat). Dalam kartu **Profit Margin**: ganti `end={profitMargin}` → `end={marginBersih}`.

- [ ] **Step 5: Tabel per-outlet — kolom HPP & Laba Kotor**

Ganti header tabel:
```tsx
                    <th className="py-3 px-6 text-right">Omzet</th>
                    <th className="py-3 px-6 text-right">Pengeluaran</th>
                    <th className="py-3 px-6 text-right">Laba Bersih</th>
```
menjadi:
```tsx
                    <th className="py-3 px-6 text-right">Omzet</th>
                    <th className="py-3 px-6 text-right">HPP</th>
                    <th className="py-3 px-6 text-right">Laba Kotor</th>
                    <th className="py-3 px-6 text-right">Pengeluaran</th>
                    <th className="py-3 px-6 text-right">Laba Bersih</th>
```
Ganti `colSpan={6}` (baris kosong) menjadi `colSpan={8}`. Lalu ganti sel Omzet/Pengeluaran/Laba Bersih di body:
```tsx
                          <td className="py-3.5 px-6 text-right text-suka-gray-600">{rupiah(row.omzet)}</td>
                          <td className="py-3.5 px-6 text-right text-suka-gray-600">{rupiah(row.expense)}</td>
                          <td className={`py-3.5 px-6 text-right font-extrabold ${isProfit ? 'text-suka-green' : 'text-red-700'}`}>
                            {rupiah(row.net)}
                          </td>
```
menjadi:
```tsx
                          <td className="py-3.5 px-6 text-right text-suka-gray-600">{rupiah(row.omzet)}</td>
                          <td className="py-3.5 px-6 text-right text-suka-gray-600">{rupiah(row.hpp)}</td>
                          <td className="py-3.5 px-6 text-right text-suka-gray-600">{rupiah(row.labaKotor)}</td>
                          <td className="py-3.5 px-6 text-right text-suka-gray-600">{rupiah(row.expense)}</td>
                          <td className={`py-3.5 px-6 text-right font-extrabold ${isProfit ? 'text-suka-green' : 'text-red-700'}`}>
                            {rupiah(row.net)}
                          </td>
```

- [ ] **Step 6: Type-check + build**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 error.
Run: `cd apps/admin-dashboard && yarn build`
Expected: build sukses.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/owner/profit/page.tsx
git commit -m "feat(hpp): Profitabilitas tiga tingkat (HPP + Laba Kotor)"
```

---

## Task 5: Verifikasi akhir

**Files:** (gerbang verifikasi, tanpa perubahan kode)

- [ ] **Step 1: Seluruh test admin-dashboard**

Run: `cd apps/admin-dashboard && yarn vitest run`
Expected: semua PASS (termasuk `profit.test.ts`).

- [ ] **Step 2: Type-check + build**

Run: `cd apps/admin-dashboard && yarn type-check && yarn build`
Expected: 0 error, build sukses.

- [ ] **Step 3: Smoke SQL (manual, setelah migration di-push ke DB dev/staging)**

Skenario Item A (jalankan di SQL editor, outlet uji):
1. Set harga master Item A = 7.000 di `bahan_baku_harga`.
2. Buat surat jalan Senin + item Item A → cek `surat_jalan_item.harga_snapshot = 7000`.
3. Set harga master = 10.000; buat surat jalan Kamis + Item A → snapshot Kamis = 10000, snapshot Senin tetap 7000.
4. Finalize opname Senin & Rabu (Item A).
5. `SELECT * FROM get_hpp_periode('<senin>','<rabu>');` → HPP outlet memakai harga 7.000 untuk stok/masuk Sen–Rab.
6. Hapus opname Selasa (bila ada) → jalankan ulang → total Sen–Rab **tetap sama** (bukti per-batas tahan opname bolong).
Expected: angka konsisten dengan rumus `stok_awal + masuk − stok_akhir`.

- [ ] **Step 4: Commit (bila ada penyesuaian kecil)**

```bash
git add -A && git commit -m "chore(hpp): verifikasi test/type-check/build" || echo "nothing to commit"
```

---

## Catatan Eksekusi

- **Migration push = MANUAL** ke produksi (cek drift dulu). Snapshot hanya terisi untuk surat jalan yang **dibuat setelah** migration; baris lama `harga_snapshot = 0` (HPP akurat mulai maju ke depan).
- **Prasyarat data:** admin mengisi harga di Master Bahan Baku, dan outlet menjalankan opname harian finalized — tanpa keduanya HPP under/over-estimate (lihat spec "Edge Cases").
- **Redeploy** `admin-dashboard` agar halaman Profitabilitas baru live.
- Merge lewat PR ke `main` seperti biasa.
