'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { ExpenseRow } from './useExpenses'
import type { PeriodFilterValue } from '@/lib/types'
import { monthRange } from '@/lib/period'
import {
  calculateMonthOverlap,
  calculateProratedExpenses,
  type ProratedExpenseResult,
} from '@/lib/opexProrata'

interface UseProratedOpexOptions {
  filter: PeriodFilterValue
  rawExpenses: ExpenseRow[]
  outlets?: { id: string; name: string }[]
  enabled?: boolean
}

/**
 * Hook untuk memprorata beban tetap (Gaji Crew dari HR, Sewa Outlet, Internet)
 * secara realtime pada bulan berjalan.
 * 
 * Strategi Kueri Optimal:
 * - Jika filter TIDAK menyentuh bulan berjalan, 3 kueri tambahan sama sekali TIDAK dijalankan (0 network overhead).
 * - Seluruh query di-cache dengan staleTime yang memadai.
 */
export function useProratedOpex({
  filter,
  rawExpenses,
  outlets = [],
  enabled = true,
}: UseProratedOpexOptions): ProratedExpenseResult & { loading: boolean } {
  const supabase = createClient()

  // 1. Cek irisan filter dengan bulan berjalan
  const overlap = useMemo(() => {
    return calculateMonthOverlap(filter.from, filter.to)
  }, [filter.from, filter.to])

  const shouldFetchProrata = enabled && overlap.isCurrentMonth && overlap.overlapDays > 0

  // 2. Kueri data slip gaji HR (payroll_records) bulan berjalan
  const { data: payrollData = [], isLoading: loadingPayroll } = useQuery({
    queryKey: ['prorata-payroll-records', overlap.year, overlap.month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_records')
        .select(`
          total_salary,
          basic_salary,
          allowance_position,
          allowance_presence,
          outlet_staff!payroll_records_staff_id_fkey(
            outlet_id,
            role,
            status
          )
        `)
        .eq('period_month', overlap.month)
        .eq('period_year', overlap.year)

      if (error) {
        console.warn('Gagal memuat payroll_records untuk prorata:', error.message)
        return []
      }

      const rows = (data ?? []) as any[]
      return rows
        .filter(r => r.outlet_staff?.role !== 'kiosk')
        .map(r => ({
          outlet_id: r.outlet_staff?.outlet_id as string,
          total_salary: Number(r.total_salary) || 0,
        }))
        .filter(r => Boolean(r.outlet_id))
    },
    enabled: shouldFetchProrata,
    staleTime: 5 * 60 * 1000, // 5 menit
  })

  // 3. Kueri fallback master staf aktif (outlet_staff + staff_financials)
  const { data: staffData = [], isLoading: loadingStaff } = useQuery({
    queryKey: ['prorata-staff-financials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlet_staff')
        .select(`
          outlet_id,
          role,
          status,
          staff_financials(
            basic_salary,
            allowance_position,
            allowance_presence
          )
        `)
        .eq('status', 'active')
        .neq('role', 'kiosk')

      if (error) {
        console.warn('Gagal memuat staff_financials untuk prorata:', error.message)
        return []
      }

      const rows = (data ?? []) as any[]
      return rows.map(s => {
        const fin = Array.isArray(s.staff_financials) ? s.staff_financials[0] : s.staff_financials
        return {
          outlet_id: s.outlet_id as string,
          basic_salary: Number(fin?.basic_salary) || 0,
          allowance_position: Number(fin?.allowance_position) || 0,
          allowance_presence: Number(fin?.allowance_presence) || 0,
        }
      }).filter(s => Boolean(s.outlet_id))
    },
    enabled: shouldFetchProrata,
    staleTime: 10 * 60 * 1000, // 10 menit
  })

  // 4. Kueri rollover beban sewa & internet bulan sebelumnya
  const prevMonthRange = useMemo(() => {
    const prevMonth = overlap.month === 1 ? 12 : overlap.month - 1
    const prevYear = overlap.month === 1 ? overlap.year - 1 : overlap.year
    return monthRange(prevYear, prevMonth)
  }, [overlap.month, overlap.year])

  const { data: lastMonthExpenses = [], isLoading: loadingLastMonth } = useQuery({
    queryKey: ['prorata-rollover-expenses', prevMonthRange.from],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('outlet_id, category, amount')
        .in('category', ['sewa_outlet', 'sewa', 'internet', 'wifi'])
        .eq('type', 'expense')
        .gte('expense_date', prevMonthRange.from)
        .lte('expense_date', prevMonthRange.to)

      if (error) {
        console.warn('Gagal memuat rollover expenses untuk prorata:', error.message)
        return []
      }

      return (data ?? []).map((e: any) => ({
        outlet_id: e.outlet_id as string | null,
        category: e.category as string,
        amount: Number(e.amount) || 0,
      }))
    },
    enabled: shouldFetchProrata,
    staleTime: 60 * 60 * 1000, // 1 jam (bulan lampau stabil)
  })

  const loading = shouldFetchProrata && (loadingPayroll || loadingStaff || loadingLastMonth)

  // 5. Kalkulasi prorata murni
  const calculationResult = useMemo(() => {
    return calculateProratedExpenses({
      filter,
      rawExpenses,
      payrollRecords: payrollData,
      staffFinancials: staffData,
      lastMonthExpenses,
      outlets,
    })
  }, [filter, rawExpenses, payrollData, staffData, lastMonthExpenses, outlets])

  return {
    ...calculationResult,
    loading,
  }
}
