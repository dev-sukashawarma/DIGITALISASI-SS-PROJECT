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
import { susunBarisGajiKantor, gabungGajiKantor } from '@/lib/gajiKantorPusat'
import { getJakartaCurrentMonthInfo } from '@/lib/opexProrata'

interface UseProratedOpexOptions {
  filter: PeriodFilterValue
  rawExpenses: ExpenseRow[]
  outlets?: { id: string; name: string; is_active?: boolean }[]
  enabled?: boolean
  /**
   * Tambahkan gaji staf kantor pusat (slip HR) sebagai baris biaya pusat.
   * Hanya untuk Laba Rugi yang memuat biaya pusat — JANGAN dinyalakan di scope mitra.
   */
  includeOfficePayroll?: boolean
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
  includeOfficePayroll = false,
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
    // Biaya pusat hanya tampil saat semua outlet digabung, jadi gaji kantor ikut syarat yang sama.
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
