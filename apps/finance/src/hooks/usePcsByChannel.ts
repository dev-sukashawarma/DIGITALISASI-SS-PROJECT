'use client'

import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'

export interface PcsByChannelRow {
  outlet_id: string
  sales_source: string
  pcs: number
}

export function usePcsByChannel(from: string, to: string) {
  const supabase = createSupabaseBrowserClient()
  const query = useQuery<PcsByChannelRow[]>({
    queryKey: ['pcs-by-channel', from, to],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const PAGE_SIZE = 1000
      const map = new Map<string, PcsByChannelRow>()
      let offset = 0
      while (true) {
        const { data, error } = await supabase
          .from('menu_sales_scoped')
          .select('outlet_id, sales_source, qty')
          .gte('sales_date', from)
          .lte('sales_date', to)
          .range(offset, offset + PAGE_SIZE - 1)
        if (error) throw error
        const page = (data ?? []) as any[]
        for (const r of page) {
          const key = `${r.outlet_id}__${r.sales_source}`
          const cur = map.get(key) ?? { outlet_id: r.outlet_id, sales_source: r.sales_source, pcs: 0 }
          cur.pcs += Number(r.qty)
          map.set(key, cur)
        }
        if (page.length < PAGE_SIZE) break
        offset += PAGE_SIZE
      }
      return [...map.values()]
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
