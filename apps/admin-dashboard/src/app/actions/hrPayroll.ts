'use server'

import { createClient } from '@supabase/supabase-js'
import { isTestOrDevStaff } from '@/lib/staffFilters'
import { isExcludedOutlet } from '@/lib/outletFilters'
import { distributeEqualSplit } from '@/lib/opexProrata'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

export interface ManagerAllocationDetail {
  staffId: string
  staffName: string
  role: 'area_manager' | 'regional_manager'
  totalSalary: number
  allocatedAmount: number
  coachedOutletsCount: number
  status: 'draft' | 'finalized'
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
  crewSalary?: number
  managerAllocation?: number
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
  crewSalary?: number
  crewCount?: number
  crewBasicSalary?: number
  crewAllowances?: number
  crewBonus?: number
  crewDeductions?: number
  managerAllocation?: number
  managerDetails?: ManagerAllocationDetail[]
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

    // Parallel fetch: payroll records, outlet master, and manager outlet assignments
    const [{ data: payrollData, error: payrollError }, { data: outletData }, { data: assignmentData }] =
      await Promise.all([
        supabase
          .from('payroll_records')
          .select('id, period_month, period_year, outlet_id, basic_salary, allowance_meal, allowance_transport, allowance_communication, allowance_presence, allowance_position, bonus, deductions, total_salary, status, staff_id, outlet_staff:staff_id(id, name, username, outlet_id, role, account_category, email)')
          .in('period_year', years)
          .in('period_month', months),
        supabase.from('outlets').select('id, name, is_active'),
        supabase
          .from('staff_outlets')
          .select('staff_id, outlet_id, outlet_staff!inner(id, role, is_active)')
          .in('outlet_staff.role', ['area_manager', 'regional_manager'])
          .eq('outlet_staff.is_active', true)
      ])

    if (payrollError) {
      console.error('Error fetching payroll_records for HR summary:', payrollError)
      throw payrollError
    }

    const rows = payrollData || []
    // Filter matching exact period objects (month & year) and exclude test/bot/mitra accounts
    const matchingPeriodRows = rows.filter(r => {
      const inPeriod = periods.some(p => p.month === r.period_month && p.year === r.period_year)
      if (!inPeriod) return false
      const staffRaw: any = r.outlet_staff
      const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
      return !isTestOrDevStaff(staffInfo)
    })

    const outletsWithNonZeroPayroll = new Set(
      matchingPeriodRows
        .filter(r => Number(r.total_salary || 0) > 0 && r.outlet_id)
        .map(r => r.outlet_id!)
    )

    // 1. Build outlet mapping and operational outlet set
    const outletNameMap = new Map<string, string>()
    const operationalOutletIds: string[] = []
    ;(outletData || []).forEach((o: any) => {
      outletNameMap.set(o.id, o.name)
      if (!isExcludedOutlet(o) && (o.is_active !== false || outletsWithNonZeroPayroll.has(o.id))) {
        operationalOutletIds.push(o.id)
      }
    })

    // 2. Build manager assignment mapping (staff_id -> outlet_id[])
    const managerAssignmentsMap = new Map<string, string[]>()
    ;(assignmentData || []).forEach((a: any) => {
      if (!managerAssignmentsMap.has(a.staff_id)) {
        managerAssignmentsMap.set(a.staff_id, [])
      }
      managerAssignmentsMap.get(a.staff_id)!.push(a.outlet_id)
    })

    // Separate Store Crew from Managers (Area Manager & Regional Manager)
    const crewRows: typeof matchingPeriodRows = []
    const managerRows: typeof matchingPeriodRows = []

    matchingPeriodRows.forEach(r => {
      const staffRaw: any = r.outlet_staff
      const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
      const role = staffInfo?.role
      if (role === 'area_manager' || role === 'regional_manager') {
        managerRows.push(r)
      } else {
        crewRows.push(r)
      }
    })

