# Rekap Bulanan (Business Report per Channel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Rekap Bulanan" report page to `apps/admin-dashboard` under the **Bisnis** nav group, showing a per-outlet × per-channel (Offline/Online/Food Apps/TikTok Go) matrix of Revenue, Gross Profit, and PCS for a chosen calendar month, plus Opex (Outlet/Gaji/Total) and Total Gross Profit per outlet — automating a report currently maintained by hand in Google Sheets.

**Architecture:** One new DB migration adds an RPC (`get_hpp_periode_by_channel`) that mirrors the existing `get_hpp_periode` but groups by `sales_source` too. The revenue side and PCS side already have channel-level data in existing views (`sales_daily_scoped`, `menu_sales_scoped`) — two small new hooks read from these. All merging/math lives in a pure, unit-tested function (`buildBusinessReportRows`) that combines four data sources (sales, HPP-by-channel, PCS-by-channel, expenses) into per-outlet rows + a TOTAL row. The page component is a thin composition layer (hooks in, pure function, table out), following the same pattern as `owner/profit/page.tsx` and `owner/waste/page.tsx`.

**Tech Stack:** Next.js App Router (client component), TanStack React Query, Supabase (Postgres RPC + views), Vitest, Tailwind (suka-* design tokens).

**Spec:** `docs/superpowers/specs/2026-07-20-rekap-bulanan-business-report-design.md`

---

## Task 1: Migration — `get_hpp_periode_by_channel` RPC

**Files:**
- Create: `supabase/migrations/20260720100000_hpp_periode_by_channel.sql`

- [ ] **Step 1: Check for remote migration drift before touching anything**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && supabase migration list`

This project's remote DB is shared with other developers and has a history of drift (see `CLAUDE.md` "Riwayat migration history"). Just eyeball the output — if `Local` and `Remote` columns are already out of sync (missing entries on either side) **stop and flag it to the user** instead of pushing on top of an unreconciled history. If they match up to the latest known migration, continue.

- [ ] **Step 2: Write the migration file**

```sql
-- supabase/migrations/20260720100000_hpp_periode_by_channel.sql
-- RPC HPP per outlet x sales_source (channel), turunan dari get_hpp_periode
-- (20260708225000_hpp_teoritis_periode.sql) dengan sales_source ditambahkan
-- ke grouping. Dipakai oleh laporan "Rekap Bulanan" (per outlet x channel).

