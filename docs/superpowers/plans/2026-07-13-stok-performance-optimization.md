# Stok Performance Optimization (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/stok` feel faster by caching data fetches with React Query (instead of manual `useEffect`/`useState`), showing skeleton loading states during route navigation, narrowing `select('*')` on hot query paths, and removing a dead component.

**Architecture:** No database migrations. Pure code-level changes inside `apps/stok`, following the existing `useQuery` + `useRealtimeInvalidate` pattern already proven in `src/hooks/useLedger.ts` and `src/hooks/useBahanBaku.ts`. Realtime subscriptions keep working exactly as before (same channel names, same tables/filters) — only *how* the fetched result reaches component state changes (from manual `setState` to React Query cache + `invalidateQueries`).

**Tech Stack:** Next.js App Router, TypeScript, `@tanstack/react-query`, Supabase JS client (`@/lib/supabase` → `@suka/auth` singleton), existing realtime helpers in `src/lib/realtime/`.

**Reference (already correct, copy this pattern):** `apps/stok/src/hooks/useLedger.ts:10-71` (`useLedgerTransaksiList`) — `useQuery` for the fetch, `useRealtimeInvalidate` for realtime, same public return shape as before migration.

**Convention note:** This codebase has no unit tests for data-fetching hooks (`useLedger.ts`, `useBahanBaku.ts` — the two hooks already on this pattern — have none either; per `CLAUDE.md` the project relies on "manual smoke tests via browser" for this layer). This plan follows that convention: verification is `yarn type-check` + a documented manual browser check per task, not new hook unit tests. Existing component tests (`SPVDashboard.test.tsx`, `PermintaanForm.test.tsx`) must still pass since they exercise these hooks indirectly.

---

## Task 1: Migrate `useStokBalance` to React Query

**Files:**
- Modify: `apps/stok/src/hooks/useStokBalance.ts`

