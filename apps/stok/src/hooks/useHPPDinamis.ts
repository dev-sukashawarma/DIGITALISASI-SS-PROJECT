import { useQuery } from '@tanstack/react-query'
import { fetchHPPDinamis } from '@/app/actions/hppDinamis'

export function useHPPDinamis(outletId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ['hpp-dinamis', outletId, from, to],
    queryFn: () => fetchHPPDinamis(outletId as string, from, to),
    enabled: !!outletId && !!from && !!to,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
