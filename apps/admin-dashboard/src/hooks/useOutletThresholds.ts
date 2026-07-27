import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export interface BahanBakuThreshold {
  id: string
  nama: string
  kategori: string | null
  satuan: string
  global_stok_ideal: number | null
  global_threshold_type: 'angka' | 'persentase' | null
  global_threshold_persentase: number | null
  outlet_stok_ideal: number | null
  outlet_threshold_type: 'angka' | 'persentase' | null
  outlet_threshold_persentase: number | null
  outlet_reorder_point_id: string | null
}

export function useOutletThresholds(outletId: string | null) {
  const supabase = createClient()
  return useQuery<BahanBakuThreshold[]>({
    queryKey: ['outlet-thresholds', outletId],
    enabled: !!outletId,
    queryFn: async () => {
      // Fetch bahan_baku
      const { data: bbData, error: bbError } = await supabase
        .from('bahan_baku')
        .select('id, nama, kategori, satuan, stok_ideal, threshold_type, threshold_persentase')
        .order('nama')

      if (bbError) throw bbError

      // Fetch outlet_reorder_point for the selected outlet
      const { data: orpData, error: orpError } = await supabase
        .from('outlet_reorder_point')
        .select('id, bahan_baku_id, stok_ideal, threshold_type, threshold_persentase')
        .eq('outlet_id', outletId!)

      if (orpError) throw orpError

      const orpMap = new Map(orpData.map(orp => [orp.bahan_baku_id, orp]))

      return bbData.map(bb => {
        const orp = orpMap.get(bb.id)
        return {
          id: bb.id,
          nama: bb.nama,
          kategori: bb.kategori,
          satuan: bb.satuan,
          global_stok_ideal: bb.stok_ideal,
          global_threshold_type: bb.threshold_type as any,
          global_threshold_persentase: bb.threshold_persentase,
          outlet_stok_ideal: orp?.stok_ideal ?? null,
          outlet_threshold_type: orp?.threshold_type as any ?? null,
          outlet_threshold_persentase: orp?.threshold_persentase ?? null,
          outlet_reorder_point_id: orp?.id ?? null,
        }
      })
    },
  })
}

export function useOutletThresholdMutations() {
  const supabase = createClient()
  const qc = useQueryClient()

  const setThreshold = useMutation({
    mutationFn: async ({
      outlet_id,
      bahan_baku_id,
      stok_ideal,
      threshold_type,
      threshold_persentase,
    }: {
      outlet_id: string
      bahan_baku_id: string
      stok_ideal: number | null
      threshold_type: 'angka' | 'persentase' | null
      threshold_persentase: number | null
    }) => {
      const { error } = await supabase
        .from('outlet_reorder_point')
        .upsert({
          outlet_id,
          bahan_baku_id,
          stok_ideal,
          threshold_type,
          threshold_persentase,
          reorder_point: 0, 
        }, { onConflict: 'outlet_id, bahan_baku_id' })

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outlet-thresholds'] })
      qc.invalidateQueries({ queryKey: ['purchase-suggestion'] })
    },
  })

  return { setThreshold }
}
