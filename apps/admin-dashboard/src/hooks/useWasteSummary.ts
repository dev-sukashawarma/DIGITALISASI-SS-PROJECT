'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'
import type { WasteSummaryRow } from '@/lib/wasteMetrics'

/**
 * Agregat waste APPROVED dari get_waste_summary_v2 (owner/admin only).
 * Hasilnya sudah di-roll up di server, jadi aman dari cap 1.000 baris
 * PostgREST dan cukup difilter outlet di klien.
 *
 * `rangeOverride` dipakai untuk menarik periode pembanding (previousRange)
 * tanpa menyentuh filter global.
 */
export function useWasteSummary(
  filter: PeriodFilterValue,
  opts?: { rangeOverride?: { from: string; to: string } }
) {
  const supabase = createClient()
  const from = opts?.rangeOverride?.from ?? filter.from
  const to = opts?.rangeOverride?.to ?? filter.to

  const query = useQuery<WasteSummaryRow[]>({
    queryKey: ['waste_summary_v2', from, to, filter.outletId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_waste_summary_v2', {
        p_from: from,
        p_to: to,
      })
      if (error) throw error
      let rows: WasteSummaryRow[] = (data ?? []).map((r: any) => ({
        outlet_id: r.outlet_id as string,
        outlet_name: r.outlet_name as string,
        bahan_baku_id: r.bahan_baku_id as string,
        bahan_nama: r.bahan_nama as string,
        reason: r.reason as string,
        tanggal: r.tanggal as string,
        qty: Number(r.qty),
        qty_kecil: Number(r.qty_kecil),
        satuan_kecil: r.satuan_kecil as string,
        hpp_kecil: Number(r.hpp_kecil),
        nilai: Number(r.nilai),
        jumlah_insiden: Number(r.jumlah_insiden),
      }))
      if (filter.outletId !== 'all') rows = rows.filter((r) => r.outlet_id === filter.outletId)
      return rows
    },
  })

  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  }
}
