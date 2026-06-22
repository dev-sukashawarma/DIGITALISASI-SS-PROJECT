# pos-kasir Tab-Switch Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate redundant Supabase fetches that re-run on every tab navigation in `apps/pos-kasir/app/kasir/*`, so switching tabs feels instant instead of laggy.

**Architecture:** Introduce `@tanstack/react-query` as a caching layer. Cache outlet identity (`useMyOutlet`) once per browser session via `staleTime: Infinity`. Convert the four data-heavy pages (Order, Histori, Menu, Reports) from manual `useState`/`useEffect` fetching to `useQuery`, preserving existing polling/realtime behavior through `refetchInterval` and `queryClient.invalidateQueries`.

**Tech Stack:** Next.js 16 App Router, React 19, `@tanstack/react-query` v5.101.0 (already used in `apps/stok`, `apps/admin-dashboard`), Supabase JS client.

**Reference spec:** [docs/superpowers/specs/2026-06-22-pos-kasir-tab-perf-design.md](../specs/2026-06-22-pos-kasir-tab-perf-design.md)

**Testing approach:** This codebase has no automated tests for these pages (only `e2e/example.spec.ts` placeholder exists). Each task's "test" step is `yarn type-check` (must stay clean) plus a manual browser smoke-test script — consistent with the project's existing "no e2e yet, manual smoke tests via browser" practice (see `CLAUDE.md`).

---

### Task 1: Add `@tanstack/react-query` dependency

**Files:**
- Modify: `apps/pos-kasir/package.json`

- [ ] **Step 1: Add the dependency**

In `apps/pos-kasir/package.json`, add to `"dependencies"` (keep alphabetical order, matches version already hoisted in monorepo from `apps/stok`):

```json
    "@supabase/ssr": "^0.5.1",
    "@supabase/supabase-js": "^2.45.0",
    "@tanstack/react-query": "^5.101.0",
    "dotenv": "^17.4.2",
```

- [ ] **Step 2: Install**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && npm install` (root install, monorepo is npm/yarn workspaces — use whichever lockfile exists; this repo has `package-lock.json` in `apps/pos-kasir`, but dependency resolves from the hoisted root `node_modules/@tanstack` already present, so a workspace-aware install is enough to record it in the lockfile).

Expected: no errors, `apps/pos-kasir/node_modules/@tanstack/react-query` resolves (directly or via hoisting) afterward.

- [ ] **Step 3: Verify**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/pos-kasir" && node -e "console.log(require('@tanstack/react-query/package.json').version)"`
Expected output: `5.101.0`

- [ ] **Step 4: Commit**

```bash
git add apps/pos-kasir/package.json apps/pos-kasir/package-lock.json
git commit -m "chore(pos-kasir): add @tanstack/react-query dependency"
```

---

### Task 2: Wire up `QueryClientProvider`

**Files:**
- Create: `apps/pos-kasir/components/Providers.tsx`
- Modify: `apps/pos-kasir/app/layout.tsx`

- [ ] **Step 1: Create the provider component**

Create `apps/pos-kasir/components/Providers.tsx`:

```tsx
'use client'

import { ReactNode, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), [])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

This mirrors the existing pattern in `apps/stok/src/app/Providers.tsx` (same monorepo, same library version).

- [ ] **Step 2: Mount it in root layout**

Modify `apps/pos-kasir/app/layout.tsx` — wrap children with `Providers`, placed outside `BrandProvider` so brand fetching and all query caching share one root:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import KioskPresenceMount from '@/components/KioskPresenceMount'
import GlobalBlockerMount from '@/components/GlobalBlockerMount'
import AudioUnlockMount from '@/components/AudioUnlockMount'
import { Providers } from '@/components/Providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SHAWARMA — Self-Ordering Kiosk',
  description: 'Pesan shawarma favoritmu dengan mudah dan cepat',
}

import { BrandProvider } from '@/components/BrandContext'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body>
        <Providers>
          <BrandProvider>
            <KioskPresenceMount />
            <GlobalBlockerMount />
            <AudioUnlockMount />
            {children}
          </BrandProvider>
        </Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/pos-kasir" && yarn type-check`
