'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Outlet, PeriodFilterValue, SalesSummaryRow } from '@/lib/laba-rugi/types'
import type { ExpenseRow } from '@/lib/laba-rugi/expenseRow'
import { susunBarisPengeluaran } from '@/lib/laba-rugi/pengeluaran/susunBaris'
import { periodCacheOptions, withPeriodCache } from '@/lib/laba-rugi/periodCache'
import {
  calculateProratedExpenses,
  getJakartaCurrentMonthInfo,
  type ProratedExpenseResult,
} from '@/lib/laba-rugi/opexProrata'
import { susunBarisGajiKantor, gabungGajiKantor } from '@/lib/laba-rugi/gajiKantorPusat'
import { useProfitFilterStore } from '@/lib/laba-rugi/useProfitFilter'
import {
  getLabaRugiOutletsAction,
  getLabaRugiSalesDailyAction,
  getExpensesAction,
  getLabaRugiHppVersionAction,
  getLabaRugiHppAction,
  getLabaRugiWasteAction,
  getLabaRugiPendapatanLainAction,
  getMitraInvestmentsAction,
  getProrataAuxiliaryDataAction,
  getHRPayrollSummaryAction,
  getTikTokSettlementSummaries,
  type HRPayrollSummary,
  type MitraInvestmentExtended,
  type MitraTransferRecord,
  type ProrataAuxiliaryData,
  type TikTokSettlementSummary,
  type WasteRow,
  type HppRow,
} from '@/app/actions/labaRugi'

export type {
  ExpenseRow,
  HRPayrollSummary,
  MitraInvestmentExtended,
  MitraTransferRecord,
  ProrataAuxiliaryData,
  TikTokSettlementSummary,
  WasteRow,
  HppRow,
}

export function useScopedFilter() {
  const { filter, setFilter } = useProfitFilterStore()
  return { filter, setFilter, lockedOutletId: null as string | null }
}

export function useOutlets() {
  return useQuery<Outlet[]>({
    queryKey: ['laba-rugi-outlets'],
    staleTime: 5 * 60_000,
    queryFn: () => getLabaRugiOutletsAction(),
  })
}

export function useMitraInvestments() {
  const query = useQuery<Record<string, MitraInvestmentExtended>>({
    queryKey: ['mitra-investments'],
    staleTime: 5 * 60_000,
    queryFn: () => getMitraInvestmentsAction(),
  })

  return {
    investments: query.data ?? {},
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  }
}

export function useSalesDaily(
  filter: PeriodFilterValue,
  outlets?: { id: string; name: string }[],
  options?: { enabled?: boolean },
) {
  const queryKey = ['sales-daily', filter.from, filter.to, filter.outletId, filter.source] as const
  const query = useQuery<SalesSummaryRow[]>({
    queryKey: [...queryKey],
    ...periodCacheOptions(filter),
    enabled: (options?.enabled ?? true) && Boolean(filter.from && filter.to),
    queryFn: withPeriodCache(queryKey, filter, () => getLabaRugiSalesDailyAction(filter)),
  })

  const rows = useMemo<SalesSummaryRow[]>(() => {
    const base = query.data ?? []
    if (!outlets || outlets.length === 0) return base
    const nameById = new Map(outlets.map((o) => [o.id, o.name]))
    return base.map((r) => ({
      ...r,
      outlet_name: nameById.get(r.outlet_id) ?? 'Outlet Tidak Dikenal',
    }))
  }, [query.data, outlets])

  return {
    rows,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  }
}

const EMPTY_EXPENSES: ExpenseRow[] = []

export function useExpenses(filter: PeriodFilterValue) {
  const query = useQuery<ExpenseRow[]>({
    queryKey: ['expenses', filter.from, filter.to, filter.outletId, filter.source],
    staleTime: 30_000,
    enabled: Boolean(filter.from && filter.to),
    queryFn: async () => {
      const res = await getExpensesAction({
        from: filter.from,
        to: filter.to,
        outletId: filter.outletId,
        source: filter.source,
      })
      if (res && 'success' in res && !res.success) {
        throw new Error(res.error || 'Gagal memuat data pengeluaran dari server')
      }
      return susunBarisPengeluaran(res.expenses ?? [], res.pettyCashExpenses ?? [])
    },
  })

  return {
    rows: query.data ?? EMPTY_EXPENSES,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
  }
}

