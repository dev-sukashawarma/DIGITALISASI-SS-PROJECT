'use client'

import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import type { WasteBreakdownRow } from '@/lib/wasteBreakdown'

export function useWasteBreakdown(filter: { from: string; to: string; outletId: string }) {
  const supabase = createSupabaseBrowserClient()
  const query = useQuery<WasteBreakdownRow[]>({
    queryKey: ['waste_breakdown', filter.from, filter.to, filter.outletId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_waste_breakdown', {
        p_from: filter.from,
        p_to: filter.to,
      })
      if (error) throw error
      let rows: WasteBreakdownRow[] = (data ?? []).map((r: any) => ({
        outlet_id: r.outlet_id as string,
        outlet_name: r.outlet_name as string,
        reason: r.reason as string,
        bahan_baku_id: r.bahan_baku_id as string,
        bahan_nama: r.bahan_nama as string,
        tanggal: r.tanggal as string,
        qty: Number(r.qty),
        qty_kecil: Number(r.qty_kecil),
        satuan_kecil: r.satuan_kecil as string,
        hpp_kecil: Number(r.hpp_kecil),
        nilai: Number(r.nilai),
      }))
      if (filter.outletId !== 'all') rows = rows.filter((r) => r.outlet_id === filter.outletId)
      return rows
    },
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
