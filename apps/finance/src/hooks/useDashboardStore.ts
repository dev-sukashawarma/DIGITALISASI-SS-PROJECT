'use client'

import { useState, useEffect } from 'react'
import { presetRange } from '@/lib/period'

export interface PeriodFilterValue {
  from: string
  to: string
  outletId: string
  source: string
}

let globalFilter: PeriodFilterValue = {
  ...presetRange('today'),
  outletId: 'all',
  source: 'all',
}

const listeners = new Set<(f: PeriodFilterValue) => void>()

function setGlobalFilter(newFilter: PeriodFilterValue) {
  globalFilter = newFilter
  listeners.forEach(fn => fn(globalFilter))
}

export function useDashboardStore() {
  const [filter, setFilterState] = useState<PeriodFilterValue>(globalFilter)

  useEffect(() => {
    const handler = (updated: PeriodFilterValue) => setFilterState(updated)
    listeners.add(handler)
    return () => {
      listeners.delete(handler)
    }
  }, [])

  return {
    filter,
    setFilter: setGlobalFilter,
  }
}
