'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Outlet, PeriodFilterValue, SalesSummaryRow } from '@/lib/laba-rugi/types'
import type { ExpenseRow } from '@/lib/laba-rugi/expenseRow'
import { susunBarisPengeluaran } from '@/lib/laba-rugi/pengeluaran/susunBaris'
import { withPeriodCache } from '@/lib/laba-rugi/periodCache'
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

type CacheEntry<T> = { data: T; expiresAt: number }
const memoryCache = new Map<string, CacheEntry<unknown>>()
const inFlight = new Map<string, Promise<unknown>>()
const invalidationListeners = new Set<() => void>()

export async function invalidateAllLabaRugiQueries() {
  memoryCache.clear()
  inFlight.clear()
  for (const listener of invalidationListeners) {
    listener()
  }
}

function useAsyncQuery<T>({
  key,
  enabled = true,
  staleTimeMs = 60_000,
  fetcher,
}: {
  key: string
  enabled?: boolean
  staleTimeMs?: number
  fetcher: () => Promise<T>
}) {
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const [tick, setTick] = useState(0)
  const [state, setState] = useState<{
    data: T | undefined
    isLoading: boolean
    error: Error | null
  }>(() => {
    const cached = memoryCache.get(key) as CacheEntry<T> | undefined
    if (cached && cached.expiresAt > Date.now()) {
      return { data: cached.data, isLoading: false, error: null }
    }
    return { data: undefined, isLoading: enabled, error: null }
  })

  useEffect(() => {
    const onInvalidate = () => setTick((n) => n + 1)
    invalidationListeners.add(onInvalidate)
    return () => {
      invalidationListeners.delete(onInvalidate)
    }
  }, [])

  const run = useCallback(
    async (force = false) => {
      if (!enabled) {
        setState((prev) => (prev.isLoading ? { ...prev, isLoading: false } : prev))
        return
      }
      if (!force) {
        const cached = memoryCache.get(key) as CacheEntry<T> | undefined
        if (cached && cached.expiresAt > Date.now()) {
          setState({ data: cached.data, isLoading: false, error: null })
          return
        }
      }

      setState((prev) => ({ data: prev.data, isLoading: true, error: null }))
      try {
        let p = !force ? (inFlight.get(key) as Promise<T> | undefined) : undefined
        if (!p) {
          p = fetcherRef.current()
          inFlight.set(key, p)
        }
        const data = await p
        inFlight.delete(key)
        memoryCache.set(key, { data, expiresAt: Date.now() + staleTimeMs })
        setState({ data, isLoading: false, error: null })
      } catch (err: any) {
        inFlight.delete(key)
        setState((prev) => ({
          data: prev.data,
          isLoading: false,
          error: err instanceof Error ? err : new Error(String(err?.message || err)),
        }))
      }
    },
    [key, enabled, staleTimeMs],
  )

  useEffect(() => {
    let active = true
    if (!enabled) {
      setState((prev) => (prev.isLoading ? { ...prev, isLoading: false } : prev))
      return
    }
    const cached = memoryCache.get(key) as CacheEntry<T> | undefined
    if (cached && cached.expiresAt > Date.now()) {
      setState({ data: cached.data, isLoading: false, error: null })
      return
    }

    setState((prev) => ({ data: prev.data, isLoading: true, error: null }))
    let p = inFlight.get(key) as Promise<T> | undefined
    if (!p) {
      p = fetcherRef.current()
      inFlight.set(key, p)
    }
    p.then((data) => {
      inFlight.delete(key)
      memoryCache.set(key, { data, expiresAt: Date.now() + staleTimeMs })
      if (active) setState({ data, isLoading: false, error: null })
    }).catch((err: any) => {
      inFlight.delete(key)
      if (active) {
        setState((prev) => ({
          data: prev.data,
          isLoading: false,
          error: err instanceof Error ? err : new Error(String(err?.message || err)),
        }))
      }
    })

    return () => {
      active = false
    }
  }, [key, enabled, staleTimeMs, tick])

  return {
    data: state.data,
    isLoading: enabled ? state.isLoading : false,
    error: state.error,
    refetch: () => run(true),
  }
}

export function useScopedFilter() {
  const { filter, setFilter } = useProfitFilterStore()
  return { filter, setFilter, lockedOutletId: null as string | null }
}

export function useOutlets() {
  return useAsyncQuery<Outlet[]>({
    key: 'laba-rugi-outlets',
    staleTimeMs: 5 * 60_000,
    fetcher: () => getLabaRugiOutletsAction(),
  })
}

export function useMitraInvestments() {
  const query = useAsyncQuery<Record<string, MitraInvestmentExtended>>({
    key: 'mitra-investments',
    staleTimeMs: 5 * 60_000,
    fetcher: () => getMitraInvestmentsAction(),
  })

  return {
    investments: query.data ?? {},
    loading: query.isLoading,
    error: query.error ? query.error.message : null,
  }
}

