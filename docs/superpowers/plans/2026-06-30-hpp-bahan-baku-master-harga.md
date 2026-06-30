# HPP Bahan Baku — Master Harga Beli Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin bisa melihat & mengedit harga beli per bahan baku lewat halaman di admin-dashboard, dengan harga tersimpan terpisah dan hanya terbaca oleh admin.

**Architecture:** Tabel baru `bahan_baku_harga` (1:1 ke `bahan_baku`, RLS read+write admin-only) menyimpan harga, sehingga nama/satuan bahan tetap terbaca semua staff sementara harga terkunci untuk admin. UI = satu halaman tabel dengan edit harga inline di admin-dashboard, memakai react-query + browser client RLS-bound (pola `useOutletMutations`). Logika yang bisa diuji (normalisasi embed, filter, parse harga) diisolasi ke helper murni; hook & komponen diverifikasi via type-check + build (sesuai konvensi test admin-dashboard yang berbasis pure-function).

**Tech Stack:** Supabase (Postgres + RLS), Next.js App Router, React, @tanstack/react-query, @suka/design-system, sonner (toast), vitest.

**Spec:** [docs/superpowers/specs/2026-06-30-hpp-bahan-baku-master-harga-design.md](../specs/2026-06-30-hpp-bahan-baku-master-harga-design.md)

---

## File Structure

**Create:**
- `supabase/migrations/20260630120000_bahan_baku_harga.sql` — tabel harga + RLS admin-only
- `apps/admin-dashboard/src/lib/bahanBaku.ts` — tipe + helper murni (normalisasi embed, filter, parse harga)
- `apps/admin-dashboard/src/lib/bahanBaku.test.ts` — unit test helper
- `apps/admin-dashboard/src/hooks/useBahanBakuHarga.ts` — react-query read (bahan + embed harga)
- `apps/admin-dashboard/src/hooks/useBahanBakuHargaMutations.ts` — upsert harga
- `apps/admin-dashboard/src/components/BahanBakuFilters.tsx` — input pencarian nama
- `apps/admin-dashboard/src/components/BahanBakuTable.tsx` — tabel + edit harga inline
- `apps/admin-dashboard/src/app/dashboard/bahan-baku/page.tsx` — halaman

**Modify:**
- `apps/admin-dashboard/src/components/layout/navConfig.ts` — item nav baru (grup System & Admin)
- `apps/admin-dashboard/src/components/layout/navConfig.test.ts` — test item ADMIN-only

---

## Task 1: Migration — tabel `bahan_baku_harga` + RLS admin-only

**Files:**
- Create: `supabase/migrations/20260630120000_bahan_baku_harga.sql`

- [ ] **Step 1: Tulis file migration**

```sql
-- 20260630120000_bahan_baku_harga.sql
-- Harga beli per bahan baku (global, terkini). Tabel terpisah dari bahan_baku
-- supaya harga bisa dikunci admin-only sementara nama/satuan tetap terbaca
-- semua staff (alur stok/permintaan/surat jalan tak terganggu).

CREATE TABLE bahan_baku_harga (
  bahan_baku_id    UUID PRIMARY KEY REFERENCES bahan_baku(id) ON DELETE CASCADE,
  harga_beli       NUMERIC NOT NULL DEFAULT 0 CHECK (harga_beli >= 0),
  harga_updated_at TIMESTAMPTZ,
  updated_by       UUID REFERENCES outlet_staff(id)
);

ALTER TABLE bahan_baku_harga ENABLE ROW LEVEL SECURITY;

-- Read: admin only.
CREATE POLICY bbh_read ON bahan_baku_harga FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'admin'));

-- Write (insert/update/delete): admin only.
CREATE POLICY bbh_write ON bahan_baku_harga FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'admin'));

-- DOWN:
-- DROP TABLE IF EXISTS bahan_baku_harga;
```

- [ ] **Step 2: Cek status migration sebelum push (hindari history drift)**

Run: `supabase migration list`
Expected: daftar migration lokal vs remote sinkron sampai migration terakhir; tidak ada drift. Bila ada drift, jalankan `supabase migration repair --status applied <ver>` sesuai playbook di CLAUDE.md sebelum lanjut.

- [ ] **Step 3: Push migration ke remote**

Run: `supabase db push`
Expected: `20260630120000_bahan_baku_harga.sql` applied tanpa error.

