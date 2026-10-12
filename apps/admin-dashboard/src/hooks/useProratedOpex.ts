'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ExpenseRow } from './useExpenses'
import type { PeriodFilterValue } from '@/lib/types'
import {
  calculateProratedExpenses,
  type ProratedExpenseResult,
} from '@/lib/opexProrata'
import { getProrataAuxiliaryDataAction, type ProrataAuxiliaryData } from '@/app/actions/prorataAuxiliary'

interface UseProratedOpexOptions {
  filter: PeriodFilterValue
  rawExpenses: ExpenseRow[]
  outlets?: { id: string; name: string; is_active?: boolean }[]
  enabled?: boolean
}

/**
 * Hook untuk memprorata beban tetap (Gaji Crew dari HR, Sewa Outlet, Internet)
 * secara realtime pada bulan berjalan, serta menyuplai data gaji dari modul HR
 * untuk bulan-bulan lampau (single source of truth selevel Tab Laba Rugi).
 * 
 * Menggunakan Server Action getProrataAuxiliaryDataAction untuk mengeliminasi
 * isu RLS Supabase client dan menyatukan 6 kueri paralel di server.
 */
export function useProratedOpex({
  filter,
  rawExpenses,
  outlets = [],
  enabled = true,
}: UseProratedOpexOptions): ProratedExpenseResult & { loading: boolean } {
  const shouldFetch = enabled && Boolean(filter.from && filter.to)

  const { data: auxData, isLoading: loadingAux } = useQuery<ProrataAuxiliaryData>({
    queryKey: ['prorata-auxiliary-data', filter.from, filter.to],
    queryFn: () => getProrataAuxiliaryDataAction({ from: filter.from, to: filter.to }),
    enabled: shouldFetch,
    staleTime: 60_000,
  })

  // Kalkulasi prorata murni menggunakan data pelengkap dari server action
  const calculationResult = useMemo(() => {
    return calculateProratedExpenses({
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
  }, [filter, rawExpenses, auxData, outlets])

  return {
    ...calculationResult,
    loading: shouldFetch ? loadingAux : false,
  }
}