CREATE OR REPLACE FUNCTION get_hpp_periode_by_channel(p_from date, p_to date)
RETURNS TABLE(outlet_id uuid, sales_source text, hpp numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH terjual AS (
    SELECT
      o.outlet_id,
      o.sales_source,
      oi.menu_item_id::text AS menu_item_ref,
      SUM(oi.quantity) as total_qty
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status = 'completed'
      AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
      AND oi.menu_item_id IS NOT NULL
    GROUP BY o.outlet_id, o.sales_source, oi.menu_item_id
  ),
  resep_terpilih AS (
    SELECT DISTINCT ON (t.outlet_id, t.sales_source, t.menu_item_ref)
      t.outlet_id,
      t.sales_source,
      t.menu_item_ref,
      t.total_qty,
      r.id AS resep_id
    FROM terjual t
    JOIN resep r ON r.menu_item_ref = t.menu_item_ref
    WHERE r.is_active = true
      AND ( (r.scope = 'outlet' AND r.outlet_id = t.outlet_id) OR (r.scope = 'global') )
    ORDER BY t.outlet_id, t.sales_source, t.menu_item_ref,
      CASE WHEN r.scope = 'outlet' THEN 1 ELSE 2 END
  ),
  hpp_per_item AS (
    SELECT
      rt.outlet_id,
      rt.sales_source,
      rt.total_qty * (ri.qty_per_porsi / COALESCE(b.faktor_konversi, 1)) * COALESCE(bh.harga_beli, 0) AS biaya_bahan
    FROM resep_terpilih rt
    JOIN resep_item ri ON ri.resep_id = rt.resep_id
    JOIN bahan_baku b ON b.id = ri.bahan_baku_id
    LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = ri.bahan_baku_id
  )
  SELECT
    hpp_per_item.outlet_id,
    hpp_per_item.sales_source,
    SUM(hpp_per_item.biaya_bahan) AS hpp
  FROM hpp_per_item
  WHERE hpp_per_item.outlet_id IN (SELECT public.accessible_outlet_ids())
  GROUP BY hpp_per_item.outlet_id, hpp_per_item.sales_source;
$$;

GRANT EXECUTE ON FUNCTION get_hpp_periode_by_channel(date, date) TO authenticated;
```

- [ ] **Step 3: Push the migration**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && supabase db push`

Expected: output lists `20260720100000_hpp_periode_by_channel.sql` as applied, no errors.

- [ ] **Step 4: Verify ground-truth in the live DB (don't trust `migration list` alone — see CLAUDE.md precedent)**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && supabase db query "SELECT proname, prosecdef FROM pg_proc WHERE proname = 'get_hpp_periode_by_channel';" --linked`

Expected: one row, `proname = get_hpp_periode_by_channel`, `prosecdef = t`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260720100000_hpp_periode_by_channel.sql
git commit -m "feat(admin-dashboard): add get_hpp_periode_by_channel RPC for per-channel HPP"
```

---

## Task 2: `groupChannel` pure function

**Files:**
- Create: `apps/admin-dashboard/src/lib/channelGroups.ts`
- Test: `apps/admin-dashboard/src/lib/channelGroups.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/admin-dashboard/src/lib/channelGroups.test.ts
import { describe, it, expect } from 'vitest'
import { groupChannel } from './channelGroups'

describe('groupChannel', () => {
  it('pos -> offline', () => {
    expect(groupChannel('pos')).toBe('offline')
  })
  it('online -> online', () => {
    expect(groupChannel('online')).toBe('online')
  })
  it('gofood, shopeefood, grabfood -> foodapps', () => {
    expect(groupChannel('gofood')).toBe('foodapps')
    expect(groupChannel('shopeefood')).toBe('foodapps')
    expect(groupChannel('grabfood')).toBe('foodapps')
  })
  it('tiktok -> tiktok', () => {
    expect(groupChannel('tiktok')).toBe('tiktok')
  })
  it('nilai tak dikenal -> fallback offline (konsisten dengan default POS Kasir di resolveOrderSource)', () => {
    expect(groupChannel('entah-apa')).toBe('offline')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn vitest run src/lib/channelGroups.test.ts`
Expected: FAIL — `Failed to resolve import "./channelGroups"` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/admin-dashboard/src/lib/channelGroups.ts
import type { SalesSource } from './types'

export type ChannelGroup = 'offline' | 'online' | 'foodapps' | 'tiktok'

const MAP: Record<SalesSource, ChannelGroup> = {
  pos: 'offline',
  online: 'online',
  gofood: 'foodapps',
  shopeefood: 'foodapps',
  grabfood: 'foodapps',
  tiktok: 'tiktok',
}

/** Kelompokkan sales_source jadi 4 grup channel untuk laporan Rekap Bulanan. Nilai tak dikenal jatuh ke 'offline' (sama seperti default POS Kasir di resolveOrderSource). */
export function groupChannel(salesSource: string): ChannelGroup {
  return MAP[salesSource as SalesSource] ?? 'offline'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn vitest run src/lib/channelGroups.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/channelGroups.ts apps/admin-dashboard/src/lib/channelGroups.test.ts
git commit -m "feat(admin-dashboard): add groupChannel pure function"
```

---

## Task 3: `monthRange` helper

**Files:**
- Modify: `apps/admin-dashboard/src/lib/period.ts`
- Modify: `apps/admin-dashboard/src/lib/period.test.ts`

- [ ] **Step 1: Write the failing test**

In `apps/admin-dashboard/src/lib/period.test.ts`, replace line 1-2:

```typescript
import { describe, it, expect } from 'vitest'
import { presetRange, previousRange } from './period'
```

with:

```typescript
import { describe, it, expect } from 'vitest'
import { presetRange, previousRange, monthRange } from './period'
```

Then append at the end of the file:

```typescript
describe('monthRange', () => {
  it('Juli 2026 (31 hari)', () => {
    expect(monthRange(2026, 7)).toEqual({ from: '2026-07-01', to: '2026-07-31' })
  })
  it('Februari 2026, bukan tahun kabisat (28 hari)', () => {
    expect(monthRange(2026, 2)).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })
  it('Februari 2024, tahun kabisat (29 hari)', () => {
    expect(monthRange(2024, 2)).toEqual({ from: '2024-02-01', to: '2024-02-29' })
  })
  it('Januari (padding bulan single-digit)', () => {
    expect(monthRange(2026, 1)).toEqual({ from: '2026-01-01', to: '2026-01-31' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn vitest run src/lib/period.test.ts`
Expected: FAIL — `monthRange is not a function` / import error.

- [ ] **Step 3: Write minimal implementation**

Append to `apps/admin-dashboard/src/lib/period.ts`:

```typescript
/** Rentang tanggal 1 bulan kalender penuh. `month` 1-indexed (1=Januari). */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn vitest run src/lib/period.test.ts`
Expected: PASS, all tests including the pre-existing 2.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/period.ts apps/admin-dashboard/src/lib/period.test.ts
git commit -m "feat(admin-dashboard): add monthRange helper for calendar-month periods"
```

---

## Task 4: `buildBusinessReportRows` pure function

**Files:**
- Create: `apps/admin-dashboard/src/lib/businessReport.ts`
- Test: `apps/admin-dashboard/src/lib/businessReport.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/admin-dashboard/src/lib/businessReport.test.ts
import { describe, it, expect } from 'vitest'
import { buildBusinessReportRows } from './businessReport'

const OUTLETS = [{ id: 'o1', name: 'Outlet 1' }]

describe('buildBusinessReportRows', () => {
  it('channel tanpa transaksi menghasilkan 0, bukan NaN/undefined', () => {
    const { rows } = buildBusinessReportRows(
      OUTLETS,
      [{ outlet_id: 'o1', sales_source: 'pos', omzet: 100_000 }],
      [{ outlet_id: 'o1', sales_source: 'pos', hpp: 40_000 }],
      [{ outlet_id: 'o1', sales_source: 'pos', pcs: 10 }],
      [],
    )
    expect(rows[0].offline).toEqual({ revenue: 100_000, gp: 60_000, pcs: 10 })
    expect(rows[0].online).toEqual({ revenue: 0, gp: 0, pcs: 0 })
    expect(rows[0].foodapps).toEqual({ revenue: 0, gp: 0, pcs: 0 })
    expect(rows[0].tiktok).toEqual({ revenue: 0, gp: 0, pcs: 0 })
  })

  it('Total Gross Profit bisa negatif kalau Opex melebihi Total Performance GP', () => {
    const { rows } = buildBusinessReportRows(
      OUTLETS,
      [{ outlet_id: 'o1', sales_source: 'pos', omzet: 50_000 }],
      [{ outlet_id: 'o1', sales_source: 'pos', hpp: 20_000 }],
      [],
      [{ outlet_id: 'o1', category: 'sewa_outlet', scope: 'outlet', amount: 100_000 }],
    )
    // GP = 50_000 - 20_000 = 30_000; Opex = 100_000; Total GP = 30_000 - 100_000 = -70_000
    expect(rows[0].totalPerformance.gp).toBe(30_000)
    expect(rows[0].opexTotal).toBe(100_000)
    expect(rows[0].totalGrossProfit).toBe(-70_000)
  })

  it('kategori gaji_crew_outlet masuk opexSalary, kategori lain masuk opexOutlet', () => {
    const { rows } = buildBusinessReportRows(
      OUTLETS,
      [],
      [],
      [],
      [
        { outlet_id: 'o1', category: 'gaji_crew_outlet', scope: 'outlet', amount: 5_000 },
        { outlet_id: 'o1', category: 'pln', scope: 'outlet', amount: 2_000 },
      ],
    )
    expect(rows[0].opexSalary).toBe(5_000)
    expect(rows[0].opexOutlet).toBe(2_000)
    expect(rows[0].opexTotal).toBe(7_000)
  })

  it('expense scope pusat (outlet_id null) tidak dibebankan ke outlet manapun', () => {
    const { rows } = buildBusinessReportRows(
      OUTLETS,
      [],
      [],
      [],
      [{ outlet_id: null, category: 'gaji_staff_kantor', scope: 'pusat', amount: 99_999 }],
    )
    expect(rows[0].opexOutlet).toBe(0)
    expect(rows[0].opexSalary).toBe(0)
  })

  it('baris TOTAL menjumlahkan seluruh outlet per kolom', () => {
    const outlets = [{ id: 'o1', name: 'Outlet 1' }, { id: 'o2', name: 'Outlet 2' }]
    const { rows, total } = buildBusinessReportRows(
      outlets,
      [
        { outlet_id: 'o1', sales_source: 'pos', omzet: 100_000 },
        { outlet_id: 'o2', sales_source: 'online', omzet: 50_000 },
      ],
      [
        { outlet_id: 'o1', sales_source: 'pos', hpp: 40_000 },
        { outlet_id: 'o2', sales_source: 'online', hpp: 10_000 },
      ],
      [],
      [],
    )
    expect(total.offline.revenue).toBe(100_000)
    expect(total.online.revenue).toBe(50_000)
    expect(total.totalGrossProfit).toBe(rows[0].totalGrossProfit + rows[1].totalGrossProfit)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn vitest run src/lib/businessReport.test.ts`
Expected: FAIL — `Failed to resolve import "./businessReport"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/admin-dashboard/src/lib/businessReport.ts
import { groupChannel, type ChannelGroup } from './channelGroups'

export interface ChannelMetrics {
  revenue: number
  gp: number
  pcs: number
}

export interface BusinessReportRow {
  outletId: string
  outletName: string
  offline: ChannelMetrics
  online: ChannelMetrics
  foodapps: ChannelMetrics
  tiktok: ChannelMetrics
  totalPerformance: ChannelMetrics
  opexOutlet: number
  opexSalary: number
  opexTotal: number
  totalGrossProfit: number
}

interface ChannelAccum { revenue: number; hpp: number; pcs: number }

function emptyAccums(): Record<ChannelGroup, ChannelAccum> {
  return {
    offline: { revenue: 0, hpp: 0, pcs: 0 },
    online: { revenue: 0, hpp: 0, pcs: 0 },
    foodapps: { revenue: 0, hpp: 0, pcs: 0 },
    tiktok: { revenue: 0, hpp: 0, pcs: 0 },
  }
}

function toMetrics(a: ChannelAccum): ChannelMetrics {
  return { revenue: a.revenue, gp: a.revenue - a.hpp, pcs: a.pcs }
}

function sumMetrics(a: ChannelMetrics, b: ChannelMetrics): ChannelMetrics {
  return { revenue: a.revenue + b.revenue, gp: a.gp + b.gp, pcs: a.pcs + b.pcs }
}

const EMPTY_METRICS: ChannelMetrics = { revenue: 0, gp: 0, pcs: 0 }

/**
 * Gabungkan Revenue (sales), HPP per-channel, PCS per-channel, dan Opex (expenses)
 * jadi matriks per outlet x channel group untuk halaman Rekap Bulanan.
 * Formula: GP channel = Revenue - HPP; Total Gross Profit = Sigma GP semua channel - Total Opex.
 */
export function buildBusinessReportRows(
  outlets: { id: string; name: string }[],
  salesRows: { outlet_id: string; sales_source: string; omzet: number }[],
  hppByChannelRows: { outlet_id: string; sales_source: string; hpp: number }[],
  pcsRows: { outlet_id: string; sales_source: string; pcs: number }[],
  expenseRows: { outlet_id: string | null; category: string; scope: string; amount: number }[],
): { rows: BusinessReportRow[]; total: BusinessReportRow } {
  const byOutlet = new Map<string, { name: string; accums: Record<ChannelGroup, ChannelAccum>; opexOutlet: number; opexSalary: number }>()

  const ensure = (id: string, name: string) => {
    let cur = byOutlet.get(id)
    if (!cur) {
      cur = { name, accums: emptyAccums(), opexOutlet: 0, opexSalary: 0 }
      byOutlet.set(id, cur)
    }
    return cur
  }

  outlets.forEach((o) => ensure(o.id, o.name))

  salesRows.forEach((r) => {
    const cur = ensure(r.outlet_id, r.outlet_id)
    cur.accums[groupChannel(r.sales_source)].revenue += r.omzet
  })

  hppByChannelRows.forEach((r) => {
    const cur = ensure(r.outlet_id, r.outlet_id)
    cur.accums[groupChannel(r.sales_source)].hpp += r.hpp
  })

  pcsRows.forEach((r) => {
    const cur = ensure(r.outlet_id, r.outlet_id)
    cur.accums[groupChannel(r.sales_source)].pcs += r.pcs
  })

  expenseRows.forEach((r) => {
    if (r.scope !== 'outlet' || !r.outlet_id) return // Pengeluaran Pusat tak dibebankan ke outlet manapun
    const cur = ensure(r.outlet_id, r.outlet_id)
    if (r.category === 'gaji_crew_outlet') cur.opexSalary += r.amount
    else cur.opexOutlet += r.amount
  })

  const rows: BusinessReportRow[] = [...byOutlet.entries()].map(([id, val]) => {
    const offline = toMetrics(val.accums.offline)
    const online = toMetrics(val.accums.online)
    const foodapps = toMetrics(val.accums.foodapps)
    const tiktok = toMetrics(val.accums.tiktok)
    const totalPerformance = [offline, online, foodapps, tiktok].reduce(sumMetrics, EMPTY_METRICS)
    const opexTotal = val.opexOutlet + val.opexSalary
    return {
      outletId: id,
      outletName: val.name,
      offline,
      online,
      foodapps,
      tiktok,
      totalPerformance,
      opexOutlet: val.opexOutlet,
      opexSalary: val.opexSalary,
      opexTotal,
      totalGrossProfit: totalPerformance.gp - opexTotal,
    }
  })

  const total: BusinessReportRow = rows.reduce<BusinessReportRow>(
    (acc, r) => ({
      outletId: 'total',
      outletName: 'TOTAL',
      offline: sumMetrics(acc.offline, r.offline),
      online: sumMetrics(acc.online, r.online),
      foodapps: sumMetrics(acc.foodapps, r.foodapps),
      tiktok: sumMetrics(acc.tiktok, r.tiktok),
      totalPerformance: sumMetrics(acc.totalPerformance, r.totalPerformance),
      opexOutlet: acc.opexOutlet + r.opexOutlet,
      opexSalary: acc.opexSalary + r.opexSalary,
      opexTotal: acc.opexTotal + r.opexTotal,
      totalGrossProfit: acc.totalGrossProfit + r.totalGrossProfit,
    }),
    {
      outletId: 'total',
      outletName: 'TOTAL',
      offline: EMPTY_METRICS,
      online: EMPTY_METRICS,
      foodapps: EMPTY_METRICS,
      tiktok: EMPTY_METRICS,
      totalPerformance: EMPTY_METRICS,
      opexOutlet: 0,
      opexSalary: 0,
      opexTotal: 0,
      totalGrossProfit: 0,
    },
  )

  return { rows, total }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn vitest run src/lib/businessReport.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/businessReport.ts apps/admin-dashboard/src/lib/businessReport.test.ts
git commit -m "feat(admin-dashboard): add buildBusinessReportRows pure aggregation function"
```

---

## Task 5: `useHppByChannel` hook

**Files:**
- Create: `apps/admin-dashboard/src/hooks/useHppByChannel.ts`

No unit test — this codebase does not unit-test Supabase-fetching hooks (see `apps/admin-dashboard/src/hooks/useHpp.ts` for the pattern being mirrored; existing hook tests like `useOutletMutations.test.tsx.skip` are disabled due to a React-version dedup issue in this workspace). Verified via `type-check` (Task 9) and manual smoke test.

- [ ] **Step 1: Write the hook**

```typescript
// apps/admin-dashboard/src/hooks/useHppByChannel.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export interface HppByChannelRow {
  outlet_id: string
  sales_source: string
  hpp: number
}

// HPP per outlet x sales_source untuk rentang periode, dari fungsi DB
// get_hpp_periode_by_channel (scoped ke outlet yang boleh diakses pemanggil).
export function useHppByChannel(from: string, to: string) {
  const supabase = createClient()
  const query = useQuery<HppByChannelRow[]>({
    queryKey: ['hpp-by-channel', from, to],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_hpp_periode_by_channel', {
        p_from: from,
        p_to: to,
      })
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        outlet_id: r.outlet_id as string,
        sales_source: r.sales_source as string,
        hpp: Number(r.hpp),
      }))
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
```

- [ ] **Step 2: Type-check**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check`
Expected: no new errors introduced by this file (pre-existing unrelated errors in BOM files, if any, are out of scope — see spec's "Next" notes in `CLAUDE.md` session history).

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useHppByChannel.ts
git commit -m "feat(admin-dashboard): add useHppByChannel hook"
```

---

## Task 6: `usePcsByChannel` hook

**Files:**
- Create: `apps/admin-dashboard/src/hooks/usePcsByChannel.ts`

- [ ] **Step 1: Write the hook**

```typescript
// apps/admin-dashboard/src/hooks/usePcsByChannel.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export interface PcsByChannelRow {
  outlet_id: string
  sales_source: string
  pcs: number
}

// PCS (qty item terjual) per outlet x sales_source, diagregasi client-side dari
// view menu_sales_scoped (sudah punya kolom outlet_id/sales_source/qty) — tanpa
// perlu RPC/migration baru.
export function usePcsByChannel(from: string, to: string) {
  const supabase = createClient()
  const query = useQuery<PcsByChannelRow[]>({
    queryKey: ['pcs-by-channel', from, to],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_sales_scoped')
        .select('outlet_id, sales_source, qty')
        .gte('sales_date', from)
        .lte('sales_date', to)
      if (error) throw error
      const map = new Map<string, PcsByChannelRow>()
      for (const r of (data ?? []) as any[]) {
        const key = `${r.outlet_id}__${r.sales_source}`
        const cur = map.get(key) ?? { outlet_id: r.outlet_id, sales_source: r.sales_source, pcs: 0 }
        cur.pcs += Number(r.qty)
        map.set(key, cur)
      }
      return [...map.values()]
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
```

- [ ] **Step 2: Type-check**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check`
Expected: no new errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/hooks/usePcsByChannel.ts
git commit -m "feat(admin-dashboard): add usePcsByChannel hook"
```

---

## Task 7: Nav item — `navConfig.ts`

**Files:**
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts:1-27`
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/admin-dashboard/src/components/layout/navConfig.test.ts`:

```typescript
describe('Rekap Bulanan nav item', () => {
  it('OWNER dan ADMIN punya akses, MITRA dan ADMIN_HR tidak', () => {
    expect(accessibleItems('OWNER').map(i => i.href)).toContain('/dashboard/owner/rekap-bulanan')
    expect(accessibleItems('ADMIN').map(i => i.href)).toContain('/dashboard/owner/rekap-bulanan')
    expect(accessibleItems('MITRA').map(i => i.href)).not.toContain('/dashboard/owner/rekap-bulanan')
    expect(accessibleItems('ADMIN_HR').map(i => i.href)).not.toContain('/dashboard/owner/rekap-bulanan')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn vitest run src/components/layout/navConfig.test.ts`
Expected: FAIL — first assertion fails (`/dashboard/owner/rekap-bulanan` not in OWNER's list yet).

- [ ] **Step 3: Add the nav item**

In `apps/admin-dashboard/src/components/layout/navConfig.ts`, add `Table2` to the lucide-react import (line 1-6):

```typescript
import {
  LayoutDashboard, Users, Store, Activity,
  CalendarClock, CalendarHeart, Banknote,
  PieChart, DollarSign, Target, BellRing, Tags, Wallet, BookOpen,
  Package, FileText, Settings, ShoppingCart, Truck, TrendingDown, Printer, Table2, type LucideIcon,
} from 'lucide-react'
```

Then add the item to the `Bisnis` group's `items` array (after the "Kerugian Waste" line, currently line 25):

```typescript
      { href: '/dashboard/owner/waste', label: 'Kerugian Waste', shortLabel: 'Waste', icon: TrendingDown, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/owner/rekap-bulanan', label: 'Rekap Bulanan', shortLabel: 'Rekap', icon: Table2, roles: ['OWNER', 'ADMIN'] },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn vitest run src/components/layout/navConfig.test.ts`
Expected: PASS, all tests including pre-existing ones (MITRA still sees exactly 4 Bisnis items, unaffected since the new item excludes MITRA).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/components/layout/navConfig.ts apps/admin-dashboard/src/components/layout/navConfig.test.ts
git commit -m "feat(admin-dashboard): add Rekap Bulanan nav item to Bisnis group"
```

---

## Task 8: Page — `/dashboard/owner/rekap-bulanan`

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/owner/rekap-bulanan/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// apps/admin-dashboard/src/app/dashboard/owner/rekap-bulanan/page.tsx
'use client'

import { Fragment, useMemo, useState } from 'react'
import { useOutlets } from '@/hooks/useOutlets'
import { useSalesDaily } from '@/hooks/useSalesDaily'
import { useExpenses } from '@/hooks/useExpenses'
import { useHppByChannel } from '@/hooks/useHppByChannel'
import { usePcsByChannel } from '@/hooks/usePcsByChannel'
import { buildBusinessReportRows, type BusinessReportRow, type ChannelMetrics } from '@/lib/businessReport'
import { monthRange } from '@/lib/period'
import { PageHeader } from '@/components/ui'
import { rupiah } from '@/lib/format'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const CHANNEL_COLUMNS: { key: 'offline' | 'online' | 'foodapps' | 'tiktok'; label: string; headerClass: string }[] = [
  { key: 'offline', label: 'Offline', headerClass: 'bg-suka-green text-white' },
  { key: 'online', label: 'Online', headerClass: 'bg-suka-orange text-white' },
  { key: 'foodapps', label: 'Food Apps', headerClass: 'bg-rose-700 text-white' },
  { key: 'tiktok', label: 'TikTok Go', headerClass: 'bg-suka-ink text-white' },
]

// 1 (Outlet) + 4*3 (channel) + 3 (Total Performance) + 3 (Opex) + 1 (Total GP)
const TOTAL_COLUMN_COUNT = 1 + CHANNEL_COLUMNS.length * 3 + 3 + 3 + 1

export default function RekapBulananPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const { from, to } = useMemo(() => monthRange(year, month), [year, month])
  const filter = useMemo(() => ({ from, to, outletId: 'all' as const, source: 'all' as const }), [from, to])

  const { data: outlets = [] } = useOutlets()
  const sales = useSalesDaily(filter, outlets)
  const expenses = useExpenses(filter)
  const hppByChannel = useHppByChannel(from, to)
  const pcsByChannel = usePcsByChannel(from, to)

  const loading = sales.loading || expenses.loading || hppByChannel.loading || pcsByChannel.loading
  const error = sales.error || expenses.error || hppByChannel.error || pcsByChannel.error

  const { rows, total } = useMemo(
    () => buildBusinessReportRows(outlets, sales.rows, hppByChannel.rows, pcsByChannel.rows, expenses.rows),
    [outlets, sales.rows, hppByChannel.rows, pcsByChannel.rows, expenses.rows],
  )

  const sortedRows = useMemo(
    () =>
      [...rows]
        .filter((r) => r.totalPerformance.revenue > 0 || r.opexTotal > 0)
        .sort((a, b) => b.totalGrossProfit - a.totalGrossProfit),
    [rows],
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Rekap Bulanan" description="Performa penjualan per channel & profitabilitas per outlet">
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange"
          />
        </div>
      </PageHeader>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
          Gagal memuat data rekap: {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-16 bg-white/50 rounded-2xl animate-pulse border border-suka-orange/20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin" />
            <p className="text-suka-brown font-bold text-sm">Memuat data rekap...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th rowSpan={2} className="py-3 px-4 bg-suka-brown text-white text-left align-bottom sticky left-0 z-10">
                    Outlet
                  </th>
                  {CHANNEL_COLUMNS.map((c) => (
                    <th key={c.key} colSpan={3} className={`py-2 px-3 text-center font-extrabold uppercase tracking-wide ${c.headerClass}`}>
                      {c.label}
                    </th>
                  ))}
                  <th colSpan={3} className="py-2 px-3 text-center font-extrabold uppercase tracking-wide bg-teal-700 text-white">
                    Total Performance
                  </th>
                  <th colSpan={3} className="py-2 px-3 text-center font-extrabold uppercase tracking-wide bg-red-700 text-white">
                    Opex
                  </th>
                  <th rowSpan={2} className="py-3 px-4 bg-suka-green text-white text-right align-bottom">
                    Total Gross Profit
                  </th>
                </tr>
                <tr className="text-[11px] uppercase text-suka-gray-500 bg-suka-cream/40">
                  {CHANNEL_COLUMNS.map((c) => (
                    <Fragment key={c.key}>
                      <th className="py-2 px-3 text-right font-bold">Revenue</th>
                      <th className="py-2 px-3 text-right font-bold">GP</th>
                      <th className="py-2 px-3 text-right font-bold">PCS</th>
                    </Fragment>
                  ))}
                  <th className="py-2 px-3 text-right font-bold">Revenue</th>
                  <th className="py-2 px-3 text-right font-bold">GP</th>
                  <th className="py-2 px-3 text-right font-bold">PCS</th>
                  <th className="py-2 px-3 text-right font-bold">Outlet</th>
                  <th className="py-2 px-3 text-right font-bold">Gaji</th>
                  <th className="py-2 px-3 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100 font-medium">
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={TOTAL_COLUMN_COUNT} className="py-8 text-center text-suka-gray-400">
                      Belum ada aktivitas bisnis pada bulan ini
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((r) => <ReportRow key={r.outletId} row={r} />)
                )}
              </tbody>
              {sortedRows.length > 0 && (
                <tfoot>
                  <ReportRow row={total} isTotal />
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ChannelCells({ m }: { m: ChannelMetrics }) {
  return (
    <>
      <td className="py-3 px-3 text-right text-suka-gray-600">{rupiah(m.revenue)}</td>
      <td className={`py-3 px-3 text-right font-bold ${m.gp >= 0 ? 'text-suka-green' : 'text-red-700'}`}>{rupiah(m.gp)}</td>
      <td className="py-3 px-3 text-right text-suka-gray-500">{m.pcs.toLocaleString('id-ID')}</td>
    </>
  )
}

function ReportRow({ row, isTotal = false }: { row: BusinessReportRow; isTotal?: boolean }) {
  return (
    <tr className={isTotal ? 'bg-suka-cream font-extrabold border-t-2 border-suka-brown' : 'hover:bg-suka-cream/20 transition-colors'}>
      <td className={`py-3 px-4 text-suka-ink font-bold sticky left-0 z-10 ${isTotal ? 'bg-suka-cream' : 'bg-white'}`}>
        {row.outletName.replace('SUKA SHAWARMA ', '')}
      </td>
      <ChannelCells m={row.offline} />
      <ChannelCells m={row.online} />
      <ChannelCells m={row.foodapps} />
      <ChannelCells m={row.tiktok} />
      <ChannelCells m={row.totalPerformance} />
      <td className="py-3 px-3 text-right text-suka-gray-600">{rupiah(row.opexOutlet)}</td>
      <td className="py-3 px-3 text-right text-suka-gray-600">{rupiah(row.opexSalary)}</td>
      <td className="py-3 px-3 text-right text-suka-gray-700 font-bold">{rupiah(row.opexTotal)}</td>
      <td className={`py-3 px-4 text-right font-extrabold ${row.totalGrossProfit >= 0 ? 'text-suka-green' : 'text-red-700'}`}>
        {rupiah(row.totalGrossProfit)}
      </td>
    </tr>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/owner/rekap-bulanan/page.tsx
git commit -m "feat(admin-dashboard): add Rekap Bulanan page"
```

---

## Task 9: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn test`
Expected: all tests pass, including the new `channelGroups.test.ts`, `period.test.ts` (monthRange cases), `businessReport.test.ts`, and `navConfig.test.ts` cases. Pre-existing unrelated failures (if any — see `CLAUDE.md` session notes about `navConfig.test.ts`/`bahanBaku.test.ts` baseline drift from other work) are not this task's concern, but confirm no *new* failures appear.

- [ ] **Step 2: Type-check**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check`
Expected: no errors in any file touched by this plan.

- [ ] **Step 3: Build**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn build`
Expected: build succeeds, `/dashboard/owner/rekap-bulanan` appears in the route output.

- [ ] **Step 4: Manual smoke test (document as follow-up if no live dev environment is available in this session)**

- Log in as OWNER or ADMIN, confirm "Rekap Bulanan" appears in the Bisnis nav group and MITRA does not see it.
- Pick a month with known sales data; verify Offline/Online/Food Apps/TikTok Go Revenue and PCS per outlet match raw numbers from `sales_daily_scoped` / `menu_sales_scoped` for that month.
- Verify Opex "Gaji" column matches the sum of `gaji_crew_outlet` entries in the Pengeluaran page for that outlet/month, and "Outlet" matches the rest.
- Pick an outlet where Opex exceeds Total Performance GP and confirm Total Gross Profit renders negative in red.
- Confirm the TOTAL row at the bottom sums correctly across all visible outlet rows.

- [ ] **Step 5: Note remaining manual step**

Add a line to the `CLAUDE.md` session log (new dated section, following existing convention in the file) once implementation + smoke test are done, noting: code complete, migration applied to remote, **admin-dashboard needs redeploy** for the change to go live in production (per this repo's existing deploy-after-push convention).