- [ ] **Step 4: Verifikasi tabel & RLS benar-benar ada di remote**

Run (psql/SQL editor):
```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'bahan_baku_harga' ORDER BY policyname;
```
Expected: dua baris — `bbh_read` (SELECT) dan `bbh_write` (ALL).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260630120000_bahan_baku_harga.sql
git commit -m "feat(hpp): tabel bahan_baku_harga + RLS admin-only"
```

---

## Task 2: Helper murni — normalisasi embed, filter, parse harga (TDD)

**Files:**
- Create: `apps/admin-dashboard/src/lib/bahanBaku.ts`
- Test: `apps/admin-dashboard/src/lib/bahanBaku.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

```ts
// apps/admin-dashboard/src/lib/bahanBaku.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeBahanBaku, filterBahanBaku, parsePriceInput } from './bahanBaku'
import type { BahanBakuRaw } from './bahanBaku'

const raw = (over: Partial<BahanBakuRaw> = {}): BahanBakuRaw => ({
  id: '1', nama: 'Daging Sapi', satuan: 'kg', kategori: 'protein',
  bahan_baku_harga: null, ...over,
})

describe('normalizeBahanBaku', () => {
  it('flattens embed object to harga', () => {
    const r = normalizeBahanBaku(raw({ bahan_baku_harga: { harga_beli: 120000, harga_updated_at: '2026-06-30T00:00:00Z' } }))
    expect(r.harga).toEqual({ harga_beli: 120000, harga_updated_at: '2026-06-30T00:00:00Z' })
  })
  it('flattens embed array (PostgREST to-many shape) to first element', () => {
    const r = normalizeBahanBaku(raw({ bahan_baku_harga: [{ harga_beli: 5000, harga_updated_at: null }] }))
    expect(r.harga).toEqual({ harga_beli: 5000, harga_updated_at: null })
  })
  it('returns null harga when embed is null or empty array', () => {
    expect(normalizeBahanBaku(raw({ bahan_baku_harga: null })).harga).toBeNull()
    expect(normalizeBahanBaku(raw({ bahan_baku_harga: [] })).harga).toBeNull()
  })
})

describe('filterBahanBaku', () => {
  const rows = [
    normalizeBahanBaku(raw({ id: '1', nama: 'Daging Sapi' })),
    normalizeBahanBaku(raw({ id: '2', nama: 'Roti Pita' })),
  ]
  it('matches by case-insensitive substring of nama', () => {
    expect(filterBahanBaku(rows, 'roti').map((r) => r.id)).toEqual(['2'])
    expect(filterBahanBaku(rows, 'SAPI').map((r) => r.id)).toEqual(['1'])
  })
  it('returns all rows when search empty', () => {
    expect(filterBahanBaku(rows, '').length).toBe(2)
  })
})

describe('parsePriceInput', () => {
  it('parses plain digits', () => { expect(parsePriceInput('5000')).toBe(5000) })
  it('strips Rp / separators', () => { expect(parsePriceInput('Rp 120.000')).toBe(120000) })
  it('returns null for empty or non-numeric', () => {
    expect(parsePriceInput('')).toBeNull()
    expect(parsePriceInput('abc')).toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/bahanBaku.test.ts`
Expected: FAIL — `Cannot find module './bahanBaku'`.

- [ ] **Step 3: Tulis implementasi minimal**

```ts
// apps/admin-dashboard/src/lib/bahanBaku.ts
export interface BahanBakuHargaRow {
  harga_beli: number
  harga_updated_at: string | null
}

/** Bentuk mentah dari Supabase: embed bisa object, array, atau null. */
export interface BahanBakuRaw {
  id: string
  nama: string
  satuan: string
  kategori: string
  bahan_baku_harga: BahanBakuHargaRow | BahanBakuHargaRow[] | null
}

export interface BahanBakuWithHarga {
  id: string
  nama: string
  satuan: string
  kategori: string
  harga: BahanBakuHargaRow | null
}

export function normalizeBahanBaku(raw: BahanBakuRaw): BahanBakuWithHarga {
  const embed = raw.bahan_baku_harga
  const harga = Array.isArray(embed) ? (embed[0] ?? null) : (embed ?? null)
  return { id: raw.id, nama: raw.nama, satuan: raw.satuan, kategori: raw.kategori, harga }
}

export function filterBahanBaku(rows: BahanBakuWithHarga[], search: string): BahanBakuWithHarga[] {
  const q = search.trim().toLowerCase()
  if (q === '') return rows
  return rows.filter((r) => r.nama.toLowerCase().includes(q))
}

/** Ubah input teks harga jadi angka >= 0, atau null bila tak valid/kosong. */
export function parsePriceInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : null
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/bahanBaku.test.ts`
Expected: PASS (semua test di file ini hijau).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/bahanBaku.ts apps/admin-dashboard/src/lib/bahanBaku.test.ts
git commit -m "feat(hpp): helper normalisasi/filter/parse harga bahan baku"
```

---

## Task 3: Nav item halaman bahan baku (ADMIN-only) + test

**Files:**
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts`
- Test: `apps/admin-dashboard/src/components/layout/navConfig.test.ts`

