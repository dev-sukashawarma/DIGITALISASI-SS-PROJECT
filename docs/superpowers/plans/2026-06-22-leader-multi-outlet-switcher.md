# Leader Multi-Outlet Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `leader` role user (bound to multiple outlets via `staff_outlets`) switch which outlet's data they see across `apps/stok` (ledger, opname, permintaan, monitoring), persisted in localStorage.

**Architecture:** A new `OutletScopeProvider` (React context, wraps `AuthProvider` output in `Providers.tsx`) computes `boundOutlets` (one entry for single-outlet roles, fetched from `staff_outlets` for leader) and `selectedOutletId` (localStorage-backed, keyed by staff id). A new `OutletSwitcher` dropdown (visible only when `isMultiOutlet`) is added to the page headers of ledger/opname/permintaan. Existing data hooks/pages swap their outlet-id source from `outletStaff.outlet_id` to `useOutletScope().selectedOutletId`. Monitoring routes `leader` to `SPVDashboard` (instead of `CrewDashboard`) with a new `allowedOutletIds` prop that filters the outlet list to the leader's `boundOutlets`.

**Tech Stack:** Next.js (app router) + React 19, `@tanstack/react-query`, Supabase JS client, TailwindCSS, Vitest + `@testing-library/react`.

---

### Task 1: `useOutletScope` hook + `OutletScopeProvider`

**Files:**
- Create: `apps/stok/src/hooks/useOutletScope.tsx`
- Test: `apps/stok/src/hooks/__tests__/useOutletScope.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/stok/src/hooks/__tests__/useOutletScope.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OutletScopeProvider, useOutletScope } from '../useOutletScope'

const mockUseAuth = vi.fn()
vi.mock('@suka/auth', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockEq = vi.fn()
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: (...args: unknown[]) => mockEq(...args),
      }),
    }),
  }),
}))

function Probe() {
  const { boundOutlets, selectedOutletId, isMultiOutlet, setSelectedOutletId } = useOutletScope()
  return (
    <div>
      <span data-testid="count">{boundOutlets.length}</span>
      <span data-testid="selected">{selectedOutletId ?? 'none'}</span>
      <span data-testid="multi">{String(isMultiOutlet)}</span>
      <button onClick={() => setSelectedOutletId('outlet-b')}>pick-b</button>
      <button onClick={() => setSelectedOutletId('not-bound')}>pick-invalid</button>
    </div>
  )
}

function renderProbe() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <OutletScopeProvider>
        <Probe />
      </OutletScopeProvider>
    </QueryClientProvider>
  )
}

describe('useOutletScope', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockEq.mockReset()
  })

  it('fixes single-outlet role (kasir) to outlet_staff.outlet_id, switcher hidden', async () => {
    mockUseAuth.mockReturnValue({
      outletStaff: { id: 'staff-1', role: 'kasir', outlet_id: 'outlet-home', outlets: { name: 'Outlet Home' } },
    })
    renderProbe()
    expect(await screen.findByTestId('selected')).toHaveTextContent('outlet-home')
    expect(screen.getByTestId('multi')).toHaveTextContent('false')
    expect(screen.getByTestId('count')).toHaveTextContent('1')
  })

  it('fetches staff_outlets and defaults to first bound outlet for leader', async () => {
    mockEq.mockResolvedValue({
      data: [
        { outlet_id: 'outlet-a', outlets: { id: 'outlet-a', name: 'Outlet A' } },
        { outlet_id: 'outlet-b', outlets: { id: 'outlet-b', name: 'Outlet B' } },
      ],
      error: null,
    })
    mockUseAuth.mockReturnValue({
      outletStaff: { id: 'staff-leader', role: 'leader', outlet_id: null, outlets: null },
    })
    renderProbe()
    expect(await screen.findByTestId('selected')).toHaveTextContent('outlet-a')
    expect(screen.getByTestId('multi')).toHaveTextContent('true')
    expect(screen.getByTestId('count')).toHaveTextContent('2')
  })

  it('restores previously selected outlet from localStorage if still bound', async () => {
    window.localStorage.setItem('stok:selectedOutletId:staff-leader', 'outlet-b')
    mockEq.mockResolvedValue({
      data: [
        { outlet_id: 'outlet-a', outlets: { id: 'outlet-a', name: 'Outlet A' } },
        { outlet_id: 'outlet-b', outlets: { id: 'outlet-b', name: 'Outlet B' } },
      ],
      error: null,
    })
    mockUseAuth.mockReturnValue({
      outletStaff: { id: 'staff-leader', role: 'leader', outlet_id: null, outlets: null },
    })
    renderProbe()
    expect(await screen.findByTestId('selected')).toHaveTextContent('outlet-b')
  })

  it('falls back to first bound outlet if stored selection is no longer bound', async () => {
    window.localStorage.setItem('stok:selectedOutletId:staff-leader', 'outlet-stale')
    mockEq.mockResolvedValue({
      data: [{ outlet_id: 'outlet-a', outlets: { id: 'outlet-a', name: 'Outlet A' } }],
      error: null,
    })
    mockUseAuth.mockReturnValue({
      outletStaff: { id: 'staff-leader', role: 'leader', outlet_id: null, outlets: null },
    })
    renderProbe()
    expect(await screen.findByTestId('selected')).toHaveTextContent('outlet-a')
  })

  it('setSelectedOutletId rejects ids outside boundOutlets and persists valid ones', async () => {
    mockEq.mockResolvedValue({
      data: [
        { outlet_id: 'outlet-a', outlets: { id: 'outlet-a', name: 'Outlet A' } },
        { outlet_id: 'outlet-b', outlets: { id: 'outlet-b', name: 'Outlet B' } },
      ],
      error: null,
    })
    mockUseAuth.mockReturnValue({
      outletStaff: { id: 'staff-leader', role: 'leader', outlet_id: null, outlets: null },
    })
    renderProbe()
    await screen.findByTestId('selected')

    act(() => screen.getByText('pick-invalid').click())
    expect(screen.getByTestId('selected')).toHaveTextContent('outlet-a')

    act(() => screen.getByText('pick-b').click())
    expect(screen.getByTestId('selected')).toHaveTextContent('outlet-b')
    expect(window.localStorage.getItem('stok:selectedOutletId:staff-leader')).toBe('outlet-b')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/stok && yarn test useOutletScope`
