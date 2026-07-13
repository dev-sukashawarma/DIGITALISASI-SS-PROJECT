'use client'
import { useId } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPendingWasteReports, fetchMyWasteReports } from '@/app/actions/waste'
import { useRealtimeChannel } from '@/lib/realtime/useRealtimeChannel'
import type { WasteReport } from '@/types/stok'

/**
 * All pending waste reports the caller can approve (server action already
 * scopes by RLS/role). Used on the waste-approval page.
 */
export function useWasteApprovalList() {
  const instanceId = useId()
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['waste_approval_list'],
    queryFn: () => fetchPendingWasteReports(),
    staleTime: 25000,
    gcTime: 60000,
  })

  useRealtimeChannel({
    channelName: `waste_approval_${instanceId}`,
    subs: [
      {
        table: 'stok_waste_reports',
        event: '*',
        handler: () => {
          queryClient.invalidateQueries({ queryKey: ['waste_approval_list'] })
          // SPVDashboard punya query React Query terpisah (['waste_pending_all'])
          // untuk badge jumlah pending — invalidate juga supaya tetap sinkron.
          queryClient.invalidateQueries({ queryKey: ['waste_pending_all'] })
        },
      },
    ],
  })

  return { reports: data ?? [], loading: isLoading, refresh: refetch }
}

/**
 * Waste reports submitted by the current staff member. Used on the
 * waste-history page.
 */
export function useMyWasteHistory(staffId: string | undefined) {
  const instanceId = useId()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['waste_history', staffId],
    queryFn: () => fetchMyWasteReports(staffId as string) as Promise<WasteReport[]>,
    enabled: !!staffId,
    staleTime: 25000,
    gcTime: 60000,
  })

  useRealtimeChannel({
    channelName: `waste_history_${staffId ?? 'anon'}_${instanceId}`,
    enabled: !!staffId,
    subs: [
      {
        table: 'stok_waste_reports',
        event: '*',
        filter: staffId ? `reported_by=eq.${staffId}` : undefined,
        handler: () => refetch(),
      },
    ],
  })

  return { reports: data ?? [], loading: isLoading, refetch }
}
