'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'
import type { WasteSummaryRow } from '@/lib/wasteMetrics'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

// RPC tak punya LIMIT dan mengembalikan ~250 baris/bulan — rentang custom di
// atas ~4 bulan bisa menyentuh cap 1.000 baris PostgREST yang sama seperti
// query mentah lain di app ini. RPC-nya sendiri TIDAK diubah (butuh migration
// produksi lagi); sebagai gantinya kita deteksi cap-nya di sini (raw.length
// >= RPC_ROW_CAP) dan expose `truncated` supaya halaman bisa menampilkan
// peringatan alih-alih angka yang diam-diam salah.
const RPC_ROW_CAP = 1000

/**
 * Agregat waste APPROVED dari get_waste_summary_v2 (owner/admin only).
 * Hasilnya sudah di-roll up di server per outlet×bahan×reason×tanggal, tapi
 * TETAP bisa kena cap 1.000 baris PostgREST untuk rentang yang cukup panjang
 * — lihat `truncated` di return value.
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

  const query = useQuery<{ rows: WasteSummaryRow[]; truncated: boolean }>({
    queryKey: ['waste_summary_v2', from, to, filter.outletId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_waste_summary_v2', {
        p_from: from,
        p_to: to,
      })
      if (error) throw error
      const raw = data ?? []
      const truncated = raw.length >= RPC_ROW_CAP
      let rows: WasteSummaryRow[] = raw
        .filter((r: any) => r.outlet_id !== TEST_OUTLET_ID && !isTestOutlet(r.outlet_id))
        .map((r: any) => ({
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
      return { rows, truncated }
    },
  })

  return {
    rows: query.data?.rows ?? [],
    truncated: query.data?.truncated ?? false,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  }
}