**Consumers (do not change, return shape must stay identical):** `src/components/stok/MonitoringDashboard.tsx` (deleted in Task 10, but don't break it before then), `src/components/stok/OpnameForm.tsx`, `src/components/stok/ManualEntryForm.tsx`, `src/app/stok/waste-approval/page.tsx`. All consume `{ balances, loading, refresh }`.

- [ ] **Step 1: Rewrite the hook using `useQuery` + `useRealtimeInvalidate`**

Replace the full contents of `apps/stok/src/hooks/useStokBalance.ts` with:

```tsx
'use client'
import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useRealtimeInvalidate } from '@/lib/realtime/useRealtimeInvalidate'
import type { StokBalance } from '@/types/stok'

export function useStokBalance(outletId: string | undefined) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['stok_balance', outletId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('stok_balance')
        .select('id, outlet_id, bahan_baku_id, saldo, updated_at')
        .eq('outlet_id', outletId as string)
      if (error) throw error
      return (data as StokBalance[]) ?? []
    },
    enabled: !!outletId,
    staleTime: 25000,
    gcTime: 60000,
  })

  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `stok_balance_${outletId ?? 'none'}_${instanceId}`,
    enabled: !!outletId,
    subs: [
      {
        table: 'stok_balance',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: [['stok_balance', outletId]],
      },
    ],
  })

  return { balances: data ?? [], loading: isLoading, refresh: refetch }
}
```

Note: `.select('*')` was narrowed to explicit columns here as well (folds Task 9's `useStokBalance.ts` item into this rewrite — no separate pass needed).

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 errors related to `useStokBalance` or its consumers.

- [ ] **Step 3: Manual smoke test**

Start dev server (`yarn dev` in `apps/stok`), log in as a role with an assigned outlet, open a page that uses `useStokBalance` (e.g. `/stok/waste-approval` or the opname form). Confirm balances render. In a second tab, trigger a stock change (e.g. submit an adjustment) and confirm the balance updates within ~1s without a manual refresh.

- [ ] **Step 4: Commit**

```bash
git add apps/stok/src/hooks/useStokBalance.ts
git commit -m "perf(stok): migrate useStokBalance to react-query caching"
```

---

## Task 2: Migrate `useSaranItem` to React Query

**Files:**
- Modify: `apps/stok/src/hooks/usePermintaan.ts:31-82`

**Consumers:** `src/components/permintaan/PermintaanForm.tsx` (uses `{ saran, loading }`).

- [ ] **Step 1: Replace the `useSaranItem` function**

In `apps/stok/src/hooks/usePermintaan.ts`, replace the entire `useSaranItem` function (lines 31-82) with:

```tsx
export function useSaranItem(outletId: string | undefined) {
  const { session } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['saran_item', outletId],
    queryFn: async () => {
      const supabase = createClient()
      // monitoring_view_crew = SECURITY DEFINER view (bypass RLS stok_balance).
      const { data, error } = await supabase
        .from('monitoring_view_crew')
        .select('bahan_baku_id, item_name, satuan, current_qty, threshold, status')
        .eq('outlet_id', outletId as string)

      if (error) throw error
      return (data ?? [])
        .filter((row: any) => row.status === 'below' || row.status === 'warning')
        .map((row: any): SaranItem => ({
          bahan_baku_id: row.bahan_baku_id,
          item_name: row.item_name,
          satuan: row.satuan,
          current_qty: row.current_qty,
          threshold: row.threshold,
          status: row.status as 'below' | 'warning',
        }))
    },
    enabled: !!outletId && !!session,
    staleTime: 25000,
    gcTime: 60000,
  })

  return { saran: data ?? [], loading: isLoading }
}
```

- [ ] **Step 2: Add the `useQuery` import**

At the top of `apps/stok/src/hooks/usePermintaan.ts`, the file already imports `useCallback, useEffect, useId, useState` from `'react'` and `useAuth` from `'@suka/auth'`. Add this import line right after the existing `import { useAuth } from '@suka/auth'` line:

```tsx
import { useQuery } from '@tanstack/react-query'
```

- [ ] **Step 3: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 errors.

- [ ] **Step 4: Manual smoke test**

Log in as crew, open the permintaan form (`/stok/permintaan`), confirm "saran item" (suggested items below/warning threshold) still lists correctly.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/hooks/usePermintaan.ts
git commit -m "perf(stok): migrate useSaranItem to react-query caching"
```

---

## Task 3: Migrate `usePermintaanList` to React Query

**Files:**
- Modify: `apps/stok/src/hooks/usePermintaan.ts:88-128`

**Consumers:** `src/components/permintaan/PermintaanList.tsx` (uses `{ permintaan, loading, error, refresh }`).

- [ ] **Step 1: Replace the `usePermintaanList` function**

Replace the entire `usePermintaanList` function (originally lines 88-128, shifted by the Task 2 edit) with:

```tsx
export function usePermintaanList(outletId: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['permintaan_list', outletId],
    queryFn: () => fetchPermintaanOutlet(outletId as string),
    enabled: !!outletId,
    staleTime: 25000,
    gcTime: 60000,
  })

  // ID unik per instance hook → nama channel realtime tak bentrok bila dua
  // konsumen (PermintaanForm + PermintaanList) memakai outletId yang sama.
  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `permintaan_list_${outletId ?? 'none'}_${instanceId}`,
    enabled: !!outletId,
    subs: [
      {
        table: 'permintaan_bahan',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: [['permintaan_list', outletId]],
      },
    ],
  })

  return {
    permintaan: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: refetch,
  }
}
```

- [ ] **Step 2: Add the `useRealtimeInvalidate` import**

Add this import near the top of `apps/stok/src/hooks/usePermintaan.ts`, alongside the other new import from Task 2:

```tsx
import { useRealtimeInvalidate } from '@/lib/realtime/useRealtimeInvalidate'
```

- [ ] **Step 3: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 errors.

- [ ] **Step 4: Manual smoke test**

Open `/stok/permintaan` as crew, confirm the outlet's own request list renders. Submit a new request and confirm it appears in the list within ~1s.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/hooks/usePermintaan.ts
git commit -m "perf(stok): migrate usePermintaanList to react-query caching"
```

---

## Task 4: Migrate `useApprovalList` to React Query

**Files:**
- Modify: `apps/stok/src/hooks/usePermintaan.ts:134-170`

**Consumers:** `src/components/permintaan/ApprovalList.tsx`, `src/components/monitoring/SPVDashboard.tsx` (uses `{ permintaan, loading, error, refresh }`).

- [ ] **Step 1: Replace the `useApprovalList` function**

Replace the entire `useApprovalList` function with:

