'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'

export interface SalesHourlyRow {
  sales_hour: number
  omzet: number
  jumlah_order_completed: number
}

export function useSalesHourly(filter: PeriodFilterValue) {
  const supabase = useMemo(() => createClient(), [])
  const query = useQuery<SalesHourlyRow[]>({
    queryKey: ['sales-hourly', filter.from, filter.to, filter.outletId, filter.source],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let q = supabase
        .from('sales_hourly_spv')
        .select('sales_hour, omzet, jumlah_order_completed')
        .gte('sales_date', filter.from)
        .lte('sales_date', filter.to)
      if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
      if (filter.source !== 'all') q = q.eq('sales_source', filter.source)
      const { data, error } = await q
      if (error) throw error
      // Gabungkan baris lintas tanggal/outlet jadi 24 bucket jam (0-23).
      const hourMap = new Map<number, SalesHourlyRow>()
      for (let i = 0; i < 24; i++) hourMap.set(i, { sales_hour: i, omzet: 0, jumlah_order_completed: 0 })
      for (const r of (data ?? []) as any[]) {
        const b = hourMap.get(r.sales_hour)
        if (!b) continue
        b.omzet += Number(r.omzet)
        b.jumlah_order_completed += Number(r.jumlah_order_completed)
      }
      return Array.from(hourMap.values()).sort((a, b) => a.sales_hour - b.sales_hour)
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
