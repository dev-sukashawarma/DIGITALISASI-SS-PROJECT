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
  role: 'area_manager' | 'regional_manager' | 'stock_controller'
  totalSalary: number
  allocatedAmount: number
  routineAmount?: number
  bonusAmount?: number
  basicSalary?: number
  allowances?: number
  deductions?: number
  allocatedBasicSalary?: number
  allocatedAllowances?: number
  allocatedDeductions?: number
  coachedOutletsCount: number
  totalPcs?: number
  status: 'draft' | 'finalized'
}

export interface StaffBonusDetail {
  staffId: string
  staffName: string
  role?: string
  subRole?: string | null
  contractType?: string | null
  isBackup?: boolean
  backupDates?: string[]
  backupDatesFormatted?: string
  backupNote?: string
  outletName?: string
  bonus: number
  totalPcs?: number
  status: 'draft' | 'finalized'
}

export interface StaffPayrollDetail {
  staffId: string
  staffName: string
  role: string
  contractType?: string | null
  subRole?: string | null
  onboardingStage?: string | null
  outletId?: string
  outletName?: string
  basicSalary: number
  allowances: number
  bonus: number
  deductions: number
  routineSalary: number
  totalSalary: number
  status: 'draft' | 'finalized'
  isManagerAllocation?: boolean
  allocatedAmount?: number
  allocationNote?: string
  isBackupAllocation?: boolean
  backupOutletsCount?: number
  fullRoutineSalary?: number
  fullBasicSalary?: number
  fullAllowances?: number
  fullDeductions?: number
  allocatedOutletNames?: string[]
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
  managerRoutineAllocation?: number
  managerBonusAllocation?: number
  bonus?: number
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
  crewRegularCount?: number
  crewBackupCount?: number
  crewTraineeCount?: number
  crewOjtCount?: number
  crewBasicSalary?: number
  crewAllowances?: number
  crewBonus?: number
  crewDeductions?: number
  managerAllocation?: number
  managerRoutineAllocation?: number
  managerBonusAllocation?: number
  managerBasicSalaryAllocation?: number
  managerAllowancesAllocation?: number
  managerDeductionsAllocation?: number
  managerDetails?: ManagerAllocationDetail[]
  bonusDetails?: StaffBonusDetail[]
  crewBonusDetails?: StaffBonusDetail[]
  managerBonusDetails?: StaffBonusDetail[]
  staffDetails?: StaffPayrollDetail[]
}

