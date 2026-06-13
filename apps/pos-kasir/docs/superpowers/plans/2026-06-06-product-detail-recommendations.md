# Product Detail Page + Smart Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full product detail page (`/menu/[id]`) and a data-driven "frequently bought together" recommendation strip shown on both the detail page and the cart.

**Architecture:** The recommendation engine is split into a pure, unit-tested ranking function (`lib/recommendations.ts`) and a thin API route (`app/api/recommendations/route.ts`) that fetches Supabase data with the service client and calls the pure function. UI is a shared `RecommendationStrip` component used by both the detail page and the cart. The menu card's body becomes a link to the detail page while keeping its quick-add button.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (`@supabase/ssr`), Zustand cart store, Tailwind, lucide-react, Vitest (new, for unit tests).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/recommendations.ts` | **New.** Pure `rankRecommendations()` function + its input/output types. No I/O. |
| `tests/recommendations.test.ts` | **New.** Vitest unit tests for the pure ranking logic. |
| `vitest.config.ts` | **New.** Minimal Vitest config (node environment). |
| `package.json` | **Modify.** Add `vitest` devDep + `test` script. |
| `app/api/recommendations/route.ts` | **New.** GET endpoint; fetches order/menu data, calls `rankRecommendations()`, returns `MenuItem[]`. |
| `components/RecommendationStrip.tsx` | **New.** Client component: fetches `/api/recommendations`, renders compact add-to-cart cards. Used by detail page + cart. |
| `app/menu/[id]/page.tsx` | **New.** Product detail page. |
| `components/MenuItem.tsx` | **Modify.** Card body → `Link` to `/menu/[id]`; keep quick-add `+` button. |
| `components/Cart.tsx` | **Modify.** Render `RecommendationStrip` above the footer when cart is non-empty. |

---

## Task 1: Pure recommendation ranking function + tests

**Files:**
- Create: `lib/recommendations.ts`
- Create: `tests/recommendations.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Add Vitest dependency and test script**

Run:
```bash
npm install -D vitest@^2.1.0
```
Then edit `package.json` `scripts` to add the `test` line (place after `"lint": "next lint"`):
```json
    "lint": "next lint",
    "test": "vitest run"
```

- [ ] **Step 2: Create Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 3: Write the failing tests**

Create `tests/recommendations.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { rankRecommendations } from '@/lib/recommendations'
import type { MenuItem } from '@/types'
import type { RankInput } from '@/lib/recommendations'

function menu(id: string, category_id: string | null, sort_order = 0, is_available = true): MenuItem {
  return { id, category_id, name: id, description: null, price: 1000, image_url: null, is_available, sort_order }
}

// Menu: m1,m2 in catA ; topKentang,topKeju in catTop ; m3 in catB
const MENU: MenuItem[] = [
  menu('m1', 'catA', 1),
  menu('m2', 'catA', 2),
  menu('m3', 'catB', 3),
  menu('kentang', 'catTop', 4),
  menu('keju', 'catTop', 5),
]

