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
