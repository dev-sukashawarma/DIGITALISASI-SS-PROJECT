import { useQuery } from '@tanstack/react-query'
import { getTikTokSettlementSummaries, type TikTokSettlementSummary } from '@/app/actions/platformSettlement'

export type { TikTokSettlementSummary }

export function useTikTokSettlement(filter: { from: string; to: string }) {
  const query = useQuery<Record<string, TikTokSettlementSummary>>({
    queryKey: ['tiktok_settlement_summaries', filter.from, filter.to],
    queryFn: async () => {
      const res = await getTikTokSettlementSummaries(filter.from, filter.to)
      if (!res.success || !res.data) {
        return {}
      }
      return res.data
    },
    staleTime: 60_000,
  })

  return {
    settlements: query.data || {},
    loading: query.isLoading,
    error: query.error,
  }
}