    // 3. Compute Manager Allocations across their coached outlets
    // outletId -> { basicSalary, allowances, bonus, deductions, totalSalary, details: ManagerAllocationDetail[] }
    const outletManagerAllocations = new Map<string, {
      basicSalary: number
      allowances: number
      bonus: number
      deductions: number
      totalSalary: number
      details: ManagerAllocationDetail[]
    }>()

    operationalOutletIds.forEach(id => {
      outletManagerAllocations.set(id, {
        basicSalary: 0,
        allowances: 0,
        bonus: 0,
        deductions: 0,
        totalSalary: 0,
        details: []
      })
    })

    managerRows.forEach(m => {
      const staffRaw: any = m.outlet_staff
      const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
      const role = (staffInfo?.role || 'area_manager') as 'area_manager' | 'regional_manager'
      const name = staffInfo?.name || (role === 'regional_manager' ? 'Regional Manager' : 'Area Manager')

      const bSalary = Number(m.basic_salary || 0)
      const bAllowances =
        Number(m.allowance_meal || m.allowance_presence || 0) +
        Number(m.allowance_transport || 0) +
        Number(m.allowance_communication || 0) +
        Number(m.allowance_position || 0)
      const bBonus = Number(m.bonus || 0)
      const bDeductions = Number(m.deductions || 0)
      const mTotal = Number(m.total_salary || 0)

      let targets: string[] = []
      if (role === 'regional_manager') {
        targets = operationalOutletIds
      } else {
        const assigned = managerAssignmentsMap.get(m.staff_id) || []
        targets = assigned.filter(id => operationalOutletIds.includes(id))
        if (targets.length === 0) {
          targets = (m.outlet_id && operationalOutletIds.includes(m.outlet_id))
            ? [m.outlet_id]
            : operationalOutletIds
        }
      }

      if (targets.length === 0) return

      const gSplit = distributeEqualSplit(bSalary, targets)
      const aSplit = distributeEqualSplit(bAllowances, targets)
      const bonSplit = distributeEqualSplit(bBonus, targets)
      const dedSplit = distributeEqualSplit(bDeductions, targets)

      targets.forEach(tId => {
        const g = gSplit.get(tId) || 0
        const a = aSplit.get(tId) || 0
        const bon = bonSplit.get(tId) || 0
        const ded = dedSplit.get(tId) || 0
        const tot = g + a + bon - ded

        let alloc = outletManagerAllocations.get(tId)
        if (!alloc) {
          alloc = { basicSalary: 0, allowances: 0, bonus: 0, deductions: 0, totalSalary: 0, details: [] }
          outletManagerAllocations.set(tId, alloc)
        }
        alloc.basicSalary += g
        alloc.allowances += a
        alloc.bonus += bon
        alloc.deductions += ded
        alloc.totalSalary += tot
        alloc.details.push({
          staffId: m.staff_id,
          staffName: name,
          role,
          totalSalary: mTotal,
          allocatedAmount: tot,
          coachedOutletsCount: targets.length,
          status: m.status === 'finalized' ? 'finalized' : 'draft'
        })
      })
    })

    // 4. Group data per outlet for breakdown list
    const outletGroups = new Map<string, {
      outletId: string
      outletName: string
      staffCount: number
      crewSalary: number
      managerAllocation: number
      totalSalary: number
      basicSalary: number
      draftCount: number
      finalizedCount: number
    }>()

    // Aggregate crew rows into outletGroups
    crewRows.forEach(r => {
      const amt = Number(r.total_salary || 0)
      const bSalary = Number(r.basic_salary || 0)
      const staffRaw: any = r.outlet_staff
      const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
      const staffOutletId = r.outlet_id || staffInfo?.outlet_id
      const isPusat = !staffOutletId || staffOutletId === 'ffffffff-ffff-ffff-ffff-ffffffffffff'
      const groupKey = isPusat ? 'PUSAT' : staffOutletId
      const outletName = isPusat ? 'Kantor Pusat' : (outletNameMap.get(staffOutletId) || 'Outlet')

      let group = outletGroups.get(groupKey)
      if (!group) {
        group = {
          outletId: groupKey,
          outletName,
          staffCount: 0,
          crewSalary: 0,
          managerAllocation: 0,
          totalSalary: 0,
          basicSalary: 0,
          draftCount: 0,
          finalizedCount: 0
        }
        outletGroups.set(groupKey, group)
      }
      group.staffCount++
      group.crewSalary += amt
      group.totalSalary += amt
      group.basicSalary += bSalary
      if (r.status === 'finalized') {
        group.finalizedCount++
      } else {
        group.draftCount++
      }
    })