```tsx
export function useApprovalList() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['permintaan_approval'],
    queryFn: () => fetchPermintaanPending(),
    staleTime: 25000,
    gcTime: 60000,
  })

  // Realtime: tak difilter per-outlet karena approver (leader/SPV/kitchen) perlu
  // melihat request dari semua outlet accessible baginya — RLS `permintaan_bahan`
  // (via `accessible_outlet_ids()`) yang membatasi baris mana yang benar-benar
  // terkirim ke client.
  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `permintaan_approval_${instanceId}`,
    subs: [
      {
        table: 'permintaan_bahan',
        queryKeys: [['permintaan_approval']],
      },
    ],
  })

  return {
    permintaan: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: refetch,
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 errors.

- [ ] **Step 3: Run existing component test**

Run: `cd apps/stok && yarn vitest run src/components/monitoring/__tests__/SPVDashboard.test.tsx`
Expected: PASS (this test exercises `useApprovalList` indirectly — if it mocks the old manual-fetch shape, update the mock to resolve the same data via the query function instead; the public hook return shape is unchanged so no mock changes should be needed).

- [ ] **Step 4: Manual smoke test**

Log in as SPV/leader/kitchen, open the approval list, confirm pending requests from multiple outlets render. Approve/reject one and confirm the list updates without manual refresh.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/hooks/usePermintaan.ts
git commit -m "perf(stok): migrate useApprovalList to react-query caching"
```

---

## Task 5: Create `useWasteApprovalList` hook and migrate the waste-approval page

**Files:**
- Create: `apps/stok/src/hooks/useWaste.ts`
- Modify: `apps/stok/src/app/stok/waste-approval/page.tsx`

- [ ] **Step 1: Create the hook**

Write `apps/stok/src/hooks/useWaste.ts`:

```tsx
'use client'
import { useId } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPendingWasteReports, fetchMyWasteReports } from '@/app/actions/waste'
import { useRealtimeChannel } from '@/lib/realtime/useRealtimeChannel'
import type { WasteReport } from '@/types/stok'

/**
 * All pending waste reports the caller can approve (server action already
 * scopes by RLS/role). Used on the waste-approval page.
 */
export function useWasteApprovalList() {
  const instanceId = useId()
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['waste_approval_list'],
    queryFn: () => fetchPendingWasteReports(),
    staleTime: 25000,
    gcTime: 60000,
  })

  useRealtimeChannel({
    channelName: `waste_approval_${instanceId}`,
    subs: [
      {
        table: 'stok_waste_reports',
        event: '*',
        handler: () => {
          queryClient.invalidateQueries({ queryKey: ['waste_approval_list'] })
          // SPVDashboard punya query React Query terpisah (['waste_pending_all'])
          // untuk badge jumlah pending — invalidate juga supaya tetap sinkron.
          queryClient.invalidateQueries({ queryKey: ['waste_pending_all'] })
        },
      },
    ],
  })

  return { reports: data ?? [], loading: isLoading, refresh: refetch }
}

/**
 * Waste reports submitted by the current staff member. Used on the
 * waste-history page.
 */
export function useMyWasteHistory(staffId: string | undefined) {
  const instanceId = useId()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['waste_history', staffId],
    queryFn: () => fetchMyWasteReports(staffId as string) as Promise<WasteReport[]>,
    enabled: !!staffId,
    staleTime: 25000,
    gcTime: 60000,
  })

  useRealtimeChannel({
    channelName: `waste_history_${staffId ?? 'anon'}_${instanceId}`,
    enabled: !!staffId,
    subs: [
      {
        table: 'stok_waste_reports',
        event: '*',
        filter: staffId ? `reported_by=eq.${staffId}` : undefined,
        handler: () => refetch(),
      },
    ],
  })

  return { reports: data ?? [], loading: isLoading, refetch }
}
```

Note: `useMyWasteHistory` uses `useRealtimeChannel` directly (not `useRealtimeInvalidate`) and calls `refetch()` in the handler rather than `invalidateQueries`, because the toast-on-status-change logic in the page (comparing previous vs new status) needs the resolved data, not just a cache invalidation signal. This mirrors the original hand-rolled logic's behavior.

- [ ] **Step 2: Rewrite the waste-approval page to use the new hook**

In `apps/stok/src/app/stok/waste-approval/page.tsx`, replace lines 1-55 (imports through the `useRealtimeChannel` call) with:

```tsx
'use client'
import { useState } from 'react'
import { Card, Button, Input } from '@suka/design-system'
import { approveWasteReport, rejectWasteReport } from '@/app/actions/waste'
import { toast } from 'sonner'
import { useStokBalance } from '@/hooks/useStokBalance'
import { useWasteApprovalList } from '@/hooks/useWaste'
import { useAuth } from '@suka/auth'

export default function WasteApprovalPage() {
  const { outletStaff } = useAuth()
  const outletId = outletStaff?.outlet_id

  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { balances } = useStokBalance(outletId || '')
  const { reports, loading, refresh: loadReports } = useWasteApprovalList()
```

