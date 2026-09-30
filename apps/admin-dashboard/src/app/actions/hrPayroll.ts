'use server'

import { createClient } from '@supabase/supabase-js'
import { isTestOrDevStaff } from '@/lib/staffFilters'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

export interface HRPayrollOutletSummary {
  outletId: string
  outletName: string
  staffCount: number
  totalSalary: number
  basicSalary?: number
  draftCount: number
  finalizedCount: number
  status: 'draft' | 'finalized' | 'partial' | 'empty'
}

export interface HRPayrollSummary {
  totalSalary: number
  totalStaff: number
  basicSalary: number
  allowances: number
  bonus: number
  deductions: number
  draftCount: number
  draftAmount: number
  finalizedCount: number
  finalizedAmount: number
  status: 'draft' | 'finalized' | 'partial' | 'empty'
  outlets?: HRPayrollOutletSummary[]
}

export async function getHRPayrollSummaryAction(filter: {
  from: string
  to: string
  outletId: string
}): Promise<HRPayrollSummary> {
  try {
    const supabase = getServiceSupabase()

    // Determine months and years in range
    const [startY, startM] = filter.from.split('-').map(Number)
    const [endY, endM] = filter.to.split('-').map(Number)

    const periods: { month: number; year: number }[] = []
    let y = startY
    let m = startM
    while (y < endY || (y === endY && m <= endM)) {
      periods.push({ month: m, year: y })
      m++
      if (m > 12) {
        m = 1
        y++
      }
    }

    if (periods.length === 0) {
      return {
        totalSalary: 0,
        totalStaff: 0,
        basicSalary: 0,
        allowances: 0,
        bonus: 0,
        deductions: 0,
        draftCount: 0,
        draftAmount: 0,
        finalizedCount: 0,
        finalizedAmount: 0,
        status: 'empty',
        outlets: []
      }
    }

    const years = [...new Set(periods.map(p => p.year))]
    const months = [...new Set(periods.map(p => p.month))]

    const { data, error } = await supabase
      .from('payroll_records')
      .select('id, period_month, period_year, basic_salary, allowance_meal, allowance_transport, allowance_communication, allowance_presence, allowance_position, bonus, deductions, total_salary, status, staff_id, outlet_staff:staff_id(id, name, username, outlet_id, role, account_category, email)')
      .in('period_year', years)
      .in('period_month', months)

    if (error) {
      console.error('Error fetching payroll_records for HR summary:', error)
      throw error
    }

    const rows = data || []
    // Filter matching exact period objects (month & year) and exclude test/bot/mitra accounts
    const matchingPeriodRows = rows.filter(r => {
      const inPeriod = periods.some(p => p.month === r.period_month && p.year === r.period_year)
      if (!inPeriod) return false
      const staffRaw: any = r.outlet_staff
      const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
      return !isTestOrDevStaff(staffInfo)
    })

    // Filter by outlet target
    const target = filter.outletId
    const filtered = matchingPeriodRows.filter(r => {
      const staffRaw: any = r.outlet_staff
      const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
      const staffOutletId = staffInfo?.outlet_id
      const isPusat = !staffOutletId || staffOutletId === 'ffffffff-ffff-ffff-ffff-ffffffffffff'

      if (target === 'PUSAT') return isPusat
      if (target === 'ALL_OUTLETS') return !isPusat
      if (target !== 'all' && staffOutletId !== target) return false
      return true
    })

    // Fetch outlets mapping
    const { data: outletData } = await supabase
      .from('outlets')
      .select('id, name')

    const outletNameMap = new Map<string, string>()
    ;(outletData || []).forEach((o: any) => {
      outletNameMap.set(o.id, o.name)
    })

    let totalSalary = 0
    let basicSalary = 0
    let allowances = 0
    let bonus = 0
    let deductions = 0
    let draftCount = 0
    let draftAmount = 0
    let finalizedCount = 0
    let finalizedAmount = 0

    const outletGroups = new Map<string, {
      outletId: string
      outletName: string
      staffCount: number
      totalSalary: number
      basicSalary: number
      draftCount: number
      finalizedCount: number
    }>()

    filtered.forEach(r => {
      const amt = Number(r.total_salary || 0)
      const bSalary = Number(r.basic_salary || 0)
      const bBonus = Number(r.bonus || 0)
      const bDeductions = Number(r.deductions || 0)
      const bAllowances =
        Number(r.allowance_meal || r.allowance_presence || 0) +
        Number(r.allowance_transport || 0) +
        Number(r.allowance_communication || 0) +
        Number(r.allowance_position || 0)

      totalSalary += amt
      basicSalary += bSalary
      allowances += bAllowances
      bonus += bBonus
      deductions += bDeductions

      if (r.status === 'finalized') {
        finalizedCount++
        finalizedAmount += amt
      } else {
        draftCount++
        draftAmount += amt
      }

      const staffRaw: any = r.outlet_staff
      const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
      const staffOutletId = staffInfo?.outlet_id
      const isPusat = !staffOutletId || staffOutletId === 'ffffffff-ffff-ffff-ffff-ffffffffffff'
      const groupKey = isPusat ? 'PUSAT' : staffOutletId
      const outletName = isPusat ? 'Kantor Pusat' : (outletNameMap.get(staffOutletId) || 'Outlet')

      let group = outletGroups.get(groupKey)
      if (!group) {
        group = {
          outletId: groupKey,
          outletName,
          staffCount: 0,
          totalSalary: 0,
          basicSalary: 0,
          draftCount: 0,
          finalizedCount: 0
        }
        outletGroups.set(groupKey, group)
      }
      group.staffCount++
      group.totalSalary += amt
      group.basicSalary += bSalary
      if (r.status === 'finalized') {
        group.finalizedCount++
      } else {
        group.draftCount++
      }
    })

    const outletsSummary: HRPayrollOutletSummary[] = Array.from(outletGroups.values()).map(g => ({
      ...g,
      status: (g.finalizedCount > 0 && g.draftCount === 0
        ? 'finalized'
        : g.draftCount > 0 && g.finalizedCount === 0
        ? 'draft'
        : g.draftCount > 0 && g.finalizedCount > 0
        ? 'partial'
        : 'empty') as 'draft' | 'finalized' | 'partial' | 'empty'
    })).sort((a, b) => b.totalSalary - a.totalSalary)

    let status: 'draft' | 'finalized' | 'partial' | 'empty' = 'empty'
    if (filtered.length > 0) {
      if (finalizedCount > 0 && draftCount === 0) {
        status = 'finalized'
      } else if (draftCount > 0 && finalizedCount === 0) {
        status = 'draft'
      } else if (draftCount > 0 && finalizedCount > 0) {
        status = 'partial'
      }
    }

    return {
      totalSalary,
      totalStaff: filtered.length,
      basicSalary,
      allowances,
      bonus,
      deductions,
      draftCount,
      draftAmount,
      finalizedCount,
      finalizedAmount,
      status,
      outlets: outletsSummary
    }
  } catch (err: any) {
    console.error('Failed to get HR payroll summary:', err)
    return {
      totalSalary: 0,
      totalStaff: 0,
      basicSalary: 0,
      allowances: 0,
      bonus: 0,
      deductions: 0,
      draftCount: 0,
      draftAmount: 0,
      finalizedCount: 0,
      finalizedAmount: 0,
      status: 'empty',
      outlets: []
    }
  }
}
