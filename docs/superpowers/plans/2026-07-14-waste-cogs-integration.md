# Waste-COGS Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the Rupiah value of approved waste (`stok_waste_reports`) as a separate "Kerugian Waste" line that reduces Laba Bersih in `apps/admin-dashboard`, without touching the theoretical recipe-based HPP, plus a dedicated owner/admin analytics page for root-cause breakdown.

**Architecture:** Two new `SECURITY DEFINER` Postgres RPCs (`get_waste_periode` for the scoped total, `get_waste_breakdown` for owner/admin-only granular rows) follow the exact pattern of the existing `get_hpp_periode`. Two React Query hooks wrap them. `profit.ts`'s pure functions gain a `wasteValue` parameter. Three UI surfaces consume this: the Profit page (StatTile + formula), the Expenses page (read-only card), and a new `/dashboard/owner/waste` analytics page (4 breakdown views + trend chart) reachable only by OWNER/ADMIN.

**Tech Stack:** Next.js App Router, Supabase Postgres (RPC + RLS), TanStack Query, Vitest, Recharts.

---

### Task 1: Migration — `get_waste_periode` RPC

**Files:**
- Create: `supabase/migrations/20260714100000_waste_cogs_integration.sql`

- [ ] **Step 1: Write the RPC**

```sql
-- 20260714100000_waste_cogs_integration.sql
-- Nilai Rupiah waste APPROVED per outlet, dipakai Profit page & card Expenses.
-- Basis harga: bahan_baku_harga saat ini (bukan snapshot historis), pola identik
-- get_hpp_periode (harga_beli disimpan per satuan-beli, dibagi faktor_konversi
-- untuk dapat harga per satuan-pakai — satuan yang dipakai stok_waste_reports.qty).

CREATE OR REPLACE FUNCTION get_waste_periode(p_from date, p_to date)
RETURNS TABLE(outlet_id uuid, nilai_waste numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH waste_valued AS (
    SELECT
      w.outlet_id,
      w.qty * (COALESCE(bh.harga_beli, 0) / COALESCE(b.faktor_konversi, 1)) AS nilai
    FROM stok_waste_reports w
    JOIN bahan_baku b ON b.id = w.bahan_baku_id
    LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = w.bahan_baku_id
    WHERE w.status = 'APPROVED'
      AND (w.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
  )
  SELECT o.id AS outlet_id, COALESCE(SUM(wv.nilai), 0) AS nilai_waste
  FROM outlets o
  LEFT JOIN waste_valued wv ON wv.outlet_id = o.id
  WHERE o.id IN (SELECT public.accessible_outlet_ids())
  GROUP BY o.id;
$$;

GRANT EXECUTE ON FUNCTION get_waste_periode(date, date) TO authenticated;
```

- [ ] **Step 2: Write the `get_waste_breakdown` RPC (owner/admin only) in the same file**

```sql
-- Rincian granular waste (outlet, alasan, bahan, tanggal) untuk dashboard
-- analitik owner/admin. Ditutup eksplisit di level function (bukan cuma UI
-- hide) — defense in depth terhadap mitra/role lain.
CREATE OR REPLACE FUNCTION get_waste_breakdown(p_from date, p_to date)
RETURNS TABLE(
  outlet_id uuid,
  outlet_name text,
  reason text,
  bahan_baku_id uuid,
  bahan_nama text,
  tanggal date,
  qty numeric,
  nilai numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh melihat rincian waste';
  END IF;

  RETURN QUERY
  SELECT
    w.outlet_id,
    o.name AS outlet_name,
    w.reason,
    w.bahan_baku_id,
    b.nama AS bahan_nama,
    (w.created_at AT TIME ZONE 'Asia/Jakarta')::date AS tanggal,
    w.qty,
    w.qty * (COALESCE(bh.harga_beli, 0) / COALESCE(b.faktor_konversi, 1)) AS nilai
  FROM stok_waste_reports w
  JOIN outlets o ON o.id = w.outlet_id
  JOIN bahan_baku b ON b.id = w.bahan_baku_id
  LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = w.bahan_baku_id
  WHERE w.status = 'APPROVED'
    AND (w.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
    AND w.outlet_id IN (SELECT public.accessible_outlet_ids());
END;
$$;

GRANT EXECUTE ON FUNCTION get_waste_breakdown(date, date) TO authenticated;
```

- [ ] **Step 3: Push migration to remote and verify**

