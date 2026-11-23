'use client'

import { useSyncExternalStore } from 'react'
import type { PeriodFilterValue } from './types'
import { presetRange } from './period'

let currentFilter: PeriodFilterValue = {
  ...presetRange('yesterday'),
  outletId: 'all',
  source: 'all',
}

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): PeriodFilterValue {
  return currentFilter
}

function setFilter(next: PeriodFilterValue) {
  currentFilter = next
  for (const listener of listeners) {
    listener()
  }
}

export function useProfitFilterStore() {
  const filter = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { filter, setFilter }
}
