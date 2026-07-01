# Pengeluaran Outlet vs Pusat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Model pengeluaran dengan dua scope (Outlet vs Pusat/company-wide), 14 kategori kanonik, form input rekap bulanan, dan reporting yang membebankan biaya pusat hanya ke P&L perusahaan (bukan per-outlet).

**Architecture:** Satu tabel `expenses` dengan `outlet_id` nullable (`NULL` = pusat), scope dikunci CHECK constraint berbasis kategori, upsert rekap bulanan per `(outlet_id, category, period_month)`. Tulis lewat RPC `SECURITY DEFINER` (owner/admin; pusat owner-only). Reporting membedakan Laba Outlet vs Laba Perusahaan.

**Tech Stack:** Supabase Postgres (RLS + RPC), Next.js App Router (admin-dashboard), React Query, TypeScript, Vitest, Recharts.

**Spec:** `docs/superpowers/specs/2026-07-01-expenses-outlet-vs-pusat-design.md` · **ADR:** `docs/adr/0013-scope-pengeluaran-outlet-vs-pusat.md`

---

## File Structure

- **Create** `supabase/migrations/20260702100000_expenses_outlet_vs_pusat.sql` — skema + `is_owner()` + RLS + RPC upsert/delete.
- **Create** `apps/admin-dashboard/src/lib/expenseCategories.ts` — daftar kategori kanonik, label/warna/ikon, `deriveScope`, konstanta grup outlet/pusat.
- **Create** `apps/admin-dashboard/src/lib/expenseCategories.test.ts` — unit test `deriveScope` + kelengkapan metadata.
- **Modify** `apps/admin-dashboard/src/lib/profit.ts` — pisah `computeOutletProfit` + `computeCompanyProfit`.
- **Modify** `apps/admin-dashboard/src/lib/profit.test.ts` — test dua fungsi baru.
- **Modify** `apps/admin-dashboard/src/hooks/useExpenses.ts` — 14 kategori, `outlet_id: string|null`, `period_month`, `scope`.
- **Create** `apps/admin-dashboard/src/hooks/useUpsertExpenses.ts` — mutation upsert rekap bulanan via RPC.
- **Modify** `apps/admin-dashboard/src/app/dashboard/owner/expenses/page.tsx` — label 14 kategori, section Outlet vs Pusat.
- **Modify** `apps/admin-dashboard/src/app/dashboard/owner/profit/page.tsx` — semantik company vs outlet, kartu "Biaya Pusat".
- **Create** `apps/admin-dashboard/src/app/dashboard/owner/expenses/input/page.tsx` — form input rekap bulanan.
- **Modify** `apps/admin-dashboard/src/components/layout/navConfig.ts` — entri "Input Pengeluaran" (owner/admin).
- **Modify** `apps/admin-dashboard/src/components/layout/navConfig.test.ts` — assert entri baru untuk OWNER, absen untuk MITRA.

---

## Task 1: Migration — skema, helper, RLS, RPC

**Files:**
- Create: `supabase/migrations/20260702100000_expenses_outlet_vs_pusat.sql`

- [ ] **Step 1: Tulis migration**

