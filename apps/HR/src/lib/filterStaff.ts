import type { StaffRow, StaffFilterValues } from './types'
import { isTestOrDevStaff } from './staffFilters'

export function filterStaff(rows: StaffRow[], f: StaffFilterValues): StaffRow[] {
  const q = f.search.trim().toLowerCase()

  // 1. Filter
  const filtered = rows.filter((r) => {
    if (isTestOrDevStaff(r)) return false
    if (q && !r.name.toLowerCase().includes(q) && !(r.username ?? '').toLowerCase().includes(q)) return false
    if (f.outletId && r.outlet_id !== f.outletId) return false
    if (f.role && r.role !== f.role) return false
    if (f.status && r.status !== f.status) return false
    return true
  })

  // 2. Sort
  const sortBy = f.sortBy || 'name'
  const sortOrder = f.sortOrder || 'asc'
  const mult = sortOrder === 'desc' ? -1 : 1

  return filtered.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name, 'id') * mult
      case 'username':
        return (a.username || '').localeCompare(b.username || '', 'id') * mult
      case 'role':
        return a.role.localeCompare(b.role, 'id') * mult
      case 'outlet': {
        const outletA = a.outlets?.name || ''
        const outletB = b.outlets?.name || ''
        return outletA.localeCompare(outletB, 'id') * mult
      }
      case 'status':
        return a.status.localeCompare(b.status, 'id') * mult
      case 'salary': {
        const salA = a.financials?.basic_salary || 0
        const salB = b.financials?.basic_salary || 0
        return (salA - salB) * mult
      }
      case 'date': {
        const dateA = a.join_date || ''
        const dateB = b.join_date || ''
        return dateA.localeCompare(dateB) * mult
      }
      default:
        return 0
    }
  })
}
