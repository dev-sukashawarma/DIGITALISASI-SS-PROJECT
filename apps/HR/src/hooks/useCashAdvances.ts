'use client'

import { useEffect, useId, useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { CashAdvance, CashAdvancePayment, CashAdvanceStatus } from '@/lib/types'
import { useHrDirectory, type HrDirectory } from '@/hooks/useHrDirectory'
import { DEFAULT_PAGE_SIZE, fetchAllPages, type Paged } from '@/lib/paging'
import { getKasbonProofSignedUrls } from '@/app/actions/kasbonProof'

interface CashAdvanceRow extends CashAdvance {
  outlet_staff: {
    name: string
    role: string
    outlet_id?: string | null
    phone?: string | null
    outlets?: { name: string } | null
  }
  cash_advance_payments: CashAdvancePayment[]
  staff_phone?: string | null
  dicairkan_oleh_name?: string | null
  ditolak_finance_oleh_name?: string | null
}

function enrichCashAdvanceRows(rows: CashAdvanceRow[], staffList: HrDirectory['staff']): CashAdvanceRow[] {
  const staffMap = new Map(staffList.map((s) => [s.id, s]))
  return rows.map((row) => ({
    ...row,
    staff_phone: row.outlet_staff?.phone ?? staffMap.get(row.staff_id)?.phone ?? null,
    dicairkan_oleh_name: row.dicairkan_oleh ? (staffMap.get(row.dicairkan_oleh)?.name ?? null) : null,
    ditolak_finance_oleh_name: row.ditolak_finance_oleh
      ? (staffMap.get(row.ditolak_finance_oleh)?.name ?? null)
      : null,
  }))
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
        id, staff_id, amount, amount_requested, remaining, installment_months, reason, status, status_hr, created_at, approved_at, rejection_note, approval_note, dicairkan_at, dicairkan_oleh, dicairkan_dari, metode_cair, bukti_cair, cash_transaction_id, ditolak_finance_at, ditolak_finance_oleh,
        outlet_staff!cash_advances_staff_id_fkey!inner(
          name, role, username, account_category, outlet_id, phone,
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
      } else if (params.status === 'menunggu_cair') {
        query = query.eq('status_hr', 'approved').eq('status', 'menunggu_cair')
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
    return {
      rows: enrichCashAdvanceRows((data || []) as unknown as CashAdvanceRow[], dir.staff),
      total: count ?? 0,
    }
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
  return {
    rows: enrichCashAdvanceRows(res.rows ?? [], dir.staff),
    total: res.total ?? 0,
  }
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

/**
 * Menandatangani semua bukti_cair di halaman aktif dalam satu batch request server action
 * agar preview & tautan WhatsApp langsung siap tanpa popup blocker.
 */
export function useKasbonProofUrls(rows: CashAdvanceRow[], enabled = true) {
  const rawPaths = useMemo(
    () => [...new Set(rows.map((r) => r.bukti_cair?.trim()).filter((p): p is string => Boolean(p)))].sort(),
    [rows],
  )
  const storagePaths = useMemo(
    () => rawPaths.filter((p) => !/^https?:\/\//i.test(p)),
    [rawPaths],
  )

  const query = useQuery<Record<string, string>>({
    queryKey: ['kasbon-proof-urls', storagePaths],
    enabled: enabled && storagePaths.length > 0,
    staleTime: 50 * 60_000,
    gcTime: 60 * 60_000,
    queryFn: async () => {
      const res = await getKasbonProofSignedUrls(storagePaths)
      if (!res.ok) throw new Error(res.error)
      return res.urls
    },
  })

  const urlByPath = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of rawPaths) {
      if (/^https?:\/\//i.test(p)) {
        map[p] = p
      } else if (query.data?.[p]) {
        map[p] = query.data[p]
      }
    }
    return map
  }, [rawPaths, query.data])

  return {
    urlByPath,
    isLoading: query.isLoading && storagePaths.length > 0,
    error: query.error instanceof Error ? query.error.message : null,
  }
}

export type { CashAdvanceRow }
