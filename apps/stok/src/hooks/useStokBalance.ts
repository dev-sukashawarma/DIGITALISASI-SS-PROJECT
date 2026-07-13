'use client'
import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useRealtimeInvalidate } from '@/lib/realtime/useRealtimeInvalidate'
import type { StokBalance } from '@/types/stok'

export function useStokBalance(outletId: string | undefined) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['stok_balance', outletId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('stok_balance')
        .select('id, outlet_id, bahan_baku_id, saldo, updated_at')
        .eq('outlet_id', outletId as string)
      if (error) throw error
      return (data as StokBalance[]) ?? []
    },
    enabled: !!outletId,
    staleTime: 25000,
    gcTime: 60000,
  })

  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `stok_balance_${outletId ?? 'none'}_${instanceId}`,
    enabled: !!outletId,
    subs: [
      {
        table: 'stok_balance',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: [['stok_balance', outletId]],
      },
    ],
  })

  return { balances: data ?? [], loading: isLoading, refresh: refetch }
}
