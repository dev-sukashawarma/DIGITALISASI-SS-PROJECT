import type { StaffRow, StaffFilterValues } from './types'

export function filterStaff(rows: StaffRow[], f: StaffFilterValues): StaffRow[] {
  const q = f.search.trim().toLowerCase()
  return rows.filter((r) => {
    if (q && !r.name.toLowerCase().includes(q) && !(r.username ?? '').toLowerCase().includes(q)) return false
    if (f.outletId && r.outlet_id !== f.outletId) return false
    if (f.role && r.role !== f.role) return false
    if (f.status && r.status !== f.status) return false
    return true
  })
}
