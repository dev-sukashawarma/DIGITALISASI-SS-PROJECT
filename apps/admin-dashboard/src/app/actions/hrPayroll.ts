'use server'

import { createClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

export interface HRPayrollSummary {
  totalSalary: number
  totalStaff: number
  draftCount: number
  draftAmount: number
  finalizedCount: number
  finalizedAmount: number
  status: 'draft' | 'finalized' | 'partial' | 'empty'
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
        draftCount: 0,
        draftAmount: 0,
        finalizedCount: 0,
        finalizedAmount: 0,
        status: 'empty'
      }
    }

    const years = [...new Set(periods.map(p => p.year))]
    const months = [...new Set(periods.map(p => p.month))]

    const { data, error } = await supabase
      .from('payroll_records')
      .select('id, period_month, period_year, total_salary, status, staff_id, outlet_staff:staff_id(id, name, outlet_id, role)')
      .in('period_year', years)
      .in('period_month', months)

    if (error) {
      console.error('Error fetching payroll_records for HR summary:', error)
      throw error
    }

    const rows = data || []
    // Filter matching exact period objects (month & year)
    const matchingPeriodRows = rows.filter(r =>
      periods.some(p => p.month === r.period_month && p.year === r.period_year)
    )

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

    let totalSalary = 0
    let draftCount = 0
    let draftAmount = 0
    let finalizedCount = 0
    let finalizedAmount = 0

    filtered.forEach(r => {
      const amt = Number(r.total_salary || 0)
      totalSalary += amt
      if (r.status === 'finalized') {
        finalizedCount++
        finalizedAmount += amt
      } else {
        draftCount++
        draftAmount += amt
      }
    })

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
      draftCount,
      draftAmount,
      finalizedCount,
      finalizedAmount,
      status
    }
  } catch (err: any) {
    console.error('Failed to get HR payroll summary:', err)
    return {
      totalSalary: 0,
      totalStaff: 0,
      draftCount: 0,
      draftAmount: 0,
      finalizedCount: 0,
      finalizedAmount: 0,
      status: 'empty'
    }
  }
}
