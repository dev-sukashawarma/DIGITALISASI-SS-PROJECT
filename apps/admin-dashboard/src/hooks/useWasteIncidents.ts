'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'

export const INCIDENTS_PER_PAGE = 25

/** Satu laporan waste APPROVED. */
export interface WasteIncidentRow {
  id: string
  outlet_id: string
  outlet_name: string
  bahan_baku_id: string
  bahan_nama: string
  reason: string
  qty: number
  qty_kecil: number
  satuan_besar: string
  satuan_kecil: string
  hpp_kecil: number
  nilai: number
  photo_url: string | null
  reporter_name: string | null
  approver_name: string | null
  created_at: string
  updated_at: string
  /** Jumlah baris ledger_stok dengan ref_waste_id = laporan ini. 0 = stok tidak pernah terpotong. */
  ledger_row_count: number
}

/**
 * Daftar insiden waste APPROVED, dipaginasi DI SERVER.
 * `page` 1-indexed. Filter outlet juga di server (bukan klien) karena
 * memfilter setelah paginasi akan membuat halaman bolong.
 */
export function useWasteIncidents(filter: PeriodFilterValue, page: number) {
  const supabase = createClient()
  const safePage = Math.max(1, page)

  const query = useQuery<{ rows: WasteIncidentRow[]; totalCount: number }>({
    queryKey: ['waste_incidents', filter.from, filter.to, filter.outletId, safePage],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_waste_incidents', {
        p_from: filter.from,
        p_to: filter.to,
        p_outlet_id: filter.outletId === 'all' ? null : filter.outletId,
        p_limit: INCIDENTS_PER_PAGE,
        p_offset: (safePage - 1) * INCIDENTS_PER_PAGE,
      })
      if (error) throw error
      const raw = data ?? []
      const rows: WasteIncidentRow[] = raw.map((r: any) => ({
        id: r.id as string,
        outlet_id: r.outlet_id as string,
        outlet_name: r.outlet_name as string,
        bahan_baku_id: r.bahan_baku_id as string,
        bahan_nama: r.bahan_nama as string,
        reason: r.reason as string,
        qty: Number(r.qty),
        qty_kecil: Number(r.qty_kecil),
        satuan_besar: (r.satuan_besar as string) ?? '',
        satuan_kecil: (r.satuan_kecil as string) ?? '',
        hpp_kecil: Number(r.hpp_kecil),
        nilai: Number(r.nilai),
        photo_url: (r.photo_url as string) ?? null,
        reporter_name: (r.reporter_name as string) ?? null,
        approver_name: (r.approver_name as string) ?? null,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
        ledger_row_count: Number(r.ledger_row_count),
      }))
      // total_count identik di setiap baris (window function sebelum LIMIT).
      const totalCount = raw.length > 0 ? Number(raw[0].total_count) : 0
      return { rows, totalCount }
    },
  })

  return {
    rows: query.data?.rows ?? [],
    totalCount: query.data?.totalCount ?? 0,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  }
}
