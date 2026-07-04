'use client'
import { useQuery } from '@tanstack/react-query'
import type { PeriodFilterValue } from '@/lib/types'
import { getAggregatedMenuSales, type AggregatedMenuSales } from '@/app/actions/menuSales'

export function useMenuSales(filter: PeriodFilterValue) {
  const query = useQuery<AggregatedMenuSales[]>({
    queryKey: ['menu-sales-agg', filter.from, filter.to, filter.outletId, filter.source],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      return await getAggregatedMenuSales(filter)
    },
  })
  
  return { 
    rows: query.data ?? [], 
    loading: query.isLoading, 
    error: query.error ? (query.error as Error).message : null 
  }
}