Expected: `0 errors` (same as baseline before this change).

- [ ] **Step 4: Manual smoke test**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/pos-kasir" && yarn dev`
Open `http://localhost:3004/login`, log in as a kasir account, confirm `/kasir` still loads with no console errors (provider mount shouldn't change any visible behavior yet).

- [ ] **Step 5: Commit**

```bash
git add apps/pos-kasir/components/Providers.tsx apps/pos-kasir/app/layout.tsx
git commit -m "feat(pos-kasir): mount QueryClientProvider at root layout"
```

---

### Task 3: Cache outlet identity in `useMyOutlet`

**Files:**
- Modify: `apps/pos-kasir/lib/useMyOutlet.ts`

- [ ] **Step 1: Rewrite the hook to use `useQuery`**

Replace the entire contents of `apps/pos-kasir/lib/useMyOutlet.ts`:

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

interface MyOutletData {
  outletId: string | null
  outletName: string | null
  isBlocked: boolean
  blockedReason: string
}

async function fetchMyOutlet(): Promise<MyOutletData> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { outletId: null, outletName: null, isBlocked: false, blockedReason: '' }
  }

  const { data: profile } = await supabase.from('outlet_staff')
    .select('outlet_id, is_active, inactive_reason, outlets!outlet_staff_outlet_id_fkey(name, is_active, inactive_reason)')
    .eq('id', user.id).single()

  if (!profile) {
    return { outletId: null, outletName: null, isBlocked: false, blockedReason: '' }
  }

  let isBlocked = false
  let blockedReason = ''

  if (profile.is_active === false) {
    isBlocked = true
    blockedReason = profile.inactive_reason || 'Akun Anda dinonaktifkan oleh Admin.'
  } else if (profile.outlets && (profile.outlets as any).is_active === false) {
    isBlocked = true
    blockedReason = (profile.outlets as any).inactive_reason || 'Cabang tempat Anda bertugas sedang dinonaktifkan oleh Admin.'
  }

  return {
    outletId: profile.outlet_id ?? null,
    outletName: (profile.outlets as any)?.name || null,
    isBlocked,
    blockedReason,
  }
}

/**
 * Mengembalikan outlet_id milik user yang sedang login (kasir).
 * Identitas outlet ini tidak berubah selama sesi login, jadi di-cache
 * selamanya (staleTime: Infinity) agar tidak di-refetch tiap pindah tab.
 * `loaded` menandai proses pengambilan selesai (untuk menggating query agar
 * tidak terlanjur mengambil data SEBELUM outlet diketahui).
 */
