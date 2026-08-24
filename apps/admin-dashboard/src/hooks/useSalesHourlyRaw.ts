'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue, SalesSource } from '@/lib/types'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

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
      const fromStart = new Date(`${filter.from}T00:00:00.000+07:00`)
      const toEnd = new Date(`${filter.to}T23:59:59.999+07:00`)

      let q = supabase
        .from('orders')
        .select('outlet_id, sales_source, is_endorse, created_at, total_amount')
        .neq('outlet_id', TEST_OUTLET_ID)
        .eq('status', 'completed')
        .gte('created_at', fromStart.toISOString())
        .lte('created_at', toEnd.toISOString())
      
      if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
      
      const PAGE_SIZE = 1000
      const allOrders: any[] = []
      let offset = 0
      while (true) {
        const { data, error } = await q.range(offset, offset + PAGE_SIZE - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        allOrders.push(...data)
        if (data.length < PAGE_SIZE) break
        offset += PAGE_SIZE
      }

      const aggMap = new Map<string, SalesHourlyRawRow>()
      
      for (const o of allOrders) {
        if (isTestOutlet(o.outlet_id)) continue;
        const d = new Date(o.created_at)
        const localDate = new Date(d.getTime() + 7 * 3600 * 1000)
        const dateStr = localDate.toISOString().split('T')[0]
        const hourStr = localDate.getHours()
        
        const srcKey = (o.is_endorse ? 'endors' : (o.sales_source || 'pos')).toLowerCase() as SalesSource
        
        if (filter.source !== 'all' && srcKey !== filter.source.toLowerCase()) continue;
        
        const key = `${o.outlet_id}|${srcKey}|${dateStr}|${hourStr}`
        
        const existing = aggMap.get(key)
        if (existing) {
          existing.omzet += Number(o.total_amount || 0)
          existing.jumlah_order_completed += 1
        } else {
          aggMap.set(key, {
            outlet_id: o.outlet_id,
            sales_source: srcKey,
            sales_date: dateStr,
            sales_hour: hourStr,
            omzet: Number(o.total_amount || 0),
            jumlah_order_completed: 1
          })
        }
      }

      return Array.from(aggMap.values())
    },
  })
}