- [ ] **Step 3: Update the remaining handlers to call `loadReports` (already bound to `refresh` above, no other changes needed)**

The rest of the file (`handleApprove`, `handleRejectSubmit`, the JSX) already calls `loadReports()` and reads `reports` — those names are preserved by the destructuring in Step 2, so no further edits are needed in the function bodies or JSX below line 55 of the original file.

- [ ] **Step 4: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 errors. If `reports` type differs from the previous `any[]`, fix any resulting type errors by using the field names already read in the JSX (`r.bahan_baku`, `r.outlets`, `r.reported_by_staff`, `r.qty`, `r.reason`, `r.photo_url`) — these come from the `fetchPendingWasteReports` select join and are already loosely typed (`any`) server-side, so no new type errors are expected.

- [ ] **Step 5: Manual smoke test**

Log in as an approver role, open `/stok/waste-approval`, confirm pending waste reports render, approve one, confirm it disappears from the list and the page doesn't need a manual refresh.

- [ ] **Step 6: Commit**

```bash
git add apps/stok/src/hooks/useWaste.ts apps/stok/src/app/stok/waste-approval/page.tsx
git commit -m "perf(stok): migrate waste-approval page to react-query"
```

---

## Task 6: Migrate the waste-history page

**Files:**
- Modify: `apps/stok/src/app/stok/waste-history/page.tsx`

**Depends on:** Task 5 (`useMyWasteHistory` must exist in `apps/stok/src/hooks/useWaste.ts`).

- [ ] **Step 1: Rewrite the page to use `useMyWasteHistory`**

Replace the full contents of `apps/stok/src/app/stok/waste-history/page.tsx` with:

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { useAuth } from '@suka/auth'
import { toast } from 'sonner'
import { Card } from '@suka/design-system'
import { useMyWasteHistory } from '@/hooks/useWaste'
import { BottomNav } from '@/components/common/BottomNav'
import type { WasteReport, WasteStatus } from '@/types/stok'

const STATUS_LABEL: Record<WasteStatus, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
}

const STATUS_CLASS: Record<WasteStatus, string> = {
  PENDING: 'text-yellow-600',
  APPROVED: 'text-green-600',
  REJECTED: 'text-red-600',
}

export default function WasteHistoryPage() {
  const { outletStaff } = useAuth()
  const staffId = outletStaff?.id
  const { reports, loading } = useMyWasteHistory(staffId)
  const prevStatusRef = useRef<Map<string, WasteStatus>>(new Map())

  useEffect(() => {
    reports.forEach((r) => {
      const prev = prevStatusRef.current.get(r.id)
      if (prev === 'PENDING' && r.status === 'APPROVED') {
        toast.success(`Waste report ${r.bahan_baku?.nama ?? ''} disetujui`)
      } else if (prev === 'PENDING' && r.status === 'REJECTED') {
        toast.error(`Waste report ${r.bahan_baku?.nama ?? ''} ditolak`)
      }
    })
    prevStatusRef.current = new Map(reports.map((r) => [r.id, r.status]))
  }, [reports])

  if (loading) return <div className="p-4">Memuat...</div>

  return (
    <div className="space-y-4 p-4 max-w-2xl mx-auto pb-28">
      <h1 className="text-xl font-bold text-suka-brown">Riwayat Waste Saya</h1>

      {reports.length === 0 ? (
        <p className="text-gray-500 text-sm">Belum ada laporan waste.</p>
      ) : (
        reports.map((r: WasteReport) => (
          <Card key={r.id} className="p-4 flex flex-col gap-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">{r.bahan_baku?.nama}</p>
                <p className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString('id-ID')}</p>
              </div>
              <span className={`text-xs font-bold uppercase ${STATUS_CLASS[r.status]}`}>
                {STATUS_LABEL[r.status]}
              </span>
            </div>
            <p className="text-sm text-gray-700">{r.qty} {r.bahan_baku?.satuan} — {r.reason}</p>
            {r.status === 'REJECTED' && r.rejection_reason && (
              <p className="text-xs text-red-600">Alasan ditolak: {r.rejection_reason}</p>
            )}
          </Card>
        ))
      )}

      <BottomNav />
    </div>
  )
}
```

Note: the toast-diffing logic moves into a `useEffect` keyed on `reports` (was inline in the manual `load()` function before) — this preserves the "toast once when status flips from PENDING" behavior since `prevStatusRef` is still only updated after comparison, same as the original.

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 errors.

- [ ] **Step 3: Manual smoke test**

Log in as crew who has submitted waste reports, open `/stok/waste-history`, confirm history renders with correct status labels. Have an approver approve/reject one of this crew's pending reports in another session/tab and confirm a toast appears on this page within ~1s.

- [ ] **Step 4: Commit**

```bash
git add apps/stok/src/app/stok/waste-history/page.tsx
git commit -m "perf(stok): migrate waste-history page to react-query"
```

---

## Task 7: Add shared loading skeleton components

**Files:**
- Create: `apps/stok/src/components/common/loading/ListSkeleton.tsx`
- Create: `apps/stok/src/components/common/loading/DetailSkeleton.tsx`
- Create: `apps/stok/src/components/common/loading/GridSkeleton.tsx`

These three cover every route.tsx needed in Task 8: `ListSkeleton` for row-based lists (ledger, opname, permintaan, waste-approval, waste-history), `DetailSkeleton` for single-record detail pages (ledger/[id], opname/[id]), `GridSkeleton` for card-grid pages (monitoring, monitoring-live, monitoring-live/[outlet-id]).

- [ ] **Step 1: Create `ListSkeleton`**

```tsx
import { Card } from '@suka/design-system'