export function useMyOutlet() {
  const { data, isFetched } = useQuery({
    queryKey: ['my-outlet'],
    queryFn: fetchMyOutlet,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  return {
    outletId: data?.outletId ?? null,
    outletName: data?.outletName ?? null,
    loaded: isFetched,
    isBlocked: data?.isBlocked ?? false,
    blockedReason: data?.blockedReason ?? '',
  }
}
```

No consumer changes needed — the public shape (`outletId`, `outletName`, `loaded`, `isBlocked`, `blockedReason`) is unchanged.

- [ ] **Step 2: Type-check**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/pos-kasir" && yarn type-check`
Expected: `0 errors`.

- [ ] **Step 3: Manual smoke test**

With `yarn dev` running, log in as kasir, open browser DevTools Network tab, filter by `outlet_staff`. Navigate `/kasir` → `/kasir/histori` → `/kasir` again. Confirm the `outlet_staff` query fires only **once** total (on first page load), not on every navigation. Confirm `KasirNav` sidebar still shows the correct outlet name and "Hai, {nama}" greeting.

- [ ] **Step 4: Commit**

```bash
git add apps/pos-kasir/lib/useMyOutlet.ts
git commit -m "perf(pos-kasir): cache outlet identity for session via react-query"
```

---

### Task 4: Migrate Menu page (`/kasir/menu`) to `useQuery`

**Files:**
- Modify: `apps/pos-kasir/app/kasir/menu/page.tsx`

- [ ] **Step 1: Replace imports and remove duplicate outlet fetch**

Replace lines 1-26 of `apps/pos-kasir/app/kasir/menu/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Loader2,
  Sandwich, ToggleLeft, ToggleRight,
  FileArchive, Search, Star, PlusCircle, Globe, ThumbsUp, ChevronDown, Check
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'
import type { MenuItem, Category } from '@/types'

const BUCKET = 'menu-images'

interface MenuQueryData {
  items: MenuItem[]
  categories: Category[]
  bestsellers: string[]
  upsells: string[]
  recommendations: string[]
  unavailableIds: string[]
}

async function fetchMenuData(outletId: string): Promise<MenuQueryData> {
  const supabase = createClient()

  const [{ data: m }, { data: c }, { data: b }, { data: u }, { data: unav }, { data: rec }] = await Promise.all([
    supabase.from('menu_items').select('*, categories(id,name,sort_order)').or(`outlet_id.is.null,outlet_id.eq.${outletId}`).order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'bestseller_ids').maybeSingle(),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'upsell_ids').maybeSingle(),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'unavailable_menu_ids').maybeSingle(),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'recommendation_ids').maybeSingle(),
  ])

  const parseIds = (raw: string | null | undefined) => {
    try { return raw ? JSON.parse(raw) : [] } catch { return [] }
  }

  return {
    items: m ?? [],
    categories: c ?? [],
    bestsellers: parseIds(b?.value),
    upsells: parseIds(u?.value),
    recommendations: parseIds(rec?.value),
    unavailableIds: parseIds(unav?.value),
  }
}

export default function KasirMenuPage() {
  const { outletId } = useMyOutlet()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)

  const { data, isLoading: loading } = useQuery({
    queryKey: ['menu', outletId],
    queryFn: () => fetchMenuData(outletId as string),
    enabled: !!outletId,
    staleTime: 30000,
  })

  const items = data?.items ?? []
  const categories = data?.categories ?? []
  const bestsellers = data?.bestsellers ?? []
  const upsells = data?.upsells ?? []
  const recommendations = data?.recommendations ?? []
  const unavailableIds = data?.unavailableIds ?? []

  const invalidateMenu = () => queryClient.invalidateQueries({ queryKey: ['menu', outletId] })
```

This removes the old `fetchData()` function, the manual `outletId`/`items`/`categories`/etc. `useState`s, and the duplicate `auth.getUser()` + `outlet_staff` query (now sourced from the shared, cached `useMyOutlet()`).

- [ ] **Step 2: Remove the now-obsolete `fetchData` mount effect**

Delete the old block (was lines 28-74 in the original file, the click-outside effect stays, `fetchData`/`useEffect(() => { fetchData() }, [])` goes away — click-outside effect should be re-added since it's still needed):

Add back just below the `invalidateMenu` line from Step 1:

```tsx

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!(e.target as Element).closest('.dropdown-trigger') && !(e.target as Element).closest('.dropdown-menu')) {
        setOpenDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
```

- [ ] **Step 3: Update the four mutation functions to invalidate instead of re-fetching manually**

Replace `toggleAvail`, `toggleBestseller`, `toggleUpsell`, `toggleRecommendation` (originally lines 77-150) with:

```tsx
  async function toggleAvail(item: MenuItem) {
    if (!outletId) return
    const supabase = createClient()

    if (item.outlet_id === outletId) {
      await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
    } else {
      const isUnav = unavailableIds.includes(item.id)
      const newUnav = isUnav
        ? unavailableIds.filter(id => id !== item.id)
        : [...unavailableIds, item.id]

      await supabase.from('kiosk_settings').upsert({
        outlet_id: outletId,
        key: 'unavailable_menu_ids',
        value: JSON.stringify(newUnav)
      })
    }
    invalidateMenu()
  }

  async function toggleBestseller(item: MenuItem) {
    if (!outletId) return
    const isBs = bestsellers.includes(item.id)
    const newBs = isBs
      ? bestsellers.filter(id => id !== item.id)
      : [...bestsellers, item.id]

    const supabase = createClient()
    await supabase.from('kiosk_settings').upsert({
      outlet_id: outletId,
      key: 'bestseller_ids',
      value: JSON.stringify(newBs)
    })
    invalidateMenu()
  }

  async function toggleUpsell(item: MenuItem) {
    if (!outletId) return
    const isUp = upsells.includes(item.id)
    const newUp = isUp
      ? upsells.filter(id => id !== item.id)
      : [...upsells, item.id]

    const supabase = createClient()
    await supabase.from('kiosk_settings').upsert({
      outlet_id: outletId,
      key: 'upsell_ids',
      value: JSON.stringify(newUp)
    })
    invalidateMenu()
  }

  async function toggleRecommendation(item: MenuItem) {
    if (!outletId) return
    const isRec = recommendations.includes(item.id)
    const newRec = isRec
      ? recommendations.filter(id => id !== item.id)
      : [...recommendations, item.id]

    const supabase = createClient()
    await supabase.from('kiosk_settings').upsert({
      outlet_id: outletId,
      key: 'recommendation_ids',
      value: JSON.stringify(newRec)
    })
    invalidateMenu()
  }
```

Note: the optimistic local `setBestsellers`/`setUpsells`/etc. calls are dropped because those pieces of state no longer exist locally — `invalidateMenu()` triggers a background refetch and the UI updates from the new query data once it resolves (sub-second on a normal connection; acceptable since these are admin toggle actions, not the time-critical Order page).

The rest of the file (JSX rendering, lines ~153 onward in the original) is unchanged — it already reads `items`, `categories`, `bestsellers`, `upsells`, `recommendations`, `unavailableIds`, `loading`, `searchQuery`, `openDropdownId`, which all still exist with the same names.

- [ ] **Step 4: Type-check**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/pos-kasir" && yarn type-check`
Expected: `0 errors`.

- [ ] **Step 5: Manual smoke test**

With `yarn dev` running: open `/kasir/menu`, confirm menu list loads. Toggle "Tersedia/Habis" on an item, confirm status flips within ~1s. Toggle "Tandai Best Seller" via the dropdown, confirm the checkmark appears after invalidation. Navigate away to `/kasir/histori` and back to `/kasir/menu` — confirm the list shows instantly (from cache) without a full-page loading skeleton.

- [ ] **Step 6: Commit**

```bash
git add apps/pos-kasir/app/kasir/menu/page.tsx
git commit -m "perf(pos-kasir): migrate menu page to react-query, drop duplicate outlet fetch"
```

---

### Task 5: Migrate Order page (`/kasir`) to `useQuery`

**Files:**
- Modify: `apps/pos-kasir/app/kasir/page.tsx`

- [ ] **Step 1: Replace imports and state setup**

Replace lines 1-46 of `apps/pos-kasir/app/kasir/page.tsx`:

```tsx
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  RefreshCw, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp,
  Banknote, ShoppingBag, Search, Loader2, CornerDownRight, ChefHat, Store, Globe, PlusCircle, BellRing
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'
import ChannelBadge from '@/components/ChannelBadge'
import type { OrderWithItems, OrderStatus } from '@/types'

const DING_SOUND = '/sound-pesanan.mp3'

// Waktu relatif yang mudah dibaca kasir: "Baru saja", "3 menit yang lalu", dst.
function timeAgo(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'Baru saja'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} menit yang lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} jam yang lalu`
  const day = Math.floor(hr / 24)
  return `${day} hari yang lalu`
}

async function fetchTodayOrders(outletId: string): Promise<OrderWithItems[]> {
  const supabase = createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('outlet_id', outletId)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })
    .limit(200)

  return data ?? []
}