export function useHpp(filter: PeriodFilterValue) {
  const versiQuery = useQuery({
    queryKey: ['hpp-riwayat-versi'],
    staleTime: 60_000,
    enabled: Boolean(filter.from && filter.to),
    queryFn: () => getLabaRugiHppVersionAction(),
  })
  const versiHpp = versiQuery.data

  const queryKey = [
    'hpp-client-calculated-v3',
    filter.from,
    filter.to,
    filter.outletId,
    versiHpp ?? '',
  ] as const

  const query = useQuery<HppRow[]>({
    queryKey: [...queryKey],
    ...periodCacheOptions(filter),
    enabled: Boolean(filter.from && filter.to && versiHpp),
    queryFn: withPeriodCache(queryKey, filter, () => getLabaRugiHppAction(filter)),
  })

  const versiBelumSiap = !versiHpp && !versiQuery.error
  const aktif = Boolean(filter.from && filter.to)
  const loading = aktif && (versiQuery.isLoading || query.isLoading || versiBelumSiap)
  const error = versiQuery.error
    ? (versiQuery.error as Error).message
    : query.error
      ? (query.error as Error).message
      : null

  return {
    rows: query.data ?? [],
    loading,
    error,
  }
}

export function useWaste(filter: PeriodFilterValue) {
  const queryKey = ['waste', filter.from, filter.to, filter.outletId] as const
  const query = useQuery<WasteRow[]>({
    queryKey: [...queryKey],
    ...periodCacheOptions(filter),
    enabled: Boolean(filter.from && filter.to),
    queryFn: withPeriodCache(queryKey, filter, () => getLabaRugiWasteAction(filter)),
  })
  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  }
}

export function useProratedOpex({
  filter,
  rawExpenses,
  outlets = [],
  enabled = true,
  includeOfficePayroll = false,
}: {
  filter: PeriodFilterValue
  rawExpenses: ExpenseRow[]
  outlets?: { id: string; name: string; is_active?: boolean }[]
  enabled?: boolean
  includeOfficePayroll?: boolean
}): ProratedExpenseResult & { loading: boolean } {
  const shouldFetch = enabled && Boolean(filter.from && filter.to)

  const { data: auxData, isLoading: loadingAux } = useQuery<ProrataAuxiliaryData>({
    queryKey: ['prorata-auxiliary-data', filter.from, filter.to],
    queryFn: () => getProrataAuxiliaryDataAction({ from: filter.from, to: filter.to }),
    enabled: shouldFetch,
    staleTime: 60_000,
  })

  const calculationResult = useMemo(() => {
    const hasil = calculateProratedExpenses({
      filter,
      rawExpenses,
      payrollRecords: auxData?.payrollRecords || [],
      staffFinancials: auxData?.staffFinancials || [],
      lastMonthExpenses: auxData?.lastMonthExpenses || [],
      crewBonusRecords: auxData?.crewBonusRecords || [],
      outlets,
      managerAssignments: auxData?.managerAssignments || [],
      operationalOutletIds: auxData?.operationalOutletIds || [],
    })
    if (!includeOfficePayroll || (filter.outletId && filter.outletId !== 'all')) return hasil
    const barisGajiKantor = susunBarisGajiKantor({
      from: filter.from,
      to: filter.to,
      officePayrollRecords: auxData?.officePayrollRecords || [],
      officeStaffMonthlyTotal: auxData?.officeStaffMonthlyTotal || 0,
      currentMonthFirstDay: getJakartaCurrentMonthInfo().firstDay,
    })
    return { ...hasil, rows: gabungGajiKantor(hasil.rows, barisGajiKantor) }
  }, [filter, rawExpenses, auxData, outlets, includeOfficePayroll])

  return {
    ...calculationResult,
    loading: shouldFetch ? loadingAux : false,
  }
}

export function useHRPayroll(
  filter: { from: string; to: string; outletId: string },
  enabled = true,
) {
  return useQuery<HRPayrollSummary>({
    queryKey: ['hr_payroll_summary', filter.from, filter.to, filter.outletId],
    queryFn: () => getHRPayrollSummaryAction(filter),
    staleTime: 60_000,
    enabled: enabled && Boolean(filter.from && filter.to),
  })
}

export function useTikTokSettlement(filter: { from: string; to: string }) {
  const query = useQuery<Record<string, TikTokSettlementSummary>>({
    queryKey: ['tiktok_settlement_summaries', filter.from, filter.to],
    enabled: Boolean(filter.from && filter.to),
    queryFn: async () => {
      const res = await getTikTokSettlementSummaries(filter.from, filter.to)
      if (!res.success || !res.data) return {}
      return res.data
    },
    staleTime: 60_000,
  })

  return {
    settlements: query.data || {},
    loading: query.isLoading,
    error: query.error,
  }
}

export function usePendapatanLain(filter: PeriodFilterValue, enabled: boolean) {
  return useQuery({
    queryKey: ['pendapatan_lain', filter.from, filter.to],
    enabled: enabled && Boolean(filter.from && filter.to),
    queryFn: () => getLabaRugiPendapatanLainAction({ from: filter.from, to: filter.to }),
  })
}