export function ListSkeleton({ rows = 6, title = 'Memuat...' }: { rows?: number; title?: string }) {
  return (
    <div className="space-y-4 p-4 max-w-2xl mx-auto animate-in fade-in duration-500">
      <div className="h-7 w-40 bg-suka-gray-200 rounded-lg animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i} className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-suka-gray-100 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 bg-suka-gray-200 rounded animate-pulse" />
            <div className="h-3 w-1/3 bg-suka-gray-100 rounded animate-pulse" />
          </div>
          <div className="h-6 w-16 bg-suka-orange/10 rounded-full animate-pulse" />
        </Card>
      ))}
      <span className="sr-only">{title}</span>
    </div>
  )
}
```

Save to `apps/stok/src/components/common/loading/ListSkeleton.tsx`.

- [ ] **Step 2: Create `DetailSkeleton`**

```tsx
import { Card } from '@suka/design-system'

export function DetailSkeleton() {
  return (
    <div className="space-y-6 p-4 max-w-2xl mx-auto animate-in fade-in duration-500">
      <div className="h-7 w-32 bg-suka-gray-200 rounded-lg animate-pulse" />
      <Card className="p-5 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center border-b border-suka-gray-100 pb-3">
            <div className="h-3 w-24 bg-suka-gray-100 rounded animate-pulse" />
            <div className="h-3 w-32 bg-suka-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </Card>
      <Card className="p-5 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 bg-suka-gray-50 rounded-xl animate-pulse" />
        ))}
      </Card>
    </div>
  )
}
```

Save to `apps/stok/src/components/common/loading/DetailSkeleton.tsx`.

- [ ] **Step 3: Create `GridSkeleton`**

```tsx
import { Card } from '@suka/design-system'

export function GridSkeleton({ cards = 18 }: { cards?: number }) {
  return (
    <div className="p-4 sm:p-6 space-y-4 animate-in fade-in duration-500">
      <div className="h-7 w-56 bg-suka-gray-200 rounded-lg animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Card key={i} className="p-4 space-y-3" style={{ minHeight: 200 }}>
            <div className="h-4 w-2/3 bg-suka-gray-200 rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-suka-gray-100 rounded animate-pulse" />
            <div className="h-20 bg-suka-gray-50 rounded-xl animate-pulse" />
          </Card>
        ))}
      </div>
    </div>
  )
}
```

Save to `apps/stok/src/components/common/loading/GridSkeleton.tsx`.

- [ ] **Step 4: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 errors (these files aren't imported anywhere yet, so this just confirms they compile standalone).

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/components/common/loading/
git commit -m "perf(stok): add shared route loading skeletons"
```

---

## Task 8: Add `loading.tsx` for each stok route

