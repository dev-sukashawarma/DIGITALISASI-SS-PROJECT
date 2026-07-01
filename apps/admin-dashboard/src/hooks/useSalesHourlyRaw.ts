'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue, SalesSource } from '@/lib/types'

export interface SalesHourlyRawRow {
  outlet_id: string
  sales_source: SalesSource
  sales_date: string
  sales_hour: number
  omzet: number
  jumlah_order_completed: number
}

// Sumber tunggal baris per-jam dari `sales_hourly_scoped`. Dipakai bersama oleh
// useSalesSummary (agregat harian) & useSalesHourly (24 bucket jam). queryKey
// identik untuk filter yang sama → React Query men-dedup jadi satu fetch jaringan.
export function useSalesHourlyRaw(filter: PeriodFilterValue) {
  const supabase = createClient()
  return useQuery<SalesHourlyRawRow[]>({
    queryKey: ['sales-hourly-raw', filter.from, filter.to, filter.outletId, filter.source],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let q = supabase
        .from('sales_hourly_scoped')
        .select('outlet_id, sales_source, sales_date, sales_hour, omzet, jumlah_order_completed')
        .gte('sales_date', filter.from)
        .lte('sales_date', filter.to)
      if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
      if (filter.source !== 'all') q = q.eq('sales_source', filter.source)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        outlet_id: r.outlet_id,
        sales_source: r.sales_source as SalesSource,
        sales_date: r.sales_date,
        sales_hour: r.sales_hour,
        omzet: Number(r.omzet),
        jumlah_order_completed: Number(r.jumlah_order_completed),
      }))
    },
  })
}
