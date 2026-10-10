'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

export interface SalesSummaryRow {
  outlet_id: string
  outlet_name: string
  sales_source: string
  sales_date: string
  omzet: number
  jumlah_order_completed: number
  jumlah_order_all: number
  total_deductions: number
  platform_fee: number
}

export function useSalesDaily(
  filter: { from: string; to: string; outletId: string; source: string },
  outlets?: { id: string; name: string }[]
) {
  const supabase = createSupabaseBrowserClient()
  const query = useQuery<SalesSummaryRow[]>({
    queryKey: ['sales-daily', filter.from, filter.to, filter.outletId, filter.source],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let q = supabase
        .from('sales_daily_scoped')
        .select('outlet_id, sales_source, sales_date, omzet, total_deductions, jumlah_order_completed')
        .neq('outlet_id', TEST_OUTLET_ID)
        .gte('sales_date', filter.from)
        .lte('sales_date', filter.to)

      if (filter.outletId !== 'all') {
        q = q.eq('outlet_id', filter.outletId)
      }
      if (filter.source !== 'all') {
        q = q.eq('sales_source', filter.source)
      }

      const { data, error } = await q
      if (error) throw error

      const normalizePlatform = (src: string) => {
        const s = (src || '').toLowerCase()
        if (s.includes('gofood') || s.includes('gojek')) return 'gofood'
        if (s.includes('grab')) return 'grabfood'
        if (s.includes('shopee')) return 'shopeefood'
        if (s.includes('tiktok')) return 'tiktokgo'
        return s
      }

      const settlementMap = new Map<string, number>()
      try {
        let offset = 0
        while (true) {
          const { data: stlPage, error: stlErr } = await supabase
            .from('platform_settlements')
            .select('outlet_id, platform, tanggal, commission')
            .gte('tanggal', filter.from)
            .lte('tanggal', filter.to)
            .order('tanggal', { ascending: true })
            .order('id', { ascending: true })
            .range(offset, offset + 999)
          if (stlErr) throw stlErr
          const page = stlPage ?? []
          for (const s of page) {
            const plat = normalizePlatform(s.platform)
            const key = `${s.outlet_id}__${plat}__${s.tanggal}`
            settlementMap.set(key, (settlementMap.get(key) || 0) + (Number(s.commission) || 0))
          }
          if (page.length < 1000) break
          offset += 1000
        }
      } catch (err) {
        console.error('Error fetching settlements in useSalesDaily:', err)
      }

      return (data || [])
        .filter((r: any) => !isTestOutlet(r.outlet_id))
        .map((r: any) => {
          const plat = normalizePlatform(r.sales_source)
          const key = `${r.outlet_id}__${plat}__${r.sales_date}`
          const platformFee = settlementMap.get(key) || 0

          return {
            outlet_id: r.outlet_id,
            outlet_name: '',
            sales_source: r.sales_source,
            sales_date: r.sales_date,
            omzet: Number(r.omzet || 0),
            jumlah_order_completed: Number(r.jumlah_order_completed || 0),
            jumlah_order_all: Number(r.jumlah_order_completed || 0),
            total_deductions: Number(r.total_deductions || 0),
            platform_fee: platformFee,
          }
        })
    },
  })

  const rows = useMemo<SalesSummaryRow[]>(() => {
    const base = query.data ?? []
    if (!outlets || outlets.length === 0) return base
    const nameById = new Map(outlets.map((o) => [o.id, o.name]))
    return base.map((r) => ({
      ...r,
      outlet_name: nameById.get(r.outlet_id) ?? 'Outlet Tidak Dikenal',
    }))
  }, [query.data, outlets])

  return { rows, loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