**Files:**
- Create: `apps/stok/src/app/stok/ledger/loading.tsx`
- Create: `apps/stok/src/app/stok/ledger/[id]/loading.tsx`
- Create: `apps/stok/src/app/stok/opname/loading.tsx`
- Create: `apps/stok/src/app/stok/opname/[id]/loading.tsx`
- Create: `apps/stok/src/app/stok/opname/new/loading.tsx`
- Create: `apps/stok/src/app/stok/monitoring/loading.tsx`
- Create: `apps/stok/src/app/stok/monitoring-live/loading.tsx`
- Create: `apps/stok/src/app/stok/monitoring-live/[outlet-id]/loading.tsx`
- Create: `apps/stok/src/app/stok/permintaan/loading.tsx`
- Create: `apps/stok/src/app/stok/waste-approval/loading.tsx`
- Create: `apps/stok/src/app/stok/waste-history/loading.tsx`

**Depends on:** Task 7 (skeleton components must exist).

- [ ] **Step 1: Verify each target directory exists before creating files**

Run: `cd apps/stok && ls src/app/stok/ledger src/app/stok/ledger/[id] src/app/stok/opname src/app/stok/opname/[id] src/app/stok/opname/new src/app/stok/monitoring src/app/stok/monitoring-live "src/app/stok/monitoring-live/[outlet-id]" src/app/stok/permintaan src/app/stok/waste-approval src/app/stok/waste-history`
Expected: all 11 directories listed exist (each already contains a `page.tsx`). If any path doesn't exist, skip that specific `loading.tsx` file below and note it — don't create a `loading.tsx` in a directory with no `page.tsx`.

- [ ] **Step 2: Create the list-style loading files (5 files)**

`apps/stok/src/app/stok/ledger/loading.tsx`:
```tsx
import { ListSkeleton } from '@/components/common/loading/ListSkeleton'
export default function Loading() {
  return <ListSkeleton title="Memuat Riwayat Ledger..." />
}
```

`apps/stok/src/app/stok/opname/loading.tsx`:
```tsx
import { ListSkeleton } from '@/components/common/loading/ListSkeleton'
export default function Loading() {
  return <ListSkeleton title="Memuat Riwayat Opname..." />
}
```

`apps/stok/src/app/stok/permintaan/loading.tsx`:
```tsx
import { ListSkeleton } from '@/components/common/loading/ListSkeleton'
export default function Loading() {
  return <ListSkeleton title="Memuat Permintaan Bahan..." />
}
```

`apps/stok/src/app/stok/waste-approval/loading.tsx`:
```tsx
import { ListSkeleton } from '@/components/common/loading/ListSkeleton'
export default function Loading() {
  return <ListSkeleton title="Memuat Persetujuan Waste..." />
}
```

`apps/stok/src/app/stok/waste-history/loading.tsx`:
```tsx
import { ListSkeleton } from '@/components/common/loading/ListSkeleton'
export default function Loading() {
  return <ListSkeleton title="Memuat Riwayat Waste..." />
}
```

- [ ] **Step 3: Create the detail-style loading files (3 files)**

`apps/stok/src/app/stok/ledger/[id]/loading.tsx`:
```tsx
import { DetailSkeleton } from '@/components/common/loading/DetailSkeleton'
export default function Loading() {
  return <DetailSkeleton />
}
```

`apps/stok/src/app/stok/opname/[id]/loading.tsx`:
```tsx
import { DetailSkeleton } from '@/components/common/loading/DetailSkeleton'
export default function Loading() {
  return <DetailSkeleton />
}
```

`apps/stok/src/app/stok/opname/new/loading.tsx`:
```tsx
import { DetailSkeleton } from '@/components/common/loading/DetailSkeleton'
export default function Loading() {
  return <DetailSkeleton />
}
```

- [ ] **Step 4: Create the grid-style loading files (3 files)**

`apps/stok/src/app/stok/monitoring/loading.tsx`:
```tsx
import { GridSkeleton } from '@/components/common/loading/GridSkeleton'
export default function Loading() {
  return <GridSkeleton cards={12} />
}
```

`apps/stok/src/app/stok/monitoring-live/loading.tsx`:
```tsx
import { GridSkeleton } from '@/components/common/loading/GridSkeleton'
export default function Loading() {
  return <GridSkeleton cards={18} />
}
```

`apps/stok/src/app/stok/monitoring-live/[outlet-id]/loading.tsx`:
```tsx
import { GridSkeleton } from '@/components/common/loading/GridSkeleton'
export default function Loading() {
  return <GridSkeleton cards={8} />
}
```

- [ ] **Step 5: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 errors.

- [ ] **Step 6: Build to confirm Next.js recognizes the new route segments correctly**

