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

      const { data, error } = await q
      if (error) throw error

      return (data || [])
        .filter((r: any) => !isTestOutlet(r.outlet_id))
        .map((r: any) => ({
          outlet_id: r.outlet_id,
          outlet_name: '',
          sales_source: r.sales_source as SalesSource,
          sales_date: r.sales_date,
          omzet: Number(r.omzet || 0),
          jumlah_order_completed: Number(r.jumlah_order_completed || 0),
          jumlah_order_all: Number(r.jumlah_order_completed || 0),
          total_deductions: Number(r.total_deductions || 0),
          platform_fee: 0,
        }))
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

