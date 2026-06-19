# Owner Dashboard — Sales Fase 1 (Hub Views + App) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bangun owner-dashboard read-only yang menampilkan omzet 19 outlet dari satu hub Outlet Suite, dibedakan `sales_source`, dengan KPI/breakdown/tren/menu-terlaris/leaderboard.

**Architecture:** Semua omzet = `orders`+`order_items` di Outlet Suite, dibedakan `orders.sales_source`. Agregasi di DB lewat view definer (`security_barrier`, pola `monitoring_view_spv`). owner-dashboard (Next.js) baca **satu project** via `@suka/auth`. Order Online sync = plan terpisah; plan ini diuji dengan seed data di hub. Lihat ADR-0009 + spec `2026-06-13-owner-dashboard-penjualan-design.md`.

**Tech Stack:** Supabase Postgres (migrations + views), Next.js 16 app router, TypeScript, TailwindCSS v4, Recharts ^3.8.1, Vitest, `@suka/auth`.

**Scope NON-tujuan plan ini:** Order Online sync (Plan 2), input order di pos-kasir, komisi/HPP/margin (Fase 2).

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `supabase/migrations/20260619100000_orders_sales_source.sql` | Tambah kolom `orders.sales_source` + backfill `pos` |
| `supabase/migrations/20260619100100_sales_summary_spv.sql` | View agregat omzet per outlet×sumber×tanggal |
| `supabase/migrations/20260619100200_menu_sales_spv.sql` | View qty/revenue per menu (nama ternormalisasi) |
| `supabase/migrations/20260619100300_sales_seed_test.sql` | (dev-only, tidak di-push prod) seed verifikasi view |
| `apps/owner-dashboard/tsconfig.json` | Tambah `baseUrl` |
| `apps/owner-dashboard/package.json` | Tambah recharts + devDeps test |
| `apps/owner-dashboard/vitest.config.ts` | Config test |
| `apps/owner-dashboard/src/test/setup.ts` | Setup jest-dom |
| `apps/owner-dashboard/src/lib/format.ts` | Helper rupiah, AOV, %, delta, normalisasi nama |
| `apps/owner-dashboard/src/lib/format.test.ts` | Unit test helper |
| `apps/owner-dashboard/src/lib/types.ts` | Tipe row view + filter |
| `apps/owner-dashboard/src/hooks/useSalesSummary.ts` | Fetch + agregasi `sales_summary_spv` |
| `apps/owner-dashboard/src/hooks/useMenuSales.ts` | Fetch `menu_sales_spv` |
| `apps/owner-dashboard/src/components/PeriodFilter.tsx` | Rentang + filter outlet + filter sumber |
| `apps/owner-dashboard/src/components/KpiCards.tsx` | 4 KPI |
| `apps/owner-dashboard/src/components/SourceBreakdown.tsx` | Omzet per sumber |
| `apps/owner-dashboard/src/components/RevenueTrendChart.tsx` | Line chart harian |
| `apps/owner-dashboard/src/components/TopMenus.tsx` | Menu terlaris |
| `apps/owner-dashboard/src/components/OutletLeaderboard.tsx` | Tabel 19 outlet |
| `apps/owner-dashboard/src/app/dashboard/page.tsx` | Rakit semua (ganti placeholder) |

---

## Task 1: Migration — `orders.sales_source`

**Files:**
- Create: `supabase/migrations/20260619100000_orders_sales_source.sql`

- [ ] **Step 1: Tulis migration**

```sql
-- orders.sales_source: pembeda Sumber Omzet (ADR-0009)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sales_source TEXT NOT NULL DEFAULT 'pos'
  CHECK (sales_source IN ('pos','online','gofood','grabfood','shopeefood','tiktok'));

-- backfill eksplisit (semua order lama = POS Outlet)
UPDATE public.orders SET sales_source = 'pos' WHERE sales_source IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_source_created
  ON public.orders (sales_source, created_at);
```

- [ ] **Step 2: Validasi SQL secara lokal (dry parse)**

Run: `supabase db lint --file supabase/migrations/20260619100000_orders_sales_source.sql` (jika tersedia) atau buka di editor SQL Supabase untuk cek sintaks.
Expected: tidak ada error sintaks.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260619100000_orders_sales_source.sql
git commit -m "feat(db): add orders.sales_source for revenue source split"
```

---

## Task 2: View `sales_summary_spv`

Grain: satu baris per `outlet_id × sales_source × sales_date`. Omzet hanya dari `completed`; hitung order completed & total-all untuk % completed.

**Files:**
- Create: `supabase/migrations/20260619100100_sales_summary_spv.sql`

- [ ] **Step 1: Tulis view**

```sql
-- Agregat omzet per outlet × sumber × tanggal (Asia/Jakarta).
-- Definer + security_barrier: owner lihat semua outlet, bypass RLS (pola monitoring_view_spv).
CREATE OR REPLACE VIEW public.sales_summary_spv
WITH (security_barrier = true) AS
SELECT
  o.outlet_id,
  ou.name                                              AS outlet_name,
  o.sales_source,
  (o.created_at AT TIME ZONE 'Asia/Jakarta')::date     AS sales_date,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'completed'), 0) AS omzet,
  COUNT(*) FILTER (WHERE o.status = 'completed')        AS jumlah_order_completed,
  COUNT(*)                                              AS jumlah_order_all
