import { useQuery } from '@tanstack/react-query'
import { getFluktuasiHargaAction, type FluktuasiHargaItem } from '@/app/actions/hargaBahan'

export type { FluktuasiHargaItem }

export function useFluktuasiHarga(daysFilter: number | null = 30) {
  const query = useQuery<FluktuasiHargaItem[]>({
    queryKey: ['fluktuasi-harga-bahan-baku', daysFilter],
    staleTime: 30_000,
    queryFn: async () => await getFluktuasiHargaAction(daysFilter),
  })
  return { ...query, items: query.data ?? [] }
}
