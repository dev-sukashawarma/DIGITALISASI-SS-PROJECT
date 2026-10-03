'use client'

import { useEffect, useId } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { CashAdvance, CashAdvancePayment, CashAdvanceStatus } from '@/lib/types'
import { useHrDirectory, type HrDirectory } from '@/hooks/useHrDirectory'
import { DEFAULT_PAGE_SIZE, fetchAllPages, type Paged } from '@/lib/paging'

interface CashAdvanceRow extends CashAdvance {
  outlet_staff: {
    name: string
    role: string
    outlet_id?: string | null
    outlets?: { name: string } | null
  }
  cash_advance_payments: CashAdvancePayment[]
}

export interface CashAdvanceListParams {
  /** false = jangan query (mis. tab lain yang sedang dibuka) */
  enabled?: boolean
  status: CashAdvanceStatus | 'all'
  outletId: string // 'all' = semua
  search: string
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize?: number
}

/** Satu halaman kasbon (RPC hr_kasbon_daftar atau Query berfilter tanggal); filter & penyaringan akun tes di database. */
export async function fetchCashAdvancesPage(
  dir: HrDirectory,
  params: Omit<CashAdvanceListParams, 'page' | 'pageSize'>,
  limit: number,
  offset: number
): Promise<Paged<CashAdvanceRow>> {
  const supabase = createClient()

  // Jika ada filter tanggal, gunakan query builder langsung
  if (params.dateFrom || params.dateTo) {
    let matchedStaffIds: string[] | null = null
    const term = params.search?.trim()
    if (term) {
      const { data: staffList } = await supabase
        .from('outlet_staff')
        .select('id')
        .or(`name.ilike.%${term}%,username.ilike.%${term}%`)
      matchedStaffIds = (staffList || []).map((s) => s.id)
    }

    let query = supabase
      .from('cash_advances')
      .select(`
        id, staff_id, amount, remaining, installment_months, reason, status, status_hr, created_at, approved_at, rejection_note,
        outlet_staff!cash_advances_staff_id_fkey!inner(
          name, role, username, account_category, outlet_id,
          outlets!outlet_staff_outlet_id_fkey(name)
        ),
        cash_advance_payments(id, amount, payment_date, note, created_at)
      `, { count: 'exact' })

    if (dir.excludedStaffIds.length > 0) {
      query = query.not('staff_id', 'in', `(${dir.excludedStaffIds.join(',')})`)
    }

    if (params.status && params.status !== 'all') {
      if (params.status === 'pending') {
        query = query.eq('status_hr', 'pending').neq('status', 'paid_off')
      } else if (params.status === 'rejected') {
        query = query.eq('status_hr', 'rejected')
      } else if (params.status === 'active') {
        query = query.eq('status_hr', 'approved').eq('status', 'active')
      } else if (params.status === 'paid_off') {
        query = query.eq('status', 'paid_off')
      }
    }

    if (params.outletId && params.outletId !== 'all') {
      query = query.eq('outlet_staff.outlet_id', params.outletId)
    }

    if (params.dateFrom) {
      query = query.gte('created_at', `${params.dateFrom}T00:00:00+07:00`)
    }
    if (params.dateTo) {
      query = query.lte('created_at', `${params.dateTo}T23:59:59+07:00`)
    }

    if (term) {
      if (matchedStaffIds && matchedStaffIds.length > 0) {
        query = query.or(`reason.ilike.%${term}%,staff_id.in.(${matchedStaffIds.join(',')})`)
      } else {
        query = query.ilike('reason', `%${term}%`)
      }
    }

    query = query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error
    return { rows: (data || []) as unknown as CashAdvanceRow[], total: count ?? 0 }
  }

  // Jika tanpa filter tanggal, gunakan RPC hr_kasbon_daftar
  const { data, error } = await supabase.rpc('hr_kasbon_daftar', {
    p_status: params.status === 'all' ? null : params.status,
    p_outlet: params.outletId === 'all' ? null : params.outletId,
    p_search: params.search.trim() || null,
    p_exclude_staff: dir.excludedStaffIds,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  const res = data as { rows: CashAdvanceRow[]; total: number }
  return { rows: res.rows ?? [], total: res.total ?? 0 }
}

export function useCashAdvances(params: CashAdvanceListParams) {
  const queryClient = useQueryClient()
  const channelId = useId()
  const { data: dir } = useHrDirectory()
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
  const { page, enabled = true, pageSize: _pageSize, ...filters } = params

  // Realtime: perubahan kasbon/cicilan → refetch halaman aktif + ringkasan
  useEffect(() => {
    const supabase = createClient()
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['cash-advances'] })
      queryClient.invalidateQueries({ queryKey: ['perizinan-summary'] })
    }
    const channel = supabase
      .channel(`hr-cash-advances-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_advances' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_advance_payments' }, invalidate)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, channelId])

  const query = useQuery<Paged<CashAdvanceRow>>({
    queryKey: ['cash-advances', filters, page, pageSize],
    enabled: !!dir && enabled,
    staleTime: 30_000,
    refetchInterval: 60_000, // realtime sudah meng-invalidate; ini cadangan saja
    placeholderData: keepPreviousData,
    queryFn: () => fetchCashAdvancesPage(dir!, filters, pageSize, (page - 1) * pageSize),
  })

  const exportAll = () => {
    if (!dir) throw new Error('Data belum siap')
    return fetchAllPages((limit, offset) => fetchCashAdvancesPage(dir, filters, limit, offset), (r) => r.id)
  }

  return { ...query, isLoading: query.isLoading || !dir, exportAll }
}

export type { CashAdvanceRow }
