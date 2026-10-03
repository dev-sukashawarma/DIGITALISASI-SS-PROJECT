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
  dateFrom?: string
  dateTo?: string
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
 * Satu halaman pengajuan cuti/izin (RPC hr_cuti_daftar atau Query berfilter tanggal).
 */
export async function fetchLeaveRequestsPage(
  dir: HrDirectory,
  params: Omit<LeaveListParams, 'page' | 'pageSize'>,
  limit: number,
  offset: number
): Promise<Paged<LeaveRequest>> {
  const supabase = createClient()
  const term = params.search.trim().toLowerCase()
  const types = term
    ? Object.entries(LEAVE_TYPE_LABEL)
        .filter(([k, label]) => label.toLowerCase().includes(term) || k.includes(term))
        .map(([k]) => k)
    : []

  // Jika ada filter tanggal, gunakan query builder langsung
  if (params.dateFrom || params.dateTo) {
    let matchedStaffIds: string[] | null = null
    if (term) {
      const { data: staffList } = await supabase
        .from('outlet_staff')
        .select('id')
        .or(`name.ilike.%${term}%,username.ilike.%${term}%`)
      matchedStaffIds = (staffList || []).map((s) => s.id)
    }

    let query = supabase
      .from('leave_requests')
      .select(`
        id, staff_id, leave_type, start_date, end_date, days, reason, status, approved_by, approved_at, rejection_note, created_at, attachment_url,
        outlet_staff!leave_requests_staff_id_fkey!inner(
          name, role, username, account_category, leave_quota, outlet_id,
          outlets!outlet_staff_outlet_id_fkey(name)
        )
      `, { count: 'exact' })

    if (dir.excludedStaffIds.length > 0) {
      query = query.not('staff_id', 'in', `(${dir.excludedStaffIds.join(',')})`)
    }

    if (params.status && params.status !== 'all') {
      query = query.eq('status', params.status)
    }

    if (params.outletId && params.outletId !== 'all') {
      query = query.eq('outlet_staff.outlet_id', params.outletId)
    }

    if (params.dateFrom) {
      query = query.gte('start_date', params.dateFrom)
    }
    if (params.dateTo) {
      query = query.lte('end_date', params.dateTo)
    }

    if (term) {
      const conditions: string[] = []
      conditions.push(`reason.ilike.%${term}%`)
      if (types.length > 0) {
        conditions.push(`leave_type.in.(${types.join(',')})`)
      }
      if (matchedStaffIds && matchedStaffIds.length > 0) {
        conditions.push(`staff_id.in.(${matchedStaffIds.join(',')})`)
      }
      query = query.or(conditions.join(','))
    }

    query = query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error
    return { rows: (data || []) as unknown as LeaveRequest[], total: count ?? 0 }
  }

  // RPC (POST body): daftar id yang dikecualikan tidak lewat URL
  const { data, error } = await supabase.rpc('hr_cuti_daftar', {
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
