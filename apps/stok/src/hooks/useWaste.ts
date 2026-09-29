'use client'
import { useQuery } from '@tanstack/react-query'
import {
  fetchPendingWasteReports,
  countPendingWasteReports,
  fetchMyWasteReports,
  fetchWasteHistory, 
  type WasteHistoryFilter, 
  type WasteHistoryResult 
} from '@/app/actions/waste'
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
        // Badge jumlah pending (sidebar, bottom nav, tab waste, SPVDashboard)
        // memakai kunci bersama WASTE_PENDING_COUNT_KEY — invalidate juga
        // supaya tetap sinkron dengan daftar.
        queryKeys: [['waste_approval_list'], WASTE_PENDING_COUNT_KEY],
      },
    ],
  })

  return { reports: data ?? [], loading: isLoading, refresh: refetch }
}

/**
 * Kunci React Query bersama untuk badge jumlah waste PENDING. Dulu ada empat
 * kunci berbeda (sidebar, bottom nav, layout waste, SPVDashboard) yang
 * masing-masing menarik SELURUH laporan pending beserta join & harga hanya
 * untuk dibaca `.length`. Sekarang satu kunci, satu head-count.
 */
export const WASTE_PENDING_COUNT_KEY: string[] = ['waste_pending_count']

/**
 * Jumlah waste PENDING yang bisa di-approve pemanggil. Pakai
 * countPendingWasteReports (head count, guard role & scope outlet identik
 * dengan fetchPendingWasteReports). Daftar lengkap tetap lewat
 * useWasteApprovalList di halaman yang benar-benar merender daftarnya.
 */
export function usePendingWasteCount(
  enabled: boolean,
  options?: { refetchInterval?: number },
) {
  const { data } = useQuery({
    queryKey: WASTE_PENDING_COUNT_KEY,
    queryFn: () => countPendingWasteReports(),
    enabled,
    staleTime: 30000,
    refetchInterval: options?.refetchInterval,
  })
  return enabled ? data ?? 0 : 0
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

/**
 * Waste history with flexible filters (outlet, status, date range, pagination).
 * Accessible by both approvers (multi-outlet scoped) and outlet staff (own outlet).
 */
export function useWasteHistory(filters: WasteHistoryFilter) {
  const { data, isLoading, refetch, isFetching } = useQuery<WasteHistoryResult>({
    queryKey: ['waste_history_list', filters],
    queryFn: () => fetchWasteHistory(filters),
    staleTime: 20000,
    gcTime: 60000,
  })

  useRealtimeInvalidate({
    channelName: 'waste_history_list',
    subs: [
      {
        table: 'stok_waste_reports',
        event: '*',
        queryKeys: [['waste_history_list']],
      },
    ],
  })

  return {
    reports: (data?.data ?? []) as WasteReport[],
    totalCount: data?.totalCount ?? 0,
    totalNilai: data?.totalNilai ?? 0,
    page: data?.page ?? 1,
    totalPages: data?.totalPages ?? 1,
    limit: data?.limit ?? 25,
    loading: isLoading,
    fetching: isFetching,
    refetch,
  }
}
