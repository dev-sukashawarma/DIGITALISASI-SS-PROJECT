import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getFluktuasiHargaAction, 
  syncMasterPriceAction, 
  type FluktuasiHargaItem, 
  type SyncMasterItemInput 
} from '@/app/actions/hargaBahan'

export type { FluktuasiHargaItem }

export function useFluktuasiHarga(daysFilter: number | null = 30) {
  const queryClient = useQueryClient()

  const query = useQuery<FluktuasiHargaItem[]>({
    queryKey: ['fluktuasi-harga-bahan-baku', daysFilter],
    staleTime: 30_000,
    queryFn: async () => {
      return await getFluktuasiHargaAction(daysFilter)
    }
  })

  const syncMutation = useMutation({
    mutationFn: async (items: SyncMasterItemInput[]) => {
      return await syncMasterPriceAction(items)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fluktuasi-harga-bahan-baku'] })
      queryClient.invalidateQueries({ queryKey: ['stok-monitoring'] })
      queryClient.invalidateQueries({ queryKey: ['po-price-alerts'] })
    }
  })

  return {
    ...query,
    items: query.data ?? [],
    syncMasterPrice: syncMutation.mutateAsync,
    isSyncing: syncMutation.isPending
  }
}