function formatBackupDatesSummary(dates: string[]): string {
  if (!dates || dates.length === 0) return ''
  const sorted = Array.from(new Set(dates)).sort()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const byMonth = new Map<string, number[]>()
  sorted.forEach(d => {
    const parts = d.split('-').map(Number)
    if (parts.length >= 3) {
      const [, m, day] = parts
      const key = `${months[m - 1]}`
      if (!byMonth.has(key)) byMonth.set(key, [])
      byMonth.get(key)!.push(day)
    }
  })
  const res: string[] = []
  byMonth.forEach((days, m) => {
    res.push(`${days.join(', ')} ${m}`)
  })
  return res.join('; ')
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
        outlets: [],
        crewCount: 0,
        crewRegularCount: 0,
        crewBackupCount: 0,
        crewTraineeCount: 0,
        crewOjtCount: 0
      }
    }

    const years = [...new Set(periods.map(p => p.year))]
    const months = [...new Set(periods.map(p => p.month))]

    // Parallel fetch: payroll records, outlet master, and manager outlet assignments
    const [{ data: payrollData, error: payrollError }, { data: outletData }, { data: assignmentData }] =
      await Promise.all([
        supabase
          .from('payroll_records')
          .select('id, period_month, period_year, outlet_id, basic_salary, allowance_meal, allowance_transport, allowance_communication, allowance_presence, allowance_position, bonus, deductions, total_salary, status, staff_id, outlet_staff:staff_id(id, name, username, outlet_id, role, account_category, email, contract_type, sub_role, onboarding_stage)')
          .in('period_year', years)
          .in('period_month', months),
        supabase.from('outlets').select('id, name, slug, is_active, status'),
        supabase
          .from('staff_outlets')
          .select('staff_id, outlet_id, outlet_staff!inner(id, role, is_active)')
          .eq('outlet_staff.is_active', true)
      ])

    if (payrollError) {
      console.error('Error fetching payroll_records for HR summary:', payrollError)
      throw payrollError
    }

    const rows = payrollData || []
    // Filter matching exact period objects (month & year) and exclude test/bot/mitra accounts
    let matchingPeriodRows: any[] = rows.filter(r => {
      const inPeriod = periods.some(p => p.month === r.period_month && p.year === r.period_year)
      if (!inPeriod) return false
      const staffRaw: any = r.outlet_staff
      const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
      return !isTestOrDevStaff(staffInfo)
    })

    // Query MTD bonus and pcs for each period (Crew, AM, and RM)
    const bonusMap = new Map<string, number>()
    const pcsMap = new Map<string, number>()
    const allCrewBonusRpcRows: any[] = []

    // Map: `${staff_id}_${outlet_id}` -> Set of dates ('YYYY-MM-DD')
    const staffOutletAttendanceDates = new Map<string, Set<string>>()
    // Map: staff_id -> Map<outlet_id, Set<string>>
    const staffAllOutletsAttendance = new Map<string, Map<string, Set<string>>>()

    for (const p of periods) {
      try {
        const [crewRes, amRes, rmRes, attRes, logsRes] = await Promise.all([
          supabase.rpc('get_monthly_crew_bonus', {
            p_month: p.month,
            p_year: p.year,
            p_outlet_id: null
          }),
          supabase.rpc('get_monthly_am_bonus', {
            p_month: p.month,
            p_year: p.year
          }),
          supabase.rpc('get_monthly_rm_bonus', {
            p_month: p.month,
            p_year: p.year
          }),
          supabase
            .from('attendance')
            .select('outlet_staff_id, outlet_id, ts_server')
            .gte('ts_server', `${filter.from}T00:00:00+07:00`)
            .lte('ts_server', `${filter.to}T23:59:59+07:00`)
            .in('type', ['in', 'masuk']),
          supabase
            .from('attendance_logs')
            .select('staff_id, outlet_id, date')
            .gte('date', filter.from)
            .lte('date', filter.to)
            .eq('status', 'hadir')
        ])

        if (crewRes.data && Array.isArray(crewRes.data)) {
          allCrewBonusRpcRows.push(...crewRes.data)
          crewRes.data.forEach((b: any) => {
            if (b.crew_id) {
              const prev = bonusMap.get(b.crew_id) || 0
              bonusMap.set(b.crew_id, prev + (Number(b.total_bonus) || 0))
              pcsMap.set(b.crew_id, (pcsMap.get(b.crew_id) || 0) + (Number(b.total_pcs_outlet) || 0))
            }
          })
        }

        if (attRes.data && Array.isArray(attRes.data)) {
          attRes.data.forEach((a: any) => {
            const date = a.ts_server ? String(a.ts_server).slice(0, 10) : ''
            if (!date || !a.outlet_staff_id) return
            const k = `${a.outlet_staff_id}_${a.outlet_id}`
            if (!staffOutletAttendanceDates.has(k)) staffOutletAttendanceDates.set(k, new Set())
            staffOutletAttendanceDates.get(k)!.add(date)

            if (!staffAllOutletsAttendance.has(a.outlet_staff_id)) staffAllOutletsAttendance.set(a.outlet_staff_id, new Map())
            const m = staffAllOutletsAttendance.get(a.outlet_staff_id)!
            if (!m.has(a.outlet_id)) m.set(a.outlet_id, new Set())
            m.get(a.outlet_id)!.add(date)
          })
        }

        if (logsRes.data && Array.isArray(logsRes.data)) {
          logsRes.data.forEach((l: any) => {
            const date = l.date ? String(l.date).slice(0, 10) : ''
            if (!date || !l.staff_id) return
            const k = `${l.staff_id}_${l.outlet_id}`
            if (!staffOutletAttendanceDates.has(k)) staffOutletAttendanceDates.set(k, new Set())
            staffOutletAttendanceDates.get(k)!.add(date)

            if (!staffAllOutletsAttendance.has(l.staff_id)) staffAllOutletsAttendance.set(l.staff_id, new Map())
            const m = staffAllOutletsAttendance.get(l.staff_id)!
            if (!m.has(l.outlet_id)) m.set(l.outlet_id, new Set())
            m.get(l.outlet_id)!.add(date)
          })
        }

        if (amRes.data && Array.isArray(amRes.data)) {
          amRes.data.forEach((b: any) => {
            if (b.staff_id) {
              const prev = bonusMap.get(b.staff_id) || 0
              bonusMap.set(b.staff_id, prev + (Number(b.total_bonus) || 0))
              pcsMap.set(b.staff_id, (pcsMap.get(b.staff_id) || 0) + (Number(b.total_pcs) || 0))
            }
          })
        }

        if (rmRes.data && Array.isArray(rmRes.data)) {
          rmRes.data.forEach((b: any) => {
            if (b.staff_id) {
              const prev = bonusMap.get(b.staff_id) || 0
              bonusMap.set(b.staff_id, prev + (Number(b.total_bonus) || 0))
              pcsMap.set(b.staff_id, (pcsMap.get(b.staff_id) || 0) + (Number(b.total_pcs_global) || 0))
            }
          })
        }
      } catch (err) {
        console.warn('Fallback bonus RPC error:', err)
      }
    }

    // Fallback: If no payroll slips have been generated for the requested period(s) (e.g. running current month),
    // build draft rows from active staff master data (outlet_staff + staff_financials) and MTD crew bonus RPC.
    if (matchingPeriodRows.length === 0 && periods.length > 0) {
      const { data: activeStaffData } = await supabase
        .from('outlet_staff')
        .select(`
          id,
          name,
          username,
          outlet_id,
          role,
          status,
          account_category,
          email,
          contract_type,
          sub_role,
          onboarding_stage,
          staff_financials(
            basic_salary,
            allowance_position,
            allowance_presence,
            allowance_meal,
            allowance_transport,
            allowance_communication,
            sales_bonus,
            deduction_kasbon,
            deduction_bpjs
          )
        `)
        .eq('status', 'active')
        .in('role', ['crew', 'leader', 'kasir', 'kitchen', 'driver', 'area_manager', 'regional_manager', 'stock_controller'])

      const activeStaffList = (activeStaffData || []).filter(s => !isTestOrDevStaff(s))
      const targetPeriod = periods[0]

      matchingPeriodRows = activeStaffList.map(s => {
        const finRaw = Array.isArray(s.staff_financials) ? s.staff_financials[0] : s.staff_financials
        const bSalary = Number(finRaw?.basic_salary || 0)
        const aMeal = Number(finRaw?.allowance_meal || 0)
        const aTransport = Number(finRaw?.allowance_transport || 0)
        const aComm = Number(finRaw?.allowance_communication || 0)
        const aPres = Number(finRaw?.allowance_presence || 0)
        const aPos = Number(finRaw?.allowance_position || 0)
        const deductions = Number(finRaw?.deduction_kasbon || 0) + Number(finRaw?.deduction_bpjs || 0)
        const rpcBonus = bonusMap.get(s.id) || 0
        const bBonus = rpcBonus > 0 ? rpcBonus : Number(finRaw?.sales_bonus || 0)
        const total = bSalary + aMeal + aTransport + aComm + aPres + aPos + bBonus - deductions

        return {
          id: `draft-${s.id}`,
          period_month: targetPeriod.month,
          period_year: targetPeriod.year,
          outlet_id: s.outlet_id,
          basic_salary: bSalary,
          allowance_meal: aMeal,
          allowance_transport: aTransport,
          allowance_communication: aComm,
          allowance_presence: aPres,
          allowance_position: aPos,
          bonus: bBonus,
          total_pcs: pcsMap.get(s.id) || (bBonus > 0 ? (s.role === 'area_manager' || s.role === 'regional_manager' ? Math.round(bBonus / 50) : Math.round(bBonus / 100)) : 0),
          deductions,
          total_salary: total,
          status: 'draft' as const,
          staff_id: s.id,
          outlet_staff: {
            id: s.id,
            name: s.name,
            username: s.username,
            outlet_id: s.outlet_id,
            role: s.role,
            account_category: s.account_category,
            email: s.email,
            contract_type: s.contract_type,
            sub_role: s.sub_role,
            onboarding_stage: s.onboarding_stage
          }
        }
      })
    }

    // 1. Build outlet mapping and operational retail outlet set
    // An outlet is an operational retail branch if it's active and not an excluded virtual/warehouse entity
    const outletNameMap = new Map<string, string>()
    const operationalOutletIds: string[] = []
    ;(outletData || []).forEach((o: any) => {
      outletNameMap.set(o.id, o.name)
      if (isExcludedOutlet(o)) return
      if (o.slug === 'sawangan-depok-internal') return
      const isOperational = (o.is_active === true || o.is_active !== false) && (o.status === 'active' || !o.status)
      if (isOperational) {
        operationalOutletIds.push(o.id)
      }
    })

    // 2. Build staff assignment mapping (staff_id -> outlet_id[]) from staff_outlets
    const staffAssignmentsMap = new Map<string, string[]>()
    ;(assignmentData || []).forEach((a: any) => {
      if (!staffAssignmentsMap.has(a.staff_id)) {
        staffAssignmentsMap.set(a.staff_id, [])
      }
      staffAssignmentsMap.get(a.staff_id)!.push(a.outlet_id)
    })
    const managerAssignmentsMap = staffAssignmentsMap

    // Helper: Determine target outlets for a crew member (backup split vs single home outlet)
    function getCrewBackupTargets(
      staffId: string,
      homeOutletId: string | undefined | null,
      isBackup: boolean
    ): string[] {
      if (!isBackup) {
        return homeOutletId ? [homeOutletId] : []
      }
      const assigned = staffAssignmentsMap.get(staffId) || []
      const set = new Set<string>()
      if (homeOutletId && operationalOutletIds.includes(homeOutletId)) {
        set.add(homeOutletId)
      }
      assigned.forEach(id => {
        if (operationalOutletIds.includes(id)) {
          set.add(id)
        }
      })
      if (set.size === 0 && homeOutletId) {
        set.add(homeOutletId)
      }
      return Array.from(set)
    }

    // Separate Store Crew from Managers (Area Manager, Regional Manager) & Central Overhead (Stock Controller)
    const crewRows: typeof matchingPeriodRows = []
    const managerRows: typeof matchingPeriodRows = []

    matchingPeriodRows.forEach(r => {
      const staffRaw: any = r.outlet_staff
      const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
      const role = staffInfo?.role
      const name = (staffInfo?.name || '').toLowerCase()
      const isStockController = name.includes('abyansah') || role === 'stock_controller'

      if (role === 'area_manager' || role === 'regional_manager' || isStockController) {
        managerRows.push(r)
      } else {
        crewRows.push(r)
      }
    })

    // 3. Compute Manager & Stock Controller Allocations across target outlets
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
      const isStockController = (staffInfo?.name || '').toLowerCase().includes('abyansah') || staffInfo?.role === 'stock_controller'
      const role: 'area_manager' | 'regional_manager' | 'stock_controller' = isStockController
        ? 'stock_controller'
        : (staffInfo?.role || 'area_manager')
      const name = staffInfo?.name || (role === 'regional_manager' ? 'Regional Manager' : role === 'stock_controller' ? 'Stock Controller' : 'Area Manager')

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
      if (role === 'regional_manager' || role === 'stock_controller') {
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
        const routineTot = g + a - ded

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
          routineAmount: routineTot,
          bonusAmount: bon,
          basicSalary: bSalary,
          allowances: bAllowances,
          deductions: bDeductions,
          allocatedBasicSalary: g,
          allocatedAllowances: a,
          allocatedDeductions: ded,
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
      managerRoutineAllocation?: number
      managerBonusAllocation?: number
      totalSalary: number
      basicSalary: number
      bonus: number
      draftCount: number
      finalizedCount: number
    }>()

    // Aggregate crew rows into outletGroups
    crewRows.forEach(r => {
      const bSalary = Number(r.basic_salary || 0)
      const bAllowances =
        Number(r.allowance_meal || r.allowance_presence || 0) +
        Number(r.allowance_transport || 0) +
        Number(r.allowance_communication || 0) +
        Number(r.allowance_position || 0)
      const bBonus = Number(r.bonus || 0)
      const bDeductions = Number(r.deductions || 0)
      const totSalary = Number(r.total_salary || 0)

      const staffRaw: any = r.outlet_staff
      const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
      const staffOutletId = r.outlet_id || staffInfo?.outlet_id
      const isPusat = !staffOutletId || staffOutletId === 'ffffffff-ffff-ffff-ffff-ffffffffffff'

      const contractType = staffInfo?.contract_type || (r as any).contract_type || null
      const subRole = staffInfo?.sub_role || (r as any).sub_role || null
      const isBackup = contractType === 'daily' || subRole === 'crew_backup'

      const targets = isPusat ? ['PUSAT'] : getCrewBackupTargets(r.staff_id, staffOutletId, isBackup)

      if (targets.length <= 1) {
        const groupKey = isPusat ? 'PUSAT' : (targets[0] || staffOutletId || 'PUSAT')
        const outletName = isPusat ? 'Kantor Pusat' : (outletNameMap.get(groupKey) || 'Outlet')

        let group = outletGroups.get(groupKey)
        if (!group) {
          group = {
            outletId: groupKey,
            outletName,
            staffCount: 0,
            crewSalary: 0,
            managerAllocation: 0,
            managerRoutineAllocation: 0,
            managerBonusAllocation: 0,
            totalSalary: 0,
            basicSalary: 0,
            bonus: 0,
            draftCount: 0,
            finalizedCount: 0
          }
          outletGroups.set(groupKey, group)
        }
        group.staffCount++
        group.crewSalary += totSalary
        group.totalSalary += totSalary
        group.basicSalary += bSalary
        group.bonus += bBonus
        if (r.status === 'finalized') {
          group.finalizedCount++
        } else {
          group.draftCount++
        }
      } else {
        // Backup crew assigned to multiple outlets: split routine components equally
        const gSplit = distributeEqualSplit(bSalary, targets)
        const aSplit = distributeEqualSplit(bAllowances, targets)
        const dedSplit = distributeEqualSplit(bDeductions, targets)

        targets.forEach(tId => {
          const g = gSplit.get(tId) || 0
          const a = aSplit.get(tId) || 0
          const ded = dedSplit.get(tId) || 0
          const routinePortion = g + a - ded
          const bonusPortion = (tId === staffOutletId) ? bBonus : 0
          const totPortion = routinePortion + bonusPortion

          const outletName = outletNameMap.get(tId) || 'Outlet'
          let group = outletGroups.get(tId)
          if (!group) {
            group = {
              outletId: tId,
              outletName,
              staffCount: 0,
              crewSalary: 0,
              managerAllocation: 0,
              managerRoutineAllocation: 0,
              managerBonusAllocation: 0,
              totalSalary: 0,
              basicSalary: 0,
              bonus: 0,
              draftCount: 0,
              finalizedCount: 0
            }
            outletGroups.set(tId, group)
          }
          group.staffCount++
          group.crewSalary += totPortion
          group.totalSalary += totPortion
          group.basicSalary += g
          group.bonus += bonusPortion
          if (r.status === 'finalized') {
            group.finalizedCount++
          } else {
            group.draftCount++
          }
        })
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
          managerRoutineAllocation: 0,
          managerBonusAllocation: 0,
          totalSalary: 0,
          basicSalary: 0,
          bonus: 0,
          draftCount: 0,
          finalizedCount: 0
        }
        outletGroups.set(oid, group)
      }
      const routineAlloc = alloc.basicSalary + alloc.allowances - alloc.deductions
      group.managerAllocation += routineAlloc
      group.managerRoutineAllocation = (group.managerRoutineAllocation || 0) + routineAlloc
      group.managerBonusAllocation = (group.managerBonusAllocation || 0) + alloc.bonus
      group.totalSalary += alloc.totalSalary
      group.basicSalary += alloc.basicSalary
      group.bonus += alloc.bonus
    }

    const target = filter.outletId
    const isSingleOutlet = target !== 'all' && target !== 'PUSAT' && target !== 'ALL_OUTLETS'

    // 5. Build Final Aggregation according to target filter
    if (isSingleOutlet) {
      // Filtered to one specific outlet (e.g. SUKA SHAWARMA EMPANG or CIBINONG)
      interface ProcessedCrewDetail {
        rawRow: any
        staffId: string
        staffName: string
        role: string
        contractType: string | null
        subRole: string | null
        onboardingStage: string | null
        isBackup: boolean
        isTrainee: boolean
        isOjt: boolean
        isRegular: boolean
        isSplitBackup: boolean
        backupOutletsCount: number
        allocatedBasic: number
        allocatedAllowances: number
        allocatedDeductions: number
        allocatedRoutine: number
        allocatedBonus: number
        allocatedTotal: number
        fullBasic: number
        fullAllowances: number
        fullDeductions: number
        fullRoutine: number
        targets: string[]
        status: 'draft' | 'finalized'
      }

      const outletCrewItems: ProcessedCrewDetail[] = []

      crewRows.forEach(r => {
        const staffRaw: any = r.outlet_staff
        const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
        const staffOutletId = r.outlet_id || staffInfo?.outlet_id

        const contractType = staffInfo?.contract_type || (r as any).contract_type || null
        const subRole = staffInfo?.sub_role || (r as any).sub_role || null
        const onboardingStage = staffInfo?.onboarding_stage || (r as any).onboarding_stage || null

        const isBackup = contractType === 'daily' || subRole === 'crew_backup'
        const isTrainee = contractType === 'probation' || subRole === 'crew_trainee'
        const isOjt = contractType === 'intern' || onboardingStage === 'ojt'
        const isRegular = !isBackup && !isTrainee && !isOjt

        const targets = getCrewBackupTargets(r.staff_id, staffOutletId, isBackup)
        const isHome = staffOutletId === target
        const isAssigned = targets.includes(target)

        if (!isHome && !isAssigned) return

        const bSalary = Number(r.basic_salary || 0)
        const bAllowances =
          Number(r.allowance_meal || r.allowance_presence || 0) +
          Number(r.allowance_transport || 0) +
          Number(r.allowance_communication || 0) +
          Number(r.allowance_position || 0)
        const bBonus = Number(r.bonus || 0)
        const bDeductions = Number(r.deductions || 0)
        const fullRoutine = bSalary + bAllowances - bDeductions

        const isSplit = isBackup && targets.length > 1

        let allocatedBasic = bSalary
        let allocatedAllowances = bAllowances
        let allocatedDeductions = bDeductions
        let allocatedRoutine = fullRoutine
        const bonusAtTarget = (staffOutletId === target) ? bBonus : 0
        let allocatedTotal = fullRoutine + bonusAtTarget

        if (isSplit) {
          const gSplit = distributeEqualSplit(bSalary, targets)
          const aSplit = distributeEqualSplit(bAllowances, targets)
          const dedSplit = distributeEqualSplit(bDeductions, targets)

          allocatedBasic = gSplit.get(target) || 0
          allocatedAllowances = aSplit.get(target) || 0
          allocatedDeductions = dedSplit.get(target) || 0
          allocatedRoutine = allocatedBasic + allocatedAllowances - allocatedDeductions
          allocatedTotal = allocatedRoutine + bonusAtTarget
        }

        outletCrewItems.push({
          rawRow: r,
          staffId: r.staff_id,
          staffName: staffInfo?.name || 'Staff',
          role: staffInfo?.role || 'crew',
          contractType,
          subRole,
          onboardingStage,
          isBackup,
          isTrainee,
          isOjt,
          isRegular,
          isSplitBackup: isSplit,
          backupOutletsCount: targets.length,
          allocatedBasic,
          allocatedAllowances,
          allocatedDeductions,
          allocatedRoutine,
          allocatedBonus: bonusAtTarget,
          allocatedTotal,
          fullBasic: bSalary,
          fullAllowances: bAllowances,
          fullDeductions: bDeductions,
          fullRoutine,
          targets,
          status: r.status === 'finalized' ? 'finalized' : 'draft'
        })
      })

      const mgrAlloc = outletManagerAllocations.get(target) || {
        basicSalary: 0,
        allowances: 0,
        bonus: 0,
        deductions: 0,
        totalSalary: 0,
        details: []
      }

      // Urutan hierarki manajer: Regional Manager (RM) -> Area Manager (AM) -> Stock Controller (SC)
      const getManagerPriority = (role: string = '') => {
        const r = role.toLowerCase()
        if (r === 'regional_manager' || r === 'rm') return 1
        if (r === 'area_manager' || r === 'am') return 2
        if (r === 'stock_controller' || r === 'sc') return 3
        return 4
      }
      mgrAlloc.details.sort((a, b) => getManagerPriority(a.role) - getManagerPriority(b.role))

      let crewSalary = 0
      let crewBasicSalary = 0
      let crewAllowances = 0
      let crewBonus = 0
      let crewDeductions = 0
      let finalizedCount = 0
      let draftCount = 0
      let crewRegularCount = 0
      let crewBackupCount = 0
      let crewTraineeCount = 0
      let crewOjtCount = 0

      outletCrewItems.forEach(item => {
        crewSalary += item.allocatedTotal
        crewBasicSalary += item.allocatedBasic
        crewAllowances += item.allocatedAllowances
        crewBonus += item.allocatedBonus
        crewDeductions += item.allocatedDeductions

        if (item.isBackup) crewBackupCount++
        else if (item.isTrainee) crewTraineeCount++
        else if (item.isOjt) crewOjtCount++
        else crewRegularCount++

        if (item.status === 'finalized') finalizedCount++
        else draftCount++
      })

      const managerRoutineAllocation = mgrAlloc.basicSalary + mgrAlloc.allowances - mgrAlloc.deductions
      const managerBonusAllocation = mgrAlloc.bonus
      const totalSalary = crewSalary + mgrAlloc.totalSalary
      const basicSalary = crewBasicSalary
      const allowances = crewAllowances
      const bonus = crewBonus + mgrAlloc.bonus
      const deductions = crewDeductions

      let status: 'draft' | 'finalized' | 'partial' | 'empty' = 'empty'
      if (outletCrewItems.length > 0) {
        if (finalizedCount > 0 && draftCount === 0) status = 'finalized'
        else if (draftCount > 0 && finalizedCount === 0) status = 'draft'
        else if (draftCount > 0 && finalizedCount > 0) status = 'partial'
      }

      const singleGroup = outletGroups.get(target)
      const outletsSummary: HRPayrollOutletSummary[] = singleGroup ? [{
        ...singleGroup,
        bonus,
        managerAllocation: managerRoutineAllocation,
        managerRoutineAllocation,
        managerBonusAllocation,
        status: (singleGroup.finalizedCount > 0 && singleGroup.draftCount === 0
          ? 'finalized'
          : singleGroup.draftCount > 0 && singleGroup.finalizedCount === 0
          ? 'draft'
          : singleGroup.draftCount > 0 && singleGroup.finalizedCount > 0
          ? 'partial'
          : 'empty') as 'draft' | 'finalized' | 'partial' | 'empty'
      }] : []

      const seenCrewIds = new Set<string>()
      const combinedCrewBonusList: StaffBonusDetail[] = []

      // 1. Crew from outletCrewItems with bonus > 0
      outletCrewItems
        .filter(item => item.allocatedBonus > 0 || Number(item.rawRow.bonus || 0) > 0)
        .forEach(item => {
          const r = item.rawRow
          const staffId = item.staffId
          seenCrewIds.add(staffId)

          const datesAtOutlet = Array.from(staffOutletAttendanceDates.get(`${staffId}_${target}`) || []).sort()
          const backupDatesFormatted = formatBackupDatesSummary(datesAtOutlet)

          let backupNote = ''
          if (item.isBackup) {
            if (datesAtOutlet.length > 0) {
              backupNote = `Tanggal backup di outlet ini: ${backupDatesFormatted} (${datesAtOutlet.length} hari)`
            } else {
              const otherMap = staffAllOutletsAttendance.get(staffId)
              if (otherMap && otherMap.size > 0) {
                const notes: string[] = []
                otherMap.forEach((dSet, oId) => {
                  const oName = outletNameMap.get(oId) || 'Cabang Lain'
                  notes.push(`${oName} (${formatBackupDatesSummary(Array.from(dSet))})`)
                })
                backupNote = `Backup di ${notes.join(', ')}`
              } else {
                backupNote = 'Jadwal backup fleksibel'
              }
            }
          }

          const bonus = item.allocatedBonus > 0 ? item.allocatedBonus : Number(r.bonus || 0)
          combinedCrewBonusList.push({
            staffId,
            staffName: item.staffName,
            role: item.role,
            subRole: item.subRole,
            contractType: item.contractType,
            isBackup: item.isBackup,
            backupDates: datesAtOutlet,
            backupDatesFormatted,
            backupNote,
            outletName: outletNameMap.get(target) || 'Cabang',
            bonus,
            totalPcs: Number((r as any).total_pcs || 0) || Math.round(bonus / 100),
            status: item.status
          })
        })

      // 2. Also include backup crew who worked at target from RPC (e.g. Reno at Cibinong)
      allCrewBonusRpcRows
        .filter(b => b.outlet_id === target && Number(b.total_bonus || 0) > 0)
        .forEach(b => {
          if (seenCrewIds.has(b.crew_id)) return
          seenCrewIds.add(b.crew_id)

          const staffId = b.crew_id
          const subRole = b.sub_role || 'crew_backup'
          const isBackup = true
          const datesAtOutlet = Array.from(staffOutletAttendanceDates.get(`${staffId}_${target}`) || []).sort()
          const backupDatesFormatted = formatBackupDatesSummary(datesAtOutlet)
          const backupNote = datesAtOutlet.length > 0
            ? `Tanggal backup di outlet ini: ${backupDatesFormatted} (${datesAtOutlet.length} hari)`
            : (b.attendance_days ? `Backup ${b.attendance_days} hari` : 'Jadwal backup fleksibel')

          const bonus = Number(b.total_bonus || 0)
          combinedCrewBonusList.push({
            staffId,
            staffName: b.crew_name || 'Staff Backup',
            role: b.role || 'crew',
            subRole,
            isBackup,
            backupDates: datesAtOutlet,
            backupDatesFormatted,
            backupNote,
            outletName: b.outlet_name || outletNameMap.get(target) || 'Cabang',
            bonus,
            totalPcs: Number(b.total_pcs_outlet || 0) || Math.round(bonus / 100),
            status: 'draft'
          })
        })

      const crewBonusDetails = combinedCrewBonusList.sort((a, b) => b.bonus - a.bonus)

      const managerBonusDetails = mgrAlloc.details
        .filter(mgr => (mgr.bonusAmount || 0) > 0 || mgr.role === 'area_manager' || mgr.role === 'regional_manager')
        .map(mgr => ({
          staffId: mgr.staffId,
          staffName: mgr.staffName,
          role: mgr.role,
          outletName: mgr.role === 'area_manager'
            ? 'Rp 50 / pcs (Cabang Binaan)'
            : mgr.role === 'regional_manager'
            ? 'Rp 50 / pcs (Wilayah Regional)'
            : 'Rp 50 / pcs',
          bonus: mgr.bonusAmount || 0,
          totalPcs: Math.round((mgr.bonusAmount || 0) / 50),
          status: mgr.status
        }))
        .sort((a, b) => {
          const diff = getManagerPriority(a.role) - getManagerPriority(b.role)
          if (diff !== 0) return diff
          return b.bonus - a.bonus
        })

      const bonusDetails = [...crewBonusDetails, ...managerBonusDetails].sort((a, b) => b.bonus - a.bonus)

      return {
        totalSalary,
        totalStaff: outletCrewItems.length,
        basicSalary,
        allowances,
        bonus,
        deductions,
        draftCount,
        draftAmount: draftCount > 0 ? (crewSalary - outletCrewItems.filter(i => i.status === 'finalized').reduce((s, i) => s + i.allocatedTotal, 0)) : 0,
        finalizedCount,
        finalizedAmount: outletCrewItems.filter(i => i.status === 'finalized').reduce((s, i) => s + i.allocatedTotal, 0),
        status,
        outlets: outletsSummary,
        crewSalary,
        crewCount: outletCrewItems.length,
        crewRegularCount,
        crewBackupCount,
        crewTraineeCount,
        crewOjtCount,
        crewBasicSalary,
        crewAllowances,
        crewBonus,
        crewDeductions,
        managerAllocation: managerRoutineAllocation,
        managerRoutineAllocation,
        managerBonusAllocation,
        managerBasicSalaryAllocation: mgrAlloc.basicSalary,
        managerAllowancesAllocation: mgrAlloc.allowances,
        managerDeductionsAllocation: mgrAlloc.deductions,
        managerDetails: mgrAlloc.details,
        crewBonusDetails,
        managerBonusDetails,
        bonusDetails,
        staffDetails: [
          ...outletCrewItems.map(item => ({
            staffId: item.staffId,
            staffName: item.staffName,
            role: item.role,
            contractType: item.contractType,
            subRole: item.subRole,
            onboardingStage: item.onboardingStage,
            outletId: target,
            outletName: outletNameMap.get(target) || 'Outlet',
            basicSalary: item.allocatedBasic,
            allowances: item.allocatedAllowances,
            bonus: item.allocatedBonus,
            deductions: item.allocatedDeductions,
            routineSalary: item.allocatedRoutine,
            totalSalary: item.allocatedTotal,
            status: item.status,
            isManagerAllocation: false,
            isBackupAllocation: item.isSplitBackup,
            backupOutletsCount: item.backupOutletsCount,
            fullRoutineSalary: item.fullRoutine,
            fullBasicSalary: item.fullBasic,
            fullAllowances: item.fullAllowances,
            fullDeductions: item.fullDeductions,
            allocatedOutletNames: item.targets.map(id => outletNameMap.get(id) || 'Cabang')
          })),
          ...mgrAlloc.details.map(mgr => {
            const routine = mgr.routineAmount ?? (mgr.allocatedAmount - (mgr.bonusAmount || 0))
            const bonus = mgr.bonusAmount || 0
            return {
              staffId: mgr.staffId,
              staffName: mgr.staffName,
              role: mgr.role,
              outletId: target,
              outletName: outletNameMap.get(target) || 'Outlet',
              basicSalary: mgr.allocatedBasicSalary ?? 0,
              allowances: mgr.allocatedAllowances ?? 0,
              bonus,
              deductions: mgr.allocatedDeductions ?? 0,
              routineSalary: routine,
              totalSalary: mgr.allocatedAmount,
              status: mgr.status,
              isManagerAllocation: true,
              allocatedAmount: mgr.allocatedAmount,
              allocationNote: mgr.role === 'area_manager'
                ? `Alokasi 1/${mgr.coachedOutletsCount} cabang (AM)`
                : mgr.role === 'regional_manager'
                ? `Alokasi 1/${mgr.coachedOutletsCount} cabang (RM)`
                : `Alokasi 1/${mgr.coachedOutletsCount} cabang (Stock Controller)`
            }
          })
        ]
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
    let crewBonus = 0
    let managerBonusAllocation = 0
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
      const b = Number(r.bonus || 0)
      bonus += b
      crewBonus += b
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
        const b = Number(m.bonus || 0)
        bonus += b
        managerBonusAllocation += b
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

    const crewBonusDetails = targetCrewRows
      .filter(r => Number(r.bonus || 0) > 0)
      .map(r => {
        const staffRaw: any = r.outlet_staff
        const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
        const staffOutletId = r.outlet_id || staffInfo?.outlet_id
        const outletName = outletNameMap.get(staffOutletId) || 'Outlet'
        const bonus = Number(r.bonus || 0)
        const staffId = r.staff_id

        const subRole = staffInfo?.sub_role || (r as any).sub_role || null
        const contractType = staffInfo?.contract_type || (r as any).contract_type || null
        const isBackup = subRole === 'crew_backup' || contractType === 'daily'

        const datesAtOutlet = Array.from(staffOutletAttendanceDates.get(`${staffId}_${staffOutletId}`) || []).sort()
        const backupDatesFormatted = formatBackupDatesSummary(datesAtOutlet)

        let backupNote = ''
        if (isBackup) {
          if (datesAtOutlet.length > 0) {
            backupNote = `Tanggal backup: ${backupDatesFormatted} (${datesAtOutlet.length} hari)`
          } else {
            const otherMap = staffAllOutletsAttendance.get(staffId)
            if (otherMap && otherMap.size > 0) {
              const notes: string[] = []
              otherMap.forEach((dSet, oId) => {
                const oName = outletNameMap.get(oId) || 'Cabang Lain'
                notes.push(`${oName} (${formatBackupDatesSummary(Array.from(dSet))})`)
              })
              backupNote = `Backup di ${notes.join(', ')}`
            } else {
              backupNote = 'Jadwal backup fleksibel'
            }
          }
        }

        return {
          staffId,
          staffName: staffInfo?.name || 'Staff',
          role: staffInfo?.role || 'crew',
          subRole,
          contractType,
          isBackup,
          backupDates: datesAtOutlet,
          backupDatesFormatted,
          backupNote,
          outletName,
          bonus,
          totalPcs: Number((r as any).total_pcs || 0) || Math.round(bonus / 100),
          status: (r.status === 'finalized' ? 'finalized' : 'draft') as 'draft' | 'finalized'
        }
      })
      .sort((a, b) => b.bonus - a.bonus)

    const managerBonusDetails = target !== 'PUSAT' ? managerRows
      .filter(m => {
        const staffRaw: any = m.outlet_staff
        const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
        const role = staffInfo?.role
        return Number(m.bonus || 0) > 0 || role === 'area_manager' || role === 'regional_manager'
      })
      .map(m => {
        const staffRaw: any = m.outlet_staff
        const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
        const isStockController = (staffInfo?.name || '').toLowerCase().includes('abyansah') || staffInfo?.role === 'stock_controller'
        const role = isStockController ? 'stock_controller' : (staffInfo?.role || 'area_manager')
        const rawBonus = Number(m.bonus || 0)
        const bonus = rawBonus > 0 ? rawBonus : (bonusMap.get(m.staff_id) || 0)
        const totalPcs = Number((m as any).total_pcs || 0) || (pcsMap.get(m.staff_id) || 0) || (bonus > 0 ? Math.round(bonus / 50) : 0)
        return {
          staffId: m.staff_id,
          staffName: staffInfo?.name || (role === 'regional_manager' ? 'Regional Manager' : 'Area Manager'),
          role,
          outletName: role === 'regional_manager' ? 'Rp 50 / pcs (Wilayah Regional)' : 'Rp 50 / pcs (Cabang Binaan)',
          bonus,
          totalPcs,
          status: (m.status === 'finalized' ? 'finalized' : 'draft') as 'draft' | 'finalized'
        }
      })
      .sort((a, b) => {
        const getPriority = (role: string = '') => {
          const r = role.toLowerCase()
          if (r === 'regional_manager' || r === 'rm') return 1
          if (r === 'area_manager' || r === 'am') return 2
          if (r === 'stock_controller' || r === 'sc') return 3
          return 4
        }
        const diff = getPriority(a.role) - getPriority(b.role)
        if (diff !== 0) return diff
        return b.bonus - a.bonus
      }) : []

    const bonusDetails = [...crewBonusDetails, ...managerBonusDetails].sort((a, b) => b.bonus - a.bonus)

    let multiCrewRegularCount = 0
    let multiCrewBackupCount = 0
    let multiCrewTraineeCount = 0
    let multiCrewOjtCount = 0

    targetCrewRows.forEach(r => {
      const staffRaw: any = r.outlet_staff
      const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
      const contractType = staffInfo?.contract_type || (r as any).contract_type || null
      const subRole = staffInfo?.sub_role || (r as any).sub_role || null
      const onboardingStage = staffInfo?.onboarding_stage || (r as any).onboarding_stage || null

      const isBackup = contractType === 'daily' || subRole === 'crew_backup'
      const isTrainee = contractType === 'probation' || subRole === 'crew_trainee'
      const isOjt = contractType === 'intern' || onboardingStage === 'ojt'

      if (isBackup) multiCrewBackupCount++
      else if (isTrainee) multiCrewTraineeCount++
      else if (isOjt) multiCrewOjtCount++
      else multiCrewRegularCount++
    })

    return {
      totalSalary,
      totalStaff,
      crewCount: targetCrewRows.length,
      crewRegularCount: multiCrewRegularCount,
      crewBackupCount: multiCrewBackupCount,
      crewTraineeCount: multiCrewTraineeCount,
      crewOjtCount: multiCrewOjtCount,
      basicSalary,
      allowances,
      bonus,
      crewBonus,
      managerBonusAllocation,
      deductions,
      draftCount,
      draftAmount,
      finalizedCount,
      finalizedAmount,
      status,
      outlets: outletsSummary,
      crewBonusDetails,
      managerBonusDetails,
      bonusDetails,
      staffDetails: [
        ...targetCrewRows.map(r => {
          const staffRaw: any = r.outlet_staff
          const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
          const staffOutletId = r.outlet_id || staffInfo?.outlet_id
          const bSalary = Number(r.basic_salary || 0)
          const bAllowances =
            Number(r.allowance_meal || r.allowance_presence || 0) +
            Number(r.allowance_transport || 0) +
            Number(r.allowance_communication || 0) +
            Number(r.allowance_position || 0)
          const bBonus = Number(r.bonus || 0)
          const bDeductions = Number(r.deductions || 0)
          const tot = Number(r.total_salary || 0)
          const isPusat = !staffOutletId || staffOutletId === 'ffffffff-ffff-ffff-ffff-ffffffffffff'
          const contractType = staffInfo?.contract_type || (r as any).contract_type || null
          const subRole = staffInfo?.sub_role || (r as any).sub_role || null
          const isBackup = contractType === 'daily' || subRole === 'crew_backup'
          const targets = isPusat ? ['PUSAT'] : getCrewBackupTargets(r.staff_id, staffOutletId, isBackup)
          const isSplit = isBackup && targets.length > 1
          const fullRoutine = bSalary + bAllowances - bDeductions

          return {
            staffId: r.staff_id,
            staffName: staffInfo?.name || 'Staff',
            role: staffInfo?.role || 'crew',
            contractType,
            subRole,
            onboardingStage: staffInfo?.onboarding_stage || (r as any).onboarding_stage || null,
            outletId: staffOutletId,
            outletName: outletNameMap.get(staffOutletId) || 'Outlet',
            basicSalary: bSalary,
            allowances: bAllowances,
            bonus: bBonus,
            deductions: bDeductions,
            routineSalary: fullRoutine,
            totalSalary: tot,
            status: (r.status === 'finalized' ? 'finalized' : 'draft') as 'draft' | 'finalized',
            isManagerAllocation: false,
            isBackupAllocation: isSplit,
            backupOutletsCount: targets.length,
            fullRoutineSalary: fullRoutine,
            fullBasicSalary: bSalary,
            fullAllowances: bAllowances,
            fullDeductions: bDeductions,
            allocatedOutletNames: targets.map(id => outletNameMap.get(id) || 'Cabang')
          }
        }),
        ...(target !== 'PUSAT' ? managerRows.map(m => {
          const staffRaw: any = m.outlet_staff
          const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
          const isStockController = (staffInfo?.name || '').toLowerCase().includes('abyansah') || staffInfo?.role === 'stock_controller'
          const role = isStockController ? 'stock_controller' : (staffInfo?.role || 'area_manager')
          const bSalary = Number(m.basic_salary || 0)
          const bAllowances =
            Number(m.allowance_meal || m.allowance_presence || 0) +
            Number(m.allowance_transport || 0) +
            Number(m.allowance_communication || 0) +
            Number(m.allowance_position || 0)
          const bBonus = Number(m.bonus || 0)
          const bDeductions = Number(m.deductions || 0)
          const tot = Number(m.total_salary || 0)
          return {
            staffId: m.staff_id,
            staffName: staffInfo?.name || (role === 'regional_manager' ? 'Regional Manager' : role === 'stock_controller' ? 'Stock Controller' : 'Area Manager'),
            role,
            outletId: 'PUSAT',
            outletName: 'Alokasi Management',
            basicSalary: bSalary,
            allowances: bAllowances,
            bonus: bBonus,
            deductions: bDeductions,
            routineSalary: bSalary + bAllowances - bDeductions,
            totalSalary: tot,
            status: (m.status === 'finalized' ? 'finalized' : 'draft') as 'draft' | 'finalized',
            isManagerAllocation: true,
            allocatedAmount: tot
          }
        }) : [])
      ]
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
      outlets: [],
      crewCount: 0,
      crewRegularCount: 0,
      crewBackupCount: 0,
      crewTraineeCount: 0,
      crewOjtCount: 0
    }
  }
}
