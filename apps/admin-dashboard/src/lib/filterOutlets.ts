import type { Outlet, OutletFilterValues } from './types'

export function filterOutlets(rows: Outlet[], f: OutletFilterValues): Outlet[] {
  const q = f.search.trim().toLowerCase()
  return rows.filter((r) => {
    if (q) {
      const matchName = r.name?.toLowerCase().includes(q)
      const matchSlug = r.slug?.toLowerCase().includes(q)
      const matchAddress = r.address?.toLowerCase().includes(q)
      if (!matchName && !matchSlug && !matchAddress) return false
    }
    if (f.status === 'active' && !r.is_active) return false
    if (f.status === 'inactive' && r.is_active) return false
    if (f.status === 'missing_coords') {
      const hasCoords = Number.isFinite(r.lat) && Number.isFinite(r.lng) && !(r.lat === 0 && r.lng === 0)
      if (hasCoords) return false
    }
    if (f.type && f.type !== 'all' && (r.type || 'outlet').toLowerCase() !== f.type.toLowerCase()) {
      return false
    }
    return true
  })
}
