# Admin-Dashboard Fase 2 — Outlet Master Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full CRUD management of the `outlets` master table to `apps/admin-dashboard`, with auto-slug, required coordinates (with Google-Maps paste helper), and two-tier delete (soft default + guarded hard delete).

**Architecture:** Mirror Fase 1 (Staff) structure — React Query hooks + focused components + admin-only route. Outlet writes go **directly via the browser supabase client** relying on the existing `outlets_all_admin` RLS policy (no edge function, unlike Staff). Pure logic (slugify, parseLatLng, filterOutlets) is extracted and TDD'd.

**Tech Stack:** Next.js (app router) + TypeScript, TanStack React Query, `@suka/auth` browser client, `@suka/design-system` (Button, Spinner), `sonner` toasts, `lucide-react` icons, vitest + Testing Library, TailwindCSS (`suka-*` palette).

**Spec:** `docs/superpowers/specs/2026-06-19-admin-dashboard-fase2-outlet-master-design.md`

---

## File Structure

- Create `apps/admin-dashboard/src/lib/slugify.ts` — pure name→slug.
- Create `apps/admin-dashboard/src/lib/slugify.test.ts`
- Create `apps/admin-dashboard/src/lib/parseLatLng.ts` — pure paste-string→{lat,lng}|null.
- Create `apps/admin-dashboard/src/lib/parseLatLng.test.ts`
- Create `apps/admin-dashboard/src/lib/filterOutlets.ts` — pure search+active filter.
- Create `apps/admin-dashboard/src/lib/filterOutlets.test.ts`
- Modify `apps/admin-dashboard/src/lib/types.ts` — extend `Outlet`, add `OutletFormValues`, `OutletFilterValues`.
- Modify `apps/admin-dashboard/src/hooks/useOutlets.ts` — select full row.
- Create `apps/admin-dashboard/src/hooks/useOutletMutations.ts` — create/update/softDelete/hardDelete/countRefs.
- Create `apps/admin-dashboard/src/hooks/useOutletMutations.test.tsx`
- Create `apps/admin-dashboard/src/components/OutletForm.tsx`
- Create `apps/admin-dashboard/src/components/OutletFilters.tsx`
- Create `apps/admin-dashboard/src/components/OutletTable.tsx`
- Create `apps/admin-dashboard/src/components/DeleteOutletDialog.tsx`
- Create `apps/admin-dashboard/src/app/dashboard/outlets/page.tsx`
- Modify `apps/admin-dashboard/src/components/layout/Sidebar.tsx` — add Outlet nav item.

**Working directory for all commands:** `apps/admin-dashboard`. Test runner: `yarn vitest run <path>` (or `npx vitest run`).

---

## Task 1: Types

**Files:**
- Modify: `apps/admin-dashboard/src/lib/types.ts`

- [ ] **Step 1: Extend `Outlet` and add form/filter value types**

Replace the existing `Outlet` interface (currently `{ id, name }`) and append the new types. Final state of the relevant section:

```typescript
export interface Outlet {
  id: string
  slug: string
  name: string
  address: string | null
  lat: number
  lng: number
  type: string
  is_active: boolean
}

export interface OutletFormValues {
  name: string
  slug: string
  address: string
  lat: number
  lng: number
  type: string
  is_active: boolean
}

export interface OutletFilterValues {
  search: string
  status: string // '' = semua, 'active', 'inactive'
}
```

Note: `StaffRow.outlets` and `useOutlets` consumers only read `id`/`name`, so widening `Outlet` is backward-compatible.

- [ ] **Step 2: Type-check**

Run: `yarn type-check`
Expected: PASS (0 errors). If `useOutlets.ts` now errors because `select('id, name')` no longer matches `Outlet`, that is fixed in Task 5 — for now it may still satisfy because extra required fields come from a cast; if type-check fails here, proceed to Task 5 and re-run. (Acceptable: defer the single useOutlets error to Task 5.)

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/lib/types.ts
git commit -m "feat(admin-dashboard): extend Outlet type + outlet form/filter value types"
```

---

## Task 2: slugify (pure, TDD)

**Files:**
- Create: `apps/admin-dashboard/src/lib/slugify.ts`
- Test: `apps/admin-dashboard/src/lib/slugify.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { slugify } from './slugify'