Expected: FAIL with "Failed to resolve import "../useOutletScope"" (module doesn't exist yet)

- [ ] **Step 3: Write the implementation**

```tsx
// apps/stok/src/hooks/useOutletScope.tsx
'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@suka/auth'
import { createClient } from '@/lib/supabase'

export interface BoundOutlet {
  id: string
  name: string
}

interface OutletScopeValue {
  boundOutlets: BoundOutlet[]
  selectedOutletId: string | null
  setSelectedOutletId: (id: string) => void
  isMultiOutlet: boolean
}

const OutletScopeContext = createContext<OutletScopeValue | null>(null)

function storageKey(staffId: string) {
  return `stok:selectedOutletId:${staffId}`
}

interface StaffOutletRow {
  outlet_id: string
  outlets: { id: string; name: string } | null
}

export function OutletScopeProvider({ children }: { children: ReactNode }) {
  const { outletStaff } = useAuth()
  const staffId = outletStaff?.id
  const isLeader = outletStaff?.role === 'leader'

  const { data: fetchedOutlets = [] } = useQuery({
    queryKey: ['staff_outlets', staffId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('staff_outlets')
        .select('outlet_id, outlets(id, name)')
        .eq('staff_id', staffId)
      if (error) throw error
      return ((data ?? []) as StaffOutletRow[])
        .filter((row) => row.outlets)
        .map((row) => ({ id: row.outlets!.id, name: row.outlets!.name }))
    },
    enabled: isLeader && !!staffId,
    staleTime: 5 * 60 * 1000,
  })

  const boundOutlets = useMemo<BoundOutlet[]>(() => {
    if (isLeader) return fetchedOutlets
    if (!outletStaff?.outlet_id) return []
    return [{ id: outletStaff.outlet_id, name: outletStaff.outlets?.name ?? '' }]
  }, [isLeader, fetchedOutlets, outletStaff?.outlet_id, outletStaff?.outlets?.name])

  const [selectedOutletId, setSelectedOutletIdState] = useState<string | null>(null)

  useEffect(() => {
    if (!staffId || boundOutlets.length === 0) return
    if (!isLeader) {
      setSelectedOutletIdState(boundOutlets[0].id)
      return
    }
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey(staffId)) : null
    const validStored = stored && boundOutlets.some((o) => o.id === stored) ? stored : null
    setSelectedOutletIdState(validStored ?? boundOutlets[0].id)
  }, [staffId, isLeader, boundOutlets])

  const setSelectedOutletId = (id: string) => {
    if (!boundOutlets.some((o) => o.id === id)) return
    setSelectedOutletIdState(id)
    if (staffId && typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey(staffId), id)
    }
  }

  const value: OutletScopeValue = {
    boundOutlets,
    selectedOutletId,
    setSelectedOutletId,
    isMultiOutlet: isLeader && boundOutlets.length > 1,
  }

  return <OutletScopeContext.Provider value={value}>{children}</OutletScopeContext.Provider>
}

export function useOutletScope() {
  const ctx = useContext(OutletScopeContext)
  if (!ctx) throw new Error('useOutletScope must be used within OutletScopeProvider')
  return ctx
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/stok && yarn test useOutletScope`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/hooks/useOutletScope.tsx apps/stok/src/hooks/__tests__/useOutletScope.test.tsx
git commit -m "feat(stok): add OutletScopeProvider for leader multi-outlet selection"
```

---

### Task 2: Wire `OutletScopeProvider` into `Providers.tsx`

**Files:**
- Modify: `apps/stok/src/app/Providers.tsx`

- [ ] **Step 1: Edit `Providers.tsx` to wrap children in `OutletScopeProvider`**

```tsx
'use client'

import { ReactNode, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { OutletScopeProvider } from '@/hooks/useOutletScope'

export function Providers({
  children,
  initialStaff = null,
}: {
  children: ReactNode
  initialStaff?: OutletStaffProfile | null
}) {
  const queryClient = useMemo(() => new QueryClient(), [])
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthProvider supabase={supabase} initialStaff={initialStaff}>
          <OutletScopeProvider>{children}</OutletScopeProvider>
        </AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `cd apps/stok && yarn type-check`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/stok/src/app/Providers.tsx
git commit -m "feat(stok): mount OutletScopeProvider in app providers tree"
```

---

### Task 3: `OutletSwitcher` component

**Files:**
- Create: `apps/stok/src/components/common/OutletSwitcher.tsx`
- Test: `apps/stok/src/components/common/__tests__/OutletSwitcher.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/stok/src/components/common/__tests__/OutletSwitcher.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OutletSwitcher } from '../OutletSwitcher'

const mockUseOutletScope = vi.fn()
vi.mock('@/hooks/useOutletScope', () => ({
  useOutletScope: () => mockUseOutletScope(),
}))

describe('OutletSwitcher', () => {
  it('renders nothing when isMultiOutlet is false', () => {
    mockUseOutletScope.mockReturnValue({
      boundOutlets: [{ id: 'outlet-a', name: 'Outlet A' }],
      selectedOutletId: 'outlet-a',
      setSelectedOutletId: vi.fn(),
      isMultiOutlet: false,
    })
    const { container } = render(<OutletSwitcher />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a select with bound outlets and calls setSelectedOutletId on change', () => {
    const setSelectedOutletId = vi.fn()
    mockUseOutletScope.mockReturnValue({
      boundOutlets: [
        { id: 'outlet-a', name: 'Outlet A' },
        { id: 'outlet-b', name: 'Outlet B' },
      ],
      selectedOutletId: 'outlet-a',
      setSelectedOutletId,
      isMultiOutlet: true,
    })
    render(<OutletSwitcher />)
    const select = screen.getByRole('combobox', { name: /outlet binaan/i })
    expect(select).toHaveValue('outlet-a')
    fireEvent.change(select, { target: { value: 'outlet-b' } })
    expect(setSelectedOutletId).toHaveBeenCalledWith('outlet-b')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/stok && yarn test OutletSwitcher`
Expected: FAIL with "Failed to resolve import "../OutletSwitcher""

- [ ] **Step 3: Write the implementation**

```tsx
// apps/stok/src/components/common/OutletSwitcher.tsx
'use client'

import { useOutletScope } from '@/hooks/useOutletScope'

export function OutletSwitcher() {
  const { boundOutlets, selectedOutletId, setSelectedOutletId, isMultiOutlet } = useOutletScope()

  if (!isMultiOutlet) return null

  return (
    <select
      aria-label="Outlet Binaan"
      value={selectedOutletId ?? ''}
      onChange={(e) => setSelectedOutletId(e.target.value)}
      className="px-3 py-1.5 bg-white border border-[#d9c2b2]/45 text-[#701604] rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#f29744]"
    >
      {boundOutlets.map((outlet) => (
        <option key={outlet.id} value={outlet.id}>
          {outlet.name}
        </option>
      ))}
    </select>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/stok && yarn test OutletSwitcher`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/components/common/OutletSwitcher.tsx apps/stok/src/components/common/__tests__/OutletSwitcher.test.tsx
git commit -m "feat(stok): add OutletSwitcher dropdown component"
```

---

### Task 4: Wire ledger/opname/permintaan pages to `useOutletScope`

**Files:**
- Modify: `apps/stok/src/app/stok/ledger/page.tsx:1-16,40-51`
- Modify: `apps/stok/src/app/stok/opname/page.tsx:1-14,38-50`
- Modify: `apps/stok/src/app/stok/permintaan/page.tsx`

- [ ] **Step 1: Update `ledger/page.tsx`**

Replace the import block and the outlet-id source (lines 1-15):

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@suka/auth';
import { useOutletScope } from '@/hooks/useOutletScope';
import { useLedgerList } from '@/hooks/useLedger';
import { LedgerList } from '@/components/stok/LedgerList';
import { OutletSwitcher } from '@/components/common/OutletSwitcher';
import { getCrossAppUrl } from '@/lib/navigation';

export default function LedgerPage() {
  const router = useRouter();
  const { outletStaff } = useAuth();
  const { selectedOutletId } = useOutletScope();
  const [page, setPage] = useState(0);
  const { ledger, loading, error } = useLedgerList(selectedOutletId, page);
```

Then update the header block (originally lines 40-51) to insert the switcher next to the title and keep `outletStaff.name` for the subtitle (unchanged):

```tsx
      <header className="bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex items-center justify-between shadow-[0_2px_8px_rgba(144,77,0,0.03)] sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm" title="Kembali ke Dashboard">
            <span className="text-base">←</span>
          </Link>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Ledger Pergerakan Stok</h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">
              Outlet {outletStaff.name} • {outletStaff.role?.toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <OutletSwitcher />
          <Link href="/stok/ledger/new">
            <button className="px-3.5 py-1.5 bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm uppercase tracking-wider active:scale-95">
              + Entri Manual
            </button>
          </Link>
        </div>
      </header>
```

- [ ] **Step 2: Update `opname/page.tsx`**

Replace the import block and outlet-id source (lines 1-14):

```tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@suka/auth';
import { useOutletScope } from '@/hooks/useOutletScope';
import { useOpnameList } from '@/hooks/useOpname';
import { OpnameList } from '@/components/stok/OpnameList';
import { OutletSwitcher } from '@/components/common/OutletSwitcher';
import Link from 'next/link';
import { getCrossAppUrl } from '@/lib/navigation';

export default function OpnamePage() {
  const router = useRouter();
  const { outletStaff } = useAuth();
  const { selectedOutletId } = useOutletScope();
  const { opnameList, loading } = useOpnameList(selectedOutletId);
```

Then update the header (originally lines 38-59) to insert the switcher:

```tsx
      <header className="bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex items-center justify-between shadow-[0_2px_8px_rgba(144,77,0,0.03)] sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm" title="Kembali ke Dashboard">
            <span className="text-base">←</span>
          </Link>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Riwayat Opname Stok</h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">
              Outlet {outletStaff.name} • {outletStaff.role?.toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <OutletSwitcher />
          <Link href="/stok/opname/new">
            <button className="px-3.5 py-1.5 bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm uppercase tracking-wider active:scale-95">
              + Opname Baru
            </button>
          </Link>
        </div>
      </header>
```

- [ ] **Step 3: Update `permintaan/page.tsx`**

Replace the full file:

```tsx
'use client'
import { useAuth } from '@suka/auth'
import { useOutletScope } from '@/hooks/useOutletScope'
import { PermintaanForm } from '@/components/permintaan/PermintaanForm'
import { PermintaanList } from '@/components/permintaan/PermintaanList'
import { ApprovalList } from '@/components/permintaan/ApprovalList'
import { OutletSwitcher } from '@/components/common/OutletSwitcher'

const KITCHEN_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'

export default function PermintaanPage() {
  const { outletStaff, loading } = useAuth()
  const { selectedOutletId } = useOutletScope()

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">Memuat…</p></div>
  }
  if (!outletStaff) return null

  const isKitchen = selectedOutletId === KITCHEN_OUTLET_ID
    || ['admin', 'spv', 'owner'].includes(outletStaff.role)

  return (
    <div className="bg-[#fff8f1] min-h-screen">
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-[#701604] tracking-tight">
            Permintaan Bahan Baku
          </h1>
          <OutletSwitcher />
        </div>

        {isKitchen ? (
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#f29744]">Menunggu Persetujuan</h2>
            <ApprovalList />
          </section>
        ) : (
          <>
            {selectedOutletId && <PermintaanForm outletId={selectedOutletId} />}
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#f29744]">Riwayat Permintaan</h2>
              {selectedOutletId && <PermintaanList outletId={selectedOutletId} />}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run existing test suite to check for regressions**

Run: `cd apps/stok && yarn test`
Expected: All existing tests still PASS (no test referenced `outletStaff.outlet_id` directly in these three pages — confirm by reading failures if any appear, and fix only if a test asserts the old prop wiring)

- [ ] **Step 5: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add apps/stok/src/app/stok/ledger/page.tsx apps/stok/src/app/stok/opname/page.tsx apps/stok/src/app/stok/permintaan/page.tsx
git commit -m "feat(stok): scope ledger/opname/permintaan pages to selected outlet"
```

---

### Task 5: Leader monitoring — scope `SPVDashboard` to bound outlets

**Files:**
- Modify: `apps/stok/src/components/monitoring/MonitoringPage.tsx`
- Modify: `apps/stok/src/components/monitoring/SPVDashboard.tsx:26-31,69-92,120,300-303`
- Test: `apps/stok/src/components/monitoring/__tests__/MonitoringPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/stok/src/components/monitoring/__tests__/MonitoringPage.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MonitoringPage } from '../MonitoringPage'

const mockUseAuth = vi.fn()
vi.mock('@suka/auth', () => ({ useAuth: () => mockUseAuth() }))

const mockUseOutletScope = vi.fn()
vi.mock('@/hooks/useOutletScope', () => ({ useOutletScope: () => mockUseOutletScope() }))

vi.mock('../SPVDashboard', () => ({
  SPVDashboard: ({ allowedOutletIds }: { allowedOutletIds?: string[] }) => (
    <div data-testid="spv-dashboard">{JSON.stringify(allowedOutletIds ?? null)}</div>
  ),
}))
vi.mock('../CrewDashboard', () => ({
  CrewDashboard: () => <div data-testid="crew-dashboard" />,
}))

describe('MonitoringPage', () => {
  it('renders CrewDashboard for crew role', () => {
    mockUseAuth.mockReturnValue({ outletStaff: { role: 'crew' }, loading: false })
    mockUseOutletScope.mockReturnValue({ boundOutlets: [], isMultiOutlet: false })
    render(<MonitoringPage />)
    expect(screen.getByTestId('crew-dashboard')).toBeInTheDocument()
  })

  it('renders SPVDashboard with no allowedOutletIds restriction for spv role', () => {
    mockUseAuth.mockReturnValue({ outletStaff: { role: 'spv' }, loading: false })
    mockUseOutletScope.mockReturnValue({ boundOutlets: [], isMultiOutlet: false })
    render(<MonitoringPage />)
    expect(screen.getByTestId('spv-dashboard')).toHaveTextContent('null')
  })

  it('renders SPVDashboard scoped to boundOutlets for leader role', () => {
    mockUseAuth.mockReturnValue({ outletStaff: { role: 'leader' }, loading: false })
    mockUseOutletScope.mockReturnValue({
      boundOutlets: [{ id: 'outlet-a', name: 'Outlet A' }, { id: 'outlet-b', name: 'Outlet B' }],
      isMultiOutlet: true,
    })
    render(<MonitoringPage />)
    expect(screen.getByTestId('spv-dashboard')).toHaveTextContent('["outlet-a","outlet-b"]')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/stok && yarn test MonitoringPage`
Expected: FAIL — `SPVDashboard` currently takes no props, and `leader` currently renders `CrewDashboard` (assertion on `spv-dashboard` testid fails to find element for the leader case)

- [ ] **Step 3: Update `MonitoringPage.tsx`**

```tsx
'use client';

import React from 'react';
import { SPVDashboard } from './SPVDashboard';
import { CrewDashboard } from './CrewDashboard';
import { useAuth } from '@suka/auth';
import { useOutletScope } from '@/hooks/useOutletScope';

export function MonitoringPage() {
  const { outletStaff, loading } = useAuth();
  const { boundOutlets, isMultiOutlet } = useOutletScope();

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!outletStaff) {
    return <div className="text-center py-8 text-red-600">Not authenticated or profile not found</div>;
  }

  const role = outletStaff.role;
  const isLeader = role === 'leader';

  if (role === 'spv') {
    return <SPVDashboard />;
  }

  if (isLeader) {
    return <SPVDashboard allowedOutletIds={isMultiOutlet ? boundOutlets.map((o) => o.id) : undefined} />;
  }

  return <CrewDashboard />;
}
```

- [ ] **Step 4: Add `allowedOutletIds` prop to `SPVDashboard` and filter the outlet grouping**

In `apps/stok/src/components/monitoring/SPVDashboard.tsx`, change the component signature (line 26) from:

```tsx
export function SPVDashboard() {
```

to:

```tsx
export function SPVDashboard({ allowedOutletIds }: { allowedOutletIds?: string[] } = {}) {
```

Then in the `items` `useMemo` (originally lines 69-92), filter by `allowedOutletIds` before applying threshold overrides — change the opening line:

```tsx
  const items = useMemo(() => {
    const originalItems = (data?.items || []).filter(
      (item) => !allowedOutletIds || allowedOutletIds.includes(item.outlet_id)
    );
    return originalItems.map(item => {
```

(rest of the function body unchanged) and add `allowedOutletIds` to the `useMemo` dependency array at its closing line:

```tsx
  }, [data?.items, localThresholdOverrides, allowedOutletIds]);
```

Finally, update the left-panel heading (originally line 302, `Daftar 19 Outlet`) to reflect scope:

```tsx
              <h3 className="font-bold text-xs text-suka-brown/70 tracking-wider uppercase border-b border-suka-brown/10 pb-2">
                {allowedOutletIds ? `Outlet Binaan (${allowedOutletIds.length})` : 'Daftar 19 Outlet'}
              </h3>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/stok && yarn test MonitoringPage`
Expected: PASS (3 tests)

- [ ] **Step 6: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add apps/stok/src/components/monitoring/MonitoringPage.tsx apps/stok/src/components/monitoring/SPVDashboard.tsx apps/stok/src/components/monitoring/__tests__/MonitoringPage.test.tsx
git commit -m "feat(stok): scope leader monitoring dashboard to bound outlets"
```

---

### Task 6: Full test suite + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

Run: `cd apps/stok && yarn test`
Expected: All tests PASS, including the new ones from Tasks 1, 3, 5

- [ ] **Step 2: Run full type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 errors

- [ ] **Step 3: Manual smoke test (dev server)**

Run: `cd apps/stok && yarn dev` (http://localhost:3001)

1. Login as a single-outlet role (e.g. `crew` or `kasir` seeded account) — confirm `OutletSwitcher` does **not** appear on ledger/opname/permintaan, and pages show that user's home outlet data as before (no regression).
2. Login as a leader with multiple bound outlets (e.g. `chairulrizky@test.com` per `docs/SEED-LEADERS-INSTRUCTION.md` — confirm via Supabase `staff_outlets` table that this account has >1 row) — confirm `OutletSwitcher` appears in ledger, opname, and permintaan headers.
3. Switch outlet in the switcher on the ledger page — confirm the ledger list refetches and shows different data (or empty state) for the new outlet, and the choice persists after a full page reload.
4. Navigate to opname and permintaan without re-selecting — confirm they reflect the same previously-selected outlet (shared `localStorage` key).
5. Go to `/dashboard` (monitoring) as the same leader — confirm the SPV-style dashboard renders showing only the leader's bound outlets in the left panel (not all 19), and drill-down per outlet still works.

- [ ] **Step 4: Commit (only if smoke test surfaced fixes)**

If any fix was needed during manual testing, stage just the changed files and commit with a message describing the specific fix (do not bundle unrelated changes).

---

## Self-Review Notes

- **Spec coverage:** OutletScopeProvider + localStorage persistence (Task 1), global switcher in header (Task 3), ledger/opname/permintaan rewiring (Task 4), monitoring leader scoping reusing `SPVDashboard` (Task 5) — all covered. Security note from spec (RLS as final gate) is reflected by the `setSelectedOutletId` validation in Task 1 plus the existing untouched RLS layer.
- **Out of scope reminder:** apps/distribusi, apps/absensi, apps/pos-kasir leader-scoping gaps are explicitly NOT part of this plan (per spec) — do not expand scope into those apps while executing this plan.