Run: `cd apps/stok && yarn build`
Expected: build succeeds; route list in build output shows the same dynamic (`ƒ`) markers as before for `ledger/[id]`, `opname/[id]`, `monitoring-live/[outlet-id]` (loading.tsx must not change a route from dynamic to static — if any of these three show up as `○ Static` in the build output, stop and investigate before proceeding, since that would reintroduce the SSG-on-dynamic-route bug documented in `CLAUDE.md`).

- [ ] **Step 7: Manual smoke test**

In the dev server, navigate between `/stok/ledger`, `/stok/opname`, `/stok/monitoring`, `/stok/monitoring-live`, `/stok/permintaan` and confirm each shows its skeleton briefly (may be very fast on localhost — throttle network in devtools to "Slow 3G" to see it clearly) before real content replaces it.

- [ ] **Step 8: Commit**

```bash
git add apps/stok/src/app/stok/*/loading.tsx apps/stok/src/app/stok/*/*/loading.tsx
git commit -m "perf(stok): add per-route loading skeletons"
```

---

## Task 9: Narrow remaining `select('*')` on hot query paths

**Files:**
- Modify: `apps/stok/src/lib/queries/monitoring.ts` (lines 72, 106, 160, 209, 341, 372, 400, 446 per current file state)
- Modify: `apps/stok/src/hooks/useLedger.ts:17`
- Modify: `apps/stok/src/components/stok/OpnameDetail.tsx:34`

`useStokBalance.ts` is already narrowed as part of Task 1 — not repeated here.

- [ ] **Step 1: Narrow `fetchSPVMonitoringData` and `fetchLeaderMonitoringData`**

In `apps/stok/src/lib/queries/monitoring.ts`, both `monitoring_view_spv` (line 72) and `monitoring_view_scoped` (line 106) queries currently do `.select('*')`. The consumers (via `attachSatuanKecil` and the SPV/leader dashboards) read: `outlet_id`, `outlet_name`, `bahan_baku_id`, `item_name`, `satuan`, `current_qty`, `threshold`, `status`, `is_flagged`. Replace both `.select('*')` calls with:

```ts
.select('outlet_id, outlet_name, bahan_baku_id, item_name, satuan, current_qty, threshold, status, is_flagged')
```

- [ ] **Step 2: Narrow `fetchCrewMonitoringData`**

In the same file, the `monitoring_view_crew` query (line 160) is read the same way by `SPVDashboard`/crew UI. Apply the same column list:

```ts
.select('outlet_id, outlet_name, bahan_baku_id, item_name, satuan, current_qty, threshold, status, is_flagged')
```

- [ ] **Step 3: Narrow `fetchItemDetail`'s `monitoring_view_spv` lookup**

The single-item lookup (line 209) is spread into the return value (`...itemData`) and consumed by `MonitoringDetailModal`. Since this endpoint returns one row (not the hot poll path), narrow it to the same superset used above plus nothing extra is needed — apply the identical select string as Step 1 for consistency:

```ts
.select('outlet_id, outlet_name, bahan_baku_id, item_name, satuan, current_qty, threshold, status, is_flagged')
```

- [ ] **Step 4: Narrow `fetchRecentLedger` and `fetchWasteToday`**

Both query `ledger_feed_spv` (lines 341, 400) and are consumed as `LedgerFeedEntry[]` (already has an explicit interface at line 316-330). Replace both `.select('*')` with the interface's field list:

```ts
.select('id, outlet_id, outlet_name, bahan_baku_id, item_name, satuan, tipe, qty, catatan, saldo_sesudah, created_at')
```

(`satuan_kecil`/`faktor_tampilan` are excluded from the select since `attachSatuanKecil` overwrites them from a separate `bahan_baku` join right after — selecting them from the view would be redundant.)

- [ ] **Step 5: Narrow `fetchStockoutForecast`**

`stockout_forecast_spv` (line 372) is consumed as `StockoutForecastItem[]` (interface at line 349-361). Replace `.select('*')` with:

```ts
.select('outlet_id, outlet_name, bahan_baku_id, item_name, satuan, current_qty, threshold, daily_rate, days_left')
```

- [ ] **Step 6: Narrow `fetchOutletItemsDetail`'s `monitoring_view_spv` query**

Line 446 is consumed by mapping into `OutletDetailItem` (interface at line 416-429), which only reads `bahan_baku_id, item_name, current_qty, threshold, satuan, status`. Replace `.select('*')` with:

```ts
.select('bahan_baku_id, item_name, current_qty, threshold, satuan, status')
```