Run: `supabase db push`
Expected: migration `20260714100000_waste_cogs_integration` listed as applied.

Run (verify functions exist and are `SECURITY DEFINER`):
```sql
SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('get_waste_periode', 'get_waste_breakdown');
```
Expected: both rows, `prosecdef = true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260714100000_waste_cogs_integration.sql
git commit -m "feat(db): add get_waste_periode and get_waste_breakdown RPCs"
```

---

### Task 2: `computeProfit` / `computeOutletProfit` gain `wasteValue`

**Files:**
- Modify: `apps/admin-dashboard/src/lib/profit.ts`
- Test: `apps/admin-dashboard/src/lib/profit.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `profit.test.ts`:

```ts
describe('computeProfit dengan waste', () => {
  it('kerugian waste mengurangi laba bersih, tidak menyentuh laba kotor/HPP', () => {
    const r = computeProfit(10_000_000, 4_000_000, 2_000_000, 500_000)
    expect(r.labaKotor).toBe(6_000_000)      // omzet - hpp, tidak berubah
    expect(r.labaBersih).toBe(3_500_000)     // labaKotor - expenses - waste
  })
  it('wasteValue default 0 kalau tidak diberikan (backward compatible)', () => {
    const r = computeProfit(10_000_000, 4_000_000, 2_000_000)
    expect(r.labaBersih).toBe(4_000_000)
  })
})