```sql
-- 20260702100000_expenses_outlet_vs_pusat.sql
-- Pengeluaran dua scope: Outlet (outlet_id terisi) vs Pusat (outlet_id NULL).
-- Ganti total 6 enum kategori lama → 14 kategori kanonik. Data lama = dummy,
-- dikosongkan (lihat ADR-013 & migration 20260625110000_remove_dummy_expenses).

-- 1. Kosongkan data lama (kategori 6-enum tak lagi valid; dummy sudah dihapus)
DELETE FROM public.expenses;

-- 2. outlet_id nullable (NULL = Pengeluaran Pusat / company-wide)
ALTER TABLE public.expenses ALTER COLUMN outlet_id DROP NOT NULL;

-- 3. Kolom periode rekap bulanan (selalu tanggal-1 bulan ybs)
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS period_month DATE NOT NULL;

-- 4. Ganti CHECK category (drop nama lama, buat 14 kategori)
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_check CHECK (category IN (
  'pengeluaran_outlet','gaji_crew_outlet','bonus_leader','bonus_korlap',
  'lembur','ads','endorsement','promo','pdam','pln','internet','sewa_outlet',
  'pengeluaran_global','gaji_staff_kantor'));

-- 5. Integritas scope: kategori pusat ⇔ outlet_id NULL
ALTER TABLE public.expenses ADD CONSTRAINT expenses_scope_check CHECK (
  (category IN ('pengeluaran_global','gaji_staff_kantor')) = (outlet_id IS NULL));

-- 6. Upsert per periode (NULLS NOT DISTINCT agar dua baris pusat NULL dianggap sama)
CREATE UNIQUE INDEX IF NOT EXISTS expenses_period_unique
  ON public.expenses (outlet_id, category, period_month) NULLS NOT DISTINCT;

-- 7. Helper: apakah user saat ini owner (untuk gate tulis Pengeluaran Pusat)
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'owner');
$$;

-- 8. RLS SELECT: outlet rows per accessible_outlet_ids; pusat rows (NULL) owner/admin only
DROP POLICY IF EXISTS "expenses_select_scoped" ON public.expenses;
DROP POLICY IF EXISTS "expenses_select_all" ON public.expenses;
CREATE POLICY "expenses_select_scoped" ON public.expenses FOR SELECT TO authenticated USING (
  outlet_id IN (SELECT public.accessible_outlet_ids())
  OR (outlet_id IS NULL AND public.is_owner_or_admin())
);

-- 9. Tutup jalur tulis langsung (permissif lama) — tulis hanya lewat RPC di Step 10
DROP POLICY IF EXISTS "expenses_insert_all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_all" ON public.expenses;
REVOKE INSERT, UPDATE, DELETE ON public.expenses FROM authenticated;

-- 10. RPC upsert rekap bulanan (owner/admin; pusat owner-only)
CREATE OR REPLACE FUNCTION public.upsert_expense(
  p_outlet UUID, p_category TEXT, p_period_month DATE, p_amount NUMERIC, p_description TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_pusat BOOLEAN := p_category IN ('pengeluaran_global','gaji_staff_kantor');
BEGIN
  IF is_pusat THEN
    IF p_outlet IS NOT NULL THEN RAISE EXCEPTION 'Kategori pusat tak boleh punya outlet'; END IF;
    IF NOT public.is_owner() THEN RAISE EXCEPTION 'Hanya owner yang boleh input Pengeluaran Pusat'; END IF;
  ELSE
    IF p_outlet IS NULL THEN RAISE EXCEPTION 'Kategori outlet wajib punya outlet'; END IF;
    IF NOT public.is_owner_or_admin() THEN RAISE EXCEPTION 'Hanya owner/admin yang boleh input pengeluaran'; END IF;
  END IF;

  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, period_month)
  VALUES (p_outlet, p_category, p_amount, p_description, date_trunc('month', p_period_month)::date, date_trunc('month', p_period_month)::date)
  ON CONFLICT (outlet_id, category, period_month)
  DO UPDATE SET amount = EXCLUDED.amount, description = EXCLUDED.description;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_expense(UUID, TEXT, DATE, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
```

- [ ] **Step 2: Push migration ke remote**

Run: `supabase db push`
Expected: migration `20260702100000` applied; `supabase migration list` sinkron tanpa drift. Jika ada drift riwayat, `supabase migration repair --status applied <id>` dulu (lihat CLAUDE.md).

- [ ] **Step 3: Verifikasi constraint & RPC nyata ada di remote**