- [ ] **Step 1: Tambah test yang gagal**

Tambahkan blok berikut di akhir `navConfig.test.ts` (setelah `describe('accessibleItems for MITRA', ...)`):

```ts
import { accessibleItems } from './navConfig'

describe('Master Bahan Baku nav item', () => {
  it('is visible to ADMIN', () => {
    const hrefs = accessibleItems('ADMIN').map((i) => i.href)
    expect(hrefs).toContain('/dashboard/bahan-baku')
  })
  it('is hidden from OWNER, ADMIN_HR, and MITRA', () => {
    for (const role of ['OWNER', 'ADMIN_HR', 'MITRA'] as const) {
      const hrefs = accessibleItems(role).map((i) => i.href)
      expect(hrefs).not.toContain('/dashboard/bahan-baku')
    }
  })
})
```

Catatan: `import { accessibleItems }` sudah ada di baris atas file — jangan duplikat import; gunakan yang sudah ada.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/admin-dashboard && yarn vitest run src/components/layout/navConfig.test.ts`
Expected: FAIL — ADMIN tidak mengandung `/dashboard/bahan-baku`.

- [ ] **Step 3: Tambah item nav**

Di `navConfig.ts`, tambahkan `Tags` ke import lucide-react:

```ts
import {
  LayoutDashboard, Users, Store, Activity,
  CalendarClock, CalendarHeart, Banknote,
  PieChart, DollarSign, MessageSquareHeart, Target, BellRing, Tags, type LucideIcon,
} from 'lucide-react'
```

Lalu tambahkan item di grup `System & Admin` (sebelum item Outlet):

```ts
  {
    title: 'System & Admin',
    roles: ['ADMIN'],
    items: [
      { href: '/dashboard/bahan-baku', label: 'Master Bahan Baku', shortLabel: 'Bahan Baku', icon: Tags, roles: ['ADMIN'] },
      { href: '/dashboard/outlets', label: 'Manajemen Outlet', shortLabel: 'Outlet', icon: Store, roles: ['ADMIN'] },
      { href: '/dashboard/push-center', label: 'Pusat Notifikasi', shortLabel: 'Notifikasi', icon: BellRing, roles: ['ADMIN'] },
      { href: '/dashboard/system-health', label: 'System Health', shortLabel: 'System', icon: Activity, roles: ['ADMIN'] },
    ],
  },
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd apps/admin-dashboard && yarn vitest run src/components/layout/navConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/components/layout/navConfig.ts apps/admin-dashboard/src/components/layout/navConfig.test.ts
git commit -m "feat(hpp): nav Master Bahan Baku (ADMIN-only)"
```

---

## Task 4: Hook read `useBahanBakuHarga`

**Files:**
- Create: `apps/admin-dashboard/src/hooks/useBahanBakuHarga.ts`

- [ ] **Step 1: Tulis hook**

```ts
// apps/admin-dashboard/src/hooks/useBahanBakuHarga.ts
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { normalizeBahanBaku } from '@/lib/bahanBaku'
import type { BahanBakuRaw, BahanBakuWithHarga } from '@/lib/bahanBaku'

