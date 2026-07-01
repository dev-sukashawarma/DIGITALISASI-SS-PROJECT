'use client'
import { useMemo } from 'react'
import { useSalesHourlyRaw } from './useSalesHourlyRaw'
import type { PeriodFilterValue } from '@/lib/types'

export interface SalesHourlyRow {
  sales_hour: number
  omzet: number
  jumlah_order_completed: number
}

// 24 bucket jam (0-23), diturunkan dari sumber raw yang sama dengan
// useSalesSummary. Untuk filter sama, keduanya berbagi satu fetch (React Query).
export function useSalesHourly(filter: PeriodFilterValue) {
  const query = useSalesHourlyRaw(filter)

  const rows = useMemo<SalesHourlyRow[]>(() => {
    const hourMap = new Map<number, SalesHourlyRow>()
    for (let i = 0; i < 24; i++) hourMap.set(i, { sales_hour: i, omzet: 0, jumlah_order_completed: 0 })
    for (const r of query.data ?? []) {
      const b = hourMap.get(r.sales_hour)
      if (!b) continue
      b.omzet += r.omzet
      b.jumlah_order_completed += r.jumlah_order_completed
    }
    return Array.from(hourMap.values()).sort((a, b) => a.sales_hour - b.sales_hour)
  }, [query.data])

  return { rows, loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