describe('rankRecommendations', () => {
  it('ranks by co-purchase frequency, excluding the seed', () => {
    // Orders: m1 bought with kentang 2x, with keju 1x
    const input: RankInput = {
      seedIds: ['m1'],
      cartIds: [],
      menuItems: MENU,
      orders: [
        ['m1', 'kentang'],
        ['m1', 'kentang'],
        ['m1', 'keju'],
      ],
      limit: 4,
    }
    const result = rankRecommendations(input).map((m) => m.id)
    expect(result[0]).toBe('kentang') // most co-purchased first
    expect(result).toContain('keju')
    expect(result).not.toContain('m1') // seed excluded
  })

  it('excludes items already in the cart', () => {
    const input: RankInput = {
      seedIds: ['m1'],
      cartIds: ['m1', 'kentang'],
      menuItems: MENU,
      orders: [['m1', 'kentang'], ['m1', 'keju']],
      limit: 4,
    }
    const result = rankRecommendations(input).map((m) => m.id)
    expect(result).not.toContain('kentang') // in cart
    expect(result).toContain('keju')
  })

  it('never recommends unavailable items', () => {
    const menuWithHabis = MENU.map((m) => (m.id === 'kentang' ? { ...m, is_available: false } : m))
    const input: RankInput = {
      seedIds: ['m1'],
      cartIds: [],
      menuItems: menuWithHabis,
      orders: [['m1', 'kentang'], ['m1', 'kentang'], ['m1', 'keju']],
      limit: 4,
    }
    const result = rankRecommendations(input).map((m) => m.id)
    expect(result).not.toContain('kentang')
  })

  it('cold-start (no orders) falls back to other-category items by sort_order', () => {
    const input: RankInput = {
      seedIds: ['m1'], // catA
      cartIds: [],
      menuItems: MENU,
      orders: [],
      limit: 4,
      seedCategoryId: 'catA',
    }
    const result = rankRecommendations(input).map((m) => m.id)
    expect(result).not.toContain('m1') // seed excluded
    expect(result).not.toContain('m2') // same category as seed excluded from fallback
    // other-category items, sort_order order: m3(3), kentang(4), keju(5)
    expect(result).toEqual(['m3', 'kentang', 'keju'])
  })

  it('fills remaining slots with fallback when co-purchase data is thin', () => {
    const input: RankInput = {
      seedIds: ['m1'],
      cartIds: [],
      menuItems: MENU,
      orders: [['m1', 'keju']], // only 1 co-purchase
      limit: 4,
      seedCategoryId: 'catA',
    }
    const result = rankRecommendations(input).map((m) => m.id)
    expect(result[0]).toBe('keju') // co-purchase ranked first
    // remaining filled from other categories, not duplicating keju or seed-category m2
    expect(result).toContain('m3')
    expect(result).toContain('kentang')
    expect(result).not.toContain('m1')
    expect(result).not.toContain('m2')
  })

  it('respects the limit', () => {
    const input: RankInput = {
      seedIds: ['m1'], cartIds: [], menuItems: MENU, orders: [], limit: 2,
    }
    expect(rankRecommendations(input)).toHaveLength(2)
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `rankRecommendations` is not exported / module not found.

- [ ] **Step 5: Implement the pure function**

Create `lib/recommendations.ts`:
```ts
import type { MenuItem } from '@/types'

/** Each order is the list of menu_item_ids it contained. */
export type OrderItemIds = string[]

export interface RankInput {
  /** Products that drive the recommendation (the detail product, or the cart items). */
  seedIds: string[]
  /** Products already in the cart — never recommended back. */
  cartIds: string[]
  /** All menu items (used for availability, category, sort order, and hydration). */
  menuItems: MenuItem[]
  /** Past orders, each as a list of menu_item_ids. */
  orders: OrderItemIds[]
  /** Max results. */
  limit: number
  /** Category of the single seed product (detail mode) — excluded from fallback. Optional. */
  seedCategoryId?: string | null
}

/**
 * Rank "frequently bought together" recommendations.
 *
 * 1. Tally how often each other product appears in orders that contain a seed product.
 * 2. Rank available, non-excluded items by that tally (desc), tie-break by sort_order.
 * 3. If fewer than `limit`, fall back to best-selling items from OTHER categories
 *    (overall order frequency desc, tie-break by sort_order), excluding the seed's category.
 *    When there are no orders at all, "best-selling" is empty so items are ordered by sort_order.
 */
export function rankRecommendations(input: RankInput): MenuItem[] {
  const { seedIds, cartIds, menuItems, orders, limit, seedCategoryId } = input

  const excluded = new Set<string>([...seedIds, ...cartIds])
  const byId = new Map(menuItems.map((m) => [m.id, m]))
  const isPickable = (id: string) => {
    const m = byId.get(id)
    return !!m && m.is_available && !excluded.has(id)
  }

  // 1. Co-purchase tally: orders containing any seed product.
  const seedSet = new Set(seedIds)
  const coTally = new Map<string, number>()
  // Overall popularity tally (for fallback ranking).
  const popTally = new Map<string, number>()

  for (const order of orders) {
    const containsSeed = order.some((id) => seedSet.has(id))
    for (const id of order) {
      popTally.set(id, (popTally.get(id) ?? 0) + 1)
      if (containsSeed && !seedSet.has(id)) {
        coTally.set(id, (coTally.get(id) ?? 0) + 1)
      }
    }
  }

  const sortOrder = (id: string) => byId.get(id)?.sort_order ?? 0

  // 2. Co-purchase recommendations.
  const coRanked = [...coTally.entries()]
    .filter(([id]) => isPickable(id))
    .sort((a, b) => b[1] - a[1] || sortOrder(a[0]) - sortOrder(b[0]))
    .map(([id]) => id)

  const result: string[] = []
  const seen = new Set<string>()
  for (const id of coRanked) {
    if (result.length >= limit) break
    if (!seen.has(id)) { result.push(id); seen.add(id) }
  }

  // 3. Fallback: other-category best-sellers.
  if (result.length < limit) {
    const fallback = menuItems
      .filter((m) => isPickable(m.id) && !seen.has(m.id))
      .filter((m) => m.category_id !== (seedCategoryId ?? null))
      .sort((a, b) =>
        (popTally.get(b.id) ?? 0) - (popTally.get(a.id) ?? 0) ||
        a.sort_order - b.sort_order
      )
      .map((m) => m.id)

    for (const id of fallback) {
      if (result.length >= limit) break
      if (!seen.has(id)) { result.push(id); seen.add(id) }
    }
  }

  return result.map((id) => byId.get(id)!).slice(0, limit)
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 6 tests green.

- [ ] **Step 7: Commit**

```bash
git add lib/recommendations.ts tests/recommendations.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat: add pure recommendation ranking function with tests"
```

---

## Task 2: Recommendation API route

**Files:**
- Create: `app/api/recommendations/route.ts`

- [ ] **Step 1: Implement the API route**

Create `app/api/recommendations/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rankRecommendations, type OrderItemIds } from '@/lib/recommendations'
import type { MenuItem } from '@/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('productId')?.trim() || null
  const cartParam = searchParams.get('cart')?.trim() || ''
  const cartIds = cartParam ? cartParam.split(',').map((s) => s.trim()).filter(Boolean) : []
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 4, 1), 8)

  // Seed = the detail product, or the cart items.
  const seedIds = productId ? [productId] : cartIds
  if (seedIds.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const supabase = createServiceClient()

  // All menu items (for availability, category, sort order, hydration).
  const { data: menuRows, error: menuErr } = await supabase
    .from('menu_items')
    .select('id, category_id, name, description, price, image_url, is_available, sort_order')
    .order('sort_order')

  if (menuErr || !menuRows) {
    return NextResponse.json({ items: [] })
  }
  const menuItems = menuRows as MenuItem[]

  // Orders that contain any seed product.
  const { data: seedOrderRows } = await supabase
    .from('order_items')
    .select('order_id')
    .in('menu_item_id', seedIds)

  const orderIds = Array.from(new Set((seedOrderRows ?? []).map((r) => r.order_id).filter(Boolean)))

  // Build the per-order item-id lists for those orders.
  let orders: OrderItemIds[] = []
  if (orderIds.length > 0) {
    const { data: itemRows } = await supabase
      .from('order_items')
      .select('order_id, menu_item_id')
      .in('order_id', orderIds)

    const grouped = new Map<string, string[]>()
    for (const row of itemRows ?? []) {
      if (!row.order_id || !row.menu_item_id) continue
      const list = grouped.get(row.order_id) ?? []
      list.push(row.menu_item_id)
      grouped.set(row.order_id, list)
    }
    orders = [...grouped.values()]
  }

  const seedCategoryId = productId
    ? (menuItems.find((m) => m.id === productId)?.category_id ?? null)
    : null

  const items = rankRecommendations({
    seedIds,
    cartIds,
    menuItems,
    orders,
    limit,
    seedCategoryId,
  })

  return NextResponse.json({ items })
}
```

- [ ] **Step 2: Verify the route compiles and responds**

Start the dev server if not running (`npm run dev`), then run:
```bash
curl -s "http://localhost:3000/api/recommendations?productId=NON_EXISTENT&limit=4"
```
Expected: HTTP 200 with JSON like `{"items":[...]}` (fallback items, since the id has no orders).

- [ ] **Step 3: Commit**

```bash
git add app/api/recommendations/route.ts
git commit -m "feat: add recommendations API route"
```

---

## Task 3: Shared RecommendationStrip component

**Files:**
- Create: `components/RecommendationStrip.tsx`

- [ ] **Step 1: Implement the strip**

Create `components/RecommendationStrip.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Plus, Sandwich } from 'lucide-react'
import type { MenuItem } from '@/types'
import { useCart } from '@/store/cart'
import { formatRupiah } from '@/lib/validations'