- [ ] **Step 7: Narrow `useLedgerTransaksiList`'s `ledger_transaksi_ringkas` query**

In `apps/stok/src/hooks/useLedger.ts:17`, the result is cast to `LedgerTransaksiSummary` (minus the enrichment fields added after, per the type in `apps/stok/src/types/stok.ts:51-69`). Replace:

```ts
.select('*')
```

with:

```ts
.select('transaksi_key, outlet_id, created_at, jumlah_bahan, ref_order_id, ref_opname_id, ref_shipment_id, ref_transfer_id, single_bahan_baku_id, single_tipe, single_qty, single_catatan, single_saldo_sesudah')
```

- [ ] **Step 8: Narrow `OpnameDetail`'s `opname_item` query**

In `apps/stok/src/components/stok/OpnameDetail.tsx:34`, the result is cast to `OpnameItem[]` (interface at `apps/stok/src/types/stok.ts:30-34`). Replace:

```ts
supabase.from('opname_item').select('*').eq('opname_id', opnameId)
```

with:

```ts
supabase.from('opname_item').select('id, opname_id, bahan_baku_id, qty_fisik, qty_system, selisih, flagged, catatan').eq('opname_id', opnameId)
```

- [ ] **Step 9: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 errors.

- [ ] **Step 10: Manual smoke test — cross-check every narrowed field actually renders**

For each page touched (SPV monitoring dashboard, leader monitoring, crew monitoring, monitoring-live feed, monitoring-live detail modal, waste-today widget, stockout forecast widget, ledger list, opname detail), open it in the browser and visually confirm no field shows blank/`undefined`/`NaN` where it previously showed a value. Pay special attention to `is_flagged` badges and `saldo_sesudah` in the ledger detail modal, since those are the fields most likely to be silently dropped by a narrowed select typo.

- [ ] **Step 11: Commit**

```bash
git add apps/stok/src/lib/queries/monitoring.ts apps/stok/src/hooks/useLedger.ts apps/stok/src/components/stok/OpnameDetail.tsx
git commit -m "perf(stok): narrow select(*) on hot monitoring/ledger/opname queries"
```

---

## Task 10: Remove dead `MonitoringDashboard.tsx`

**Files:**
- Delete: `apps/stok/src/components/stok/MonitoringDashboard.tsx`

**Depends on:** Task 1 must be committed first (so if anything did still import this file, `useStokBalance`'s new query-based shape is already compatible before it's removed — though confirmed unused below).

- [ ] **Step 1: Confirm zero remaining imports**

Run: `cd apps/stok && grep -rn "MonitoringDashboard" src --include=*.tsx --include=*.ts`
Expected: only `src/components/stok/MonitoringDashboard.tsx` itself matches (the file's own internal references). If any other file matches, stop — do not delete, investigate that import first.

- [ ] **Step 2: Delete the file**

```bash
git rm apps/stok/src/components/stok/MonitoringDashboard.tsx
```

- [ ] **Step 3: Type-check and build**

Run: `cd apps/stok && yarn type-check && yarn build`
Expected: both succeed with 0 errors (confirms nothing depended on this file at build time either).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(stok): remove dead MonitoringDashboard.tsx (superseded by MonitoringPage + monitoring_view_crew)"
```

---

## Task 11: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 errors.

- [ ] **Step 2: Full test suite**

Run: `cd apps/stok && yarn vitest run`
Expected: all existing tests pass (in particular `SPVDashboard.test.tsx` and `PermintaanForm.test.tsx`, which exercise several of the hooks migrated in this plan).

- [ ] **Step 3: Full production build**

Run: `cd apps/stok && yarn build`
Expected: succeeds, route list shows `ledger/[id]`, `opname/[id]`, `monitoring-live/[outlet-id]` still marked dynamic (`ƒ`), not static (`○`).

- [ ] **Step 4: End-to-end manual walkthrough**

Start the app (`yarn dev`), and for each of these roles (use whichever test accounts are available per role), click through every route touched in this plan and confirm no console errors and no missing data:
- Crew: `/stok/permintaan`, `/stok/waste-history`, `/dashboard`
- SPV/leader/kitchen: `/stok/monitoring`, `/stok/monitoring-live`, `/stok/ledger`, `/stok/opname`, `/stok/waste-approval`

- [ ] **Step 5: Final commit (if any fixups were needed during verification)**

```bash
git add -A
git commit -m "fix(stok): address issues found during performance optimization verification pass"
```

(Skip this step if no fixes were needed.)
