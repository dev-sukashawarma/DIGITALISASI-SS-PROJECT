import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { LeaveRequest, LeaveStatus } from '@/lib/types'
import { useHrDirectory, type HrDirectory } from '@/hooks/useHrDirectory'
import { DEFAULT_PAGE_SIZE, fetchAllPages, type Paged } from '@/lib/paging'

export interface LeaveListParams {
  /** false = jangan query (mis. tab lain yang sedang dibuka) */
  enabled?: boolean
  status: LeaveStatus | 'all'
  outletId: string // 'all' = semua
  search: string
  page: number
  pageSize?: number
}

const LEAVE_TYPE_LABEL: Record<string, string> = {
  annual: 'Cuti Tahunan',
  sick: 'Sakit',
  personal: 'Izin Pribadi',
  maternity: 'Cuti Melahirkan',
  other: 'Lainnya',
}

/**
 * Satu halaman pengajuan cuti/izin (RPC hr_cuti_daftar). Semua filter (status,
 * outlet, pencarian, akun tes) diterapkan di database; yang dikirim hanya 1 halaman.
 */
export async function fetchLeaveRequestsPage(
  dir: HrDirectory,
  params: Omit<LeaveListParams, 'page' | 'pageSize'>,
  limit: number,
  offset: number
): Promise<Paged<LeaveRequest>> {
  const term = params.search.trim().toLowerCase()
  const types = term
    ? Object.entries(LEAVE_TYPE_LABEL)
        .filter(([k, label]) => label.toLowerCase().includes(term) || k.includes(term))
        .map(([k]) => k)
    : []
  // RPC (POST body): daftar id yang dikecualikan tidak lewat URL
  const { data, error } = await createClient().rpc('hr_cuti_daftar', {
    p_status: params.status === 'all' ? null : params.status,
    p_outlet: params.outletId === 'all' ? null : params.outletId,
    p_search: params.search.trim() || null,
    p_leave_types: types,
    p_exclude_staff: dir.excludedStaffIds,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  const res = data as { rows: LeaveRequest[]; total: number }
  return { rows: res.rows ?? [], total: res.total ?? 0 }
}

export function useLeaveRequests(params: LeaveListParams) {
  const { data: dir } = useHrDirectory()
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
  const { page, enabled = true, pageSize: _pageSize, ...filters } = params

  const query = useQuery<Paged<LeaveRequest>>({
    queryKey: ['leave-requests', filters, page, pageSize],
    enabled: !!dir && enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: () => fetchLeaveRequestsPage(dir!, filters, pageSize, (page - 1) * pageSize),
  })

  const exportAll = () => {
    if (!dir) throw new Error('Data belum siap')
    return fetchAllPages((limit, offset) => fetchLeaveRequestsPage(dir, filters, limit, offset), (r) => r.id)
  }

  return { ...query, isLoading: query.isLoading || !dir, exportAll }
}

export interface PerizinanSummary {
  cuti: { pending: number; approved: number; rejected: number; total: number }
  kasbon: { pending: number; active: number; total: number; active_amount: number; paid_amount: number }
}

/** Angka kartu Cuti & Kasbon — dihitung di database (RPC hr_perizinan_ringkasan). */
export function usePerizinanSummary() {
  const { data: dir } = useHrDirectory()
  return useQuery<PerizinanSummary>({
    queryKey: ['perizinan-summary', dir?.excludedStaffIds.length ?? 0],
    enabled: !!dir,
    staleTime: 30_000,
    refetchInterval: 60_000, // badge sidebar; mutasi di app ini sudah meng-invalidate
    queryFn: async () => {
      const { data, error } = await createClient().rpc('hr_perizinan_ringkasan', {
        p_exclude_staff: dir!.excludedStaffIds,
      })
      if (error) throw error
      return data as PerizinanSummary
    },
  })
}
