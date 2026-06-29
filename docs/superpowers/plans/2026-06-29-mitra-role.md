# Mitra Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `mitra` (partner) role that sees a read-only Owner-style dashboard scoped to the single outlet it holds, with isolation enforced at the database layer.

**Architecture:** Reuse the existing `accessible_outlet_ids()` SQL primitive. Add a `mitra` branch (returns its single home `outlet_id`). New `*_scoped` views and a scoped `get_current_targets()` filter by that helper, so owner/admin still see all 19 outlets while mitra sees only theirs. admin-dashboard hooks repoint to the scoped sources; the admin-dashboard role layer gains a `MITRA` role that is route-guarded to 4 owner pages and renders read-only.

**Tech Stack:** Supabase (Postgres, RLS, SQL views/functions), Next.js 16 (app router), TypeScript, React Query, Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-29-admin-dashboard-mitra-role-design.md`

---

## File Structure

**Central role (packages/auth):**
- Modify `packages/auth/src/types.ts` — add `'mitra'` to `Role`.
- Modify `packages/auth/src/access.ts` — `ROLE_APP_ACCESS.mitra`.

**Database:**
- Create `supabase/migrations/20260629100000_add_mitra_role.sql` — role constraint, `accessible_outlet_ids()` mitra branch, scoped views, scoped `get_current_targets()`, scoped `expenses` SELECT policy.

**admin-dashboard:**
- Modify `src/hooks/useSalesSummary.ts`, `src/hooks/useSalesHourly.ts`, `src/hooks/useMenuSales.ts`, `src/hooks/useTargetProgress.ts` — repoint to scoped views.
- Modify `src/components/layout/RoleContext.tsx` — `MITRA` role, expose `outletId` + `isReadOnly`, route guard.
- Modify `src/components/layout/navConfig.ts` — `MITRA` type + "Dashboard Mitra" group.
- Create `src/components/layout/navConfig.test.ts` — accessibleItems(MITRA).
- Modify `src/app/dashboard/page.tsx` — mitra landing redirect.
- Create `src/hooks/useScopedFilter.ts` — forces filter to mitra outlet + returns `lockedOutletId`.
- Modify `src/components/PeriodFilter.tsx` — `lockedOutletId` prop.
- Modify `src/app/dashboard/owner/page.tsx`, `src/app/dashboard/owner/profit/page.tsx`, `src/app/dashboard/owner/expenses/page.tsx` — use `useScopedFilter`.
- Modify `src/components/DailyTargetBoard.tsx` — hide edit controls when read-only.
- Modify `src/app/dashboard/owner/targets/page.tsx` — read-only rendering.
- Modify `src/components/StaffForm.tsx` — add `mitra` to ROLES.

**Edge function:**
- Modify `supabase/functions/_shared/admin-guard.ts` — add `mitra` to `VALID_ROLES`.

---

## Task 1: Central role type + app-access matrix

**Files:**
- Modify: `packages/auth/src/types.ts:1-9`
- Modify: `packages/auth/src/access.ts:4-13`

- [ ] **Step 1: Add `mitra` to the `Role` union**

In `packages/auth/src/types.ts`, change the `Role` type to:

```ts
export type Role =
  | 'admin'
  | 'admin_hr'
  | 'owner'
  | 'spv'
  | 'leader'
  | 'crew'
  | 'kiosk'
  | 'kitchen'
  | 'mitra'
```

- [ ] **Step 2: Add `mitra` to the app-access matrix**

In `packages/auth/src/access.ts`, add the `mitra` entry to `ROLE_APP_ACCESS` (after the `kiosk` line):

```ts
export const ROLE_APP_ACCESS: Record<Role, AppName[]> = {
  admin: ['pos-kasir', 'absensi', 'stok', 'distribusi', 'owner-dashboard', 'admin-dashboard'],
  admin_hr: ['absensi', 'admin-dashboard'],
  owner: ['owner-dashboard', 'admin-dashboard'],
  spv: ['absensi', 'stok', 'distribusi'],
  kitchen: ['stok', 'distribusi'],
  leader: ['pos-kasir', 'absensi', 'stok', 'distribusi'],
  crew: ['absensi', 'pos-kasir', 'stok', 'distribusi'],
  kiosk: ['pos-kasir'],
  mitra: ['admin-dashboard'],
}
```

- [ ] **Step 3: Rebuild `@suka/auth`**

The package compiles to `dist/`; consumers import the built output, so edits to `src/` are inert until rebuilt.

Run: `cd "d:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/packages/auth" && yarn build`
Expected: build completes, `dist/` updated, no TS errors.

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/types.ts packages/auth/src/access.ts packages/auth/dist
git commit -m "feat(auth): add mitra role to Role type and app-access matrix"
```

