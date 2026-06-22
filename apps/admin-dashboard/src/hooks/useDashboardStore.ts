import { create } from 'zustand'
import type { PeriodFilterValue } from '@/lib/types'
import { presetRange } from '@/lib/period'

interface DashboardState {
  filter: PeriodFilterValue
  setFilter: (filter: PeriodFilterValue) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  filter: {
    ...presetRange('7d'),
    outletId: 'all',
    source: 'all',
  },
  setFilter: (filter) => set({ filter }),
}))