export default function CashierOrdersPage() {
  const [expandedId, setExpand] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [now, setNow] = useState(() => Date.now())

  // Audio state
  const [audioPermission, setAudioPermission] = useState(true)

  // Ref untuk mendeteksi order baru secara akurat (berdasarkan ID, bukan cuma jumlah)
  const knownOrderIds = useRef<Set<string>>(new Set())
  const hasFetchedInitial = useRef<boolean>(false)

  const supabase = createClient()
  const queryClient = useQueryClient()
  const { outletId, outletName } = useMyOutlet()

  const { data: orders = [], isLoading: loading } = useQuery({
    queryKey: ['orders', outletId],
    queryFn: () => fetchTodayOrders(outletId as string),
    enabled: !!outletId,
    refetchInterval: 3000,
    staleTime: 3000,
  })
```

This drops the old `orders`/`loading` `useState`s (now derived from `useQuery`), the old `fetchOrders` `useCallback`, and the `outletLoaded` destructure (no longer needed — `enabled: !!outletId` already gates the query, and `isLoading` is `false` while disabled, so the "don't leave loading stuck" effect from the original code is no longer needed).

- [ ] **Step 2: Replace the polling/realtime effect with a notification-detection effect + realtime invalidate**

Replace the old block (originally lines 131-156: the "don't leave loading stuck" effect + the polling/realtime `useEffect`) with:

```tsx
  const playNotification = useCallback(async () => {
    try {
      const a = document.getElementById('ding-sound') as HTMLAudioElement
      if (a) {
        a.currentTime = 0
        await a.play()
        setAudioPermission(true)
      }
    } catch (err) {
      console.warn('Audio blocked', err)
      setAudioPermission(false)
    }
  }, [])

  // Deteksi order baru dari data query terbaru (dipanggil tiap kali `orders` berubah,
  // baik dari polling 3s maupun dari invalidate realtime di bawah).
  useEffect(() => {
    if (!hasFetchedInitial.current) {
      orders.forEach(o => knownOrderIds.current.add(o.id))
      if (orders.length > 0 || !loading) hasFetchedInitial.current = true
      return
    }

    let hasNewPendingOrder = false
    orders.filter(o => o.status === 'pending' || o.status === 'preparing').forEach(o => {
      if (!knownOrderIds.current.has(o.id)) {
        hasNewPendingOrder = true
        knownOrderIds.current.add(o.id)
      }
    })

    if (hasNewPendingOrder) playNotification()
  }, [orders, loading, playNotification])

  // Realtime: invalidate cache instan saat ada perubahan order, jangan tunggu polling 3s
  useEffect(() => {
    if (!outletId) return
    const channel = supabase
      .channel('orders_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders', outletId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, outletId])
```

Move the "Unlock audio otomatis" `useEffect` (originally lines 49-68) and the "Tick setiap detik" `useEffect` (originally lines 71-74) to sit just above `playNotification` — they are unchanged, just keep them in place since they don't reference removed state.

- [ ] **Step 3: Update mutation functions to use `queryClient.setQueryData`/`invalidateQueries`**

Replace `markAsPreparing`, `markAsCompleted`, `cancelOrder` (originally lines 158-187):

```tsx
  // Mark as Preparing
  async function markAsPreparing(id: string) {
    queryClient.setQueryData<OrderWithItems[]>(['orders', outletId], (prev) =>
      prev?.map(o => o.id === id ? { ...o, status: 'preparing' } : o)
    )
    await supabase.from('orders').update({ status: 'preparing', updated_at: new Date().toISOString() }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['orders', outletId] })
  }

  // Mark as Completed
  async function markAsCompleted(id: string) {
    queryClient.setQueryData<OrderWithItems[]>(['orders', outletId], (prev) =>
      prev?.map(o => o.id === id ? { ...o, status: 'completed' } : o)
    )
    await supabase.from('orders').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['orders', outletId] })

    // Kalau order ini berasal dari website order online, teruskan notifikasi
    // ke order-system supaya WA "pesanan siap diambil" terkirim ke customer.
    fetch('/api/orders/notify-online-done', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: id }),
    }).catch((err) => console.error('Gagal mengirim notifikasi online ke order-system:', err))
  }

  // Cancel order
  async function cancelOrder(id: string) {
    if (confirm('Batalkan pesanan ini secara permanen?')) {
      queryClient.setQueryData<OrderWithItems[]>(['orders', outletId], (prev) =>
        prev?.map(o => o.id === id ? { ...o, status: 'cancelled' } : o)
      )
      await supabase.from('orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id)
      queryClient.invalidateQueries({ queryKey: ['orders', outletId] })
    }
  }
```

The rest of the file (filtering logic `filteredOrders`/`pendingOrders`/etc., and all JSX from `renderActiveCard` onward) is unchanged — it reads `orders`, `loading`, `outletName`, `now`, `expandedId`, `searchQuery`, `sourceFilter`, `audioPermission`, all of which still exist with identical names and types.

- [ ] **Step 4: Type-check**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/pos-kasir" && yarn type-check`
Expected: `0 errors`.

- [ ] **Step 5: Manual smoke test**

With `yarn dev` running: open `/kasir`, confirm pending/preparing/completed columns render. Place a test order from another tab/device (or via `/kasir/order-manual`) and confirm it appears in "Menunggu Pembayaran" within ~3s with the notification sound. Click "Terima & Proses", confirm it moves to "Sedang Diproses" instantly (optimistic update) and stays there after the next poll. Navigate to `/kasir/menu` and back to `/kasir` — confirm orders render instantly from cache, no blank flash.

- [ ] **Step 6: Commit**

```bash
git add apps/pos-kasir/app/kasir/page.tsx
git commit -m "perf(pos-kasir): migrate order page to react-query with realtime invalidation"
```

---

### Task 6: Migrate Histori page (`/kasir/histori`) to `useQuery`

**Files:**
- Modify: `apps/pos-kasir/app/kasir/histori/page.tsx`

- [ ] **Step 1: Replace imports and state setup**

Replace lines 1-58 of `apps/pos-kasir/app/kasir/histori/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import {
  RefreshCw, ClipboardList, ChevronDown, ChevronUp,
  Clock, CheckCircle2, ChefHat, Banknote, XCircle, Store
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import ChannelBadge from '@/components/ChannelBadge'
import { formatRupiah } from '@/lib/validations'
import type { OrderWithItems, OrderStatus } from '@/types'

const STATUS_CONF: Partial<Record<OrderStatus, {
  label: string; color: string; badge: string; icon: React.ElementType
}>> = {
  pending:   { label: 'Menunggu',     color: 'text-yellow-600',  badge: 'badge-yellow', icon: Clock },
  completed: { label: 'Selesai',      color: 'text-gray-400',    badge: 'badge-gray',   icon: CheckCircle2 },
  cancelled: { label: 'Dibatalkan',   color: 'text-red-500',     badge: 'badge-red',    icon: XCircle },
}

const STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending:   'completed',
}

const STATUS_NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  pending:   'Tandai Selesai',
}

async function fetchHistoriOrders(outletId: string, filter: OrderStatus | 'all'): Promise<OrderWithItems[]> {
  const supabase = createClient()
  const q = supabase.from('orders').select('*, order_items(*)')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false }).limit(100)
  if (filter !== 'all') q.eq('status', filter)
  const { data } = await q
  return data ?? []
}

export default function AdminOrdersPage() {
  const [filter, setFilter]     = useState<OrderStatus | 'all'>('all')
  const [expandedId, setExpand] = useState<string | null>(null)
  const { outletId, outletName } = useMyOutlet()
  const queryClient = useQueryClient()

  const { data: orders = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['histori', outletId, filter],
    queryFn: () => fetchHistoriOrders(outletId as string, filter),
    enabled: !!outletId,
    refetchInterval: 15000,
    staleTime: 15000,
  })
```

- [ ] **Step 2: Update `updateStatus` to invalidate the cache**

Replace `updateStatus` (originally lines 60-64):

```tsx
  async function updateStatus(id: string, status: OrderStatus) {
    const supabase = createClient()
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['histori', outletId] })
  }
```

Note: `invalidateQueries({ queryKey: ['histori', outletId] })` invalidates **all** filter variants for this outlet (partial key match — React Query invalidates every query whose key starts with the given array), so switching the status filter right after an update still shows fresh data.

- [ ] **Step 3: Update the manual "Refresh" button**

The refresh button at line ~92-98 currently calls `onClick={fetchOrders}`. Change it to use the `refetch` function returned by `useQuery`:

```tsx
        <button
          onClick={() => refetch()}
          className="btn-secondary py-2 px-4 text-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
```

The rest of the file (stat cards, filter tabs, order list JSX) is unchanged — it reads `orders`, `loading`, `filter`, `expandedId`, `outletName`, all still present with identical names.

- [ ] **Step 4: Type-check**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/pos-kasir" && yarn type-check`
Expected: `0 errors`.

- [ ] **Step 5: Manual smoke test**

With `yarn dev` running: open `/kasir/histori`, confirm orders list loads. Switch the status filter tabs (Semua/Menunggu/Selesai/Dibatalkan) — confirm each filter loads (first time has a brief load, switching back to an already-viewed filter is instant from cache). Click "Tandai Selesai" on a pending order, confirm it updates. Click "Refresh" button, confirm it refetches without error.

- [ ] **Step 6: Commit**

```bash
git add apps/pos-kasir/app/kasir/histori/page.tsx
git commit -m "perf(pos-kasir): migrate histori page to react-query"
```

---

### Task 7: Migrate Reports page (`/kasir/reports`) to `useQuery`

**Files:**
- Modify: `apps/pos-kasir/app/kasir/reports/page.tsx`

- [ ] **Step 1: Replace imports and state/query setup**

Replace lines 1-118 of `apps/pos-kasir/app/kasir/reports/page.tsx`:

```tsx
'use client'

import { useState, useMemo } from 'react'
import {
  BarChart3, TrendingUp, TrendingDown, ShoppingBag, Banknote,
  Calendar, ChevronDown, Award, Clock, CreditCard, QrCode,
  Package, ArrowUpRight, ArrowDownRight, Minus, FileText, Download, Printer, Search, CheckCircle2, XCircle
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { cleanItemName } from '@/lib/order-item-name'
import { formatRupiah } from '@/lib/validations'
import ChannelBadge from '@/components/ChannelBadge'

interface OrderRow {
  id: string
  order_number: number
  status: string
  payment_method: string | null
  channel: string | null
  total_amount: number
  created_at: string
  order_items: {
    id: string
    menu_item_name: string
    quantity: number
    unit_price: number
    subtotal: number
  }[]
}

type DateRange = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom'

const RANGE_LABELS: Record<DateRange, string> = {
  today: 'Hari Ini',
  yesterday: 'Kemarin',
  '7days': '7 Hari Terakhir',
  '30days': '30 Hari Terakhir',
  all: 'Semua Waktu',
  custom: 'Kustom Tanggal',
}

async function fetchReportOrders(outletId: string, range: DateRange, customStart: string, customEnd: string): Promise<OrderRow[]> {
  const supabase = createClient()

  let q = supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })

  if (range === 'today') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    q = q.gte('created_at', today.toISOString())
  } else if (range === 'yesterday') {
    const yest = new Date()
    yest.setDate(yest.getDate() - 1)
    yest.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    q = q.gte('created_at', yest.toISOString()).lt('created_at', today.toISOString())
  } else if (range === '7days') {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    d.setHours(0, 0, 0, 0)
    q = q.gte('created_at', d.toISOString())
  } else if (range === '30days') {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    d.setHours(0, 0, 0, 0)
    q = q.gte('created_at', d.toISOString())
  } else if (range === 'custom' && customStart && customEnd) {
    const s = new Date(customStart)
    s.setHours(0, 0, 0, 0)
    const e = new Date(customEnd)
    e.setHours(23, 59, 59, 999)
    q = q.gte('created_at', s.toISOString()).lte('created_at', e.toISOString())
  }

  const { data } = await q
  return data ?? []
}

export default function ReportsPage() {
  const [range, setRange] = useState<DateRange>('today')
  const [showRangePicker, setShowRangePicker] = useState(false)

  // Custom Date
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Outlet Data (outletName sudah di-cache di useMyOutlet, tidak perlu query terpisah lagi)
  const { outletId, outletName: rawOutletName } = useMyOutlet()
  const outletName = rawOutletName || 'Memuat...'

  // Table State
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const isCustomReady = range !== 'custom' || (!!customStart && !!customEnd)

  const { data: orders = [], isLoading: loading } = useQuery({
    queryKey: ['reports', outletId, range, customStart, customEnd],
    queryFn: () => fetchReportOrders(outletId as string, range, customStart, customEnd),
    enabled: !!outletId && isCustomReady,
    staleTime: 30000,
  })
```

This removes: the old `outletName` `useState` + its manual `supabase.from('outlets').select('name')` fetch (now sourced from `useMyOutlet`, which already resolves it once per session), the old `orders`/`loading` `useState`s, the `fetchOrders` `useCallback`, and the "don't leave loading stuck" effect (handled by `enabled`).

- [ ] **Step 2: Verify `analytics` memo and everything below is untouched**

The `analytics` `useMemo` (originally starting at line 121, `useMemo(() => {...}, [orders])`) and everything after it reference `orders`, `outletName`, `range`, `showRangePicker`, `customStart`, `customEnd`, `searchQuery`, `currentPage`, `loading` — all still defined with identical names. No further code changes needed in this file.

- [ ] **Step 3: Type-check**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/pos-kasir" && yarn type-check`
Expected: `0 errors`.

- [ ] **Step 4: Manual smoke test**

With `yarn dev` running: open `/kasir/reports`, confirm KPI cards, charts, and the transaction table load for "Hari Ini". Switch date range to "7 Hari Terakhir", confirm data reloads. Switch back to "Hari Ini", confirm it's instant (cached). Try "Kustom Tanggal" with both start/end dates filled, confirm it only fetches once both fields are set (not on every keystroke/partial state). Click "Cetak / Download PDF Eksekutif", confirm print dialog opens with correct outlet name in the header.

- [ ] **Step 5: Commit**

```bash
git add apps/pos-kasir/app/kasir/reports/page.tsx
git commit -m "perf(pos-kasir): migrate reports page to react-query, drop duplicate outlet-name fetch"
```

---

### Task 8: Full regression smoke test across all tabs

**Files:** none (verification only)

- [ ] **Step 1: Run full type-check**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/pos-kasir" && yarn type-check`
Expected: `0 errors`.

- [ ] **Step 2: Run existing unit tests**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/pos-kasir" && yarn test`
Expected: all existing tests still pass (this change doesn't touch any unit-tested module, but confirms nothing else broke).

- [ ] **Step 3: End-to-end manual walkthrough**

With `yarn dev` running, log in as a kasir account and, in order:
1. Open `/kasir` (Order) — confirm orders load, place a manual order via "Input Manual", confirm it shows up and notification sound plays.
2. Switch to `/kasir/menu` — confirm instant nav, no full blank screen.
3. Switch to `/kasir/histori` — confirm instant nav.
4. Switch to `/kasir/reports` — confirm instant nav, change date range once.
5. Switch back to `/kasir` (Order) — confirm the order placed in step 1 is still visible (proves cache persisted across navigation, not refetched from a blank state).
6. Open DevTools Network tab, repeat steps 1-5 once more, confirm `outlet_staff` query does **not** fire again (still cached from initial session load).

- [ ] **Step 4: Final commit (if any smoke-test fixes were needed)**

If all steps pass cleanly with no further code changes, no commit needed for this task — it's verification only. If a smoke test step surfaced a bug, fix it, re-run the relevant step, then commit:

```bash
git add -A
git commit -m "fix(pos-kasir): <describe the regression found during smoke test>"
```

---

## Self-Review Notes

- **Spec coverage:** Section 1 (outlet identity caching) → Task 3. Section 2 table (Order/Histori/Menu/Reports queries + polling) → Tasks 4-7. Section 3 (`QueryClientProvider` at root) → Task 2. Section 4 (Settings/Kiosk out of scope) → correctly not touched by any task.
- **Type consistency:** `outletId`/`outletName`/`loaded`/`isBlocked`/`blockedReason` signature from `useMyOutlet()` is identical pre/post-change across Tasks 3-7. Query keys consistently use the pattern `['<domain>', outletId, ...extra params]` matching the spec's table.
- **No placeholders:** every step has complete, runnable code or an exact command with expected output.