Run (SQL editor / psql):
```sql
-- scope CHECK menolak kategori pusat dgn outlet_id terisi
INSERT INTO expenses (outlet_id, category, amount, expense_date, period_month)
VALUES ((SELECT id FROM outlets LIMIT 1), 'gaji_staff_kantor', 1, '2026-07-01', '2026-07-01');
-- Expected: ERROR expenses_scope_check
```
Expected: statement di atas ERROR (bukti CHECK aktif). Lalu `SELECT proname FROM pg_proc WHERE proname IN ('upsert_expense','is_owner');` → dua baris.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260702100000_expenses_outlet_vs_pusat.sql
git commit -m "feat(db): expenses dua scope outlet vs pusat + upsert RPC (ADR-013)"
```

---

## Task 2: `expenseCategories.ts` — kategori kanonik + deriveScope (TDD)

**Files:**
- Create: `apps/admin-dashboard/src/lib/expenseCategories.ts`
- Test: `apps/admin-dashboard/src/lib/expenseCategories.test.ts`

- [ ] **Step 1: Tulis failing test**

```ts
// apps/admin-dashboard/src/lib/expenseCategories.test.ts
import { describe, it, expect } from 'vitest'
import {
  EXPENSE_CATEGORIES, OUTLET_CATEGORIES, PUSAT_CATEGORIES,
  deriveScope, CATEGORY_META,
} from './expenseCategories'