    // Merge allocated manager shares into outletGroups for operational outlets
    for (const [oid, alloc] of outletManagerAllocations.entries()) {
      if (alloc.totalSalary <= 0) continue
      let group = outletGroups.get(oid)
      if (!group) {
        const outletName = outletNameMap.get(oid) || 'Outlet'
        group = {
          outletId: oid,
          outletName,
          staffCount: 0,
          crewSalary: 0,
          managerAllocation: 0,
          totalSalary: 0,
          basicSalary: 0,
          draftCount: 0,
          finalizedCount: 0
        }
        outletGroups.set(oid, group)
      }
      group.managerAllocation += alloc.totalSalary
      group.totalSalary += alloc.totalSalary
      group.basicSalary += alloc.basicSalary
    }

    const target = filter.outletId
    const isSingleOutlet = target !== 'all' && target !== 'PUSAT' && target !== 'ALL_OUTLETS'

    // 5. Build Final Aggregation according to target filter
    if (isSingleOutlet) {
      // Filtered to one specific outlet (e.g. SUKA SHAWARMA EMPANG)
      const empangCrew = crewRows.filter(r => {
        const staffRaw: any = r.outlet_staff
        const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
        const staffOutletId = r.outlet_id || staffInfo?.outlet_id
        return staffOutletId === target
      })

      const mgrAlloc = outletManagerAllocations.get(target) || {
        basicSalary: 0,
        allowances: 0,
        bonus: 0,
        deductions: 0,
        totalSalary: 0,
        details: []
      }

      let crewSalary = 0
      let crewBasicSalary = 0
      let crewAllowances = 0
      let crewBonus = 0
      let crewDeductions = 0
      let finalizedCount = 0
      let draftCount = 0

      empangCrew.forEach(r => {
        const amt = Number(r.total_salary || 0)
        crewSalary += amt
        crewBasicSalary += Number(r.basic_salary || 0)
        crewAllowances +=
          Number(r.allowance_meal || r.allowance_presence || 0) +
          Number(r.allowance_transport || 0) +
          Number(r.allowance_communication || 0) +
          Number(r.allowance_position || 0)
        crewBonus += Number(r.bonus || 0)
        crewDeductions += Number(r.deductions || 0)

        if (r.status === 'finalized') {
          finalizedCount++
        } else {
          draftCount++
        }
      })

      const totalSalary = crewSalary + mgrAlloc.totalSalary
      const basicSalary = crewBasicSalary
      const allowances = crewAllowances
      const bonus = crewBonus
      const deductions = crewDeductions

      let status: 'draft' | 'finalized' | 'partial' | 'empty' = 'empty'
      if (empangCrew.length > 0) {
        if (finalizedCount > 0 && draftCount === 0) status = 'finalized'
        else if (draftCount > 0 && finalizedCount === 0) status = 'draft'
        else if (draftCount > 0 && finalizedCount > 0) status = 'partial'
      }

      const singleGroup = outletGroups.get(target)
      const outletsSummary: HRPayrollOutletSummary[] = singleGroup ? [{
        ...singleGroup,
        status: (singleGroup.finalizedCount > 0 && singleGroup.draftCount === 0
          ? 'finalized'
          : singleGroup.draftCount > 0 && singleGroup.finalizedCount === 0
          ? 'draft'
          : singleGroup.draftCount > 0 && singleGroup.finalizedCount > 0
          ? 'partial'
          : 'empty') as 'draft' | 'finalized' | 'partial' | 'empty'
      }] : []

      return {
        totalSalary,
        totalStaff: empangCrew.length,
        basicSalary,
        allowances,
        bonus,
        deductions,
        draftCount,
        draftAmount: draftCount > 0 ? (crewSalary - empangCrew.filter(r => r.status === 'finalized').reduce((s, r) => s + Number(r.total_salary || 0), 0)) : 0,
        finalizedCount,
        finalizedAmount: empangCrew.filter(r => r.status === 'finalized').reduce((s, r) => s + Number(r.total_salary || 0), 0),
        status,
        outlets: outletsSummary,
        crewSalary,
        crewCount: empangCrew.length,
        crewBasicSalary,
        crewAllowances,
        crewBonus,
        crewDeductions,
        managerAllocation: mgrAlloc.totalSalary,
        managerDetails: mgrAlloc.details
      }
    }