export function useBahanBakuHarga() {
  const supabase = createClient()
  return useQuery<BahanBakuWithHarga[]>({
    queryKey: ['bahan_baku_harga'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bahan_baku')
        .select('id, nama, satuan, kategori, bahan_baku_harga(harga_beli, harga_updated_at)')
        .eq('is_active', true)
        .order('nama')
      if (error) throw error
      return ((data ?? []) as unknown as BahanBakuRaw[]).map(normalizeBahanBaku)
    },
  })
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useBahanBakuHarga.ts
git commit -m "feat(hpp): hook useBahanBakuHarga (read bahan + embed harga)"
```

---

## Task 5: Hook mutation `useBahanBakuHargaMutations`

**Files:**
- Create: `apps/admin-dashboard/src/hooks/useBahanBakuHargaMutations.ts`

- [ ] **Step 1: Tulis hook**

```ts
// apps/admin-dashboard/src/hooks/useBahanBakuHargaMutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export function useBahanBakuHargaMutations() {
  const supabase = createClient()
  const qc = useQueryClient()

  const setHarga = useMutation({
    mutationFn: async (vars: { bahan_baku_id: string; harga_beli: number }) => {
      const { data: auth } = await supabase.auth.getUser()
      const { error } = await supabase.from('bahan_baku_harga').upsert({
        bahan_baku_id: vars.bahan_baku_id,
        harga_beli: vars.harga_beli,
        harga_updated_at: new Date().toISOString(),
        updated_by: auth.user?.id ?? null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bahan_baku_harga'] }),
  })

  return { setHarga }
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useBahanBakuHargaMutations.ts
git commit -m "feat(hpp): hook upsert harga bahan baku (admin RLS)"
```

---

## Task 6: Komponen `BahanBakuFilters` + `BahanBakuTable`

**Files:**
- Create: `apps/admin-dashboard/src/components/BahanBakuFilters.tsx`
- Create: `apps/admin-dashboard/src/components/BahanBakuTable.tsx`

- [ ] **Step 1: Tulis `BahanBakuFilters`**

```tsx
// apps/admin-dashboard/src/components/BahanBakuFilters.tsx
'use client'

export function BahanBakuFilters({
  search, onSearch,
}: {
  search: string
  onSearch: (v: string) => void
}) {
  const inputCls = 'rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange'
  return (
    <div className="flex flex-wrap gap-2">
      <input className={inputCls} placeholder="Cari nama bahan"
        value={search} onChange={(e) => onSearch(e.target.value)} />
    </div>
  )
}
```

- [ ] **Step 2: Tulis `BahanBakuTable` (edit harga inline)**

```tsx
// apps/admin-dashboard/src/components/BahanBakuTable.tsx
'use client'
import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { rupiah } from '@/lib/format'
import { parsePriceInput } from '@/lib/bahanBaku'
import type { BahanBakuWithHarga } from '@/lib/bahanBaku'

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function BahanBakuTable({
  rows, onSave, saving,
}: {
  rows: BahanBakuWithHarga[]
  onSave: (bahanBakuId: string, harga: number) => void
  saving: boolean
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  if (rows.length === 0) {
    return <p className="rounded-xl bg-suka-gray-50 p-6 text-center text-sm text-gray-500">Tidak ada bahan baku.</p>
  }

  function startEdit(r: BahanBakuWithHarga) {
    setEditingId(r.id)
    setDraft(r.harga ? String(r.harga.harga_beli) : '')
  }
  function cancel() { setEditingId(null); setDraft('') }
  function commit(id: string) {
    const parsed = parsePriceInput(draft)
    if (parsed === null) return // input tak valid: biarkan tetap edit
    onSave(id, parsed)
    setEditingId(null); setDraft('')
  }

  const inputCls = 'w-28 rounded-lg border border-suka-gray-200 px-2 py-1 text-sm outline-none focus:border-suka-orange'

  return (
    <div className="overflow-x-auto rounded-2xl border border-suka-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-suka-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">Nama</th>
            <th className="px-4 py-3">Kategori</th>
            <th className="px-4 py-3">Satuan</th>
            <th className="px-4 py-3">Harga Beli</th>
            <th className="px-4 py-3">Terakhir Diubah</th>
            <th className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isEditing = editingId === r.id
            return (
              <tr key={r.id} className="border-t border-suka-gray-200">
                <td className="px-4 py-3 font-medium text-suka-ink">{r.nama}</td>
                <td className="px-4 py-3 text-gray-500">{r.kategori}</td>
                <td className="px-4 py-3 text-gray-500">{r.satuan}</td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <input
                      autoFocus className={inputCls} inputMode="numeric" value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commit(r.id); if (e.key === 'Escape') cancel() }}
                    />
                  ) : (
                    <span className={r.harga ? 'text-suka-ink' : 'text-gray-400'}>
                      {r.harga ? rupiah(r.harga.harga_beli) : '—'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{formatUpdatedAt(r.harga?.harga_updated_at ?? null)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3 text-gray-500">
                    {isEditing ? (
                      <>
                        <button title="Simpan" disabled={saving} onClick={() => commit(r.id)} className="text-suka-green"><Check size={16} /></button>
                        <button title="Batal" disabled={saving} onClick={cancel}><X size={16} /></button>
                      </>
                    ) : (
                      <button title="Edit harga" onClick={() => startEdit(r)}><Pencil size={16} /></button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/components/BahanBakuFilters.tsx apps/admin-dashboard/src/components/BahanBakuTable.tsx
git commit -m "feat(hpp): komponen tabel + filter harga bahan baku"
```

---

## Task 7: Halaman `/dashboard/bahan-baku`

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/bahan-baku/page.tsx`

- [ ] **Step 1: Tulis halaman**

```tsx
// apps/admin-dashboard/src/app/dashboard/bahan-baku/page.tsx
'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@suka/design-system'
import { useBahanBakuHarga } from '@/hooks/useBahanBakuHarga'
import { useBahanBakuHargaMutations } from '@/hooks/useBahanBakuHargaMutations'
import { filterBahanBaku } from '@/lib/bahanBaku'
import { BahanBakuFilters } from '@/components/BahanBakuFilters'
import { BahanBakuTable } from '@/components/BahanBakuTable'

export const dynamic = 'force-dynamic'

export default function BahanBakuPage() {
  const { data: rows = [], isLoading } = useBahanBakuHarga()
  const { setHarga } = useBahanBakuHargaMutations()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => filterBahanBaku(rows, search), [rows, search])

  function handleSave(bahanBakuId: string, harga: number) {
    setHarga.mutate({ bahan_baku_id: bahanBakuId, harga_beli: harga }, {
      onSuccess: () => toast.success('Harga disimpan'),
      onError: (e: any) => toast.error(e.message),
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-suka-ink">Master Bahan Baku</h1>
        <p className="text-sm text-gray-500">Kelola harga beli bahan baku. Harga hanya terlihat oleh admin.</p>
      </div>

      <BahanBakuFilters search={search} onSearch={setSearch} />

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <BahanBakuTable rows={filtered} onSave={handleSave} saving={setHarga.isPending} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 error.

- [ ] **Step 3: Verifikasi `Spinner` di-export `@suka/design-system`**

Run: `grep -r "Spinner" apps/admin-dashboard/src/app/dashboard/outlets/page.tsx`
Expected: import `Spinner` dari `@suka/design-system` (sudah dipakai di outlets). Bila tidak ada, gunakan pola spinner yang dipakai halaman lain (cek import di outlets/page.tsx).

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/bahan-baku/page.tsx
git commit -m "feat(hpp): halaman /dashboard/bahan-baku kelola harga"
```

---

## Task 8: Verifikasi akhir — test, type-check, build

**Files:** (tidak ada perubahan kode; gerbang verifikasi)

- [ ] **Step 1: Jalankan seluruh test admin-dashboard**

Run: `cd apps/admin-dashboard && yarn vitest run`
Expected: semua test PASS (termasuk `bahanBaku.test.ts` & `navConfig.test.ts`).

- [ ] **Step 2: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 error.

- [ ] **Step 3: Build**

Run: `cd apps/admin-dashboard && yarn build`
Expected: build sukses; route `/dashboard/bahan-baku` muncul sebagai `ƒ (Dynamic)`.

- [ ] **Step 4: Commit (bila ada perubahan kecil dari verifikasi)**

```bash
git add -A
git commit -m "chore(hpp): verifikasi test/type-check/build hijau" || echo "nothing to commit"
```

---

## Catatan Eksekusi

- **Smoke test manual** setelah merge: login sebagai admin → buka `/dashboard/bahan-baku` → set harga sebuah bahan → reload → harga & "Terakhir Diubah" terisi. Login sebagai non-admin (mis. owner) → item nav "Master Bahan Baku" tidak muncul, dan query `bahan_baku_harga` tak mengembalikan baris.
- **Redeploy** `admin-dashboard` ke produksi agar fitur live (lihat playbook deploy di CLAUDE.md).
- Setelah selesai, integrasi PR `feat/hpp-bahan-baku-master-harga` → `main`.
