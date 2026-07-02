'use client'

import { useEffect, useId } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

async function fetchPendingCount(): Promise<number> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from('petty_cash_topups')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (error) throw error
  return count ?? 0
}

/**
 * Jumlah pengajuan top up petty cash yang masih menunggu persetujuan
 * (lintas outlet) — dipakai sebagai badge angka di nav admin. Realtime di
 * petty_cash_topups memicu refetch instan agar badge langsung update saat
 * ada pengajuan baru atau sudah diproses admin lain.
 */
export function usePendingPettyCash() {
  const queryClient = useQueryClient()
  const instanceId = useId()

  const { data: count = 0 } = useQuery({
    queryKey: ['pending-petty-cash-count'],
    queryFn: fetchPendingCount,
    refetchInterval: 30000,
    staleTime: 20000,
    retry: false,
  })

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`petty_cash_topups_pending_${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'petty_cash_topups' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pending-petty-cash-count'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, instanceId])

  return count
}
