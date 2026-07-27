'use client'
import { useQuery } from '@tanstack/react-query'
import { fetchPendingWasteReports, fetchMyWasteReports } from '@/app/actions/waste'
import { useRealtimeInvalidate } from '@suka/realtime'
import type { WasteReport } from '@/types/stok'

/**
 * All pending waste reports the caller can approve (server action already
 * scopes by RLS/role). Used on the waste-approval page.
 */
export function useWasteApprovalList() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['waste_approval_list'],
    queryFn: () => fetchPendingWasteReports(),
    staleTime: 25000,
    gcTime: 60000,
  })

  useRealtimeInvalidate({
    channelName: 'waste_approval_list',
    subs: [
      {
        table: 'stok_waste_reports',
        event: '*',
        // SPVDashboard punya query React Query terpisah (['waste_pending_all'])
        // untuk badge jumlah pending — invalidate juga supaya tetap sinkron.
        queryKeys: [['waste_approval_list'], ['waste_pending_all']],
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
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['waste_history', staffId],
    queryFn: () => fetchMyWasteReports() as Promise<WasteReport[]>,
    enabled: !!staffId,
    staleTime: 25000,
    gcTime: 60000,
  })

  useRealtimeInvalidate({
    channelName: `waste_history_${staffId ?? 'none'}`,
    enabled: !!staffId,
    subs: [
      {
        table: 'stok_waste_reports',
        event: '*',
        filter: staffId ? `reported_by=eq.${staffId}` : undefined,
        queryKeys: [['waste_history', staffId]],
      },
    ],
  })

  return { reports: data ?? [], loading: isLoading, refetch }
}
