'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export interface PcsByChannelRow {
  outlet_id: string
  sales_source: string
  pcs: number
}

// PCS (qty item terjual) per outlet x sales_source, diagregasi client-side dari
// view menu_sales_scoped (sudah punya kolom outlet_id/sales_source/qty) — tanpa
// perlu RPC/migration baru.
export function usePcsByChannel(from: string, to: string) {
  const supabase = createClient()
  const query = useQuery<PcsByChannelRow[]>({
    queryKey: ['pcs-by-channel', from, to],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_sales_scoped')
        .select('outlet_id, sales_source, qty')
        .gte('sales_date', from)
        .lte('sales_date', to)
      if (error) throw error
      const map = new Map<string, PcsByChannelRow>()
      for (const r of (data ?? []) as any[]) {
        const key = `${r.outlet_id}__${r.sales_source}`
        const cur = map.get(key) ?? { outlet_id: r.outlet_id, sales_source: r.sales_source, pcs: 0 }
        cur.pcs += Number(r.qty)
        map.set(key, cur)
      }
      return [...map.values()]
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