describe('slugify', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(slugify('Suka Shawarma Empang')).toBe('suka-shawarma-empang')
  })
  it('strips punctuation', () => {
    expect(slugify('Outlet #1 (Pusat)!')).toBe('outlet-1-pusat')
  })
  it('collapses repeated separators', () => {
    expect(slugify('A  --  B')).toBe('a-b')
  })
  it('trims leading/trailing dashes', () => {
    expect(slugify('  Empang  ')).toBe('empang')
  })
  it('strips accents', () => {
    expect(slugify('Café Düsseldorf')).toBe('cafe-dusseldorf')
  })
  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/lib/slugify.test.ts`
Expected: FAIL — "slugify is not a function" / module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents (combining diacritics)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric → dash
    .replace(/^-+|-+$/g, '') // trim dashes
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/lib/slugify.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/slugify.ts apps/admin-dashboard/src/lib/slugify.test.ts
git commit -m "feat(admin-dashboard): slugify util (TDD)"
```

---

## Task 3: parseLatLng (pure, TDD)

**Files:**
- Create: `apps/admin-dashboard/src/lib/parseLatLng.ts`
- Test: `apps/admin-dashboard/src/lib/parseLatLng.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { parseLatLng } from './parseLatLng'

describe('parseLatLng', () => {
  it('parses "lat, lng" with spaces', () => {
    expect(parseLatLng('-6.5971, 106.8060')).toEqual({ lat: -6.5971, lng: 106.806 })
  })
  it('parses without space after comma', () => {
    expect(parseLatLng('-6.5971,106.8060')).toEqual({ lat: -6.5971, lng: 106.806 })
  })
  it('tolerates degree symbols and extra whitespace', () => {
    expect(parseLatLng('  -6.5971°, 106.8060°  ')).toEqual({ lat: -6.5971, lng: 106.806 })
  })
  it('returns null for a single number', () => {
    expect(parseLatLng('-6.5971')).toBeNull()
  })
  it('returns null for non-numeric input', () => {
    expect(parseLatLng('not coords')).toBeNull()
  })
  it('returns null for out-of-range values', () => {
    expect(parseLatLng('999, 999')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/lib/parseLatLng.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
export interface LatLng {
  lat: number
  lng: number
}

export function parseLatLng(input: string): LatLng | null {
  const cleaned = input.replace(/[°\s]/g, '')
  const parts = cleaned.split(',')
  if (parts.length !== 2) return null
  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/lib/parseLatLng.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/parseLatLng.ts apps/admin-dashboard/src/lib/parseLatLng.test.ts
git commit -m "feat(admin-dashboard): parseLatLng paste helper (TDD)"
```

---

## Task 4: filterOutlets (pure, TDD)

**Files:**
- Create: `apps/admin-dashboard/src/lib/filterOutlets.ts`
- Test: `apps/admin-dashboard/src/lib/filterOutlets.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { filterOutlets } from './filterOutlets'
import type { Outlet } from './types'

const make = (p: Partial<Outlet>): Outlet => ({
  id: 'x', slug: 'x', name: 'X', address: null, lat: 0, lng: 0, type: 'outlet', is_active: true, ...p,
})

const rows: Outlet[] = [
  make({ id: '1', name: 'Empang', slug: 'empang', is_active: true }),
  make({ id: '2', name: 'Pusat', slug: 'pusat', is_active: false }),
]

describe('filterOutlets', () => {
  it('returns all when filter empty', () => {
    expect(filterOutlets(rows, { search: '', status: '' })).toHaveLength(2)
  })
  it('searches by name (case-insensitive)', () => {
    expect(filterOutlets(rows, { search: 'emp', status: '' }).map(r => r.id)).toEqual(['1'])
  })
  it('searches by slug', () => {
    expect(filterOutlets(rows, { search: 'pusat', status: '' }).map(r => r.id)).toEqual(['2'])
  })
  it('filters by active status', () => {
    expect(filterOutlets(rows, { search: '', status: 'active' }).map(r => r.id)).toEqual(['1'])
  })
  it('filters by inactive status', () => {
    expect(filterOutlets(rows, { search: '', status: 'inactive' }).map(r => r.id)).toEqual(['2'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/lib/filterOutlets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { Outlet, OutletFilterValues } from './types'

export function filterOutlets(rows: Outlet[], f: OutletFilterValues): Outlet[] {
  const q = f.search.trim().toLowerCase()
  return rows.filter((r) => {
    if (q && !r.name.toLowerCase().includes(q) && !r.slug.toLowerCase().includes(q)) return false
    if (f.status === 'active' && !r.is_active) return false
    if (f.status === 'inactive' && r.is_active) return false
    return true
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/lib/filterOutlets.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/filterOutlets.ts apps/admin-dashboard/src/lib/filterOutlets.test.ts
git commit -m "feat(admin-dashboard): filterOutlets util (TDD)"
```