FROM public.orders o
JOIN public.outlets ou ON ou.id = o.outlet_id
GROUP BY o.outlet_id, ou.name, o.sales_source,
         (o.created_at AT TIME ZONE 'Asia/Jakarta')::date;

GRANT SELECT ON public.sales_summary_spv TO authenticated;
```

- [ ] **Step 2: Cek sintaks**

Buka di editor SQL Supabase / `supabase db lint`. Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260619100100_sales_summary_spv.sql
git commit -m "feat(db): sales_summary_spv aggregate view"
```

---

## Task 3: View `menu_sales_spv`

Grain: satu baris per `outlet_id × sales_source × sales_date × menu_key`. Hanya order `completed`. Nama menu di-normalisasi untuk join lintas-sumber; simpan satu nama display.

**Files:**
- Create: `supabase/migrations/20260619100200_menu_sales_spv.sql`

- [ ] **Step 1: Tulis view**

```sql
-- Qty & revenue per menu (nama ternormalisasi), dari order completed.
CREATE OR REPLACE VIEW public.menu_sales_spv
WITH (security_barrier = true) AS
SELECT
  o.outlet_id,
  o.sales_source,
  (o.created_at AT TIME ZONE 'Asia/Jakarta')::date     AS sales_date,
  lower(trim(regexp_replace(oi.menu_item_name, '\s+', ' ', 'g'))) AS menu_key,
  max(oi.menu_item_name)                               AS menu_name,
  SUM(oi.quantity)                                     AS qty,
  SUM(oi.subtotal)                                     AS revenue
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
WHERE o.status = 'completed'
GROUP BY o.outlet_id, o.sales_source,
         (o.created_at AT TIME ZONE 'Asia/Jakarta')::date,
         lower(trim(regexp_replace(oi.menu_item_name, '\s+', ' ', 'g')));

GRANT SELECT ON public.menu_sales_spv TO authenticated;
```

- [ ] **Step 2: Cek sintaks** (editor SQL / lint). Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260619100200_menu_sales_spv.sql
git commit -m "feat(db): menu_sales_spv top-menu view (normalized name join)"
```

---

## Task 4: Verifikasi view dengan seed (dev-only)

Karena belum ada test-harness SQL, verifikasi manual dengan seed + query. **File seed JANGAN di-push ke prod** (taruh nama berakhiran `_seed_test` dan hapus sebelum `db push`, atau jalankan via editor SQL saja).

**Files:**
- Create: `supabase/migrations/20260619100300_sales_seed_test.sql` (jalankan manual, lalu hapus/rollback)

- [ ] **Step 1: Tulis seed + assertion**

```sql
-- DEV ONLY. Jalankan di editor SQL Supabase, eyeball hasilnya, lalu ROLLBACK.
BEGIN;
-- asumsi minimal 1 outlet ada; ambil satu id
WITH ot AS (SELECT id FROM public.outlets LIMIT 1)
INSERT INTO public.orders (outlet_id, status, payment_method, total_amount, sales_source, created_at)
SELECT id, 'completed', 'cash', 100000, 'pos',    '2026-06-18T14:00:00+07' FROM ot UNION ALL
SELECT id, 'completed', NULL,   25000,  'gofood', '2026-06-18T15:00:00+07' FROM (SELECT id FROM public.outlets LIMIT 1) g UNION ALL
SELECT id, 'cancelled', 'cash', 999999, 'pos',    '2026-06-18T16:00:00+07' FROM (SELECT id FROM public.outlets LIMIT 1) c;

