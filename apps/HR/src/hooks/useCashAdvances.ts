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
  page: number
  pageSize?: number
}

/** Satu halaman kasbon (RPC hr_kasbon_daftar); filter & penyaringan akun tes di database. */
export async function fetchCashAdvancesPage(
  dir: HrDirectory,
  params: Omit<CashAdvanceListParams, 'page' | 'pageSize'>,
  limit: number,
  offset: number
): Promise<Paged<CashAdvanceRow>> {
  // RPC (POST body): daftar id yang dikecualikan tidak lewat URL
  const { data, error } = await createClient().rpc('hr_kasbon_daftar', {
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