---

## Task 5: useOutlets (read full row) + useOutletMutations

**Files:**
- Modify: `apps/admin-dashboard/src/hooks/useOutlets.ts`
- Create: `apps/admin-dashboard/src/hooks/useOutletMutations.ts`
- Test: `apps/admin-dashboard/src/hooks/useOutletMutations.test.tsx`

- [ ] **Step 1: Widen the read query**

Replace the `select` line in `useOutlets.ts`:

```typescript
const { data, error } = await supabase
  .from('outlets')
  .select('id, slug, name, address, lat, lng, type, is_active')
  .order('name')
```

(Keep the rest of the file identical: `useQuery<Outlet[]>`, `queryKey: ['outlets']`.)

- [ ] **Step 2: Write the failing test for mutations**

Mirrors `useStaffMutations.test.tsx` mocking style, but mocks the supabase client builder instead of `adminApi`.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const insert = vi.fn().mockResolvedValue({ error: null })
const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
const del = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({ insert, update, delete: del }),
  }),
}))

import { useOutletMutations } from './useOutletMutations'

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useOutletMutations', () => {
  beforeEach(() => { insert.mockClear(); update.mockClear(); del.mockClear() })

  it('create inserts a row with a generated id and invalidates ["outlets"]', async () => {
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useOutletMutations(), { wrapper: wrapper(client) })

    await result.current.create.mutateAsync({
      name: 'Empang', slug: 'empang', address: '', lat: -6.6, lng: 106.8, type: 'outlet', is_active: true,
    })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ slug: 'empang', name: 'Empang' }))
    const arg = insert.mock.calls[0][0] as { id: string }
    expect(typeof arg.id).toBe('string')
    expect(arg.id.length).toBeGreaterThan(0)
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['outlets'] }))
  })

  it('softDelete updates is_active=false', async () => {
    const client = new QueryClient()
    const { result } = renderHook(() => useOutletMutations(), { wrapper: wrapper(client) })
    await result.current.softDelete.mutateAsync('o1')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }))
  })

  it('hardDelete calls delete', async () => {
    const client = new QueryClient()
    const { result } = renderHook(() => useOutletMutations(), { wrapper: wrapper(client) })
    await result.current.hardDelete.mutateAsync('o1')
    expect(del).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn vitest run src/hooks/useOutletMutations.test.tsx`
Expected: FAIL — `./useOutletMutations` not found.

- [ ] **Step 4: Implement the mutations hook**

Friendly error mapping for PostgREST codes `23505` (dup slug) and `23503` (FK on hard delete). `countRefs` powers the hard-delete eligibility check in Task 8.

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { OutletFormValues } from '@/lib/types'

function friendly(error: { code?: string; message: string }): never {
  if (error.code === '23505') throw new Error('Slug sudah dipakai outlet lain.')
  if (error.code === '23503') throw new Error('Outlet masih punya data terkait, tidak bisa dihapus permanen.')
  throw new Error(error.message)
}

export function useOutletMutations() {
  const supabase = createClient()
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['outlets'] })

  const create = useMutation({
    mutationFn: async (values: OutletFormValues) => {
      const { error } = await supabase.from('outlets').insert({
        id: crypto.randomUUID(),
        name: values.name,
        slug: values.slug,
        address: values.address || null,
        lat: values.lat,
        lng: values.lng,
        type: values.type,
        is_active: values.is_active,
      })
      if (error) friendly(error)
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async (vars: { id: string } & OutletFormValues) => {
      const { id, ...values } = vars
      const { error } = await supabase
        .from('outlets')
        .update({
          name: values.name,
          slug: values.slug,
          address: values.address || null,
          lat: values.lat,
          lng: values.lng,
          type: values.type,
          is_active: values.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) friendly(error)
    },
    onSuccess: invalidate,
  })

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('outlets')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) friendly(error)
    },
    onSuccess: invalidate,
  })

  const hardDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('outlets').delete().eq('id', id)
      if (error) friendly(error)
    },
    onSuccess: invalidate,
  })

  // Count blocking references for hard-delete eligibility.
  async function countRefs(outletId: string): Promise<number> {
    const tables = ['outlet_staff', 'staff_outlets', 'ledger_stok']
    let total = 0
    for (const t of tables) {
      const { count, error } = await supabase
        .from(t)
        .select('*', { count: 'exact', head: true })
        .eq('outlet_id', outletId)
      if (error) throw new Error(error.message)
      total += count ?? 0
    }
    return total
  }

  return { create, update, softDelete, hardDelete, countRefs }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn vitest run src/hooks/useOutletMutations.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Type-check**

Run: `yarn type-check`
Expected: PASS (0 errors).

- [ ] **Step 7: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useOutlets.ts apps/admin-dashboard/src/hooks/useOutletMutations.ts apps/admin-dashboard/src/hooks/useOutletMutations.test.tsx
git commit -m "feat(admin-dashboard): useOutlets full row + useOutletMutations (TDD)"
```

---

## Task 6: OutletForm component

**Files:**
- Create: `apps/admin-dashboard/src/components/OutletForm.tsx`

- [ ] **Step 1: Implement the form**

Auto-slug from name (until the user manually edits slug), required lat/lng, and a "Paste dari Google Maps" button using `parseLatLng`. On edit the slug is read-only behind an "ubah slug" toggle. Pattern (controlled inputs, `suka-*` classes, `@suka/design-system` Button) mirrors `StaffForm`.

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@suka/design-system'
import { toast } from 'sonner'
import { slugify } from '@/lib/slugify'
import { parseLatLng } from '@/lib/parseLatLng'
import type { OutletFormValues } from '@/lib/types'

const inputCls =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange'

const EMPTY: OutletFormValues = {
  name: '', slug: '', address: '', lat: NaN, lng: NaN, type: 'outlet', is_active: true,
}

export function OutletForm({
  initial, submitting, isEdit, onSubmit,
}: {
  initial?: OutletFormValues
  submitting: boolean
  isEdit: boolean
  onSubmit: (v: OutletFormValues) => void
}) {
  const [v, setV] = useState<OutletFormValues>(initial ?? EMPTY)
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [slugLocked, setSlugLocked] = useState(isEdit) // edit: read-only until "ubah slug"
  const set = (patch: Partial<OutletFormValues>) => setV((prev) => ({ ...prev, ...patch }))

  function onName(name: string) {
    set({ name, ...(slugTouched ? {} : { slug: slugify(name) }) })
  }

  function onPaste() {
    const text = prompt('Tempel koordinat dari Google Maps (contoh: -6.5971, 106.8060)')
    if (!text) return
    const parsed = parseLatLng(text)
    if (!parsed) { toast.error('Format koordinat tidak dikenali'); return }
    set({ lat: parsed.lat, lng: parsed.lng })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!v.name.trim()) { toast.error('Nama wajib diisi'); return }
    if (!v.slug.trim()) { toast.error('Slug wajib diisi'); return }
    if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) { toast.error('Koordinat wajib diisi'); return }
    onSubmit(v)
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        <span className="mb-1 block font-medium text-suka-ink">Nama</span>
        <input className={inputCls} value={v.name} onChange={(e) => onName(e.target.value)} />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium text-suka-ink">Slug</span>
        <div className="flex items-center gap-2">
          <input
            className={inputCls} value={v.slug} readOnly={slugLocked}
            onChange={(e) => { setSlugTouched(true); set({ slug: slugify(e.target.value) }) }}
          />
          {isEdit && slugLocked && (
            <button type="button" className="whitespace-nowrap text-xs text-suka-orange"
              onClick={() => { setSlugLocked(false); toast('Mengubah slug bisa memutus link lama') }}>
              ubah slug
            </button>
          )}
        </div>
      </label>

      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-suka-ink">Alamat</span>
        <input className={inputCls} value={v.address} onChange={(e) => set({ address: e.target.value })} />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium text-suka-ink">Latitude</span>
        <input type="number" step="any" className={inputCls}
          value={Number.isFinite(v.lat) ? v.lat : ''}
          onChange={(e) => set({ lat: e.target.value === '' ? NaN : Number(e.target.value) })} />
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-medium text-suka-ink">Longitude</span>
        <input type="number" step="any" className={inputCls}
          value={Number.isFinite(v.lng) ? v.lng : ''}
          onChange={(e) => set({ lng: e.target.value === '' ? NaN : Number(e.target.value) })} />
      </label>

      <div className="sm:col-span-2">
        <button type="button" onClick={onPaste} className="text-xs font-medium text-suka-orange">
          Paste dari Google Maps
        </button>
      </div>

      <label className="text-sm">
        <span className="mb-1 block font-medium text-suka-ink">Tipe</span>
        <input className={inputCls} value={v.type} onChange={(e) => set({ type: e.target.value })} />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={v.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
        <span className="font-medium text-suka-ink">Aktif</span>
      </label>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={submitting} className="rounded-xl">
          {submitting ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Buat Outlet'}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `yarn type-check`
Expected: PASS (0 errors).

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/components/OutletForm.tsx
git commit -m "feat(admin-dashboard): OutletForm (auto-slug, paste coords, required lat/lng)"
```

---

## Task 7: OutletFilters + OutletTable

**Files:**
- Create: `apps/admin-dashboard/src/components/OutletFilters.tsx`
- Create: `apps/admin-dashboard/src/components/OutletTable.tsx`

- [ ] **Step 1: Implement OutletFilters** (mirrors `StaffFilters`)

```tsx
'use client'
import type { OutletFilterValues } from '@/lib/types'

export function OutletFilters({
  value, onChange,
}: {
  value: OutletFilterValues
  onChange: (v: OutletFilterValues) => void
}) {
  const set = (patch: Partial<OutletFilterValues>) => onChange({ ...value, ...patch })
  const inputCls = 'rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange'
  return (
    <div className="flex flex-wrap gap-2">
      <input className={inputCls} placeholder="Cari nama / slug"
        value={value.search} onChange={(e) => set({ search: e.target.value })} />
      <select className={inputCls} value={value.status} onChange={(e) => set({ status: e.target.value })}>
        <option value="">Semua Status</option>
        <option value="active">Aktif</option>
        <option value="inactive">Nonaktif</option>
      </select>
    </div>
  )
}
```

- [ ] **Step 2: Implement OutletTable**

Renders rows with status badge, edit, soft-toggle, and delete actions. Soft toggle flips `is_active`; delete opens the dialog (wired in page).

```tsx
'use client'
import { Pencil, Power, Trash2 } from 'lucide-react'
import type { Outlet } from '@/lib/types'

export function OutletTable({
  rows, onEdit, onToggleActive, onDelete,
}: {
  rows: Outlet[]
  onEdit: (o: Outlet) => void
  onToggleActive: (o: Outlet) => void
  onDelete: (o: Outlet) => void
}) {
  if (rows.length === 0) {
    return <p className="rounded-xl bg-suka-gray-50 p-6 text-center text-sm text-gray-500">Tidak ada outlet.</p>
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-suka-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-suka-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">Nama</th>
            <th className="px-4 py-3">Slug</th>
            <th className="px-4 py-3">Koordinat</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-t border-suka-gray-200">
              <td className="px-4 py-3 font-medium text-suka-ink">{o.name}</td>
              <td className="px-4 py-3 text-gray-500">{o.slug}</td>
              <td className="px-4 py-3 text-gray-500">{o.lat}, {o.lng}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                  {o.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-3 text-gray-500">
                  <button title="Edit" onClick={() => onEdit(o)}><Pencil size={16} /></button>
                  <button title={o.is_active ? 'Nonaktifkan' : 'Aktifkan'} onClick={() => onToggleActive(o)}><Power size={16} /></button>
                  <button title="Hapus permanen" onClick={() => onDelete(o)} className="text-red-500"><Trash2 size={16} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `yarn type-check`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/components/OutletFilters.tsx apps/admin-dashboard/src/components/OutletTable.tsx
git commit -m "feat(admin-dashboard): OutletFilters + OutletTable"
```

---

## Task 8: DeleteOutletDialog (two-tier delete)

**Files:**
- Create: `apps/admin-dashboard/src/components/DeleteOutletDialog.tsx`

- [ ] **Step 1: Implement the dialog**

On open it calls `countRefs(outlet.id)`. If refs > 0, hard delete is disabled with a reason and only "Nonaktifkan" is offered. If refs === 0, hard delete unlocks behind a typed-name confirmation. Pattern mirrors `ResetPasswordDialog` (fixed overlay + card).

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Button } from '@suka/design-system'
import type { Outlet } from '@/lib/types'

export function DeleteOutletDialog({
  outlet, countRefs, onSoftDelete, onHardDelete, onClose,
}: {
  outlet: Outlet
  countRefs: (id: string) => Promise<number>
  onSoftDelete: () => void
  onHardDelete: () => void
  onClose: () => void
}) {
  const [refs, setRefs] = useState<number | null>(null)
  const [confirmName, setConfirmName] = useState('')

  useEffect(() => {
    let alive = true
    countRefs(outlet.id).then((n) => { if (alive) setRefs(n) }).catch(() => { if (alive) setRefs(-1) })
    return () => { alive = false }
  }, [outlet.id, countRefs])

  const canHardDelete = refs === 0 && confirmName.trim() === outlet.name

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        <h3 className="mb-2 text-lg font-bold text-suka-ink">Hapus {outlet.name}?</h3>

        <p className="mb-4 text-sm text-gray-600">
          <strong>Nonaktifkan</strong> menyembunyikan outlet tanpa menghapus data historis. Bisa diaktifkan kembali.
        </p>

        {refs === null && <p className="text-sm text-gray-400">Memeriksa data terkait…</p>}
        {refs !== null && refs > 0 && (
          <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
            Outlet punya {refs} data terkait (staff / ledger). Hapus permanen dinonaktifkan — gunakan Nonaktifkan.
          </p>
        )}
        {refs === 0 && (
          <div className="mb-4 rounded-xl bg-red-50 p-3">
            <p className="mb-2 text-sm text-red-700">Hapus permanen tidak bisa dibatalkan. Ketik nama outlet untuk konfirmasi:</p>
            <input
              className="w-full rounded-xl border border-red-200 px-3 py-2 text-sm outline-none focus:border-red-400"
              placeholder={outlet.name} value={confirmName} onChange={(e) => setConfirmName(e.target.value)}
            />
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-gray-500">Batal</button>
          <Button onClick={onSoftDelete} className="rounded-xl">Nonaktifkan</Button>
          <button
            onClick={onHardDelete} disabled={!canHardDelete}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Hapus permanen
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `yarn type-check`
Expected: PASS (0 errors).

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/components/DeleteOutletDialog.tsx
git commit -m "feat(admin-dashboard): DeleteOutletDialog (soft default + guarded hard delete)"
```

---

## Task 9: Outlets page + sidebar wiring

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/outlets/page.tsx`
- Modify: `apps/admin-dashboard/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Implement the page** (composition mirrors `dashboard/staff/page.tsx`)

```tsx
'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { useOutlets } from '@/hooks/useOutlets'
import { useOutletMutations } from '@/hooks/useOutletMutations'
import { filterOutlets } from '@/lib/filterOutlets'
import { OutletFilters } from '@/components/OutletFilters'
import { OutletTable } from '@/components/OutletTable'
import { OutletForm } from '@/components/OutletForm'
import { DeleteOutletDialog } from '@/components/DeleteOutletDialog'
import type { Outlet, OutletFilterValues, OutletFormValues } from '@/lib/types'

export const dynamic = 'force-dynamic'

const EMPTY_FILTER: OutletFilterValues = { search: '', status: '' }

function toFormValues(o: Outlet): OutletFormValues {
  return {
    name: o.name, slug: o.slug, address: o.address ?? '',
    lat: o.lat, lng: o.lng, type: o.type, is_active: o.is_active,
  }
}

export default function OutletsPage() {
  const { data: outlets = [], isLoading } = useOutlets()
  const { create, update, softDelete, hardDelete, countRefs } = useOutletMutations()

  const [filter, setFilter] = useState<OutletFilterValues>(EMPTY_FILTER)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Outlet | null>(null)
  const [deleting, setDeleting] = useState<Outlet | null>(null)

  const rows = useMemo(() => filterOutlets(outlets, filter), [outlets, filter])

  function handleCreate(values: OutletFormValues) {
    create.mutate(values, {
      onSuccess: () => { toast.success(`Outlet ${values.name} dibuat`); setShowForm(false) },
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleUpdate(values: OutletFormValues) {
    if (!editing) return
    update.mutate({ id: editing.id, ...values }, {
      onSuccess: () => { toast.success('Perubahan disimpan'); setEditing(null) },
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleToggleActive(o: Outlet) {
    if (o.is_active) {
      softDelete.mutate(o.id, {
        onSuccess: () => toast.success(`${o.name} dinonaktifkan`),
        onError: (e: any) => toast.error(e.message),
      })
    } else {
      update.mutate({ id: o.id, ...toFormValues(o), is_active: true }, {
        onSuccess: () => toast.success(`${o.name} diaktifkan`),
        onError: (e: any) => toast.error(e.message),
      })
    }
  }

  function handleSoftDelete() {
    if (!deleting) return
    softDelete.mutate(deleting.id, {
      onSuccess: () => { toast.success(`${deleting.name} dinonaktifkan`); setDeleting(null) },
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleHardDelete() {
    if (!deleting) return
    hardDelete.mutate(deleting.id, {
      onSuccess: () => { toast.success(`${deleting.name} dihapus permanen`); setDeleting(null) },
      onError: (e: any) => toast.error(e.message),
    })
  }

  if (isLoading) return <div className="flex justify-center p-8"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-suka-ink">Master Outlet</h2>
        <Button onClick={() => { setEditing(null); setShowForm((v) => !v) }} className="flex items-center gap-2 rounded-xl">
          <Plus size={18} /> Tambah Outlet
        </Button>
      </div>

      {showForm && !editing && (
        <div className="rounded-2xl border-2 border-suka-orange/40 bg-white p-4 sm:p-6">
          <h3 className="mb-4 font-bold text-suka-ink">Outlet Baru</h3>
          <OutletForm isEdit={false} submitting={create.isPending} onSubmit={handleCreate} />
        </div>
      )}

      {editing && (
        <div className="rounded-2xl border-2 border-blue-300 bg-white p-4 sm:p-6">
          <h3 className="mb-4 font-bold text-suka-ink">Edit — {editing.name}</h3>
          <OutletForm isEdit submitting={update.isPending} onSubmit={handleUpdate} initial={toFormValues(editing)} />
        </div>
      )}

      <OutletFilters value={filter} onChange={setFilter} />

      <OutletTable
        rows={rows}
        onEdit={(o) => { setShowForm(false); setEditing(o) }}
        onToggleActive={handleToggleActive}
        onDelete={(o) => setDeleting(o)}
      />

      {deleting && (
        <DeleteOutletDialog
          outlet={deleting}
          countRefs={countRefs}
          onSoftDelete={handleSoftDelete}
          onHardDelete={handleHardDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the sidebar nav item**

In `Sidebar.tsx`, import `Store` and add the nav entry between Ringkasan and Staff:

```tsx
import { LayoutDashboard, Users, Store } from 'lucide-react'

const NAV = [
  { href: '/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { href: '/dashboard/outlets', label: 'Outlet', icon: Store },
  { href: '/dashboard/staff', label: 'Staff', icon: Users },
]
```

- [ ] **Step 3: Type-check + run full test suite**

Run: `yarn type-check && yarn vitest run`
Expected: type-check 0 errors; all tests pass (existing Fase 1 tests + new slugify/parseLatLng/filterOutlets/useOutletMutations).

- [ ] **Step 4: Build**

Run: `yarn build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/outlets/page.tsx apps/admin-dashboard/src/components/layout/Sidebar.tsx
git commit -m "feat(admin-dashboard): Outlet master data page + sidebar nav (Fase 2)"
```

---

## Task 10: Manual smoke test

- [ ] **Step 1: Run dev server and verify**

Run: `yarn dev` (from `apps/admin-dashboard`), log in as admin, open `/dashboard/outlets`.

Verify:
- List loads all outlets with status badges.
- Create: name auto-fills slug; "Paste dari Google Maps" fills lat/lng; submitting without coords blocks with toast; duplicate slug → "Slug sudah dipakai outlet lain."
- Edit: slug read-only until "ubah slug"; changes persist.
- Power toggle nonaktif/aktif updates badge.
- Delete dialog: outlet with staff/ledger → hard delete disabled with reason; empty outlet → typed-name confirmation enables permanent delete.
- Filters: search by name/slug + active/inactive narrow the list.

- [ ] **Step 2: No commit** (verification only).

---

## Notes

- All outlet writes rely on the existing `outlets_all_admin` RLS policy — no migration or edge function is part of this plan.
- The misleading "sync from Ecosystem" comment / `sync-outlets` function are out of scope (noted in spec §7).
- `crypto.randomUUID()` is available in modern browsers and Node 18+ (test env). No polyfill needed.