-- Expected sales_summary_spv: untuk outlet tsb tanggal 2026-06-18,
--   pos:    omzet 100000, completed 1, all 2
--   gofood: omzet 25000,  completed 1, all 1
SELECT sales_source, omzet, jumlah_order_completed, jumlah_order_all
FROM public.sales_summary_spv
WHERE sales_date = '2026-06-18'
ORDER BY sales_source;
ROLLBACK;
```

- [ ] **Step 2: Jalankan di editor SQL Supabase**

Expected: baris `pos` → omzet 100000, completed 1, all 2; baris `gofood` → omzet 25000, completed 1, all 1. Order `cancelled` TIDAK menambah omzet (membuktikan filter). Lalu pastikan `ROLLBACK` (tidak ada data sisa).

- [ ] **Step 3: Jangan commit file seed** (atau commit lalu hapus sebelum push). Jika dibuat sebagai file:

```bash
rm supabase/migrations/20260619100300_sales_seed_test.sql
```

---

## Task 5: Hardening owner-dashboard (baseUrl + test infra + buang dead code)

**Files:**
- Modify: `apps/owner-dashboard/tsconfig.json`
- Modify: `apps/owner-dashboard/package.json`
- Create: `apps/owner-dashboard/vitest.config.ts`
- Create: `apps/owner-dashboard/src/test/setup.ts`
- Delete: `apps/owner-dashboard/src/lib/supabase.ts` (dead code, 0 importir — footgun service-role)

- [ ] **Step 1: Tambah baseUrl** ke `apps/owner-dashboard/tsconfig.json` di `compilerOptions`:

```json
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
```

- [ ] **Step 2: Hapus dead code**

```bash
git rm apps/owner-dashboard/src/lib/supabase.ts
```

- [ ] **Step 3: Tambah deps** ke `apps/owner-dashboard/package.json`:

`dependencies`: `"recharts": "^3.8.1"`
`devDependencies`:
```json
    "vitest": "^2.1.0",
    "jsdom": "^25.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.0"
```
Tambah script: `"test": "vitest run"`, `"test:watch": "vitest"`.
Tambah ke `compilerOptions.types` di tsconfig: `["vitest/globals", "@testing-library/jest-dom"]`.

- [ ] **Step 4: Buat `vitest.config.ts`** (contek pola stok):

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```
(Tambahkan `@vitejs/plugin-react` ke devDependencies bila belum ada.)

- [ ] **Step 5: Buat `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Install**

Run: `cd apps/owner-dashboard && yarn install`
Expected: sukses, tanpa error registry.

- [ ] **Step 7: type-check**

Run: `cd apps/owner-dashboard && yarn type-check`
Expected: 0 error.

- [ ] **Step 8: Commit**

```bash
git add apps/owner-dashboard/tsconfig.json apps/owner-dashboard/package.json apps/owner-dashboard/vitest.config.ts apps/owner-dashboard/src/test/setup.ts
git commit -m "chore(owner-dashboard): add baseUrl, vitest, recharts; drop dead supabase lib"
```

---

## Task 6: Tipe data

**Files:**
- Create: `apps/owner-dashboard/src/lib/types.ts`

- [ ] **Step 1: Tulis tipe**

```ts
export type SalesSource = 'pos' | 'online' | 'gofood' | 'grabfood' | 'shopeefood' | 'tiktok'

export interface SalesSummaryRow {
  outlet_id: string
  outlet_name: string
  sales_source: SalesSource
  sales_date: string            // 'YYYY-MM-DD'
  omzet: number
  jumlah_order_completed: number
  jumlah_order_all: number
}

export interface MenuSalesRow {
  outlet_id: string
  sales_source: SalesSource
  sales_date: string
  menu_key: string
  menu_name: string
  qty: number
  revenue: number
}

