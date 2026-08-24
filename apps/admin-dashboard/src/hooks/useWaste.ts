// apps/admin-dashboard/src/hooks/useWaste.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

export interface WasteRow {
  outlet_id: string
  nilai_waste: number
}

// Nilai waste APPROVED per outlet untuk rentang periode, dari get_waste_periode
// (scoped ke outlet yang boleh diakses pemanggil, sama pola dgn useHpp).
export function useWaste(filter: PeriodFilterValue) {
  const supabase = createClient()
  const query = useQuery<WasteRow[]>({
    queryKey: ['waste', filter.from, filter.to, filter.outletId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_waste_periode', {
        p_from: filter.from,
        p_to: filter.to,
      })
      if (error) throw error
      let rows: WasteRow[] = (data ?? [])
        .filter((r: any) => r.outlet_id !== TEST_OUTLET_ID && !isTestOutlet(r.outlet_id))
        .map((r: any) => ({
          outlet_id: r.outlet_id as string,
          nilai_waste: Number(r.nilai_waste),
        }))
      if (filter.outletId !== 'all') rows = rows.filter((r: WasteRow) => r.outlet_id === filter.outletId)
      return rows
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
