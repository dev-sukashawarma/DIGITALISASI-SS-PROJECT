'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export interface HppByChannelRow {
  outlet_id: string
  sales_source: string
  hpp: number
}

// HPP per outlet x sales_source untuk rentang periode, dari fungsi DB
// get_hpp_periode_by_channel (scoped ke outlet yang boleh diakses pemanggil).
export function useHppByChannel(from: string, to: string) {
  const supabase = createClient()
  const query = useQuery<HppByChannelRow[]>({
    queryKey: ['hpp-by-channel', from, to],
    staleTime: 2 * 60_000,
    // Rentang belum lengkap (mis. custom date baru terisi sebagian) — jangan
    // query, karena tanpa batas tanggal RPC mengembalikan HPP sepanjang masa.
    enabled: Boolean(from && to),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_hpp_periode_by_channel', {
        p_from: from,
        p_to: to,
      })
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        outlet_id: r.outlet_id as string,
        sales_source: r.sales_source as string,
        hpp: Number(r.hpp),
      }))
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
