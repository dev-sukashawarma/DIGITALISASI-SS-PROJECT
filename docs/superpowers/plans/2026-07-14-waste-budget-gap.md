# Waste vs BOM Budget Gap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the existing `/dashboard/owner/waste` page, compare actual approved-waste value against the "Budget Loss" already allocated per recipe (`resep.buffer_amount × qty terjual`), and surface the variance as a Gap % (headline total + per-outlet table column).

**Architecture:** A new `SECURITY DEFINER` Postgres RPC (`get_budget_loss_periode`) mirrors `get_hpp_periode`'s sold-quantity-per-outlet CTE but sums `buffer_amount` instead of ingredient cost. A new hook (`useBudgetLoss`) wraps it, following the exact `useHpp`/`useWaste` pattern. A new pure function (`computeWasteGap`) computes the variance, returning `null` for the percentage when budget is 0 (rendered as "N/A"). The existing waste page wires all three together.

**Tech Stack:** Next.js App Router, Supabase Postgres (RPC), TanStack Query, Vitest.

---

### Task 1: Migration — `get_budget_loss_periode` RPC

**Files:**
- Create: `supabase/migrations/20260714110000_waste_budget_gap.sql`

- [ ] **Step 1: Write the RPC**

```sql
-- 20260714110000_waste_budget_gap.sql
-- "Budget Loss" per outlet untuk rentang periode: buffer_amount (kolom "Loss"
-- di resep, migration 20260707140000_cogs_card_display.sql) dikalikan qty
-- terjual per resep yang laku pada periode itu. Pola CTE identik
-- get_hpp_periode (20260708225000_hpp_teoritis_periode.sql), hanya beda
-- kalkulasi biaya: buffer_amount, bukan harga bahan baku.
-- Tidak ada guard owner/admin (sama seperti get_waste_periode) — hanya
-- scoping outlet standar via accessible_outlet_ids().

CREATE OR REPLACE FUNCTION get_budget_loss_periode(p_from date, p_to date)
RETURNS TABLE(outlet_id uuid, budget_loss numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH terjual AS (
    SELECT
      o.outlet_id,
      oi.menu_item_id::text AS menu_item_ref,
      SUM(oi.quantity) as total_qty
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status = 'completed'
      AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
      AND oi.menu_item_id IS NOT NULL
    GROUP BY o.outlet_id, oi.menu_item_id
  ),
  resep_terpilih AS (
    SELECT DISTINCT ON (t.outlet_id, t.menu_item_ref)
      t.outlet_id,
      t.menu_item_ref,
      t.total_qty,
      r.id AS resep_id,
      r.buffer_amount
    FROM terjual t
    JOIN resep r ON r.menu_item_ref = t.menu_item_ref
    WHERE r.is_active = true
      AND ( (r.scope = 'outlet' AND r.outlet_id = t.outlet_id) OR (r.scope = 'global') )
    ORDER BY t.outlet_id, t.menu_item_ref,
      CASE WHEN r.scope = 'outlet' THEN 1 ELSE 2 END
  ),
  budget_per_outlet AS (
    SELECT outlet_id, SUM(total_qty * buffer_amount) AS total_budget
    FROM resep_terpilih
    GROUP BY outlet_id
  )
  SELECT
    o.id AS outlet_id,
    COALESCE(bp.total_budget, 0) AS budget_loss
  FROM outlets o
  LEFT JOIN budget_per_outlet bp ON bp.outlet_id = o.id
  WHERE o.id IN (SELECT public.accessible_outlet_ids());
$$;

GRANT EXECUTE ON FUNCTION get_budget_loss_periode(date, date) TO authenticated;
```

- [ ] **Step 2: Push migration to remote and verify**

Run: `supabase db push`
Expected: migration `20260714110000_waste_budget_gap` listed as applied. If `db push` complains about a later-timestamped migration already applied (this has happened before in this repo — check `supabase migration list` first), use `supabase db push --include-all` and confirm only this one file appears in the push confirmation before proceeding — do NOT apply anything else.

Run (verify function exists and is `SECURITY DEFINER`):
```sql
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'get_budget_loss_periode';
```
If no way to run this query directly against the remote DB exists in your environment, it's acceptable to confirm via `supabase migration list` showing the migration applied remotely — note this in your report.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260714110000_waste_budget_gap.sql
git commit -m "feat(db): add get_budget_loss_periode RPC for BOM loss allocation"
```

---

### Task 2: `computeWasteGap` pure function (TDD)

**Files:**
- Create: `apps/admin-dashboard/src/lib/wasteGap.ts`
- Test: `apps/admin-dashboard/src/lib/wasteGap.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/admin-dashboard/src/lib/wasteGap.test.ts
import { describe, it, expect } from 'vitest'
import { computeWasteGap } from './wasteGap'