---

## Task 2: Database migration — role constraint, scoping helper, scoped views, scoped targets RPC, scoped expenses RLS

**Files:**
- Create: `supabase/migrations/20260629100000_add_mitra_role.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260629100000_add_mitra_role.sql` with exactly:

```sql
-- 20260629100000_add_mitra_role.sql
-- Role baru 'mitra': partner/investor 1 outlet. Hanya akses admin-dashboard,
-- read-only, scope ke outlet_id home-nya. Isolasi server-enforced via
-- accessible_outlet_ids(). Owner/admin tidak terpengaruh (helper mengembalikan
-- semua outlet untuk mereka).

-- 1. Perluas CHECK constraint outlet_staff.role dengan 'mitra'
ALTER TABLE public.outlet_staff
  DROP CONSTRAINT IF EXISTS outlet_staff_role_check;
ALTER TABLE public.outlet_staff
  ADD CONSTRAINT outlet_staff_role_check
  CHECK (role IN ('admin', 'admin_hr', 'owner', 'spv', 'leader', 'crew', 'kiosk', 'kitchen', 'mitra'));

-- 2. accessible_outlet_ids: mitra → outlet_id home (single), seperti crew/kiosk
CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT id, role, outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  )
  SELECT o.id FROM public.outlets o, me
    WHERE me.role IN ('admin', 'admin_hr', 'owner', 'spv', 'kitchen')
  UNION
  SELECT so.outlet_id FROM public.staff_outlets so, me
    WHERE me.role = 'leader' AND so.staff_id = me.id
  UNION
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('leader', 'crew', 'kiosk', 'mitra');
$$;

-- 3. Scoped views — filter ke outlet yang boleh diakses pemanggil.
--    accessible_outlet_ids() (SECURITY DEFINER) membaca auth.uid() pemanggil,
--    jadi owner/admin → semua outlet, mitra → satu outlet.
CREATE OR REPLACE VIEW public.sales_hourly_scoped AS
  SELECT * FROM public.sales_hourly_spv
  WHERE outlet_id IN (SELECT public.accessible_outlet_ids());
GRANT SELECT ON public.sales_hourly_scoped TO authenticated;

CREATE OR REPLACE VIEW public.menu_sales_scoped AS
  SELECT * FROM public.menu_sales_spv
  WHERE outlet_id IN (SELECT public.accessible_outlet_ids());
GRANT SELECT ON public.menu_sales_scoped TO authenticated;

CREATE OR REPLACE VIEW public.daily_target_progress_scoped AS
  SELECT * FROM public.daily_target_progress_spv
  WHERE outlet_id IN (SELECT public.accessible_outlet_ids());
GRANT SELECT ON public.daily_target_progress_scoped TO authenticated;

-- 4. get_current_targets: scope ke accessible outlets (owner/admin tetap semua)
CREATE OR REPLACE FUNCTION public.get_current_targets()
RETURNS TABLE (outlet_id UUID, outlet_name TEXT, target_amount NUMERIC, is_override BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.id,
    o.name,
    public.resolve_daily_target(o.id, (now() AT TIME ZONE 'Asia/Jakarta')::date),
    EXISTS (SELECT 1 FROM public.daily_sales_targets t WHERE t.outlet_id = o.id)
  FROM public.outlets o
  WHERE o.id IN (SELECT public.accessible_outlet_ids())
  ORDER BY o.name;
$$;

-- 5. expenses: ganti SELECT policy permissif (USING true) → scoped.
--    Owner/admin/spv tetap baca semua (helper kembalikan semua outlet).
--    INSERT/UPDATE/DELETE tetap seperti semula (mitra tak punya UI tulis).
DROP POLICY IF EXISTS "expenses_select_all" ON public.expenses;
CREATE POLICY "expenses_select_scoped" ON public.expenses
  FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));
```

