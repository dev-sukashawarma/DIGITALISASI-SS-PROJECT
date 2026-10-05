import { describe, it, expect } from 'vitest'
import { fetchManagedOutlets, patchOutlet, withPinned } from './managedOutlets'
import { filterOutlets } from './filterOutlets'
import type { Outlet } from './types'

const base = { address: null, lat: -6.5, lng: 106.8, marquee_warning_threshold: 10 }
const tes: Outlet = { ...base, id: 'a', name: 'tes', slug: 'tes', type: 'internal', status: 'pending', is_active: false }
const bogor: Outlet = { ...base, id: 'b', name: 'Bogor', slug: 'bogor', type: 'internal', status: 'active', is_active: true }

function fakeSupabase(rows: Outlet[]) {
  const q: any = { select: () => q, order: () => q, then: (r: any) => r({ data: rows, error: null }) }
  return { from: () => q } as any
}

describe('fetchManagedOutlets', () => {
  // Regresi 2026-10-05: refetch sesudah "Aktifkan" memakai daftar operasional yang
  // membuang outlet bernama "tes" → outlet lenyap sampai halaman di-refresh.
  it('tidak membuang outlet tes — daftar sama dengan yang dirender SSR', async () => {
    const rows = await fetchManagedOutlets(fakeSupabase([bogor, tes]))
    expect(rows.map((o) => o.id)).toEqual(['b', 'a'])
  })
})

describe('withPinned', () => {
  it('outlet pending yang diaktifkan tetap tampil di tab Pending', () => {
    const all = patchOutlet([bogor, tes], 'a', { status: 'active', is_active: true })
    const filtered = filterOutlets(all, { search: '', status: 'pending', type: 'all' })
    expect(filtered).toHaveLength(0)
    expect(withPinned(filtered, all, new Set(['a'])).map((o) => o.id)).toEqual(['a'])
  })

  it('tanpa pin hasil filter tak berubah', () => {
    const f = [bogor]
    expect(withPinned(f, [bogor, tes], new Set())).toBe(f)
  })
})
