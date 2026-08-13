import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'

const supabase = createSupabaseBrowserClient()

export type HargaHistoryRow = {
  id: string
  harga_lama: number | null
  harga_baru: number
  ref_po_id: string | null
  changed_at: string
}

export function useHargaHistory(bahanBakuId: string | null) {
  const q = useQuery<HargaHistoryRow[]>({
    queryKey: ['harga-history', bahanBakuId],
    enabled: !!bahanBakuId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bahan_baku_harga_history')
        .select('id, harga_lama, harga_baru, ref_po_id, changed_at')
        .eq('bahan_baku_id', bahanBakuId)
        .order('changed_at', { ascending: false })
      if (error) throw error
      return data as HargaHistoryRow[]
    },
  })
  return { rows: q.data ?? [], loading: q.isLoading, error: q.error }
}