- [ ] **Step 2: Commit (apply happens in Task 10)**

```bash
git add supabase/migrations/20260629100000_add_mitra_role.sql
git commit -m "feat(db): mitra role constraint, scoped views, scoped targets RPC, scoped expenses RLS"
```

Note: This migration is applied to the remote in Task 10 (after the app code is ready), following the project's `supabase db push` workflow.

---

## Task 3: Repoint admin-dashboard hooks to scoped views

**Files:**
- Modify: `apps/admin-dashboard/src/hooks/useSalesSummary.ts:20`
- Modify: `apps/admin-dashboard/src/hooks/useSalesHourly.ts:20`
- Modify: `apps/admin-dashboard/src/hooks/useMenuSales.ts:14`
- Modify: `apps/admin-dashboard/src/hooks/useTargetProgress.ts:24`

- [ ] **Step 1: Repoint `useSalesSummary`**

In `useSalesSummary.ts`, change the source table:

```ts
      let q = supabase
        .from('sales_hourly_scoped')
        .select('outlet_id, sales_source, sales_date, omzet, jumlah_order_completed')
```

- [ ] **Step 2: Repoint `useSalesHourly`**

In `useSalesHourly.ts`:

```ts
      let q = supabase
        .from('sales_hourly_scoped')
        .select('sales_hour, omzet, jumlah_order_completed')
```

- [ ] **Step 3: Repoint `useMenuSales`**

In `useMenuSales.ts`:

```ts
      let q = supabase
        .from('menu_sales_scoped')
        .select('outlet_id, sales_source, sales_date, menu_key, menu_name, qty, revenue')
```

- [ ] **Step 4: Repoint `useTargetProgress`**

In `useTargetProgress.ts`, change the `fetchRows` source:

```ts
    const { data } = await supabase
      .from('daily_target_progress_scoped')
      .select('*')
      .order('outlet_name')
```

- [ ] **Step 5: Type-check**

Run: `cd "d:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useSalesSummary.ts apps/admin-dashboard/src/hooks/useSalesHourly.ts apps/admin-dashboard/src/hooks/useMenuSales.ts apps/admin-dashboard/src/hooks/useTargetProgress.ts
git commit -m "feat(admin-dashboard): read from scoped views so mitra is outlet-isolated"
```

---

## Task 4: RoleContext — add MITRA, expose outletId + isReadOnly, route guard

**Files:**
- Modify: `apps/admin-dashboard/src/components/layout/RoleContext.tsx`

- [ ] **Step 1: Widen the local Role type and context shape**

In `RoleContext.tsx`, change lines 7-11:

```ts
type Role = 'ADMIN_HR' | 'OWNER' | 'ADMIN' | 'MITRA'

interface RoleContextType {
  role: Role
  outletId: string | null
  isReadOnly: boolean
}
```

- [ ] **Step 2: Track outletId and allow MITRA through the gate**

Replace the component body's state + first effect (lines 16-46) with:

```ts
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { outletStaff, loading } = useAuth()
  const [role, setRole] = useState<Role | null>(null)
  const [outletId, setOutletId] = useState<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (outletStaff?.role) {
      const mappedRole = outletStaff.role.toUpperCase() as Role
      if (['OWNER', 'ADMIN', 'ADMIN_HR', 'MITRA'].includes(mappedRole)) {
        setRole(mappedRole)
        setOutletId(outletStaff.outlet_id ?? null)
      } else {
        // Redirect to Portal if the role is not allowed in admin-dashboard (e.g. crew)
        const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
        let url = portalUrl
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
          url = 'http://localhost:3010'
        }
        window.location.href = url
      }
    } else if (outletStaff === null) {
      // Redirect to Portal if no staff profile is found
      const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
      let url = portalUrl
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        url = 'http://localhost:3010'
      }
      window.location.href = url
    }
  }, [outletStaff, loading])
```

- [ ] **Step 3: Add the mitra route guard and update the provider value**

Replace the existing OWNER route-guard effect + provider value (lines 48-75) with:

