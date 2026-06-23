'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { MenuSalesRow, PeriodFilterValue } from '@/lib/types'

export function useMenuSales(filter: PeriodFilterValue) {
  const supabase = useMemo(() => createClient(), [])
  const query = useQuery<MenuSalesRow[]>({
    queryKey: ['menu-sales', filter.from, filter.to, filter.outletId, filter.source],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let q = supabase
        .from('menu_sales_spv')
        .select('outlet_id, sales_source, sales_date, menu_key, menu_name, qty, revenue')
        .gte('sales_date', filter.from)
        .lte('sales_date', filter.to)
      if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
      if (filter.source !== 'all') q = q.eq('sales_source', filter.source)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as MenuSalesRow[]
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
