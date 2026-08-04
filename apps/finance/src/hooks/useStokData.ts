import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export interface StokItem {
  outlet_id: string
  outlet_name: string
  bahan_baku_id: string
  item_name: string
  satuan: string
  kategori: string
  current_qty: number
  threshold: number
  status: 'aman' | 'kritis' | 'habis'
  is_flagged: boolean
  last_updated: string | null
  last_opname_date: string | null
  saldo_is_gram: boolean
}

export function useStokData() {
  const supabase = createClient()
  return useQuery<StokItem[]>({
    queryKey: ['stok-monitoring-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monitoring_view_spv')
        .select('*')
        .order('outlet_name')
        .order('item_name')

      if (error) throw error
      return data as StokItem[]
    }
  })
}