```ts
  // Route-guard: Redirect OWNER to /dashboard/owner if trying to access HR or Admin paths
  useEffect(() => {
    if (role === 'OWNER') {
      const isHrRoute = pathname.startsWith('/dashboard/hr')
      const isAdminRoute = pathname.startsWith('/dashboard/system-health') || pathname.startsWith('/dashboard/outlets')
      if (isHrRoute || isAdminRoute) {
        router.replace('/dashboard/owner')
      }
    }
  }, [role, pathname, router])

  // Route-guard: MITRA may only see its 4 read-only pages.
  useEffect(() => {
    if (role !== 'MITRA') return
    const allowed = [
      '/dashboard/owner',
      '/dashboard/owner/targets',
      '/dashboard/owner/profit',
      '/dashboard/owner/expenses',
    ]
    if (!allowed.includes(pathname)) {
      router.replace('/dashboard/owner')
    }
  }, [role, pathname, router])

  if (loading || !role) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-suka-cream">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-suka-orange border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-suka-brown tracking-wide animate-pulse">Memuat Akses...</p>
        </div>
      </div>
    )
  }

  return (
    <RoleContext.Provider value={{ role, outletId, isReadOnly: role === 'MITRA' }}>
      {children}
    </RoleContext.Provider>
  )
}
```

- [ ] **Step 4: Type-check**

Run: `cd "d:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/components/layout/RoleContext.tsx
git commit -m "feat(admin-dashboard): MITRA role in RoleContext with outlet scope + route guard"
```

---

## Task 5: navConfig — Dashboard Mitra group (TDD)

**Files:**
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts:7,12-46`
- Create: `apps/admin-dashboard/src/components/layout/navConfig.test.ts`

- [ ] **Step 1: Write the failing test**

Create `navConfig.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { accessibleItems } from './navConfig'

