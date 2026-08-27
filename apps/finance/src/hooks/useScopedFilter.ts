'use client'

import { useDashboardStore } from './useDashboardStore'

export function useScopedFilter() {
  const { filter, setFilter } = useDashboardStore()
  return { filter, setFilter, lockedOutletId: null }
}