export interface PeriodFilterValue {
  from: string                  // 'YYYY-MM-DD' inklusif
  to: string                    // 'YYYY-MM-DD' inklusif
  outletId: string | 'all'
  source: SalesSource | 'all'
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/owner-dashboard/src/lib/types.ts
git commit -m "feat(owner-dashboard): sales view + filter types"
```

---

## Task 7: Helper `format.ts` (TDD)

**Files:**
- Create: `apps/owner-dashboard/src/lib/format.test.ts`
- Create: `apps/owner-dashboard/src/lib/format.ts`

- [ ] **Step 1: Tulis test gagal**

```ts
import { describe, it, expect } from 'vitest'
import { rupiah, aov, pct, deltaPct, normalizeMenuName } from './format'

describe('rupiah', () => {
  it('format ribuan dengan pemisah titik', () => {
    expect(rupiah(1500000)).toBe('Rp 1.500.000')
  })
  it('nol', () => expect(rupiah(0)).toBe('Rp 0'))
})

describe('aov', () => {
  it('omzet / jumlah order', () => expect(aov(100000, 4)).toBe(25000))
  it('guard pembagi nol → 0', () => expect(aov(100000, 0)).toBe(0))
})

describe('pct', () => {
  it('rasio dalam persen 1 desimal', () => expect(pct(3, 4)).toBe(75))
  it('guard nol → 0', () => expect(pct(1, 0)).toBe(0))
})

describe('deltaPct', () => {
  it('kenaikan', () => expect(deltaPct(150, 100)).toBe(50))
  it('baseline nol → null (tak terdefinisi)', () => expect(deltaPct(150, 0)).toBeNull())
})

describe('normalizeMenuName', () => {
  it('lowercase, trim, rapatkan spasi', () => {
    expect(normalizeMenuName('  Shawarma   Ayam ')).toBe('shawarma ayam')
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd apps/owner-dashboard && yarn test src/lib/format.test.ts`
Expected: FAIL (modul belum ada).

- [ ] **Step 3: Implementasi**

```ts
export function rupiah(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}
export function aov(omzet: number, orders: number): number {
  return orders > 0 ? Math.round(omzet / orders) : 0
}
export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0
}
export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}
export function normalizeMenuName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd apps/owner-dashboard && yarn test src/lib/format.test.ts`
Expected: PASS (semua).

- [ ] **Step 5: Commit**

```bash
git add apps/owner-dashboard/src/lib/format.ts apps/owner-dashboard/src/lib/format.test.ts
git commit -m "feat(owner-dashboard): format & metric helpers (TDD)"
```

---

## Task 8: Hook `useSalesSummary` + `useMenuSales`

Pakai client `@suka/auth` via `useAuth()` (pola stok `useMonitoringData`). Query view dengan filter periode/outlet/sumber.

**Files:**
- Create: `apps/owner-dashboard/src/hooks/useSalesSummary.ts`
- Create: `apps/owner-dashboard/src/hooks/useMenuSales.ts`

- [ ] **Step 1: Tulis `useSalesSummary.ts`**

```ts
'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@suka/auth'
import type { SalesSummaryRow, PeriodFilterValue } from '@/lib/types'

export function useSalesSummary(filter: PeriodFilterValue) {
  const { supabase } = useAuth()
  const [rows, setRows] = useState<SalesSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true); setError(null)
    let q = supabase.from('sales_summary_spv').select('*')
      .gte('sales_date', filter.from).lte('sales_date', filter.to)
    if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
    if (filter.source !== 'all') q = q.eq('sales_source', filter.source)
    q.then(({ data, error }) => {
      if (!active) return
      if (error) setError(error.message)
      else setRows((data ?? []) as SalesSummaryRow[])
      setLoading(false)
    })
    return () => { active = false }
  }, [supabase, filter.from, filter.to, filter.outletId, filter.source])

  return { rows, loading, error }
}
```

- [ ] **Step 2: Tulis `useMenuSales.ts`** (struktur identik, tabel `menu_sales_spv`, tipe `MenuSalesRow`)

```ts
'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@suka/auth'
import type { MenuSalesRow, PeriodFilterValue } from '@/lib/types'

export function useMenuSales(filter: PeriodFilterValue) {
  const { supabase } = useAuth()
  const [rows, setRows] = useState<MenuSalesRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true); setError(null)
    let q = supabase.from('menu_sales_spv').select('*')
      .gte('sales_date', filter.from).lte('sales_date', filter.to)
    if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
    if (filter.source !== 'all') q = q.eq('sales_source', filter.source)
    q.then(({ data, error }) => {
      if (!active) return
      if (error) setError(error.message)
      else setRows((data ?? []) as MenuSalesRow[])
      setLoading(false)
    })
    return () => { active = false }
  }, [supabase, filter.from, filter.to, filter.outletId, filter.source])

  return { rows, loading, error }
}
```

- [ ] **Step 3: type-check**

Run: `cd apps/owner-dashboard && yarn type-check`
Expected: 0 error. (Jika `useAuth` tak meng-ekspos `supabase`, cek `packages/auth` — pola sama dipakai stok `useMonitoringData`.)

- [ ] **Step 4: Commit**

```bash
git add apps/owner-dashboard/src/hooks/useSalesSummary.ts apps/owner-dashboard/src/hooks/useMenuSales.ts
git commit -m "feat(owner-dashboard): sales & menu data hooks"
```

---

## Task 9: `KpiCards` + `SourceBreakdown` (TDD ringkas)

Komponen murni: terima `rows: SalesSummaryRow[]`, hitung agregat. Logika agregasi diuji.

**Files:**
- Create: `apps/owner-dashboard/src/components/KpiCards.tsx`
- Create: `apps/owner-dashboard/src/components/KpiCards.test.tsx`
- Create: `apps/owner-dashboard/src/components/SourceBreakdown.tsx`

- [ ] **Step 1: Test gagal KpiCards**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { KpiCards } from './KpiCards'
import type { SalesSummaryRow } from '@/lib/types'

const rows: SalesSummaryRow[] = [
  { outlet_id: 'a', outlet_name: 'A', sales_source: 'pos', sales_date: '2026-06-18', omzet: 100000, jumlah_order_completed: 4, jumlah_order_all: 5 },
  { outlet_id: 'b', outlet_name: 'B', sales_source: 'online', sales_date: '2026-06-18', omzet: 50000, jumlah_order_completed: 1, jumlah_order_all: 1 },
]

describe('KpiCards', () => {
  it('omzet total & AOV', () => {
    render(<KpiCards rows={rows} />)
    expect(screen.getByText('Rp 150.000')).toBeInTheDocument()   // omzet
    expect(screen.getByText('Rp 30.000')).toBeInTheDocument()    // AOV 150000/5
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd apps/owner-dashboard && yarn test src/components/KpiCards.test.tsx`
Expected: FAIL (modul belum ada).