    // Target is 'all', 'ALL_OUTLETS', or 'PUSAT'
    let relevantGroups: typeof outletGroups
    if (target === 'PUSAT') {
      relevantGroups = new Map()
      const pusatGroup = outletGroups.get('PUSAT')
      if (pusatGroup) relevantGroups.set('PUSAT', pusatGroup)
    } else if (target === 'ALL_OUTLETS') {
      relevantGroups = new Map()
      for (const [k, v] of outletGroups.entries()) {
        if (k !== 'PUSAT') relevantGroups.set(k, v)
      }
    } else {
      relevantGroups = outletGroups
    }

    let totalSalary = 0
    let basicSalary = 0
    let allowances = 0
    let bonus = 0
    let deductions = 0
    let draftCount = 0
    let draftAmount = 0
    let finalizedCount = 0
    let finalizedAmount = 0
    let totalStaff = 0

    // Filter crew rows matching target
    const targetCrewRows = crewRows.filter(r => {
      const staffRaw: any = r.outlet_staff
      const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
      const staffOutletId = r.outlet_id || staffInfo?.outlet_id
      const isPusat = !staffOutletId || staffOutletId === 'ffffffff-ffff-ffff-ffff-ffffffffffff'

      if (target === 'PUSAT') return isPusat
      if (target === 'ALL_OUTLETS') return !isPusat
      return true
    })

    targetCrewRows.forEach(r => {
      const amt = Number(r.total_salary || 0)
      totalSalary += amt
      basicSalary += Number(r.basic_salary || 0)
      allowances +=
        Number(r.allowance_meal || r.allowance_presence || 0) +
        Number(r.allowance_transport || 0) +
        Number(r.allowance_communication || 0) +
        Number(r.allowance_position || 0)
      bonus += Number(r.bonus || 0)
      deductions += Number(r.deductions || 0)
      totalStaff++

      if (r.status === 'finalized') {
        finalizedCount++
        finalizedAmount += amt
      } else {
        draftCount++
        draftAmount += amt
      }
    })

    // If target includes operational outlets, include manager rows
    if (target !== 'PUSAT') {
      managerRows.forEach(m => {
        const amt = Number(m.total_salary || 0)
        totalSalary += amt
        basicSalary += Number(m.basic_salary || 0)
        allowances +=
          Number(m.allowance_meal || m.allowance_presence || 0) +
          Number(m.allowance_transport || 0) +
          Number(m.allowance_communication || 0) +
          Number(m.allowance_position || 0)
        bonus += Number(m.bonus || 0)
        deductions += Number(m.deductions || 0)
        totalStaff++

        if (m.status === 'finalized') {
          finalizedCount++
          finalizedAmount += amt
        } else {
          draftCount++
          draftAmount += amt
        }
      })
    }

    const outletsSummary: HRPayrollOutletSummary[] = Array.from(relevantGroups.values()).map(g => ({
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
    if (totalStaff > 0) {
      if (finalizedCount > 0 && draftCount === 0) status = 'finalized'
      else if (draftCount > 0 && finalizedCount === 0) status = 'draft'
      else if (draftCount > 0 && finalizedCount > 0) status = 'partial'
    }

    return {
      totalSalary,
      totalStaff,
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