describe('computeOutletProfit dengan waste', () => {
  it('laba outlet = omzet - hpp - pengeluaran outlet - waste', () => {
    const r = computeOutletProfit(1_000_000, 300_000, 200_000, 50_000)
    expect(r.labaKotor).toBe(700_000)
    expect(r.labaBersih).toBe(450_000)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/profit.test.ts`
Expected: FAIL — `computeProfit` called with 4 args but only uses 3 (labaBersih assertions mismatch).

- [ ] **Step 3: Implement**

Replace `profit.ts` in full:

```ts
// apps/admin-dashboard/src/lib/profit.ts
export interface ProfitResult {
  labaKotor: number
  labaBersih: number
  marginKotor: number
  marginBersih: number
}

/** Laba Kotor = Omzet − HPP; Laba Bersih = Laba Kotor − Expenses − Kerugian Waste. Margin % thd omzet. */
export function computeProfit(omzet: number, hpp: number, expenses: number, wasteValue: number = 0): ProfitResult {
  const labaKotor = omzet - hpp
  const labaBersih = labaKotor - expenses - wasteValue
  return {
    labaKotor,
    labaBersih,
    marginKotor: omzet > 0 ? (labaKotor / omzet) * 100 : 0,
    marginBersih: omzet > 0 ? (labaBersih / omzet) * 100 : 0,
  }
}

export interface OutletProfit {
  labaKotor: number; labaBersih: number; marginKotor: number; marginBersih: number
}

/** Laba Outlet = Omzet − HPP − Pengeluaran Outlet − Kerugian Waste (outlet itu saja). */
export function computeOutletProfit(omzet: number, hpp: number, pengeluaranOutlet: number, wasteValue: number = 0): OutletProfit {
  const labaKotor = omzet - hpp
  const labaBersih = labaKotor - pengeluaranOutlet - wasteValue
  return {
    labaKotor,
    labaBersih,
    marginKotor: omzet > 0 ? (labaKotor / omzet) * 100 : 0,
    marginBersih: omzet > 0 ? (labaBersih / omzet) * 100 : 0,
  }
}

/** Laba Perusahaan = Σ Laba Outlet − Σ Pengeluaran Pusat. (Waste sudah terpotong di level outlet.) */
export function computeCompanyProfit(sumLabaOutlet: number, pengeluaranPusat: number) {
  return { labaPerusahaan: sumLabaOutlet - pengeluaranPusat }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/profit.test.ts`
Expected: PASS (all tests, old and new).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/profit.ts apps/admin-dashboard/src/lib/profit.test.ts
git commit -m "feat(profit): add wasteValue param to computeProfit/computeOutletProfit"
```

---

### Task 3: `useWaste` hook (scoped total)

**Files:**
- Create: `apps/admin-dashboard/src/hooks/useWaste.ts`

- [ ] **Step 1: Write the hook**

```ts
// apps/admin-dashboard/src/hooks/useWaste.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'

export interface WasteRow {
  outlet_id: string
  nilai_waste: number
}

// Nilai waste APPROVED per outlet untuk rentang periode, dari get_waste_periode
// (scoped ke outlet yang boleh diakses pemanggil, sama pola dgn useHpp).
export function useWaste(filter: PeriodFilterValue) {
  const supabase = createClient()
  const query = useQuery<WasteRow[]>({
    queryKey: ['waste', filter.from, filter.to, filter.outletId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_waste_periode', {
        p_from: filter.from,
        p_to: filter.to,
      })
      if (error) throw error
      let rows: WasteRow[] = (data ?? []).map((r: any) => ({
        outlet_id: r.outlet_id as string,
        nilai_waste: Number(r.nilai_waste),
      }))
      if (filter.outletId !== 'all') rows = rows.filter((r: WasteRow) => r.outlet_id === filter.outletId)
      return rows
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 errors (this file compiles standalone; not yet wired to any page).

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useWaste.ts
git commit -m "feat(hooks): add useWaste hook for scoped waste totals"
```

---

### Task 4: Profit page — integrate waste into headline & outlet breakdown

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/owner/profit/page.tsx`

- [ ] **Step 1: Add the `useWaste` call and fold waste into `loading`/`error`/totals**

In `ProfitPage`, after the existing `hpp = useHpp(filter)` line (`page.tsx:28`), add:

```tsx
  const waste = useWaste(filter)
```

Update the `loading`/`error` lines (`page.tsx:30-31`):

```tsx
  const loading = sales.loading || expenses.loading || hpp.loading || waste.loading
  const error = sales.error || expenses.error || hpp.error || waste.error
```

Add the import at the top alongside `useHpp`:

```tsx
import { useWaste } from '@/hooks/useWaste'
```

- [ ] **Step 2: Compute `totalWaste` and pass it into the profit formulas**

After `const totalHpp = useMemo(...)` (`page.tsx:47`), add:

```tsx
  const totalWaste = useMemo(() => waste.rows.reduce((sum, r) => sum + r.nilai_waste, 0), [waste.rows])
```

Change the `computeProfit` call (`page.tsx:49`) from:

```tsx
  const { labaKotor, labaBersih, marginKotor } = computeProfit(totalOmzet, totalHpp, pengeluaranOutlet)
```

to:

```tsx
  const { labaKotor, labaBersih, marginKotor } = computeProfit(totalOmzet, totalHpp, pengeluaranOutlet, totalWaste)
```

- [ ] **Step 3: Fold waste into the per-outlet breakdown table**

In the `outletBreakdown` `useMemo` (`page.tsx:56-92`), the map value shape needs a `waste` field. Replace the whole block with:

```tsx
  const outletBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; omzet: number; expense: number; hpp: number; waste: number }>()

    outlets.forEach(o => {
      map.set(o.id, { name: o.name, omzet: 0, expense: 0, hpp: 0, waste: 0 })
    })

    sales.rows.forEach(s => {
      const cur = map.get(s.outlet_id) ?? { name: s.outlet_name, omzet: 0, expense: 0, hpp: 0, waste: 0 }
      cur.omzet += s.omzet
      map.set(s.outlet_id, cur)
    })

    expenses.rows.forEach(e => {
      // Pengeluaran Pusat (scope pusat / outlet_id NULL) tak dibebankan ke outlet manapun.
      if (e.scope !== 'outlet' || !e.outlet_id) return
      const cur = map.get(e.outlet_id) ?? { name: e.outlet_name ?? 'Outlet Tidak Dikenal', omzet: 0, expense: 0, hpp: 0, waste: 0 }
      cur.expense += e.amount
      map.set(e.outlet_id, cur)
    })

    hpp.rows.forEach(h => {
      const cur = map.get(h.outlet_id) ?? { name: 'Outlet Tidak Dikenal', omzet: 0, expense: 0, hpp: 0, waste: 0 }
      cur.hpp += h.hpp
      map.set(h.outlet_id, cur)
    })

    waste.rows.forEach(w => {
      const cur = map.get(w.outlet_id) ?? { name: 'Outlet Tidak Dikenal', omzet: 0, expense: 0, hpp: 0, waste: 0 }
      cur.waste += w.nilai_waste
      map.set(w.outlet_id, cur)
    })

    return [...map.entries()]
      .map(([id, val]) => {
        const net = val.omzet - val.hpp - val.expense - val.waste
        const labaKotor = val.omzet - val.hpp
        const margin = val.omzet > 0 ? (net / val.omzet) * 100 : 0
        return { id, name: val.name, omzet: val.omzet, expense: val.expense, hpp: val.hpp, waste: val.waste, labaKotor, net, margin }
      })
      .filter(item => item.omzet > 0 || item.expense > 0 || item.hpp > 0 || item.waste > 0)
      .sort((a, b) => b.net - a.net)
  }, [sales.rows, expenses.rows, hpp.rows, waste.rows, outlets])
```

- [ ] **Step 4: Add "Kerugian Waste" StatTile to Rincian Perhitungan**

In the `Section title="Rincian Perhitungan"` grid (`page.tsx:159-168`), add a StatTile after "Pengeluaran Outlet":

```tsx
              <StatTile label="Kerugian Waste" value={<><span className="text-lg align-top">Rp </span><CountUp end={totalWaste} duration={1} separator="." /></>} sub="Approved, di luar HPP resep" icon={TrendingDown} accent="red" />
```

(`TrendingDown` icon is already imported at `page.tsx:14`.)

- [ ] **Step 5: Add a "Kerugian Waste" column to the outlet leaderboard table**

In the table header (`page.tsx:184-194`), add a `<th>` after "Pengeluaran":

```tsx
                    <th className="py-3 px-6 text-right">Kerugian Waste</th>
```

In the row rendering (`page.tsx:210-227`), add a `<td>` after the "Pengeluaran" cell:

```tsx
                          <td className="py-3.5 px-6 text-right text-suka-gray-600">{rupiah(row.waste)}</td>
```

Update `colSpan={8}` on the empty-state row (`page.tsx:199`) to `colSpan={9}`.

- [ ] **Step 6: Verify manually**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 errors.

Run: `cd apps/admin-dashboard && yarn dev` then open `/dashboard/owner/profit` as an owner/admin test account.
Expected: page loads, "Kerugian Waste" tile shows a Rupiah figure (0 if no approved waste in range yet), table has the new column, Laba Bersih is lower by that amount compared to before this change.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/owner/profit/page.tsx
git commit -m "feat(profit): surface Kerugian Waste in headline, breakdown table, and net profit"
```

---

### Task 5: Expenses page — read-only "Kerugian Waste" card

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/owner/expenses/page.tsx`

- [ ] **Step 1: Import `useWaste` and call it with the same filter as `useExpenses`**

Add import near the top:

```tsx
import { useWaste } from '@/hooks/useWaste'
```

After `const { rows, loading, error } = useExpenses(filter)` (`page.tsx:46`), add:

```tsx
  const { rows: wasteRows, loading: wasteLoading } = useWaste(filter)
```

Note: `filter.outletId` here is already `isPusat ? 'all' : target` (`page.tsx:42`) — when `target === 'PUSAT'`, waste is intentionally shown for all outlets (waste has no "pusat" scope, so this card is only meaningful when a specific outlet or "all" is selected; when `isPusat` the card will show the all-outlet total — acceptable since waste never belongs to Pusat).

- [ ] **Step 2: Compute total and hide the card when scope is Pusat**

After the `totalAmount`/`amountBulanan`/`amountPettyCash` memos (`page.tsx:58-60`), add:

```tsx
  const totalWaste = useMemo(() => wasteRows.reduce((s, r) => s + r.nilai_waste, 0), [wasteRows])
```

- [ ] **Step 3: Render the card**

In the StatTile grid (`page.tsx:106-114`), change `grid-cols-1 sm:grid-cols-3` to `grid-cols-1 sm:grid-cols-2` (still valid at 1 or 2 tiles) and add a conditional second tile right after the existing "Total Pengeluaran" StatTile:

```tsx
            {!isPusat && (
              <StatTile
                label="Kerugian Waste"
                value={<><span className="text-lg align-top">Rp </span><CountUp end={totalWaste} duration={1} separator="." /></>}
                sub="Read-only, dari approval waste (bukan input manual)"
                icon={TrendingDown}
                accent="red"
              />
            )}
```

Add `TrendingDown` to the lucide-react import (`page.tsx:10`):

```tsx
import { Wallet, TrendingDown } from 'lucide-react'
```

Update the `loading` check to also gate on `wasteLoading` (`page.tsx:102`):

```tsx
      {loading || wasteLoading ? (
```

- [ ] **Step 4: Verify manually**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 errors.

Run: `cd apps/admin-dashboard && yarn dev` then open `/dashboard/owner/expenses`.
Expected: "Kerugian Waste" card visible when target is "Semua Outlet" or a specific outlet; hidden when target is "Pengeluaran Pusat"; card is not clickable/editable.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/owner/expenses/page.tsx
git commit -m "feat(expenses): add read-only Kerugian Waste summary card"
```

---

### Task 6: Pure aggregation functions for the waste breakdown page (TDD)

**Files:**
- Create: `apps/admin-dashboard/src/lib/wasteBreakdown.ts`
- Test: `apps/admin-dashboard/src/lib/wasteBreakdown.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/admin-dashboard/src/lib/wasteBreakdown.test.ts
import { describe, it, expect } from 'vitest'
import { aggregateByOutlet, aggregateByReason, aggregateByBahan, aggregateByDate, type WasteBreakdownRow } from './wasteBreakdown'

const rows: WasteBreakdownRow[] = [
  { outlet_id: 'o1', outlet_name: 'Outlet A', reason: 'Basi / Expired', bahan_baku_id: 'b1', bahan_nama: 'Ayam', tanggal: '2026-07-01', qty: 2, nilai: 20000 },
  { outlet_id: 'o1', outlet_name: 'Outlet A', reason: 'Jatuh / Tumpah', bahan_baku_id: 'b2', bahan_nama: 'Saus', tanggal: '2026-07-01', qty: 1, nilai: 5000 },
  { outlet_id: 'o2', outlet_name: 'Outlet B', reason: 'Basi / Expired', bahan_baku_id: 'b1', bahan_nama: 'Ayam', tanggal: '2026-07-02', qty: 3, nilai: 30000 },
]

describe('aggregateByOutlet', () => {
  it('menjumlahkan nilai per outlet, urut nilai tertinggi', () => {
    const result = aggregateByOutlet(rows)
    expect(result).toEqual([
      { id: 'o1', name: 'Outlet A', nilai: 25000, qty: 3 },
      { id: 'o2', name: 'Outlet B', nilai: 30000, qty: 3 },
    ].sort((a, b) => b.nilai - a.nilai))
  })
})

describe('aggregateByReason', () => {
  it('menjumlahkan nilai per alasan, urut nilai tertinggi', () => {
    const result = aggregateByReason(rows)
    expect(result[0]).toEqual({ reason: 'Basi / Expired', nilai: 50000, qty: 5 })
    expect(result[1]).toEqual({ reason: 'Jatuh / Tumpah', nilai: 5000, qty: 1 })
  })
})

describe('aggregateByBahan', () => {
  it('menjumlahkan nilai per bahan baku, urut nilai tertinggi', () => {
    const result = aggregateByBahan(rows)
    expect(result[0]).toEqual({ id: 'b1', name: 'Ayam', nilai: 50000, qty: 5 })
    expect(result[1]).toEqual({ id: 'b2', name: 'Saus', nilai: 5000, qty: 1 })
  })
})

describe('aggregateByDate', () => {
  it('menjumlahkan nilai per tanggal, urut tanggal ascending', () => {
    const result = aggregateByDate(rows)
    expect(result).toEqual([
      { date: '2026-07-01', nilai: 25000 },
      { date: '2026-07-02', nilai: 30000 },
    ])
  })
})

describe('empty input', () => {
  it('semua fungsi mengembalikan array kosong', () => {
    expect(aggregateByOutlet([])).toEqual([])
    expect(aggregateByReason([])).toEqual([])
    expect(aggregateByBahan([])).toEqual([])
    expect(aggregateByDate([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/wasteBreakdown.test.ts`
Expected: FAIL — `Cannot find module './wasteBreakdown'`.

- [ ] **Step 3: Implement**

```ts
// apps/admin-dashboard/src/lib/wasteBreakdown.ts
// Agregasi murni dari baris granular get_waste_breakdown untuk 4 view
// dashboard analitik waste (per outlet, per alasan, per bahan, tren waktu).

export interface WasteBreakdownRow {
  outlet_id: string
  outlet_name: string
  reason: string
  bahan_baku_id: string
  bahan_nama: string
  tanggal: string // 'YYYY-MM-DD'
  qty: number
  nilai: number
}

export interface OutletAgg { id: string; name: string; nilai: number; qty: number }
export interface ReasonAgg { reason: string; nilai: number; qty: number }
export interface BahanAgg { id: string; name: string; nilai: number; qty: number }
export interface DateAgg { date: string; nilai: number }

export function aggregateByOutlet(rows: WasteBreakdownRow[]): OutletAgg[] {
  const map = new Map<string, OutletAgg>()
  for (const r of rows) {
    const cur = map.get(r.outlet_id) ?? { id: r.outlet_id, name: r.outlet_name, nilai: 0, qty: 0 }
    cur.nilai += r.nilai
    cur.qty += r.qty
    map.set(r.outlet_id, cur)
  }
  return [...map.values()].sort((a, b) => b.nilai - a.nilai)
}

export function aggregateByReason(rows: WasteBreakdownRow[]): ReasonAgg[] {
  const map = new Map<string, ReasonAgg>()
  for (const r of rows) {
    const cur = map.get(r.reason) ?? { reason: r.reason, nilai: 0, qty: 0 }
    cur.nilai += r.nilai
    cur.qty += r.qty
    map.set(r.reason, cur)
  }
  return [...map.values()].sort((a, b) => b.nilai - a.nilai)
}

export function aggregateByBahan(rows: WasteBreakdownRow[]): BahanAgg[] {
  const map = new Map<string, BahanAgg>()
  for (const r of rows) {
    const cur = map.get(r.bahan_baku_id) ?? { id: r.bahan_baku_id, name: r.bahan_nama, nilai: 0, qty: 0 }
    cur.nilai += r.nilai
    cur.qty += r.qty
    map.set(r.bahan_baku_id, cur)
  }
  return [...map.values()].sort((a, b) => b.nilai - a.nilai)
}

export function aggregateByDate(rows: WasteBreakdownRow[]): DateAgg[] {
  const map = new Map<string, DateAgg>()
  for (const r of rows) {
    const cur = map.get(r.tanggal) ?? { date: r.tanggal, nilai: 0 }
    cur.nilai += r.nilai
    map.set(r.tanggal, cur)
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/wasteBreakdown.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/wasteBreakdown.ts apps/admin-dashboard/src/lib/wasteBreakdown.test.ts
git commit -m "feat(waste): add pure aggregation functions for waste breakdown views"
```

---

### Task 7: `useWasteBreakdown` hook

**Files:**
- Create: `apps/admin-dashboard/src/hooks/useWasteBreakdown.ts`

- [ ] **Step 1: Write the hook**

```ts
// apps/admin-dashboard/src/hooks/useWasteBreakdown.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'
import type { WasteBreakdownRow } from '@/lib/wasteBreakdown'

// Rincian granular waste APPROVED, owner/admin only (RPC raises exception
// untuk role lain — lihat get_waste_breakdown di migration 20260714100000).
export function useWasteBreakdown(filter: PeriodFilterValue) {
  const supabase = createClient()
  const query = useQuery<WasteBreakdownRow[]>({
    queryKey: ['waste_breakdown', filter.from, filter.to, filter.outletId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_waste_breakdown', {
        p_from: filter.from,
        p_to: filter.to,
      })
      if (error) throw error
      let rows: WasteBreakdownRow[] = (data ?? []).map((r: any) => ({
        outlet_id: r.outlet_id as string,
        outlet_name: r.outlet_name as string,
        reason: r.reason as string,
        bahan_baku_id: r.bahan_baku_id as string,
        bahan_nama: r.bahan_nama as string,
        tanggal: r.tanggal as string,
        qty: Number(r.qty),
        nilai: Number(r.nilai),
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
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useWasteBreakdown.ts
git commit -m "feat(hooks): add useWasteBreakdown hook for owner/admin waste analytics"
```

---

### Task 8: Waste trend chart component

**Files:**
- Create: `apps/admin-dashboard/src/components/WasteTrendChart.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/admin-dashboard/src/components/WasteTrendChart.tsx
'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'
import { rupiah } from '@/lib/format'
import type { DateAgg } from '@/lib/wasteBreakdown'

export function WasteTrendChart({ data }: { data: DateAgg[] }) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-suka-gray-400 text-sm">Tidak ada waste pada periode ini</div>
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toLocaleString('id-ID')}k`} />
          <Tooltip formatter={(value) => rupiah(Number(value))} />
          <Line type="monotone" dataKey="nilai" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/components/WasteTrendChart.tsx
git commit -m "feat(waste): add WasteTrendChart component"
```

---

### Task 9: Waste analytics page

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/owner/waste/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// apps/admin-dashboard/src/app/dashboard/owner/waste/page.tsx
'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useScopedFilter } from '@/hooks/useScopedFilter'
import { useOutlets } from '@/hooks/useOutlets'
import { useWasteBreakdown } from '@/hooks/useWasteBreakdown'
import { aggregateByOutlet, aggregateByReason, aggregateByBahan, aggregateByDate } from '@/lib/wasteBreakdown'
import { PeriodFilter } from '@/components/PeriodFilter'
import { PageHeader, StatTile, Section, StatTilesSkeleton } from '@/components/ui'
import { rupiah } from '@/lib/format'
import CountUp from 'react-countup'
import { TrendingDown } from 'lucide-react'

const WasteTrendChart = dynamic(
  () => import('@/components/WasteTrendChart').then((m) => m.WasteTrendChart),
  { ssr: false, loading: () => <div className="h-64 bg-white rounded-2xl border border-suka-gray-200 animate-pulse" /> }
)

export default function WastePage() {
  const { data: outlets = [] } = useOutlets()
  const { filter, setFilter, lockedOutletId } = useScopedFilter()

  const { rows, loading, error } = useWasteBreakdown(filter)

  const totalNilai = useMemo(() => rows.reduce((s, r) => s + r.nilai, 0), [rows])
  const byOutlet = useMemo(() => aggregateByOutlet(rows), [rows])
  const byReason = useMemo(() => aggregateByReason(rows), [rows])
  const byBahan = useMemo(() => aggregateByBahan(rows), [rows])
  const byDate = useMemo(() => aggregateByDate(rows), [rows])

  return (
    <div className="space-y-6">
      <PageHeader title="Kerugian Waste" description="Rincian waste bahan baku yang sudah di-approve">
        <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} lockedOutletId={lockedOutletId} hideSource />
      </PageHeader>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
          Gagal memuat data waste: {error}
        </div>
      )}

      {loading ? (
        <StatTilesSkeleton count={1} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              label="Total Kerugian Waste"
              value={<><span className="text-lg align-top">Rp </span><CountUp end={totalNilai} duration={1} separator="." /></>}
              sub="Approved, periode terpilih"
              icon={TrendingDown}
              accent="red"
            />
          </div>

          <Section title="Tren Waktu">
            <WasteTrendChart data={byDate} />
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-suka-gray-100">
                <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Ranking per Outlet</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
                      <th className="py-3 px-6">Outlet</th>
                      <th className="py-3 px-6 text-right">Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-gray-100 font-medium">
                    {byOutlet.length === 0 ? (
                      <tr><td colSpan={2} className="py-8 text-center text-suka-gray-400">Belum ada waste pada periode ini</td></tr>
                    ) : byOutlet.map(o => (
                      <tr key={o.id}>
                        <td className="py-3 px-6 text-suka-ink font-bold">{o.name.replace('SUKA SHAWARMA ', '')}</td>
                        <td className="py-3 px-6 text-right text-red-700 font-extrabold">{rupiah(o.nilai)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-suka-gray-100">
                <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Per Alasan</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
                      <th className="py-3 px-6">Alasan</th>
                      <th className="py-3 px-6 text-right">Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-gray-100 font-medium">
                    {byReason.length === 0 ? (
                      <tr><td colSpan={2} className="py-8 text-center text-suka-gray-400">Belum ada waste pada periode ini</td></tr>
                    ) : byReason.map(r => (
                      <tr key={r.reason}>
                        <td className="py-3 px-6 text-suka-ink font-bold">{r.reason}</td>
                        <td className="py-3 px-6 text-right text-red-700 font-extrabold">{rupiah(r.nilai)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-suka-gray-100">
              <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Bahan Baku Paling Sering Waste</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
                    <th className="py-3 px-6">Bahan Baku</th>
                    <th className="py-3 px-6 text-right">Qty</th>
                    <th className="py-3 px-6 text-right">Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-gray-100 font-medium">
                  {byBahan.length === 0 ? (
                    <tr><td colSpan={3} className="py-8 text-center text-suka-gray-400">Belum ada waste pada periode ini</td></tr>
                  ) : byBahan.map(b => (
                    <tr key={b.id}>
                      <td className="py-3 px-6 text-suka-ink font-bold">{b.name}</td>
                      <td className="py-3 px-6 text-right text-suka-gray-600">{b.qty}</td>
                      <td className="py-3 px-6 text-right text-red-700 font-extrabold">{rupiah(b.nilai)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/owner/waste/page.tsx
git commit -m "feat(waste): add waste analytics page for owner/admin"
```

---

### Task 10: Nav entry + role guard

**Files:**
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts`
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.test.ts`
- Modify: `apps/admin-dashboard/src/components/layout/RoleContext.tsx`

- [ ] **Step 1: Write the failing test**

Add to `navConfig.test.ts`:

```ts
describe('Kerugian Waste nav item', () => {
  it('OWNER dan ADMIN punya akses, MITRA dan ADMIN_HR tidak', () => {
    expect(accessibleItems('OWNER').map(i => i.href)).toContain('/dashboard/owner/waste')
    expect(accessibleItems('ADMIN').map(i => i.href)).toContain('/dashboard/owner/waste')
    expect(accessibleItems('MITRA').map(i => i.href)).not.toContain('/dashboard/owner/waste')
    expect(accessibleItems('ADMIN_HR').map(i => i.href)).not.toContain('/dashboard/owner/waste')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/admin-dashboard && yarn vitest run src/components/layout/navConfig.test.ts`
Expected: FAIL — `toContain('/dashboard/owner/waste')` not found.

- [ ] **Step 3: Add the nav item**

In `navConfig.ts`, in the `'Bisnis'` group's `items` array (`navConfig.ts:20-25`), add after the "Target & Pesan" item:

```ts
      { href: '/dashboard/owner/waste', label: 'Kerugian Waste', shortLabel: 'Waste', icon: TrendingDown, roles: ['OWNER', 'ADMIN'] },
```

(`TrendingDown` is already imported at `navConfig.ts:5`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/admin-dashboard && yarn vitest run src/components/layout/navConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Add route guard for MITRA in `RoleContext.tsx`**

`RoleContext.tsx` already redirects MITRA away from any path not in its allowed list (`RoleContext.tsx:68-73`) — `/dashboard/owner/waste` is not in that list, so MITRA is already blocked. No code change needed here; confirm by reading the `allowed` array still excludes it.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/components/layout/navConfig.ts apps/admin-dashboard/src/components/layout/navConfig.test.ts
git commit -m "feat(nav): add Kerugian Waste nav item for OWNER/ADMIN"
```

---

### Task 11: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

Run: `cd apps/admin-dashboard && yarn vitest run`
Expected: all tests pass (existing + new).

- [ ] **Step 2: Run type-check across the app**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 errors.

- [ ] **Step 3: Run build**

Run: `cd apps/admin-dashboard && yarn build`
Expected: build succeeds, `/dashboard/owner/waste` listed in the route output.

- [ ] **Step 4: Manual smoke test (requires a real waste report)**

1. In `apps/stok`, submit a waste report as crew (`WasteModal`) and approve it as SPV (`waste-approval` page) — or use an existing approved report.
2. In `apps/admin-dashboard`, log in as owner/admin, open `/dashboard/owner/profit`: confirm "Kerugian Waste" tile shows a non-zero value matching `qty × harga_beli_current / faktor_konversi` for that report, and Laba Bersih reflects the subtraction.
3. Open `/dashboard/owner/expenses`: confirm the same total appears in the read-only card (when target ≠ Pusat).
4. Open `/dashboard/owner/waste`: confirm the report appears in "Ranking per Outlet", "Per Alasan", "Bahan Baku Paling Sering Waste", and the trend chart.
5. Log in as a `mitra` test account: confirm `/dashboard/owner/waste` redirects to `/dashboard/owner`, and the Laba Bersih on `/dashboard/owner/profit` is reduced by the same waste amount (even though they can't see the breakdown).

- [ ] **Step 5: Update CLAUDE.md with a session summary**

Append a new `## Session 2026-07-14: Waste-COGS Integration` section to `CLAUDE.md` following the existing session-log format, summarizing what shipped (RPCs, hooks, 3 UI surfaces) and any manual next steps (redeploy `admin-dashboard`).

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: log waste-COGS integration session summary"
```

---

## Post-Plan (manual, not part of this plan)
- Redeploy `admin-dashboard` to production per the cPanel deploy steps in `CLAUDE.md` (build + restart Node app) so the changes go live on `admin-dashboard`'s subdomain.