- [ ] **Step 3: Implementasi `KpiCards.tsx`**

```tsx
import type { SalesSummaryRow } from '@/lib/types'
import { rupiah, aov, pct } from '@/lib/format'

export function KpiCards({ rows }: { rows: SalesSummaryRow[] }) {
  const omzet = rows.reduce((s, r) => s + r.omzet, 0)
  const completed = rows.reduce((s, r) => s + r.jumlah_order_completed, 0)
  const all = rows.reduce((s, r) => s + r.jumlah_order_all, 0)
  const cards = [
    { label: 'Omzet', value: rupiah(omzet) },
    { label: 'Jumlah Order', value: completed.toLocaleString('id-ID') },
    { label: 'AOV', value: rupiah(aov(omzet, completed)) },
    { label: '% Order Completed', value: `${pct(completed, all)}%` },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="p-4 bg-white rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">{c.label}</p>
          <p className="text-2xl font-bold text-suka-brown">{c.value}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd apps/owner-dashboard && yarn test src/components/KpiCards.test.tsx`
Expected: PASS.

- [ ] **Step 5: Implementasi `SourceBreakdown.tsx`**

```tsx
import type { SalesSummaryRow, SalesSource } from '@/lib/types'
import { rupiah } from '@/lib/format'

const LABEL: Record<SalesSource, string> = {
  pos: 'POS Outlet', online: 'Order Online', gofood: 'GoFood',
  grabfood: 'GrabFood', shopeefood: 'ShopeeFood', tiktok: 'TikTok',
}

export function SourceBreakdown({ rows }: { rows: SalesSummaryRow[] }) {
  const bySource = new Map<SalesSource, number>()
  for (const r of rows) bySource.set(r.sales_source, (bySource.get(r.sales_source) ?? 0) + r.omzet)
  const sources = Object.keys(LABEL) as SalesSource[]
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {sources.map((s) => {
        const v = bySource.get(s) ?? 0
        return (
          <div key={s} className="p-3 bg-white rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500">{LABEL[s]}</p>
            <p className="text-lg font-semibold text-suka-brown">
              {v > 0 ? rupiah(v) : <span className="text-gray-400">belum ada transaksi</span>}
            </p>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/owner-dashboard/src/components/KpiCards.tsx apps/owner-dashboard/src/components/KpiCards.test.tsx apps/owner-dashboard/src/components/SourceBreakdown.tsx
git commit -m "feat(owner-dashboard): KpiCards + SourceBreakdown"
```

---

## Task 10: `RevenueTrendChart` + `TopMenus`

**Files:**
- Create: `apps/owner-dashboard/src/components/RevenueTrendChart.tsx`
- Create: `apps/owner-dashboard/src/components/TopMenus.tsx`

- [ ] **Step 1: `RevenueTrendChart.tsx`** (omzet per `sales_date`)

```tsx
'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { SalesSummaryRow } from '@/lib/types'
import { rupiah } from '@/lib/format'

export function RevenueTrendChart({ rows }: { rows: SalesSummaryRow[] }) {
  const byDate = new Map<string, number>()
  for (const r of rows) byDate.set(r.sales_date, (byDate.get(r.sales_date) ?? 0) + r.omzet)
  const data = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, omzet]) => ({ date, omzet }))
  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200">
      <h2 className="font-semibold text-suka-brown mb-3">Tren Omzet Harian</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" fontSize={11} />
          <YAxis tickFormatter={(v) => rupiah(v)} fontSize={11} width={90} />
          <Tooltip formatter={(v: number) => rupiah(v)} />
          <Line type="monotone" dataKey="omzet" stroke="#C2410C" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: `TopMenus.tsx`** (agregasi lintas-sumber via `menu_key`, toggle qty/revenue)

```tsx
'use client'
import { useState } from 'react'
import type { MenuSalesRow } from '@/lib/types'
import { rupiah } from '@/lib/format'

