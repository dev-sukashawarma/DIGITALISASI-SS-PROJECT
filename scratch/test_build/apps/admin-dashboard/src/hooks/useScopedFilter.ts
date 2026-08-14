'use client'
import { useEffect } from 'react'
import { useDashboardStore } from './useDashboardStore'
import { useRole } from '@/components/layout/RoleContext'

/**
 * Wraps the dashboard period filter. For a read-only role (mitra) it forces
 * filter.outletId to the mitra's outlet and returns a non-null `lockedOutletId`
 * so PeriodFilter can render the outlet as a fixed label instead of a picker.
 */
export function useScopedFilter() {
  const { filter, setFilter } = useDashboardStore()
  const { isReadOnly, outletId } = useRole()

  useEffect(() => {
    if (isReadOnly && outletId && filter.outletId !== outletId) {
      setFilter({ ...filter, outletId })
    }
  }, [isReadOnly, outletId, filter, setFilter])

  return { filter, setFilter, lockedOutletId: isReadOnly ? outletId : null }
}