describe('accessibleItems for MITRA', () => {
  const items = accessibleItems('MITRA')
  const hrefs = items.map((i) => i.href)

  it('exposes exactly the 4 mitra pages', () => {
    expect(hrefs).toEqual([
      '/dashboard/owner',
      '/dashboard/owner/targets',
      '/dashboard/owner/profit',
      '/dashboard/owner/expenses',
    ])
  })

  it('never exposes Pesan ke Kasir, HR, or System routes', () => {
    expect(hrefs).not.toContain('/dashboard/owner/messages')
    expect(hrefs.some((h) => h.startsWith('/dashboard/hr'))).toBe(false)
    expect(hrefs).not.toContain('/dashboard/outlets')
    expect(hrefs).not.toContain('/dashboard/system-health')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "d:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn test navConfig`
Expected: FAIL — `'MITRA'` is not assignable / no MITRA items returned.

- [ ] **Step 3: Add MITRA to the Role type and a Dashboard Mitra group**

In `navConfig.ts`, change line 7:

```ts
export type Role = 'ADMIN_HR' | 'OWNER' | 'ADMIN' | 'MITRA'
```

Then add this group to the `NAV_GROUPS` array, immediately after the `'Owner Dashboard'` group object (before the `'System & Admin'` group):

```ts
  {
    title: 'Dashboard Mitra',
    roles: ['MITRA'],
    items: [
      { href: '/dashboard/owner', label: 'Ringkasan Bisnis', shortLabel: 'Ringkasan', icon: PieChart, roles: ['MITRA'] },
      { href: '/dashboard/owner/targets', label: 'Target Harian', shortLabel: 'Target', icon: Target, roles: ['MITRA'] },
      { href: '/dashboard/owner/profit', label: 'Profitabilitas', shortLabel: 'Laba Rugi', icon: DollarSign, roles: ['MITRA'] },
      { href: '/dashboard/owner/expenses', label: 'Pengeluaran', shortLabel: 'Biaya', icon: Activity, roles: ['MITRA'] },
    ],
  },
```

(`PieChart`, `Target`, `DollarSign`, `Activity` are already imported at the top of the file.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "d:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn test navConfig`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/components/layout/navConfig.ts apps/admin-dashboard/src/components/layout/navConfig.test.ts
git commit -m "feat(admin-dashboard): Dashboard Mitra nav group (4 read-only pages)"
```

---

## Task 6: Mitra landing redirect

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/page.tsx:12-20`

- [ ] **Step 1: Add MITRA branch to the landing redirect**

In `dashboard/page.tsx`, change the effect to:

```ts
  useEffect(() => {
    if (role === 'OWNER') {
      router.replace('/dashboard/owner')
    } else if (role === 'MITRA') {
      router.replace('/dashboard/owner')
    } else if (role === 'ADMIN_HR') {
      router.replace('/dashboard/hr')
    } else if (role === 'ADMIN') {
      router.replace('/dashboard/system-health')
    }
  }, [role, router])
```

- [ ] **Step 2: Type-check**

Run: `cd "d:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/page.tsx
git commit -m "feat(admin-dashboard): land mitra on /dashboard/owner"
```

---

## Task 7: Scoped filter hook + locked PeriodFilter

**Files:**
- Create: `apps/admin-dashboard/src/hooks/useScopedFilter.ts`
- Modify: `apps/admin-dashboard/src/components/PeriodFilter.tsx:123-146,229-301`
- Modify: `apps/admin-dashboard/src/app/dashboard/owner/page.tsx:8,22-23,45`
- Modify: `apps/admin-dashboard/src/app/dashboard/owner/profit/page.tsx:5,18,97`
- Modify: `apps/admin-dashboard/src/app/dashboard/owner/expenses/page.tsx:5,45,89`

- [ ] **Step 1: Create the scoped-filter hook**

Create `useScopedFilter.ts`:

```ts
'use client'
import { useEffect } from 'react'
import { useDashboardStore } from './useDashboardStore'
import { useRole } from '@/components/layout/RoleContext'

/**
 * Wraps the dashboard period filter. For a read-only role (mitra) it forces
 * filter.outletId to the mitra's outlet and returns a non-null `lockedOutletId`
 * so PeriodFilter can render the outlet as a fixed label instead of a picker.
 */
export function useScopedFilter() {
  const { filter, setFilter } = useDashboardStore()
  const { isReadOnly, outletId } = useRole()

  useEffect(() => {
    if (isReadOnly && outletId && filter.outletId !== outletId) {
      setFilter({ ...filter, outletId })
    }
  }, [isReadOnly, outletId, filter, setFilter])

  return { filter, setFilter, lockedOutletId: isReadOnly ? outletId : null }
}
```

- [ ] **Step 2: Add `lockedOutletId` support to PeriodFilter**

In `PeriodFilter.tsx`, change the `PeriodFilter` function signature and the outlet slot. Replace the props block (lines 229-235) with:

```ts
export function PeriodFilter({
  value, onChange, outlets, lockedOutletId,
}: {
  value: PeriodFilterValue
  onChange: (v: PeriodFilterValue) => void
  outlets: { id: string; name: string }[]
  lockedOutletId?: string | null
}) {
```

Then replace the `<OutletCombobox ... />` usage (lines 289-293) with:

```ts
        {lockedOutletId ? (
          <div className="w-full sm:w-auto flex items-center gap-2 pl-9 pr-4 py-2.5 sm:py-2 bg-suka-cream/30 border border-suka-gray-200 rounded-xl text-xs font-bold text-suka-brown relative sm:min-w-[180px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-brown/50">
              <Store className="w-4 h-4" />
            </span>
            <span className="truncate text-left flex-1">
              {cleanOutletName(outlets.find((o) => o.id === lockedOutletId)?.name ?? 'Outlet Saya')}
            </span>
          </div>
        ) : (
          <OutletCombobox
            value={value.outletId}
            outlets={outlets}
            onChange={(outletId) => onChange({ ...value, outletId: outletId as PeriodFilterValue['outletId'] })}
          />
        )}
```

(`cleanOutletName` and `Store` are already defined/imported in this file.)

- [ ] **Step 3: Wire the hook into the Ringkasan page (and scope the leaderboard)**

`OutletLeaderboard` merges its `allOutlets` prop into the table, showing every
outlet name (with Rp 0 for outlets absent from the scoped sales rows). For a
mitra that would leak all 19 outlet names, so the leaderboard must receive a
scoped outlet list too.

In `owner/page.tsx`: replace the `useDashboardStore` import (line 8) with the scoped hook import:

```ts
import { useScopedFilter } from '@/hooks/useScopedFilter'
```

Replace line 23 (`const { filter, setFilter } = useDashboardStore()`) with:

```ts
  const { filter, setFilter, lockedOutletId } = useScopedFilter()
```

Immediately after that line, add a scoped outlet list (used by both the filter and the leaderboard):

```ts
  const scopedOutlets = useMemo(
    () => (lockedOutletId ? outlets.filter((o) => o.id === lockedOutletId) : outlets),
    [outlets, lockedOutletId]
  )
```

(`useMemo` is already imported at the top of this file.)

Replace the `<PeriodFilter ... />` usage (line 45) with:

```ts
        <PeriodFilter value={filter} onChange={setFilter} outlets={scopedOutlets} lockedOutletId={lockedOutletId} />
```

Replace the `<OutletLeaderboard ... />` usage (line 78) with:

```ts
          <OutletLeaderboard entries={leaderboard} allOutlets={scopedOutlets} />
```

- [ ] **Step 4: Wire the hook into the Profit page**

In `owner/profit/page.tsx`: replace the `useDashboardStore` import (line 5) with:

```ts
import { useScopedFilter } from '@/hooks/useScopedFilter'
```

Replace line 18 (`const { filter, setFilter } = useDashboardStore()`) with:

```ts
  const { filter, setFilter, lockedOutletId } = useScopedFilter()
```

Replace the `<PeriodFilter ... />` usage (line 97) with:

```ts
        <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} lockedOutletId={lockedOutletId} />
```

- [ ] **Step 5: Wire the hook into the Expenses page**

In `owner/expenses/page.tsx`: replace the `useDashboardStore` import (line 5) with:

```ts
import { useScopedFilter } from '@/hooks/useScopedFilter'
```

Replace line 45 (`const { filter, setFilter } = useDashboardStore()`) with:

```ts
  const { filter, setFilter, lockedOutletId } = useScopedFilter()
```

Replace the `<PeriodFilter ... />` usage (line 89) with:

```ts
        <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} lockedOutletId={lockedOutletId} />
```

- [ ] **Step 6: Type-check**

Run: `cd "d:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useScopedFilter.ts apps/admin-dashboard/src/components/PeriodFilter.tsx apps/admin-dashboard/src/app/dashboard/owner/page.tsx apps/admin-dashboard/src/app/dashboard/owner/profit/page.tsx apps/admin-dashboard/src/app/dashboard/owner/expenses/page.tsx
git commit -m "feat(admin-dashboard): lock period filter to mitra outlet"
```

---

## Task 8: Read-only gating (DailyTargetBoard + Targets page)

**Files:**
- Modify: `apps/admin-dashboard/src/components/DailyTargetBoard.tsx:1-6,12-14,143-153,162-172`
- Modify: `apps/admin-dashboard/src/app/dashboard/owner/targets/page.tsx`

- [ ] **Step 1: Make `DailyTargetBoard` honor read-only**

In `DailyTargetBoard.tsx`, add the `useRole` import after the existing imports (around line 6):

```ts
import { useRole } from '@/components/layout/RoleContext'
```

Inside the component (after line 13, `const supabase = useMemo(...)`), add:

```ts
  const { isReadOnly } = useRole()
```

Wrap the "Set Target" button (lines 143-152) so it only renders when editable:

```ts
            {!isReadOnly && (
              <button
                onClick={() => {
                  setTargetScope('global')
                  setModalOpen(true)
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-suka-cream/50 hover:bg-suka-cream border border-suka-brown/10 text-suka-brown rounded-lg text-xs font-bold transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Set Target
              </button>
            )}
```

Make the per-outlet cards non-interactive in read-only mode by replacing the card's `onClick` (lines 167-171) with:

```ts
                    onClick={() => {
                      if (isReadOnly) return
                      setTargetScope(r.outlet_id)
                      setModalOpen(true)
                    }}
```

- [ ] **Step 2: Make the Targets page read-only for mitra**

In `owner/targets/page.tsx`, add the `useRole` import after the existing imports (around line 6):

```ts
import { useRole } from '@/components/layout/RoleContext'
```

Inside `TargetsPage`, after line 20 (`const supabase = useMemo(...)`), add:

```ts
  const { isReadOnly } = useRole()
```

Replace the global-default card block (lines 132-161, the `{/* Global default */}` `<div>...</div>`) with a version hidden in read-only mode:

```ts
          {/* Global default — editing only; mitra (read-only) does not see it */}
          {!isReadOnly && (
            <div className="bg-gradient-to-br from-suka-brown to-suka-ink text-white p-5 sm:p-6 rounded-2xl shadow-md shadow-suka-brown/10">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-suka-cream/90" />
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-suka-cream">Target Default (Semua Outlet)</h3>
              </div>
              <p className="text-[11px] text-suka-cream/70 font-medium mb-4">
                Outlet tanpa override mengikuti angka ini. Saat ini: <b className="text-white">{rupiah(globalDefault)}</b> / hari
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-sm font-bold">Rp</span>
                  <input
                    inputMode="numeric"
                    value={globalInput ? Number(globalInput).toLocaleString('id-ID') : ''}
                    onChange={(e) => setGlobalInput(e.target.value.replace(/\D/g, ''))}
                    placeholder={globalDefault ? globalDefault.toLocaleString('id-ID') : 'mis. 5.000.000'}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-bold text-suka-ink bg-white outline-none focus:ring-2 focus:ring-suka-orange/40"
                  />
                </div>
                <button
                  onClick={saveGlobal}
                  disabled={savingKey === 'global' || !globalInput}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-suka-orange hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-sm transition-all active:scale-95"
                >
                  {savingKey === 'global' ? <Loader2 className="w-4 h-4 animate-spin" /> : savedKey === 'global' ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  Simpan
                </button>
              </div>
            </div>
          )}
```

Then, inside the per-outlet row's `<div className="flex flex-1 gap-2">` block (lines 200-229), gate the editing controls. Replace that whole `<div className="flex flex-1 gap-2">...</div>` with:

```ts
                    {isReadOnly ? (
                      <div className="flex flex-1 items-center">
                        <span className="text-sm font-extrabold text-suka-brown">{rupiah(r.target_amount)}</span>
                        <span className="ml-2 text-[10px] font-bold text-suka-gray-400 uppercase">/ hari</span>
                      </div>
                    ) : (
                      <div className="flex flex-1 gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400 text-xs font-bold">Rp</span>
                          <input
                            inputMode="numeric"
                            value={overrideInputs[r.outlet_id] ? Number(overrideInputs[r.outlet_id]).toLocaleString('id-ID') : ''}
                            onChange={(e) => setOverrideInputs((m) => ({ ...m, [r.outlet_id]: e.target.value.replace(/\D/g, '') }))}
                            placeholder="set override..."
                            className="w-full pl-8 pr-3 py-2 rounded-xl text-sm font-bold text-suka-ink bg-suka-cream/30 border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10"
                          />
                        </div>
                        <button
                          onClick={() => saveOverride(r.outlet_id)}
                          disabled={isSaving || !(overrideInputs[r.outlet_id] ?? '')}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-suka-orange hover:bg-amber-600 disabled:opacity-40 text-white font-bold text-xs transition-all active:scale-95 shrink-0"
                        >
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">Simpan</span>
                        </button>
                        {r.is_override && (
                          <button
                            onClick={() => clearOverride(r.outlet_id)}
                            disabled={isSaving}
                            title="Hapus override (ikut default)"
                            className="flex items-center justify-center px-2.5 py-2 rounded-xl border border-suka-gray-200 text-suka-gray-500 hover:text-suka-brown hover:border-suka-brown/20 transition-all active:scale-95 shrink-0"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
```

- [ ] **Step 3: Type-check**

Run: `cd "d:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/components/DailyTargetBoard.tsx apps/admin-dashboard/src/app/dashboard/owner/targets/page.tsx
git commit -m "feat(admin-dashboard): read-only target views for mitra"
```

---

## Task 9: Provisioning — StaffForm role option + edge function whitelist

**Files:**
- Modify: `apps/admin-dashboard/src/components/StaffForm.tsx:8`
- Modify: `supabase/functions/_shared/admin-guard.ts:1`

- [ ] **Step 1: Add `mitra` to the StaffForm role list**

In `StaffForm.tsx`, change line 8:

```ts
const ROLES: Role[] = ['admin', 'admin_hr', 'owner', 'spv', 'kitchen', 'leader', 'crew', 'kiosk', 'mitra']
```

- [ ] **Step 2: Add `mitra` to the edge-function role whitelist**

In `supabase/functions/_shared/admin-guard.ts`, change line 1:

```ts
const VALID_ROLES = ["admin", "admin_hr", "owner", "spv", "leader", "kasir", "crew", "kiosk", "kitchen", "mitra"];
```

- [ ] **Step 3: Type-check admin-dashboard**

Run: `cd "d:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/components/StaffForm.tsx supabase/functions/_shared/admin-guard.ts
git commit -m "feat: allow creating mitra accounts (StaffForm + create-staff guard)"
```

Note: The `admin-create-staff` edge function is **not auto-deployed** from the repo. Until it is redeployed, create the test mitra account via SQL/Supabase Dashboard (Task 10, Step 4).

---

## Task 10: Apply migration, build, and verify end-to-end

**Files:** none (operational)

- [ ] **Step 1: Run the full admin-dashboard test suite**

Run: `cd "d:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn test`
Expected: all tests pass (existing suite + new `navConfig` tests).

- [ ] **Step 2: Build admin-dashboard**

Run: `cd "d:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn build`
Expected: build succeeds, 0 type errors.

- [ ] **Step 3: Apply the migration to remote**

Per the project workflow (history often diverged — reconcile with `supabase migration repair` before pushing if needed):

Run: `cd "d:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && supabase migration list`
Then: `supabase db push`
Expected: `20260629100000_add_mitra_role` applied; `migration list` shows it synced with no drift.

- [ ] **Step 4: Seed one test mitra account**

In the Supabase Dashboard (Auth → create user, then link in `outlet_staff`), or via SQL with a known auth user id, create a mitra bound to one outlet. Example SQL (replace `<auth-user-id>` and `<outlet-id>`):

```sql
INSERT INTO public.outlet_staff (id, outlet_id, name, role, username, status)
VALUES ('<auth-user-id>', '<outlet-id>', 'Mitra Uji', 'mitra', 'mitra_uji', 'active');
```

Expected: insert succeeds (proves the role CHECK constraint accepts `mitra`).

- [ ] **Step 5: Manual smoke test (login as mitra)**

Verify each:
- Sidebar shows ONLY the "Dashboard Mitra" group with 4 items (Ringkasan, Target Harian, Profitabilitas, Pengeluaran). No HR, no System & Admin, no "Pesan ke Kasir".
- Landing goes to `/dashboard/owner`.
- Period filter shows the mitra's outlet as a fixed label (no "Semua Outlet", no outlet picker).
- Ringkasan / Profit / Expenses show numbers for the mitra's outlet only; other outlets' figures are absent.
- Target Harian shows the outlet's target value with no input/Save/Clear controls; the global-default card is hidden; the Ringkasan "Set Target" button is hidden.
- Manually navigating to `/dashboard/hr` or `/dashboard/owner/messages` redirects to `/dashboard/owner`.

- [ ] **Step 6: Verify DB isolation directly (defense check)**

While logged in as the mitra (using the browser network tab or a Supabase client with the mitra session), query a scoped view and confirm only the mitra's `outlet_id` returns:

```
select distinct outlet_id from sales_hourly_scoped;
```

Expected: exactly one outlet_id (the mitra's). Repeat as an owner session → all 19 outlet_ids.

- [ ] **Step 7: Final commit (if any tracked build artifacts changed)**

```bash
git add -A
git commit -m "chore(admin-dashboard): mitra role build + migration applied" || echo "nothing to commit"
```

---

## Notes / pre-existing drift (do not fix unless asked)

- `accessible_outlet_ids()` is reproduced verbatim from the latest migration with only the `mitra` addition; it intentionally keeps the existing branches (e.g. `kitchen` global, `leader` via `staff_outlets`).
- The `expenses` table previously had a fully-permissive `SELECT USING (true)` policy — Task 2 tightens it to scoped. This also (correctly) scopes expense reads for crew/leader, who have no expenses UI, so there is no user-facing regression.
- `get_current_targets()` previously returned all outlets unconditionally; Task 2 scopes it. Owner/admin are unaffected because the helper returns all outlets for them.
- The `daily_sales_targets` table already has owner/admin-only RLS (`is_owner_or_admin()`), so the plan deliberately does **not** add a table SELECT policy for mitra (the spec mentioned it as one option). Mitra reads targets only through the scoped definer RPC `get_current_targets()` and the `daily_target_progress_scoped` view, and the global-default direct read is hidden in read-only mode (Task 8). The edit RPCs (`set_daily_target`, `clear_daily_target_override`) are already guarded by `is_owner_or_admin()`, so mitra is blocked server-side even if a request were forged.
