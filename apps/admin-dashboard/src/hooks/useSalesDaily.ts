'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { SalesSummaryRow, PeriodFilterValue, SalesSource } from '@/lib/types'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

// Ringkasan harian per outlet × sumber langsung dari view DB `sales_daily_scoped`.
// Sangat cepat karena dihitung langsung di database menggunakan covering & functional indexes.
export function useSalesDaily(filter: PeriodFilterValue, outlets?: { id: string; name: string }[]) {
  const supabase = createClient()
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

      // Convert Asia/Jakarta date bounds to ISO strings for orders query
      const fromIso = new Date(`${filter.from}T00:00:00+07:00`).toISOString()
      const toIso = new Date(`${filter.to}T23:59:59+07:00`).toISOString()

      let ordQ = supabase
        .from('orders')
        .select('outlet_id, sales_source, channel, created_at, discount_amount, promo_subsidy')
        .eq('status', 'completed')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .neq('outlet_id', TEST_OUTLET_ID)

      if (filter.outletId !== 'all') {
        ordQ = ordQ.eq('outlet_id', filter.outletId)
      }

      const [salesRes, ordersRes] = await Promise.all([
        q,
        ordQ
      ])

      if (salesRes.error) throw salesRes.error

      const dedMap = new Map<string, number>()
      if (ordersRes.data) {
        ordersRes.data.forEach((o: any) => {
          const d = new Date(o.created_at)
          const jakartaDate = new Date(d.getTime() + (7 * 60 * 60 * 1000)).toISOString().split('T')[0]
          const src = (o.sales_source || o.channel || 'pos').toLowerCase()
          const key = `${o.outlet_id}__${src}__${jakartaDate}`
          const disc = Number(o.discount_amount) || 0
          const promo = Number(o.promo_subsidy) || 0
          dedMap.set(key, (dedMap.get(key) || 0) + disc + promo)
        })
      }

      return (salesRes.data || [])
        .filter((r: any) => !isTestOutlet(r.outlet_id))
        .map((r: any) => {
          const src = (r.sales_source || 'pos').toLowerCase()
          const key = `${r.outlet_id}__${src}__${r.sales_date}`
          const calculatedDed = dedMap.get(key) || 0
          const totalDed = (Number(r.total_deductions) || 0) > 0 ? Number(r.total_deductions) : calculatedDed

          return {
            outlet_id: r.outlet_id,
            outlet_name: '',
            sales_source: r.sales_source as SalesSource,
            sales_date: r.sales_date,
            omzet: Number(r.omzet || 0),
            jumlah_order_completed: Number(r.jumlah_order_completed || 0),
            jumlah_order_all: Number(r.jumlah_order_completed || 0),
            total_deductions: totalDed,
            platform_fee: 0,
          }
        })
    },
  })

  // Resolusi nama outlet dari daftar yang sudah dimuat caller (useOutlets()).
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