export function useSalesDaily(
  filter: PeriodFilterValue,
  outlets?: { id: string; name: string }[],
  options?: { enabled?: boolean },
) {
  const queryKey = ['sales-daily', filter.from, filter.to, filter.outletId, filter.source] as const
  const key = JSON.stringify(queryKey)
  const enabled = (options?.enabled ?? true) && Boolean(filter.from && filter.to)

  const query = useAsyncQuery<SalesSummaryRow[]>({
    key,
    enabled,
    staleTimeMs: 60_000,
    fetcher: withPeriodCache(queryKey, filter, () => getLabaRugiSalesDailyAction(filter)),
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
    error: query.error ? query.error.message : null,
  }
}

const EMPTY_EXPENSES: ExpenseRow[] = []

export function useExpenses(filter: PeriodFilterValue) {
  const key = JSON.stringify(['expenses', filter.from, filter.to, filter.outletId, filter.source])
  const query = useAsyncQuery<ExpenseRow[]>({
    key,
    enabled: Boolean(filter.from && filter.to),
    staleTimeMs: 30_000,
    fetcher: async () => {
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
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  }
}

export function useHpp(filter: PeriodFilterValue) {
  const aktif = Boolean(filter.from && filter.to)
  const versiQuery = useAsyncQuery<string>({
    key: 'hpp-riwayat-versi',
    enabled: aktif,
    staleTimeMs: 60_000,
    fetcher: () => getLabaRugiHppVersionAction(),
  })
  const versiHpp = versiQuery.data

  const queryKey = [
    'hpp-client-calculated-v3',
    filter.from,
    filter.to,
    filter.outletId,
    versiHpp ?? '',
  ] as const

  const query = useAsyncQuery<HppRow[]>({
    key: JSON.stringify(queryKey),
    enabled: Boolean(aktif && versiHpp),
    staleTimeMs: 60_000,
    fetcher: withPeriodCache(queryKey, filter, () => getLabaRugiHppAction(filter)),
  })

  const versiBelumSiap = !versiHpp && !versiQuery.error
  const loading = aktif && (versiQuery.isLoading || query.isLoading || versiBelumSiap)
  const error = versiQuery.error
    ? versiQuery.error.message
    : query.error
      ? query.error.message
      : null

  return {
    rows: query.data ?? [],
    loading,
    error,
  }
}

export function useWaste(filter: PeriodFilterValue) {
  const queryKey = ['waste', filter.from, filter.to, filter.outletId] as const
  const query = useAsyncQuery<WasteRow[]>({
    key: JSON.stringify(queryKey),
    enabled: Boolean(filter.from && filter.to),
    staleTimeMs: 60_000,
    fetcher: withPeriodCache(queryKey, filter, () => getLabaRugiWasteAction(filter)),
  })

  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? query.error.message : null,
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

  const { data: auxData, isLoading: loadingAux } = useAsyncQuery<ProrataAuxiliaryData>({
    key: JSON.stringify(['prorata-auxiliary-data', filter.from, filter.to]),
    enabled: shouldFetch,
    staleTimeMs: 60_000,
    fetcher: () => getProrataAuxiliaryDataAction({ from: filter.from, to: filter.to }),
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
  return useAsyncQuery<HRPayrollSummary>({
    key: JSON.stringify(['hr_payroll_summary', filter.from, filter.to, filter.outletId]),
    enabled: enabled && Boolean(filter.from && filter.to),
    staleTimeMs: 60_000,
    fetcher: () => getHRPayrollSummaryAction(filter),
  })
}

export function useTikTokSettlement(filter: { from: string; to: string }) {
  const query = useAsyncQuery<Record<string, TikTokSettlementSummary>>({
    key: JSON.stringify(['tiktok_settlement_summaries', filter.from, filter.to]),
    enabled: Boolean(filter.from && filter.to),
    staleTimeMs: 60_000,
    fetcher: async () => {
      const res = await getTikTokSettlementSummaries(filter.from, filter.to)
      if (!res.success || !res.data) return {}
      return res.data
    },
  })

  return {
    settlements: query.data || {},
    loading: query.isLoading,
    error: query.error,
  }
}

export function usePendapatanLain(filter: PeriodFilterValue, enabled: boolean) {
  return useAsyncQuery<number>({
    key: JSON.stringify(['pendapatan_lain', filter.from, filter.to]),
    enabled: enabled && Boolean(filter.from && filter.to),
    staleTimeMs: 60_000,
    fetcher: () => getLabaRugiPendapatanLainAction({ from: filter.from, to: filter.to }),
  })
}
