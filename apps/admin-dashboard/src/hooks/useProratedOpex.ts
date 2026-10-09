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
  getPeriodsInRange,
  type ProratedExpenseResult,
  type ManagerAssignment,
} from '@/lib/opexProrata'
import { isTestOrDevStaff, KANTOR_PUSAT_ID } from '@/lib/staffFilters'
import { isExcludedOutlet } from '@/lib/outletFilters'

interface UseProratedOpexOptions {
  filter: PeriodFilterValue
  rawExpenses: ExpenseRow[]
  outlets?: { id: string; name: string; is_active?: boolean }[]
  enabled?: boolean
}

/**
 * Hook untuk memprorata beban tetap (Gaji Crew dari HR, Sewa Outlet, Internet)
 * secara realtime pada bulan berjalan, serta menyuplai data gaji dari modul HR
 * untuk bulan-bulan lampau (single source of truth).
 */
export function useProratedOpex({
  filter,
  rawExpenses,
  outlets = [],
  enabled = true,
}: UseProratedOpexOptions): ProratedExpenseResult & { loading: boolean } {
  const supabase = createClient()

  // 1. Cek irisan filter dengan bulan berjalan & ekstrak periode bulan
  const overlap = useMemo(() => {
    return calculateMonthOverlap(filter.from, filter.to)
  }, [filter.from, filter.to])

  const periods = useMemo(() => {
    return getPeriodsInRange(filter.from, filter.to)
  }, [filter.from, filter.to])

  const months = useMemo(() => [...new Set(periods.map(p => p.month))], [periods])
  const years = useMemo(() => [...new Set(periods.map(p => p.year))], [periods])

  const uniqueYearMonths = useMemo(() => {
    const list: { year: number; month: number }[] = []
    const seen = new Set<string>()
    const source = periods.length > 0 ? periods : [{ year: overlap.year, month: overlap.month }]
    for (const p of source) {
      const key = `${p.year}-${p.month}`
      if (!seen.has(key)) {
        seen.add(key)
        list.push({ year: p.year, month: p.month })
      }
    }
    return list
  }, [periods, overlap.year, overlap.month])

  const shouldFetchPayroll = enabled && periods.length > 0
  const shouldFetchBonus = enabled && uniqueYearMonths.length > 0
  const shouldFetchProrata = enabled && overlap.isCurrentMonth && overlap.overlapDays > 0

  // 2. Kueri data slip gaji HR (payroll_records) untuk seluruh bulan yang disentuh filter
  const { data: payrollData = [], isLoading: loadingPayroll } = useQuery({
    queryKey: ['prorata-payroll-records', years, months],
    queryFn: async () => {
      let q = supabase
        .from('payroll_records')
        .select(`
          period_month,
          period_year,
          total_salary,
          basic_salary,
          bonus,
          allowance_position,
          allowance_presence,
          outlet_staff!payroll_records_staff_id_fkey(
            id,
            name,
            username,
            outlet_id,
            role,
            status,
            account_category
          )
        `)

      if (years.length === 1) q = q.eq('period_year', years[0])
      else if (years.length > 1) q = q.in('period_year', years)

      if (months.length === 1) q = q.eq('period_month', months[0])
      else if (months.length > 1) q = q.in('period_month', months)

      const { data, error } = await q

      if (error) {
        console.warn('Gagal memuat payroll_records untuk prorata:', error.message)
        return []
      }

      const rows = (data ?? []) as any[]
      const ALLOWED_ROLES = ['crew', 'leader', 'kasir', 'kitchen', 'driver', 'area_manager', 'regional_manager']

      return rows
        .filter(r => {
          const s = r.outlet_staff
          if (!s || s.status !== 'active') return false
          if (isTestOrDevStaff(s)) return false
          if (!ALLOWED_ROLES.includes(s.role)) return false
          const isManager = s.role === 'area_manager' || s.role === 'regional_manager'
          if (!isManager && (!s.outlet_id || s.outlet_id === KANTOR_PUSAT_ID)) return false
          return true
        })
        .map(r => ({
          staff_id: (r.outlet_staff?.id || r.staff_id) as string,
          outlet_id: r.outlet_staff?.outlet_id as string,
          total_salary: Number(r.total_salary) || 0,
          bonus: Number(r.bonus) || 0,
          period_month: Number(r.period_month),
          period_year: Number(r.period_year),
          role: r.outlet_staff?.role as string,
        }))
        .filter(r => Boolean(r.outlet_id))
    },
    enabled: shouldFetchPayroll,
    staleTime: 5 * 60 * 1000, // 5 menit
  })

  // 3. Kueri fallback master staf aktif (outlet_staff + staff_financials)
  const { data: staffData = [], isLoading: loadingStaff } = useQuery({
    queryKey: ['prorata-staff-financials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlet_staff')
        .select(`
          id,
          name,
          username,
          outlet_id,
          role,
          status,
          account_category,
          staff_financials(
            basic_salary,
            allowance_position,
            allowance_presence
          )
        `)
        .eq('status', 'active')
        .in('role', ['crew', 'leader', 'kasir', 'kitchen', 'driver', 'area_manager', 'regional_manager'])

      if (error) {
        console.warn('Gagal memuat staff_financials untuk prorata:', error.message)
        return []
      }

      const rows = (data ?? []) as any[]
      const ALLOWED_ROLES = ['crew', 'leader', 'kasir', 'kitchen', 'driver', 'area_manager', 'regional_manager']

      return rows
        .filter(s => {
          if (!s || s.status !== 'active') return false
          if (isTestOrDevStaff(s)) return false
          if (!ALLOWED_ROLES.includes(s.role)) return false
          const isManager = s.role === 'area_manager' || s.role === 'regional_manager'
          if (!isManager && (!s.outlet_id || s.outlet_id === KANTOR_PUSAT_ID)) return false
          return true
        })
        .map(s => {
          const fin = Array.isArray(s.staff_financials) ? s.staff_financials[0] : s.staff_financials
          return {
            staff_id: s.id as string,
            outlet_id: s.outlet_id as string,
            basic_salary: Number(fin?.basic_salary) || 0,
            allowance_position: Number(fin?.allowance_position) || 0,
            allowance_presence: Number(fin?.allowance_presence) || 0,
            role: s.role as string,
          }
        }).filter(s => Boolean(s.outlet_id))
    },
    enabled: shouldFetchPayroll,
    staleTime: 10 * 60 * 1000, // 10 menit
  })

  // 3b. Kueri mapping outlet binaan manajer (staff_outlets)
  const { data: managerAssignments = [] } = useQuery({
    queryKey: ['prorata-manager-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_outlets')
        .select(`
          staff_id,
          outlet_id,
          outlet_staff!inner(id, role, is_active)
        `)
        .in('outlet_staff.role', ['area_manager', 'regional_manager'])
        .eq('outlet_staff.is_active', true)

      if (error) {
        console.warn('Gagal memuat staff_outlets untuk manajer:', error.message)
        return []
      }

      const map = new Map<string, ManagerAssignment>()
      for (const row of (data || [])) {
        const sid = row.staff_id
        const role = (row.outlet_staff as any)?.role || 'area_manager'
        if (!map.has(sid)) {
          map.set(sid, {
            staff_id: sid,
            role,
            outlet_ids: [],
          })
        }
        map.get(sid)!.outlet_ids.push(row.outlet_id)
      }
      return Array.from(map.values())
    },
    enabled: shouldFetchPayroll,
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
        .in('category', [
          'sewa_outlet', 'sewa',
          'internet', 'wifi',
          'bonus_crew', 'bonus_leader',
          'bonus_area_manager', 'bonus_regional_manager', 'bonus_korlap',
        ])
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

  // 5. Kueri data bonus kru & porsi penjualan MTD dari RPC database untuk seluruh bulan yang relevan
  const { data: crewBonusData = [], isLoading: loadingCrewBonus } = useQuery({
    queryKey: ['prorata-crew-bonus', uniqueYearMonths.map(ym => `${ym.year}-${ym.month}`).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        uniqueYearMonths.map(async ({ year, month }) => {
          const { data, error } = await supabase.rpc('get_monthly_crew_bonus', {
            p_month: month,
            p_year: year,
            p_outlet_id: null,
          })

          if (error) {
            console.warn(`Gagal memuat crew bonus untuk prorata (${year}-${month}):`, error.message)
            return []
          }

          const rows = (data ?? []) as any[]
          return rows.map(r => ({
            crew_id: r.crew_id as string,
            outlet_id: r.outlet_id as string,
            outlet_name: r.outlet_name as string,
            total_pcs_outlet: Number(r.total_pcs_outlet) || 0,
            total_bonus: Number(r.total_bonus) || 0,
            period_month: month,
            period_year: year,
          }))
        })
      )

      return results.flat()
    },
    enabled: shouldFetchBonus,
    staleTime: 5 * 60 * 1000, // 5 menit
  })

  // 5b. Kueri seluruh cabang operasional aktif (internal & mitra) tanpa dummy/backup.
  // Harus SETELAH kueri crew bonus: kuncinya memakai crewBonusData (dulu dipakai
  // sebelum dideklarasikan → ReferenceError, halaman Profit crash).
  const { data: operationalOutletIds = [] } = useQuery({
    queryKey: ['prorata-operational-outlets', crewBonusData.map(c => c.outlet_id).sort().join(',')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name, slug, type, is_active, status')
        .in('type', ['internal', 'mitra'])

      if (error) {
        console.warn('Gagal memuat outlet operasional untuk prorata manajer:', error.message)
        return []
      }

      const bonusOutletIds = new Set(crewBonusData.map(c => c.outlet_id))
      return (data || [])
        .filter(o => {
          if (isExcludedOutlet(o)) return false
          if (o.slug === 'sawangan-depok-internal') return false
          const isActive = o.is_active === true && o.status === 'active'
          const hadActivity = bonusOutletIds.has(o.id)
          return isActive || hadActivity
        })
        .map(o => o.id)
    },
    // Tunggu crew bonus selesai agar tidak menembak kueri dua kali (daftar kosong lalu terisi).
    enabled: shouldFetchPayroll && !loadingCrewBonus,
    staleTime: 30 * 60 * 1000, // 30 menit
  })

  const loading =
    (shouldFetchPayroll && (loadingPayroll || loadingStaff)) ||
    (shouldFetchBonus && loadingCrewBonus) ||
    (shouldFetchProrata && loadingLastMonth)

  // 6. Kalkulasi prorata murni
  const calculationResult = useMemo(() => {
    return calculateProratedExpenses({
      filter,
      rawExpenses,
      payrollRecords: payrollData,
      staffFinancials: staffData,
      lastMonthExpenses,
      crewBonusRecords: crewBonusData,
      outlets,
      managerAssignments,
      operationalOutletIds,
    })
  }, [filter, rawExpenses, payrollData, staffData, lastMonthExpenses, crewBonusData, outlets, managerAssignments, operationalOutletIds])

  return {
    ...calculationResult,
    loading,
  }
}
