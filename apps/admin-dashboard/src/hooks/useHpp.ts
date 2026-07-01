'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'

export interface HppRow {
  outlet_id: string
  hpp: number
}

// HPP per outlet untuk rentang periode, dari fungsi DB get_hpp_periode
// (per-batas-periode, sudah di-scope ke outlet yang boleh diakses pemanggil).
export function useHpp(filter: PeriodFilterValue) {
  const supabase = useMemo(() => createClient(), [])
  const query = useQuery<HppRow[]>({
    queryKey: ['hpp', filter.from, filter.to, filter.outletId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_hpp_periode', {
        p_from: filter.from,
        p_to: filter.to,
      })
      if (error) throw error
      let rows: HppRow[] = (data ?? []).map((r: any) => ({
        outlet_id: r.outlet_id as string,
        hpp: Number(r.hpp),
      }))
      if (filter.outletId !== 'all') rows = rows.filter((r: HppRow) => r.outlet_id === filter.outletId)
      return rows
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
