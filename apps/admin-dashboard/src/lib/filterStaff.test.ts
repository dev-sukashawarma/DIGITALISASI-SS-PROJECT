import { describe, it, expect } from 'vitest'
import { filterStaff } from './filterStaff'
import type { StaffRow } from './types'

const rows: StaffRow[] = [
  { id: '1', name: 'Andi', role: 'crew', status: 'active', username: 'andi', outlet_id: 'o1', outlets: { name: 'Empang' }, outlet_ids: [] },
  { id: '2', name: 'Budi', role: 'crew', status: 'inactive', username: 'budi', outlet_id: 'o2', outlets: { name: 'Sudirman' }, outlet_ids: [] },
  { id: '3', name: 'Citra', role: 'crew', status: 'active', username: 'citra', outlet_id: 'o2', outlets: { name: 'Sudirman' }, outlet_ids: [] },
]

describe('filterStaff', () => {
  it('filters by search (case-insensitive, name)', () => {
    expect(filterStaff(rows, { search: 'an', outletId: '', role: '', status: '' }).map(r => r.id)).toEqual(['1'])
  })
  it('filters by outletId', () => {
    expect(filterStaff(rows, { search: '', outletId: 'o2', role: '', status: '' }).map(r => r.id)).toEqual(['2', '3'])
  })
  it('filters by role', () => {
    expect(filterStaff(rows, { search: '', outletId: '', role: 'crew', status: '' }).map(r => r.id)).toEqual(['1', '2', '3'])
  })
  it('filters by status', () => {
    expect(filterStaff(rows, { search: '', outletId: '', role: '', status: 'inactive' }).map(r => r.id)).toEqual(['2'])
  })
  it('combines filters (AND)', () => {
    expect(filterStaff(rows, { search: '', outletId: 'o2', role: 'crew', status: 'active' }).map(r => r.id)).toEqual(['3'])
  })
})
