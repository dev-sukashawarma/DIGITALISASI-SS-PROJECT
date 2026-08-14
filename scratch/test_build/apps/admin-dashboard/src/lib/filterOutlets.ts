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