export function TopMenus({ rows }: { rows: MenuSalesRow[] }) {
  const [mode, setMode] = useState<'qty' | 'revenue'>('qty')
  const agg = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const r of rows) {
    const cur = agg.get(r.menu_key) ?? { name: r.menu_name, qty: 0, revenue: 0 }
    cur.qty += r.qty; cur.revenue += r.revenue
    agg.set(r.menu_key, cur)
  }
  const list = [...agg.values()].sort((a, b) => b[mode] - a[mode]).slice(0, 10)
  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-suka-brown">Menu Terlaris</h2>
        <div className="text-xs">
          <button onClick={() => setMode('qty')} className={mode === 'qty' ? 'font-bold' : 'text-gray-400'}>Qty</button>
          <span className="mx-1 text-gray-300">|</span>
          <button onClick={() => setMode('revenue')} className={mode === 'revenue' ? 'font-bold' : 'text-gray-400'}>Revenue</button>
        </div>
      </div>
      <ol className="space-y-1 text-sm">
        {list.length === 0 && <li className="text-gray-400">Belum ada data</li>}
        {list.map((m, i) => (
          <li key={m.name} className="flex justify-between">
            <span>{i + 1}. {m.name}</span>
            <span className="font-medium">{mode === 'qty' ? `${m.qty} porsi` : rupiah(m.revenue)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
```

- [ ] **Step 3: type-check**

Run: `cd apps/owner-dashboard && yarn type-check`
Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git add apps/owner-dashboard/src/components/RevenueTrendChart.tsx apps/owner-dashboard/src/components/TopMenus.tsx
git commit -m "feat(owner-dashboard): revenue trend chart + top menus"
```

---

## Task 11: `OutletLeaderboard` (TDD logika ranking + delta)

Bandingkan periode terpilih vs periode sebelumnya sama panjang. Komponen terima `current` & `previous` rows.

**Files:**
- Create: `apps/owner-dashboard/src/components/OutletLeaderboard.tsx`
- Create: `apps/owner-dashboard/src/components/OutletLeaderboard.test.tsx`
- Create: `apps/owner-dashboard/src/lib/leaderboard.ts`
- Create: `apps/owner-dashboard/src/lib/leaderboard.test.ts`

- [ ] **Step 1: Test gagal `leaderboard.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildLeaderboard } from './leaderboard'
import type { SalesSummaryRow } from './types'

const row = (outlet_id: string, outlet_name: string, omzet: number, c = 1, a = 1): SalesSummaryRow =>
  ({ outlet_id, outlet_name, sales_source: 'pos', sales_date: '2026-06-18', omzet, jumlah_order_completed: c, jumlah_order_all: a })

describe('buildLeaderboard', () => {
  it('agregasi per outlet, urut omzet desc, hitung delta vs previous', () => {
    const cur = [row('a', 'A', 100000), row('a', 'A', 50000), row('b', 'B', 200000)]
    const prev = [row('a', 'A', 100000), row('b', 'B', 400000)]
    const lb = buildLeaderboard(cur, prev)
    expect(lb[0].outlet_name).toBe('B')          // 200k > 150k
    expect(lb[0].omzet).toBe(200000)
    expect(lb[0].deltaPct).toBe(-50)             // 200k vs 400k
    expect(lb[1].outlet_name).toBe('A')
    expect(lb[1].omzet).toBe(150000)
    expect(lb[1].deltaPct).toBe(50)              // 150k vs 100k
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd apps/owner-dashboard && yarn test src/lib/leaderboard.test.ts` → FAIL.

- [ ] **Step 3: Implementasi `leaderboard.ts`**

```ts
import type { SalesSummaryRow } from './types'
import { aov, deltaPct } from './format'

export interface LeaderboardEntry {
  outlet_id: string
  outlet_name: string
  omzet: number
  orders: number
  aov: number
  deltaPct: number | null
}

function omzetPerOutlet(rows: SalesSummaryRow[]) {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.outlet_id, (m.get(r.outlet_id) ?? 0) + r.omzet)
  return m
}

export function buildLeaderboard(current: SalesSummaryRow[], previous: SalesSummaryRow[]): LeaderboardEntry[] {
  const prev = omzetPerOutlet(previous)
  const agg = new Map<string, { name: string; omzet: number; orders: number }>()
  for (const r of current) {
    const cur = agg.get(r.outlet_id) ?? { name: r.outlet_name, omzet: 0, orders: 0 }
    cur.omzet += r.omzet; cur.orders += r.jumlah_order_completed
    agg.set(r.outlet_id, cur)
  }
  return [...agg.entries()]
    .map(([outlet_id, v]) => ({
      outlet_id, outlet_name: v.name, omzet: v.omzet, orders: v.orders,
      aov: aov(v.omzet, v.orders), deltaPct: deltaPct(v.omzet, prev.get(outlet_id) ?? 0),
    }))
    .sort((a, b) => b.omzet - a.omzet)
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd apps/owner-dashboard && yarn test src/lib/leaderboard.test.ts` → PASS.

- [ ] **Step 5: Implementasi `OutletLeaderboard.tsx`**

```tsx
import type { LeaderboardEntry } from '@/lib/leaderboard'
import { rupiah } from '@/lib/format'

export function OutletLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <h2 className="font-semibold text-suka-brown mb-3">Leaderboard Outlet</h2>
      <table className="w-full text-sm">
        <thead className="text-left text-gray-500 border-b">
          <tr><th className="py-1">#</th><th>Outlet</th><th className="text-right">Omzet</th><th className="text-right">Order</th><th className="text-right">AOV</th><th className="text-right">vs lalu</th></tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={e.outlet_id} className="border-b last:border-0">
              <td className="py-1">{i + 1}</td>
              <td>{e.outlet_name}</td>
              <td className="text-right">{rupiah(e.omzet)}</td>
              <td className="text-right">{e.orders}</td>
              <td className="text-right">{rupiah(e.aov)}</td>
              <td className={'text-right ' + (e.deltaPct == null ? 'text-gray-400' : e.deltaPct >= 0 ? 'text-green-600' : 'text-red-600')}>
                {e.deltaPct == null ? '—' : `${e.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(e.deltaPct)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/owner-dashboard/src/lib/leaderboard.ts apps/owner-dashboard/src/lib/leaderboard.test.ts apps/owner-dashboard/src/components/OutletLeaderboard.tsx apps/owner-dashboard/src/components/OutletLeaderboard.test.tsx
git commit -m "feat(owner-dashboard): outlet leaderboard with period delta (TDD)"
```

---

## Task 12: `PeriodFilter` + util periode

**Files:**
- Create: `apps/owner-dashboard/src/lib/period.ts`
- Create: `apps/owner-dashboard/src/lib/period.test.ts`
- Create: `apps/owner-dashboard/src/components/PeriodFilter.tsx`

- [ ] **Step 1: Test gagal `period.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { presetRange, previousRange } from './period'

describe('presetRange', () => {
  it('7 hari termasuk hari ini', () => {
    expect(presetRange('7d', new Date('2026-06-19T10:00:00+07:00')))
      .toEqual({ from: '2026-06-13', to: '2026-06-19' })
  })
})
describe('previousRange', () => {
  it('periode sebelum, sama panjang', () => {
    expect(previousRange({ from: '2026-06-13', to: '2026-06-19' }))
      .toEqual({ from: '2026-06-06', to: '2026-06-12' })
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal** → FAIL.

- [ ] **Step 3: Implementasi `period.ts`**

```ts
export type Preset = 'today' | '7d' | '30d'

function iso(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d)
}

export function presetRange(preset: Preset, now = new Date()): { from: string; to: string } {
  // gunakan tanggal lokal Asia/Jakarta (UTC+7)
  const jkt = new Date(now.getTime() + 7 * 3600 * 1000)
  const to = jkt.toISOString().slice(0, 10)
  const span = preset === 'today' ? 0 : preset === '7d' ? 6 : 29
  return { from: addDays(to, -span), to }
}

export function previousRange(range: { from: string; to: string }): { from: string; to: string } {
  const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86400000) + 1
  return { from: addDays(range.from, -days), to: addDays(range.from, -1) }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus** → PASS.

- [ ] **Step 5: Implementasi `PeriodFilter.tsx`**

```tsx
'use client'
import type { PeriodFilterValue, SalesSource } from '@/lib/types'
import type { Preset } from '@/lib/period'
import { presetRange } from '@/lib/period'

const SOURCES: (SalesSource | 'all')[] = ['all', 'pos', 'online', 'gofood', 'grabfood', 'shopeefood', 'tiktok']

export function PeriodFilter({
  value, onChange, outlets,
}: {
  value: PeriodFilterValue
  onChange: (v: PeriodFilterValue) => void
  outlets: { id: string; name: string }[]
}) {
  const setPreset = (p: Preset) => onChange({ ...value, ...presetRange(p) })
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {(['today', '7d', '30d'] as Preset[]).map((p) => (
        <button key={p} onClick={() => setPreset(p)}
          className="px-3 py-1 rounded border text-sm border-gray-300 hover:bg-gray-50">
          {p === 'today' ? 'Hari ini' : p === '7d' ? '7 hari' : '30 hari'}
        </button>
      ))}
      <select className="px-2 py-1 rounded border text-sm border-gray-300"
        value={value.outletId} onChange={(e) => onChange({ ...value, outletId: e.target.value as PeriodFilterValue['outletId'] })}>
        <option value="all">Semua outlet</option>
        {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <select className="px-2 py-1 rounded border text-sm border-gray-300"
        value={value.source} onChange={(e) => onChange({ ...value, source: e.target.value as PeriodFilterValue['source'] })}>
        {SOURCES.map((s) => <option key={s} value={s}>{s === 'all' ? 'Semua sumber' : s}</option>)}
      </select>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/owner-dashboard/src/lib/period.ts apps/owner-dashboard/src/lib/period.test.ts apps/owner-dashboard/src/components/PeriodFilter.tsx
git commit -m "feat(owner-dashboard): period filter + range utils (TDD)"
```

---

## Task 13: Rakit `dashboard/page.tsx`

Ganti placeholder. Muat outlets untuk filter, current+previous summary, menu sales. Tangani loading/error.

**Files:**
- Modify: `apps/owner-dashboard/src/app/dashboard/page.tsx` (ganti seluruh isi)

- [ ] **Step 1: Tulis page**

```tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@suka/auth'
import { presetRange, previousRange } from '@/lib/period'
import { buildLeaderboard } from '@/lib/leaderboard'
import type { PeriodFilterValue } from '@/lib/types'
import { useSalesSummary } from '@/hooks/useSalesSummary'
import { useMenuSales } from '@/hooks/useMenuSales'
import { PeriodFilter } from '@/components/PeriodFilter'
import { KpiCards } from '@/components/KpiCards'
import { SourceBreakdown } from '@/components/SourceBreakdown'
import { RevenueTrendChart } from '@/components/RevenueTrendChart'
import { TopMenus } from '@/components/TopMenus'
import { OutletLeaderboard } from '@/components/OutletLeaderboard'

export default function DashboardPage() {
  const { supabase } = useAuth()
  const [outlets, setOutlets] = useState<{ id: string; name: string }[]>([])
  const [filter, setFilter] = useState<PeriodFilterValue>(() => ({ ...presetRange('7d'), outletId: 'all', source: 'all' }))
  const prevFilter = useMemo<PeriodFilterValue>(() => ({ ...filter, ...previousRange({ from: filter.from, to: filter.to }) }), [filter])

  useEffect(() => {
    supabase.from('outlets').select('id,name').order('name').then(({ data }) => setOutlets(data ?? []))
  }, [supabase])

  const cur = useSalesSummary(filter)
  const prev = useSalesSummary(prevFilter)
  const menu = useMenuSales(filter)
  const leaderboard = useMemo(() => buildLeaderboard(cur.rows, prev.rows), [cur.rows, prev.rows])

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-suka-brown">Owner Dashboard — Penjualan</h1>
        <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} />
      </div>

      {cur.error && <p className="text-red-600 text-sm">Gagal memuat data: {cur.error}</p>}
      {cur.loading ? <p className="text-gray-500">Memuat…</p> : (
        <>
          <KpiCards rows={cur.rows} />
          <SourceBreakdown rows={cur.rows} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2"><RevenueTrendChart rows={cur.rows} /></div>
            <TopMenus rows={menu.rows} />
          </div>
          <OutletLeaderboard entries={leaderboard} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: type-check + test full**

Run: `cd apps/owner-dashboard && yarn type-check && yarn test`
Expected: 0 type error; semua test PASS.

- [ ] **Step 3: build**

Run: `cd apps/owner-dashboard && yarn build`
Expected: build sukses.

- [ ] **Step 4: Commit**

```bash
git add apps/owner-dashboard/src/app/dashboard/page.tsx
git commit -m "feat(owner-dashboard): assemble sales dashboard page"
```

---

## Task 14: Push migrations & smoke

- [ ] **Step 1: Rekonsiliasi migration drift dulu** (WAJIB — lihat CLAUDE.md)

Run: `supabase migration list`
Bila remote diverged: `supabase migration repair --status applied <id>` sebelum push.

- [ ] **Step 2: Push**

Run: `supabase db push`
Expected: 3 migration baru (`20260619100000/100100/100200`) ter-apply. **Pastikan file seed test (Task 4) TIDAK ikut.**

- [ ] **Step 3: Smoke manual via browser**

Run: `cd apps/owner-dashboard && yarn dev` (port 3003). Login sebagai owner/admin via Portal. Buka `/dashboard`.
Expected: dashboard render tanpa crash; sumber tanpa data tampil "belum ada transaksi"; jika ada `orders` completed di hub, KPI/leaderboard/menu terisi.

- [ ] **Step 4: Commit catatan sesi** (opsional, update CLAUDE.md session log)

---

## Self-Review Checklist (untuk penulis plan)

- ✅ **Spec coverage:** KPI(T9) · breakdown sumber(T9) · leaderboard+delta(T11) · tren(T10) · menu terlaris(T10) · AOV/%(T7,T9) · filter periode/outlet/sumber(T12) · view definer(T2,T3) · `sales_source`(T1) · hardening(T5) · recognized=completed(T2) · date created_at Jakarta(T2,T3) · normalisasi nama(T3,T7). **Order Online sync = Plan 2 (out of scope, dicatat di spec §6).**
- ✅ **Placeholder scan:** semua step berisi kode/command nyata.
- ✅ **Type consistency:** `SalesSummaryRow`/`MenuSalesRow`/`PeriodFilterValue`/`LeaderboardEntry` konsisten antar-task; `useAuth().supabase` dipakai seragam (verifikasi pola di `apps/stok/src/hooks/useMonitoringData.ts`).

## Catatan eksekusi
- Jalankan di **session baru** dengan `superpowers:subagent-driven-development` atau `executing-plans`.
- Pertimbangkan worktree terisolasi (`superpowers:using-git-worktrees`).
- **Plan 2 (Order Online sync)** harus ditulis terpisah sebelum omzet online muncul di dashboard.