describe('computeWasteGap', () => {
  it('actual melebihi budget: gap positif (over-budget)', () => {
    const r = computeWasteGap(150_000, 100_000)
    expect(r.actual).toBe(150_000)
    expect(r.budget).toBe(100_000)
    expect(r.gapPct).toBeCloseTo(50, 5) // (150k-100k)/100k * 100
  })

  it('actual di bawah budget: gap negatif (efisien)', () => {
    const r = computeWasteGap(60_000, 100_000)
    expect(r.gapPct).toBeCloseTo(-40, 5) // (60k-100k)/100k * 100
  })

  it('actual sama dengan budget: gap 0', () => {
    const r = computeWasteGap(100_000, 100_000)
    expect(r.gapPct).toBe(0)
  })

  it('budget 0: gapPct null (N/A) terlepas dari nilai actual', () => {
    expect(computeWasteGap(50_000, 0).gapPct).toBeNull()
    expect(computeWasteGap(0, 0).gapPct).toBeNull()
  })

  it('actual 0, budget > 0: gap -100% (tidak ada waste sama sekali)', () => {
    const r = computeWasteGap(0, 100_000)
    expect(r.gapPct).toBeCloseTo(-100, 5)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/wasteGap.test.ts`
Expected: FAIL — `Cannot find module './wasteGap'`.

- [ ] **Step 3: Implement**

```ts
// apps/admin-dashboard/src/lib/wasteGap.ts
// Bandingkan nilai waste aktual (approved) terhadap "Budget Loss" — alokasi
// Rp yang sudah ditanam di BOM (resep.buffer_amount x qty terjual). Budget=0
// (resep belum diisi Loss, atau tak ada penjualan matching di periode itu)
// membuat gap tak bermakna secara matematis -> gapPct null, UI render "N/A".

export interface WasteGap {
  actual: number
  budget: number
  gapPct: number | null
}

export function computeWasteGap(actual: number, budget: number): WasteGap {
  return {
    actual,
    budget,
    gapPct: budget > 0 ? ((actual - budget) / budget) * 100 : null,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/wasteGap.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/wasteGap.ts apps/admin-dashboard/src/lib/wasteGap.test.ts
git commit -m "feat(waste): add computeWasteGap pure function for BOM budget variance"
```

---

### Task 3: `useBudgetLoss` hook

**Files:**
- Create: `apps/admin-dashboard/src/hooks/useBudgetLoss.ts`

- [ ] **Step 1: Write the hook**

```ts
// apps/admin-dashboard/src/hooks/useBudgetLoss.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'

export interface BudgetLossRow {
  outlet_id: string
  budget_loss: number
}

// Budget Loss (alokasi BOM) per outlet untuk rentang periode, dari
// get_budget_loss_periode (scoped ke outlet yang boleh diakses pemanggil,
// sama pola dgn useHpp/useWaste).
export function useBudgetLoss(filter: PeriodFilterValue) {
  const supabase = createClient()
  const query = useQuery<BudgetLossRow[]>({
    queryKey: ['budget_loss', filter.from, filter.to, filter.outletId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_budget_loss_periode', {
        p_from: filter.from,
        p_to: filter.to,
      })
      if (error) throw error
      let rows: BudgetLossRow[] = (data ?? []).map((r: any) => ({
        outlet_id: r.outlet_id as string,
        budget_loss: Number(r.budget_loss),
      }))
      if (filter.outletId !== 'all') rows = rows.filter((r: BudgetLossRow) => r.outlet_id === filter.outletId)
      return rows
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 new errors traced to this file (pre-existing unrelated errors in other dirty files, e.g. `BahanBakuDetailModal.tsx`, are not your concern).

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useBudgetLoss.ts
git commit -m "feat(hooks): add useBudgetLoss hook for BOM loss allocation totals"
```

---

### Task 4: Wire Budget Loss + Gap % into the waste analytics page

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/owner/waste/page.tsx`

The current file (read it fresh before editing — line numbers below are from the version at plan-writing time):

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
  ...
```

### Edit 1 — imports

Add after the existing imports:
```tsx
import { useBudgetLoss } from '@/hooks/useBudgetLoss'
import { computeWasteGap } from '@/lib/wasteGap'
import { Target } from 'lucide-react'
```

### Edit 2 — call the hook, fold into loading/error

Find:
```tsx
  const { rows, loading, error } = useWasteBreakdown(filter)
```
Change to:
```tsx
  const { rows, loading, error } = useWasteBreakdown(filter)
  const budgetLoss = useBudgetLoss(filter)
```

Since `loading`/`error` aren't combined into new variables on this page today (the page directly uses `loading`/`error` from `useWasteBreakdown`), rename for clarity and combine. Replace all three lines (`const { rows, loading, error } = ...` plus the two new lines above) with:

```tsx
  const { rows, loading: wasteLoading, error: wasteError } = useWasteBreakdown(filter)
  const budgetLoss = useBudgetLoss(filter)
  const loading = wasteLoading || budgetLoss.loading
  const error = wasteError || budgetLoss.error
```

### Edit 3 — compute totals and gap

Find:
```tsx
  const totalNilai = useMemo(() => rows.reduce((s, r) => s + r.nilai, 0), [rows])
  const byOutlet = useMemo(() => aggregateByOutlet(rows), [rows])
  const byReason = useMemo(() => aggregateByReason(rows), [rows])
  const byBahan = useMemo(() => aggregateByBahan(rows), [rows])
  const byDate = useMemo(() => aggregateByDate(rows), [rows])
```
Add directly after it:
```tsx
  const totalBudget = useMemo(() => budgetLoss.rows.reduce((s, r) => s + r.budget_loss, 0), [budgetLoss.rows])
  const gap = useMemo(() => computeWasteGap(totalNilai, totalBudget), [totalNilai, totalBudget])
  const budgetByOutlet = useMemo(() => {
    const map = new Map<string, number>()
    budgetLoss.rows.forEach(r => map.set(r.outlet_id, r.budget_loss))
    return map
  }, [budgetLoss.rows])
```

### Edit 4 — headline: 4-tile grid with Budget Loss + Gap %

Find:
```tsx
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              label="Total Kerugian Waste"
              value={<><span className="text-lg align-top">Rp </span><CountUp end={totalNilai} duration={1} separator="." /></>}
              sub="Approved, periode terpilih"
              icon={TrendingDown}
              accent="red"
            />
          </div>
```
Replace with:
```tsx
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile
              label="Total Kerugian Waste"
              value={<><span className="text-lg align-top">Rp </span><CountUp end={totalNilai} duration={1} separator="." /></>}
              sub="Approved, periode terpilih"
              icon={TrendingDown}
              accent="red"
            />
            <StatTile
              label="Budget Loss (BOM)"
              value={<><span className="text-lg align-top">Rp </span><CountUp end={totalBudget} duration={1} separator="." /></>}
              sub="Alokasi Loss dari resep x qty terjual"
              icon={Target}
              accent="brown"
            />
            <StatTile
              label="Gap %"
              value={gap.gapPct === null ? 'N/A' : <><CountUp end={gap.gapPct} duration={1} decimals={1} /> %</>}
              sub={gap.gapPct === null ? 'Belum ada budget pada periode ini' : gap.gapPct > 0 ? 'Waste melebihi alokasi BOM' : 'Di bawah alokasi BOM'}
              icon={TrendingDown}
              accent={gap.gapPct === null ? 'brown' : gap.gapPct > 0 ? 'red' : 'green'}
            />
          </div>
```

Note: this leaves 3 tiles in a `lg:grid-cols-4` grid (asymmetric on large screens) — acceptable for now, matches the spec's "2 new StatTiles" requirement without inventing a 4th filler tile.

### Edit 5 — "Ranking per Outlet" table gains Budget Loss + Gap % columns

Find the "Ranking per Outlet" table header:
```tsx
                    <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
                      <th className="py-3 px-6">Outlet</th>
                      <th className="py-3 px-6 text-right">Nilai</th>
                    </tr>
```
Change to:
```tsx
                    <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
                      <th className="py-3 px-6">Outlet</th>
                      <th className="py-3 px-6 text-right">Nilai</th>
                      <th className="py-3 px-6 text-right">Budget Loss</th>
                      <th className="py-3 px-6 text-right">Gap %</th>
                    </tr>
```

Find the row rendering:
```tsx
                    {byOutlet.length === 0 ? (
                      <tr><td colSpan={2} className="py-8 text-center text-suka-gray-400">Belum ada waste pada periode ini</td></tr>
                    ) : byOutlet.map(o => (
                      <tr key={o.id}>
                        <td className="py-3 px-6 text-suka-ink font-bold">{o.name.replace('SUKA SHAWARMA ', '')}</td>
                        <td className="py-3 px-6 text-right text-red-700 font-extrabold">{rupiah(o.nilai)}</td>
                      </tr>
                    ))}
```
Change to:
```tsx
                    {byOutlet.length === 0 ? (
                      <tr><td colSpan={4} className="py-8 text-center text-suka-gray-400">Belum ada waste pada periode ini</td></tr>
                    ) : byOutlet.map(o => {
                      const budget = budgetByOutlet.get(o.id) ?? 0
                      const rowGap = computeWasteGap(o.nilai, budget)
                      return (
                        <tr key={o.id}>
                          <td className="py-3 px-6 text-suka-ink font-bold">{o.name.replace('SUKA SHAWARMA ', '')}</td>
                          <td className="py-3 px-6 text-right text-red-700 font-extrabold">{rupiah(o.nilai)}</td>
                          <td className="py-3 px-6 text-right text-suka-gray-600">{rupiah(budget)}</td>
                          <td className={`py-3 px-6 text-right font-bold ${rowGap.gapPct === null ? 'text-suka-gray-400' : rowGap.gapPct > 0 ? 'text-red-700' : 'text-suka-green'}`}>
                            {rowGap.gapPct === null ? 'N/A' : `${rowGap.gapPct.toFixed(1)}%`}
                          </td>
                        </tr>
                      )
                    })}
```

## Steps
1. Read the live file first (content may have drifted from the reference above by a few lines — apply edits by matching the surrounding code, not by line number).
2. Apply all 5 edits.
3. Run `cd apps/admin-dashboard && yarn type-check` — confirm no new errors traced to this file (pre-existing unrelated errors in other dirty files are not your concern).
4. Commit:
```bash
git add apps/admin-dashboard/src/app/dashboard/owner/waste/page.tsx
git commit -m "feat(waste): surface Budget Loss (BOM) and Gap % on waste analytics page"
```
5. Self-review: re-read the final file, confirm all 5 edits are present, `computeWasteGap` is imported and used both for the headline `gap` and per-row in the outlet table, `colSpan` on the empty-state row was bumped from 2 to 4, no leftover references to the old 3-column grid or old table header.

## Report format
DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED, summary, exact git commit SHA, confirmation of type-check result.

---

### Task 5: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

Run: `cd apps/admin-dashboard && yarn vitest run`
Expected: all tests pass except the known pre-existing `navConfig.test.ts` failures (7 failures, unrelated nav-group drift — confirmed baseline in the prior waste-COGS integration work on this same branch). No new failures.

- [ ] **Step 2: Run type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 errors in any file touched by this plan (`wasteGap.ts`, `useBudgetLoss.ts`, `waste/page.tsx`, migration file has no TS). Pre-existing errors in `BahanBakuDetailModal.tsx`/`BahanBakuTable.tsx`/`bahanBaku.test.ts` are not this plan's concern.

- [ ] **Step 3: Run build**

Run: `cd apps/admin-dashboard && yarn build`
Expected: build succeeds.

- [ ] **Step 4: Static consistency check**

Re-read `apps/admin-dashboard/src/app/dashboard/owner/waste/page.tsx` in full and confirm:
- `useBudgetLoss`'s return shape (`{rows: {outlet_id, budget_loss}[], loading, error}`) matches how it's destructured and used.
- `computeWasteGap`'s return shape (`{actual, budget, gapPct}`) matches how `gap.gapPct` and `rowGap.gapPct` are accessed (including the `null` check before arithmetic/formatting).
- The `Target` icon import from `lucide-react` is actually used (in the "Budget Loss (BOM)" StatTile) and not a duplicate of an existing import.

- [ ] **Step 5: Update CLAUDE.md**

Append a new `## Session 2026-07-14: Waste vs BOM Budget Gap (apps/admin-dashboard)` section to `CLAUDE.md` (root of the repo, inside this worktree — do NOT write to a path outside the worktree), following the existing session-log format. Cover: what was added (Budget Loss RPC + Gap % on the waste page), the formula, the N/A edge case, and note this depends on the waste-COGS integration session logged directly above it. End with a 📝 Next section: merge branch, redeploy `admin-dashboard`, manual smoke test (fill in `buffer_amount` for a resep with real sales in the test period, confirm Budget Loss > 0 and Gap % is numeric).

Commit:
```bash
git add CLAUDE.md
git commit -m "docs: log waste-vs-BOM-budget gap session summary"
```

## Report format
A clear PASS/FAIL summary for steps 1-4, and confirmation of the CLAUDE.md commit SHA for step 5.

---

## Post-Plan (manual, not part of this plan)
- Redeploy `admin-dashboard` to production per the cPanel deploy steps in `CLAUDE.md`.
- Manual smoke test: set `buffer_amount` ("Loss") on a resep with real sales volume in the test date range via the Manajemen Resep page, then check `/dashboard/owner/waste` shows Budget Loss > 0 and a numeric Gap %.