interface Props {
  /** Detail mode: recommend items bought together with this product. */
  productId?: string
  /** Cart mode: recommend items bought together with these cart item ids. */
  cartIds?: string[]
  title?: string
  limit?: number
}

export default function RecommendationStrip({ productId, cartIds, title = 'Sering dibeli bersama', limit = 4 }: Props) {
  const [items, setItems] = useState<MenuItem[]>([])
  const { addItem, items: cartItems } = useCart()

  // Stable string key so a new array identity each render does not refetch in a loop.
  const cartKey = cartIds && cartIds.length ? cartIds.join(',') : ''

  useEffect(() => {
    if (!productId && !cartKey) { setItems([]); return }
    const params = new URLSearchParams()
    if (productId) params.set('productId', productId)
    if (cartKey) params.set('cart', cartKey)
    params.set('limit', String(limit))

    let active = true
    fetch(`/api/recommendations?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => { if (active) setItems(data.items ?? []) })
      .catch(() => { if (active) setItems([]) })
    return () => { active = false }
  }, [productId, cartKey, limit])

  // Hide items already in the cart (covers optimistic adds after fetch).
  const cartIdSet = new Set(cartItems.map((c) => c.item.id))
  const visible = items.filter((m) => !cartIdSet.has(m.id))

  if (visible.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {visible.map((item) => (
          <div
            key={item.id}
            className="w-32 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="relative h-20 bg-gradient-to-br from-amber-50 to-orange-100">
              {item.image_url ? (
                <Image src={item.image_url} alt={item.name} fill className="object-cover" unoptimized />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sandwich className="w-8 h-8 text-amber-200" strokeWidth={1} />
                </div>
              )}
            </div>
            <div className="p-2.5">
              <p className="text-xs font-bold text-gray-900 leading-snug line-clamp-1">{item.name}</p>
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <span className="text-amber-600 font-extrabold text-xs">{formatRupiah(item.price)}</span>
                <button
                  onClick={() => addItem(item)}
                  aria-label={`Tambah ${item.name}`}
                  className="w-7 h-7 bg-amber-gradient text-white rounded-xl flex items-center justify-center shadow-amber hover:brightness-110 active:scale-95 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/RecommendationStrip.tsx
git commit -m "feat: add shared RecommendationStrip component"
```

---

## Task 4: Product detail page

**Files:**
- Create: `app/menu/[id]/page.tsx`

- [ ] **Step 1: Implement the detail page**

Create `app/menu/[id]/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Plus, Minus, Sandwich, ShoppingCart, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'
import { formatRupiah } from '@/lib/validations'
import RecommendationStrip from '@/components/RecommendationStrip'
import type { MenuItem } from '@/types'

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = String(params.id)
  const { addItem } = useCart()

  const [item, setItem] = useState<MenuItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('menu_items')
      .select('*, categories(id,name,sort_order)')
      .eq('id', id)
      .single()
      .then(({ data }) => { setItem(data as MenuItem | null); setLoading(false) })
  }, [id])

  function handleAdd() {
    if (!item) return
    for (let i = 0; i < qty; i++) addItem(item)
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5]">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#FFFBF5] px-4">
        <p className="text-gray-500 font-medium">Produk tidak ditemukan</p>
        <Link href="/" className="btn-primary">Kembali ke Menu</Link>
      </div>
    )
  }

  const showPlaceholder = !item.image_url

  return (
    <div className="min-h-screen bg-[#FFFBF5]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center gap-3">
          <Link href="/" className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <h1 className="font-bold text-gray-900 leading-none truncate">{item.name}</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-5 py-6 space-y-6">
        {/* Image */}
        <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-gradient-to-br from-amber-50 via-amber-100 to-orange-100">
          {!showPlaceholder ? (
            <Image src={item.image_url!} alt={item.name} fill className="object-cover" unoptimized />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Sandwich className="w-20 h-20 text-amber-200" strokeWidth={1} />
            </div>
          )}
          {!item.is_available && (
            <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center backdrop-blur-[1px]">
              <span className="bg-white/90 text-gray-700 text-sm font-bold px-5 py-2 rounded-full tracking-widest uppercase shadow">Habis</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-2">
          {item.categories?.name && (
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2.5 py-1 rounded-md">
              {item.categories.name}
            </span>
          )}
          <h2 className="text-2xl font-black text-gray-900">{item.name}</h2>
          {item.description && <p className="text-gray-500 text-sm leading-relaxed">{item.description}</p>}
          <p className="text-2xl font-extrabold text-amber-600 pt-1">{formatRupiah(item.price)}</p>
        </div>

        {/* Qty + Add */}
        {item.is_available && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-2 py-1.5">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-9 h-9 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl flex items-center justify-center transition-colors"
                aria-label="Kurangi"
              >
                <Minus className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <span className="w-8 text-center font-extrabold text-gray-900 tabular-nums">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(10, q + 1))}
                disabled={qty >= 10}
                className="w-9 h-9 bg-amber-gradient text-white rounded-xl flex items-center justify-center transition-all hover:brightness-110 disabled:opacity-30"
                aria-label="Tambah"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </div>
            <button onClick={handleAdd} className="btn-primary flex-1 py-3.5">
              <ShoppingCart className="w-4 h-4" />
              Tambah ke Keranjang
            </button>
          </div>
        )}

        {/* Recommendations */}
        <RecommendationStrip productId={item.id} title="Sering dibeli bersama" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the page renders**

With the dev server running, open `http://localhost:3000/menu/<an existing menu id>` in the browser.
Expected: detail page shows image/name/price/qty/add button and a "Sering dibeli bersama" strip (or nothing if no recommendations). Visiting `/menu/bogus-id` shows "Produk tidak ditemukan".

- [ ] **Step 3: Commit**

```bash
git add app/menu/[id]/page.tsx
git commit -m "feat: add product detail page"
```

---

## Task 5: Make menu cards link to the detail page

**Files:**
- Modify: `components/MenuItem.tsx`

- [ ] **Step 1: Replace the card-body click handler with navigation**

In `components/MenuItem.tsx`:

Add `useRouter` to the imports from `next/navigation` (add a new import line near the top, after the React import):
```tsx
import { useRouter } from 'next/navigation'
```

Add the router inside the component, next to the existing hooks:
```tsx
  const router = useRouter()
```

Replace the outer `<div onClick=...>` opening tag:
```tsx
    <div
      onClick={() => {
        if (item.is_available) addItem(item)
      }}
      className={`group bg-white rounded-3xl overflow-hidden border border-gray-100
```
with:
```tsx
    <div
      onClick={() => router.push(`/menu/${item.id}`)}
      className={`group bg-white rounded-3xl overflow-hidden border border-gray-100
```

(The quick-add `+` button and the qty `+/-` buttons below already call `e.stopPropagation()`, so they keep working without opening the detail page. The card body now navigates to the detail page for both available and habis items, so customers can read details even when an item is sold out.)

- [ ] **Step 2: Verify**

With the dev server running, open `http://localhost:3000`, click a card body → navigates to `/menu/[id]`. Click the corner `+` on a card → item is added to cart and the page does NOT navigate.

- [ ] **Step 3: Commit**

```bash
git add components/MenuItem.tsx
git commit -m "feat: menu card body opens product detail page"
```

---

## Task 6: Recommendations in the cart

**Files:**
- Modify: `components/Cart.tsx`

- [ ] **Step 1: Import the strip**

In `components/Cart.tsx`, add after the existing imports (after the `formatRupiah` import line):
```tsx
import RecommendationStrip from '@/components/RecommendationStrip'
```

- [ ] **Step 2: Render the strip above the footer**

In `components/Cart.tsx`, locate the items list closing `</div>` immediately before the `{/* Footer */}` comment. Insert the strip between them so it sits below the scrollable items and above the footer:
```tsx
      </div>

      {/* Recommendations */}
      <div className="px-5 py-3 border-t border-gray-50">
        <RecommendationStrip
          cartIds={items.map((i) => i.item.id)}
          title="Lengkapi pesananmu"
          limit={4}
        />
      </div>

      {/* Footer */}
```

(The strip returns `null` when there are no recommendations or all are already in the cart, so the bordered wrapper only adds visible spacing when there is content. This block lives inside the non-empty-cart return, so it never shows for an empty cart.)

- [ ] **Step 3: Verify**

With the dev server running, add an item to the cart and open the cart (desktop sidebar or mobile drawer).
Expected: a "Lengkapi pesananmu" strip appears with quick-add buttons (or nothing if there are no eligible recommendations). Adding a recommended item updates the cart and removes it from the strip.

- [ ] **Step 4: Commit**

```bash
git add components/Cart.tsx
git commit -m "feat: show recommendations in the cart"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run the unit tests**

Run: `npm test`
Expected: PASS — all recommendation tests green.

- [ ] **Step 2: Build to catch type/compile errors**

Run: `npm run build`
Expected: build completes with no type errors.

- [ ] **Step 3: Manual end-to-end smoke test**

With `npm run dev`:
1. Menu `/` → click a card body → lands on `/menu/[id]`.
2. Detail page shows correct product + "Sering dibeli bersama" strip.
3. Set qty to 2 → "Tambah ke Keranjang" → returns to `/` with 2 in cart.
4. Open cart → "Lengkapi pesananmu" strip shows; quick-add a recommendation.
5. Corner `+` on a menu card adds without navigating.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during verification"
```

---

## Notes / future work

- If transactions grow into the thousands, replace the JS aggregation in Task 2 with a Postgres
  RPC (co-occurrence query) — the `/api/recommendations` response contract stays identical, so no
  client changes are needed.
- A second cross-sell point (the checkout page) can reuse `RecommendationStrip` in cart mode later
  if desired; out of scope for this plan.