describe('expenseCategories', () => {
  it('punya 14 kategori kanonik (12 outlet + 2 pusat)', () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(14)
    expect(OUTLET_CATEGORIES).toHaveLength(12)
    expect(PUSAT_CATEGORIES).toEqual(['pengeluaran_global', 'gaji_staff_kantor'])
  })

  it('deriveScope: kategori pusat → pusat, sisanya → outlet', () => {
    expect(deriveScope('gaji_staff_kantor')).toBe('pusat')
    expect(deriveScope('pengeluaran_global')).toBe('pusat')
    expect(deriveScope('gaji_crew_outlet')).toBe('outlet')
    expect(deriveScope('pln')).toBe('outlet')
  })

  it('setiap kategori punya label, color, icon', () => {
    for (const c of EXPENSE_CATEGORIES) {
      expect(CATEGORY_META[c].label).toBeTruthy()
      expect(CATEGORY_META[c].color).toMatch(/^#/)
      expect(CATEGORY_META[c].icon).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Run test, verify fail**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/expenseCategories.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/admin-dashboard/src/lib/expenseCategories.ts
import { Wallet, Users, Award, UserCog, Clock, Megaphone, Star, Tag,
  Droplets, Zap, Wifi, Home, Globe, Building2, type LucideIcon } from 'lucide-react'

export const OUTLET_CATEGORIES = [
  'pengeluaran_outlet', 'gaji_crew_outlet', 'bonus_leader', 'bonus_korlap',
  'lembur', 'ads', 'endorsement', 'promo', 'pdam', 'pln', 'internet', 'sewa_outlet',
] as const
export const PUSAT_CATEGORIES = ['pengeluaran_global', 'gaji_staff_kantor'] as const

export const EXPENSE_CATEGORIES = [...OUTLET_CATEGORIES, ...PUSAT_CATEGORIES] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export type ExpenseScope = 'outlet' | 'pusat'

const PUSAT_SET = new Set<string>(PUSAT_CATEGORIES)
export function deriveScope(category: string): ExpenseScope {
  return PUSAT_SET.has(category) ? 'pusat' : 'outlet'
}

export const CATEGORY_META: Record<ExpenseCategory, { label: string; color: string; icon: LucideIcon }> = {
  pengeluaran_outlet: { label: 'Pengeluaran Outlet', color: '#4b5563', icon: Wallet },
  gaji_crew_outlet:   { label: 'Gaji Crew Outlet',   color: '#701604', icon: Users },
  bonus_leader:       { label: 'Bonus Leader',       color: '#b45309', icon: Award },
  bonus_korlap:       { label: 'Bonus Korlap',       color: '#92400e', icon: UserCog },
  lembur:             { label: 'Lembur',             color: '#c2410c', icon: Clock },
  ads:                { label: 'Ads',                color: '#2563eb', icon: Megaphone },
  endorsement:        { label: 'Endorsement',        color: '#7c3aed', icon: Star },
  promo:              { label: 'Promo',              color: '#db2777', icon: Tag },
  pdam:               { label: 'PDAM',               color: '#0891b2', icon: Droplets },
  pln:                { label: 'PLN',                color: '#0a7d2c', icon: Zap },
  internet:           { label: 'Internet',           color: '#0d9488', icon: Wifi },
  sewa_outlet:        { label: 'Biaya Sewa Outlet',  color: '#d97706', icon: Home },
  pengeluaran_global: { label: 'Pengeluaran Global', color: '#dc2626', icon: Globe },
  gaji_staff_kantor:  { label: 'Gaji Staff Kantor',  color: '#9f1239', icon: Building2 },
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/expenseCategories.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/expenseCategories.ts apps/admin-dashboard/src/lib/expenseCategories.test.ts
git commit -m "feat(admin): kategori pengeluaran kanonik + deriveScope"
```

---

## Task 3: `profit.ts` — pisah outlet vs company (TDD)

**Files:**
- Modify: `apps/admin-dashboard/src/lib/profit.ts`
- Test: `apps/admin-dashboard/src/lib/profit.test.ts`

- [ ] **Step 1: Tulis failing test** (tambahkan ke `profit.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { computeOutletProfit, computeCompanyProfit } from './profit'

describe('computeOutletProfit', () => {
  it('laba outlet = omzet - hpp - pengeluaran outlet', () => {
    const r = computeOutletProfit(1_000_000, 300_000, 200_000)
    expect(r.labaKotor).toBe(700_000)
    expect(r.labaBersih).toBe(500_000)
    expect(r.marginBersih).toBeCloseTo(50, 5)
  })
  it('margin 0 saat omzet 0', () => {
    expect(computeOutletProfit(0, 0, 100_000).marginBersih).toBe(0)
  })
})

describe('computeCompanyProfit', () => {
  it('laba perusahaan = Σ laba outlet - pengeluaran pusat', () => {
    const r = computeCompanyProfit(5_000_000, 1_200_000)
    expect(r.labaPerusahaan).toBe(3_800_000)
  })
})
```

- [ ] **Step 2: Run test, verify fail**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/profit.test.ts`
Expected: FAIL — `computeOutletProfit`/`computeCompanyProfit` not exported.

- [ ] **Step 3: Implement** (tambah ke `profit.ts`, pertahankan `computeProfit` lama agar konsumen tak putus)

```ts
export interface OutletProfit {
  labaKotor: number; labaBersih: number; marginKotor: number; marginBersih: number
}

/** Laba Outlet = Omzet − HPP − Pengeluaran Outlet (outlet itu saja). */
export function computeOutletProfit(omzet: number, hpp: number, pengeluaranOutlet: number): OutletProfit {
  const labaKotor = omzet - hpp
  const labaBersih = labaKotor - pengeluaranOutlet
  return {
    labaKotor,
    labaBersih,
    marginKotor: omzet > 0 ? (labaKotor / omzet) * 100 : 0,
    marginBersih: omzet > 0 ? (labaBersih / omzet) * 100 : 0,
  }
}

/** Laba Perusahaan = Σ Laba Outlet − Σ Pengeluaran Pusat. */
export function computeCompanyProfit(sumLabaOutlet: number, pengeluaranPusat: number) {
  return { labaPerusahaan: sumLabaOutlet - pengeluaranPusat }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/profit.test.ts`
Expected: PASS (semua, termasuk test `computeProfit` lama).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/profit.ts apps/admin-dashboard/src/lib/profit.test.ts
git commit -m "feat(admin): computeOutletProfit + computeCompanyProfit"
```

---

## Task 4: `useExpenses.ts` — 14 kategori, nullable outlet, scope

**Files:**
- Modify: `apps/admin-dashboard/src/hooks/useExpenses.ts`

- [ ] **Step 1: Ganti isi hook**

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'
import { deriveScope, type ExpenseCategory, type ExpenseScope } from '@/lib/expenseCategories'

export interface ExpenseRow {
  id: string
  outlet_id: string | null
  outlet_name: string | null
  category: ExpenseCategory
  scope: ExpenseScope
  amount: number
  description: string
  expense_date: string
  period_month: string
}

export function useExpenses(filter: PeriodFilterValue) {
  const supabase = createClient()
  const query = useQuery<ExpenseRow[]>({
    queryKey: ['expenses', filter.from, filter.to, filter.outletId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let q = supabase
        .from('expenses')
        .select('id, outlet_id, category, amount, description, expense_date, period_month, outlets(name)')
        .gte('expense_date', filter.from)
        .lte('expense_date', filter.to)

      // Filter outlet: satu outlet → hanya baris outlet itu (pusat/NULL tak muncul).
      if (filter.outletId !== 'all') {
        q = q.eq('outlet_id', filter.outletId)
      }

      const { data, error } = await q
      if (error) throw error

      return (data ?? []).map((row: any) => ({
        id: row.id,
        outlet_id: row.outlet_id,
        outlet_name: row.outlets?.name ?? (row.outlet_id ? 'Outlet Tidak Dikenal' : null),
        category: row.category,
        scope: deriveScope(row.category),
        amount: Number(row.amount),
        description: row.description ?? '',
        expense_date: row.expense_date,
        period_month: row.period_month,
      })) as ExpenseRow[]
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
```

> Catatan: saat `filter.outletId === 'all'`, query mengembalikan baris outlet **dan** pusat (NULL). Konsumen memisah via `scope`.

- [ ] **Step 2: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 error (konsumen lama `row.amount`/`outlet_name` tetap kompatibel; `outlet_name` kini bisa `null` → cek konsumen di Task 5).

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useExpenses.ts
git commit -m "feat(admin): useExpenses dukung 14 kategori + scope + period_month"
```

---

## Task 5: Expenses report page — section Outlet vs Pusat

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/owner/expenses/page.tsx`

- [ ] **Step 1: Ganti label/warna/ikon lokal → import dari `expenseCategories`**

Hapus konstanta lokal `CATEGORY_LABELS`/`CATEGORY_COLORS`/`CATEGORY_ICONS`. Ganti dengan:
```ts
import { CATEGORY_META, EXPENSE_CATEGORIES } from '@/lib/expenseCategories'
const labelOf = (c: string) => CATEGORY_META[c as keyof typeof CATEGORY_META]?.label ?? c
const colorOf = (c: string) => CATEGORY_META[c as keyof typeof CATEGORY_META]?.color ?? '#cccccc'
const iconOf  = (c: string) => CATEGORY_META[c as keyof typeof CATEGORY_META]?.icon ?? Wallet
```

- [ ] **Step 2: Pisah rows outlet vs pusat**

Setelah `const { rows } = useExpenses(filter)`:
```ts
const outletRows = useMemo(() => rows.filter(r => r.scope === 'outlet'), [rows])
const pusatRows  = useMemo(() => rows.filter(r => r.scope === 'pusat'), [rows])
const totalOutlet = useMemo(() => outletRows.reduce((s, r) => s + r.amount, 0), [outletRows])
const totalPusat  = useMemo(() => pusatRows.reduce((s, r) => s + r.amount, 0), [pusatRows])
```
- Ganti agregasi `byCategory`/`byDate`/`totalExpenses` agar berbasis `outletRows` (distribusi & tren = biaya outlet).
- Tambah kartu KPI **"Biaya Pusat"** (`totalPusat`) yang **hanya** dirender saat `filter.outletId === 'all'` (saat satu outlet dipilih `pusatRows` kosong).
- Tabel rincian: kolom Outlet pakai `row.outlet_name ?? 'PUSAT'`.

- [ ] **Step 3: Sesuaikan stacked bar & pie** memakai `EXPENSE_CATEGORIES` (loop `<Bar>` dari daftar, bukan 6 hardcoded).

```tsx
{EXPENSE_CATEGORIES.filter(c => deriveScope(c) === 'outlet').map(c => (
  <Bar key={c} dataKey={c} name={CATEGORY_META[c].label} stackId="a" fill={CATEGORY_META[c].color} />
))}
```
(Perbarui `byDate` seed object agar mencakup 12 kunci kategori outlet, atau default 0 via `?? 0`.)

- [ ] **Step 4: Verifikasi build + preview**

Run: `cd apps/admin-dashboard && yarn type-check && yarn build`
Expected: 0 error, build sukses. (Smoke visual: halaman render tanpa crash saat rows kosong.)

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/owner/expenses/page.tsx
git commit -m "feat(admin): expenses page section outlet vs pusat + 14 kategori"
```

---

## Task 6: Profit page — Laba Outlet vs Laba Perusahaan

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/owner/profit/page.tsx`

- [ ] **Step 1: Pisah pengeluaran outlet vs pusat + hitung dua level**

Ganti `totalExpenses` lama:
```ts
import { computeCompanyProfit } from '@/lib/profit'

const isAllOutlets = filter.outletId === 'all'
const pengeluaranOutlet = useMemo(
  () => expenses.rows.filter(r => r.scope === 'outlet').reduce((s, r) => s + r.amount, 0),
  [expenses.rows])
const pengeluaranPusat = useMemo(
  () => expenses.rows.filter(r => r.scope === 'pusat').reduce((s, r) => s + r.amount, 0),
  [expenses.rows])
```
- `computeProfit(totalOmzet, totalHpp, pengeluaranOutlet)` → dapat `labaKotor`, `labaBersih` (=Σ laba outlet saat all).
- Saat `isAllOutlets`: **Laba Perusahaan** = `computeCompanyProfit(labaBersih, pengeluaranPusat).labaPerusahaan`. Saat satu outlet: pusat 0 (rows sudah difilter di hook), jadi Laba Perusahaan = Laba Outlet.

- [ ] **Step 2: `outletBreakdown` hanya pakai baris outlet**

Di loop `expenses.rows.forEach(...)`, lewati baris pusat:
```ts
expenses.rows.forEach(e => {
  if (e.scope !== 'outlet' || !e.outlet_id) return
  const cur = map.get(e.outlet_id) ?? { name: e.outlet_name ?? 'Outlet', omzet: 0, expense: 0, hpp: 0 }
  cur.expense += e.amount
  map.set(e.outlet_id, cur)
})
```

- [ ] **Step 3: Kartu KPI**

- "Total Pengeluaran" → tampilkan `pengeluaranOutlet` (label "Biaya Operasional Outlet").
- Tambah kartu **"Biaya Pusat"** (`pengeluaranPusat`) — render **hanya** saat `isAllOutlets`.
- "Laba Bersih" → saat `isAllOutlets` pakai **Laba Perusahaan** (label "Laba Bersih Perusahaan"); saat satu outlet pakai `labaBersih` (label "Laba Bersih Outlet").

- [ ] **Step 4: Verifikasi**

Run: `cd apps/admin-dashboard && yarn type-check && yarn build`
Expected: 0 error, build sukses.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/owner/profit/page.tsx
git commit -m "feat(admin): profit page laba outlet vs perusahaan (exclude pusat dari P&L outlet)"
```

---

## Task 7: Nav entry "Input Pengeluaran" (TDD)

**Files:**
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts`
- Test: `apps/admin-dashboard/src/components/layout/navConfig.test.ts`

- [ ] **Step 1: Tulis failing test**

```ts
it('OWNER punya Input Pengeluaran, MITRA tidak', () => {
  const owner = accessibleItems('OWNER').map(i => i.href)
  const mitra = accessibleItems('MITRA').map(i => i.href)
  expect(owner).toContain('/dashboard/owner/expenses/input')
  expect(mitra).not.toContain('/dashboard/owner/expenses/input')
})
```

- [ ] **Step 2: Run test, verify fail**

Run: `cd apps/admin-dashboard && yarn vitest run src/components/layout/navConfig.test.ts`
Expected: FAIL — href belum ada.

- [ ] **Step 3: Tambah item** ke grup "Owner Dashboard" (setelah item `expenses`):

```ts
{ href: '/dashboard/owner/expenses/input', label: 'Input Pengeluaran', shortLabel: 'Input Biaya', icon: Wallet, roles: ['OWNER', 'ADMIN'] },
```
(Tambah `Wallet` ke import `lucide-react` di baris atas file.)

- [ ] **Step 4: Run test, verify pass**

Run: `cd apps/admin-dashboard && yarn vitest run src/components/layout/navConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/components/layout/navConfig.ts apps/admin-dashboard/src/components/layout/navConfig.test.ts
git commit -m "feat(admin): nav Input Pengeluaran (owner/admin)"
```

---

## Task 8: `useUpsertExpenses` — mutation via RPC

**Files:**
- Create: `apps/admin-dashboard/src/hooks/useUpsertExpenses.ts`

- [ ] **Step 1: Implement hook**

```ts
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { ExpenseCategory } from '@/lib/expenseCategories'

export interface UpsertExpenseInput {
  outletId: string | null   // null = pusat
  category: ExpenseCategory
  periodMonth: string        // 'YYYY-MM-01'
  amount: number
}

export function useUpsertExpenses() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: UpsertExpenseInput[]) => {
      for (const it of items) {
        const { error } = await supabase.rpc('upsert_expense', {
          p_outlet: it.outletId,
          p_category: it.category,
          p_period_month: it.periodMonth,
          p_amount: it.amount,
          p_description: null,
        })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useUpsertExpenses.ts
git commit -m "feat(admin): useUpsertExpenses (RPC upsert rekap bulanan)"
```

---

## Task 9: Form input rekap bulanan

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/owner/expenses/input/page.tsx`

- [ ] **Step 1: Implement page**

```tsx
'use client'

import { useMemo, useState, useEffect } from 'react'
import { useOutlets } from '@/hooks/useOutlets'
import { useExpenses } from '@/hooks/useExpenses'
import { useUpsertExpenses } from '@/hooks/useUpsertExpenses'
import { useRole } from '@/components/layout/RoleContext'
import { OUTLET_CATEGORIES, PUSAT_CATEGORIES, CATEGORY_META, type ExpenseCategory } from '@/lib/expenseCategories'
import { rupiah } from '@/lib/format'

function firstOfMonth(ym: string) { return `${ym}-01` } // ym = 'YYYY-MM'

export default function ExpenseInputPage() {
  const { data: outlets = [] } = useOutlets()
  const { role } = useRole()
  const isOwner = role === 'OWNER'

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [target, setTarget] = useState<string>('')       // outletId | 'PUSAT'
  const isPusat = target === 'PUSAT'
  const periodMonth = firstOfMonth(month)

  // Muat nilai existing untuk bulan+target (untuk pre-fill upsert)
  const filter = useMemo(() => ({
    from: periodMonth, to: periodMonth,
    outletId: isPusat ? 'all' : (target || 'all'),
  }), [periodMonth, target, isPusat])
  const { rows } = useExpenses(filter as any)

  const categories: readonly ExpenseCategory[] = isPusat ? PUSAT_CATEGORIES : OUTLET_CATEGORIES
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const c of categories) {
      const match = rows.find(r => r.category === c &&
        (isPusat ? r.outlet_id === null : r.outlet_id === target) &&
        r.period_month === periodMonth)
      next[c] = match ? String(match.amount) : ''
    }
    setAmounts(next)
  }, [rows, target, month]) // eslint-disable-line react-hooks/exhaustive-deps

  const upsert = useUpsertExpenses()
  const canSubmit = !!target && (!isPusat || isOwner)

  async function handleSave() {
    const items = categories
      .filter(c => amounts[c] !== '' && amounts[c] != null)
      .map(c => ({
        outletId: isPusat ? null : target,
        category: c,
        periodMonth,
        amount: Number(amounts[c]) || 0,
      }))
    await upsert.mutateAsync(items)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm">
        <h2 className="text-xl font-extrabold text-suka-brown">Input Pengeluaran (Rekap Bulanan)</h2>
        <div className="flex gap-3 mt-3">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm" />
          <select value={target} onChange={e => setTarget(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm flex-1">
            <option value="">— Pilih target —</option>
            {isOwner && <option value="PUSAT">🏢 Pengeluaran Pusat (company-wide)</option>}
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      </div>

      {target && (
        <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm space-y-2">
          {categories.map(c => (
            <label key={c} className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-suka-ink">{CATEGORY_META[c].label}</span>
              <input type="number" min={0} value={amounts[c] ?? ''}
                onChange={e => setAmounts(a => ({ ...a, [c]: e.target.value }))}
                className="border rounded-lg px-3 py-1.5 text-sm text-right w-44" placeholder="0" />
            </label>
          ))}
          <button disabled={!canSubmit || upsert.isPending} onClick={handleSave}
            className="mt-3 w-full bg-suka-orange text-white font-bold rounded-lg py-2 disabled:opacity-50">
            {upsert.isPending ? 'Menyimpan…' : 'Simpan Rekap'}
          </button>
          {upsert.isError && <p className="text-red-600 text-sm">{(upsert.error as Error).message}</p>}
          {upsert.isSuccess && <p className="text-suka-green text-sm">Tersimpan · Total {rupiah(
            categories.reduce((s, c) => s + (Number(amounts[c]) || 0), 0))}</p>}
        </div>
      )}
    </div>
  )
}
```

> Verifikasi API `useRole()` / properti `role` sesuai `RoleContext.tsx` (nilai `'OWNER' | 'ADMIN' | 'MITRA' | 'ADMIN_HR'`). Sesuaikan import bila nama export beda.

- [ ] **Step 2: Verifikasi build**

Run: `cd apps/admin-dashboard && yarn type-check && yarn build`
Expected: 0 error, build sukses.

- [ ] **Step 3: Smoke test (preview)** — login owner → `/dashboard/owner/expenses/input`, pilih bulan + outlet → isi angka → Simpan → refresh, angka ter-load lagi (upsert bukan dobel). Pilih "Pengeluaran Pusat" hanya muncul untuk owner.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/owner/expenses/input/page.tsx
git commit -m "feat(admin): form input pengeluaran rekap bulanan (upsert, pusat owner-only)"
```

---

## Task 10: Verifikasi menyeluruh & finalisasi

- [ ] **Step 1: Test + type-check + build penuh**

Run: `cd apps/admin-dashboard && yarn vitest run && yarn type-check && yarn build`
Expected: semua test PASS, 0 type error, build sukses.

- [ ] **Step 2: Cek migration remote sinkron**

Run: `supabase migration list`
Expected: `20260702100000` applied, tanpa drift.

- [ ] **Step 3: Update CLAUDE.md** — tambah ringkasan sesi (fitur pengeluaran dua scope) di bagian Session, tandai next = redeploy admin-dashboard.

```bash
git add CLAUDE.md
git commit -m "docs: catatan sesi pengeluaran outlet vs pusat"
```

---

## Self-Review Notes (spec coverage)

- Skema (nullable outlet_id, 14 kategori, CHECK scope, unique periode) → Task 1 ✓
- RLS baca (pusat owner/admin) + tulis via RPC (owner/admin, pusat owner-only) → Task 1 ✓
- Kategori kanonik + deriveScope → Task 2 ✓
- Profit dua level → Task 3 ✓
- Hook expenses scope-aware → Task 4 ✓
- Expenses report outlet vs pusat → Task 5 ✓
- Profit page semantik company vs outlet → Task 6 ✓
- Nav entry → Task 7 ✓
- Form input rekap bulanan + upsert → Task 8, 9 ✓
- Non-goals (prorata, import CSV, audit) tidak dikerjakan ✓
