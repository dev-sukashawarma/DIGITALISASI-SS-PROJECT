'use server'

import { requireRole, PERAN_KEUANGAN } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import { isTestOrDevStaff, KANTOR_PUSAT_ID } from '@/lib/staffFilters'
import { isExcludedOutlet } from '@/lib/outletFilters'
import {
  calculateMonthOverlap,
  type RolloverExpenseBaseline,
  type CrewBonusRecord,
  type ManagerAssignment,
  distributeEqualSplit,
} from '@/lib/opexProrata'
import { getPeriodsInRange } from '@/lib/opexDateRangeProrata'
import { monthRange } from '@/lib/period'
import type { OfficePayrollRecord } from '@/lib/gajiKantorPusat'

export interface ProrataAuxiliaryData {
  payrollRecords: {
    staff_id?: string
    outlet_id: string
    total_salary: number
    bonus?: number
    period_month: number
    period_year: number
    role: string
  }[]
  staffFinancials: {
    staff_id?: string
    outlet_id: string
    basic_salary: number
    allowance_position: number
    allowance_presence: number
    role: string
  }[]
  crewBonusRecords: CrewBonusRecord[]
  lastMonthExpenses: RolloverExpenseBaseline[]
  managerAssignments?: ManagerAssignment[]
  operationalOutletIds?: string[]
  /** Slip gaji HR staf kantor pusat — lihat lib/gajiKantorPusat.ts. */
  officePayrollRecords?: OfficePayrollRecord[]
  /** Total gaji bulanan master staf kantor aktif (cadangan bulan berjalan). */
  officeStaffMonthlyTotal?: number
}

/**
 * Mengambil data pelengkap kalkulasi prorata OPEX (payroll slip HR, master gaji staf,
 * bonus omzet kru, dan beban rollover bulan lalu) dari server dengan service client.
 */
export async function getProrataAuxiliaryDataAction({
  from,
  to,
}: {
  from: string
  to: string
}): Promise<ProrataAuxiliaryData> {
  // Memuat slip gaji & gaji master per orang — hanya untuk peran keuangan.
  await requireRole(PERAN_KEUANGAN)
  const supabase = createServiceClient()

  const overlap = calculateMonthOverlap(from, to)
  const periods = getPeriodsInRange(from, to)
  const months = [...new Set(periods.map(p => p.month))]
  const years = [...new Set(periods.map(p => p.year))]

  const uniqueYearMonths: { year: number; month: number }[] = []
  const seen = new Set<string>()
  const source = periods.length > 0 ? periods : [{ year: overlap.year, month: overlap.month }]
  for (const p of source) {
    const key = `${p.year}-${p.month}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueYearMonths.push({ year: p.year, month: p.month })
    }
  }

  // 1. Payroll records
  let qPayroll = supabase
    .from('payroll_records')
    .select(`
      period_month,
      period_year,
      outlet_id,
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
        sub_role,
        contract_type,
        status,
        account_category
      )
    `)

  if (years.length === 1) qPayroll = qPayroll.eq('period_year', years[0])
  else if (years.length > 1) qPayroll = qPayroll.in('period_year', years)

  if (months.length === 1) qPayroll = qPayroll.eq('period_month', months[0])
  else if (months.length > 1) qPayroll = qPayroll.in('period_month', months)

  // 2. Staff financials fallback
  const qStaff = supabase
    .from('outlet_staff')
    .select(`
      id,
      name,
      username,
      outlet_id,
      role,
      sub_role,
      contract_type,
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

  // 2b. Master gaji staf kantor pusat (semua role di luar kru outlet & manajer)
  const qOfficeStaff = supabase
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
      staff_financials(
        basic_salary,
        allowance_position,
        allowance_presence
      )
    `)
    .eq('status', 'active')

  // 3. Last month expenses (rollover)
  const prevMonth = overlap.month === 1 ? 12 : overlap.month - 1
  const prevYear = overlap.month === 1 ? overlap.year - 1 : overlap.year
  const prevMonthRange = monthRange(prevYear, prevMonth)

  const qLastMonth = supabase
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

  // 4. Staff outlets untuk manajer & backup crew
  const qStaffOutlets = supabase
    .from('staff_outlets')
    .select(`
      staff_id,
      outlet_id,
      outlet_staff!inner(id, role, sub_role, contract_type, is_active)
    `)
    .eq('outlet_staff.is_active', true)

  // 5. Crew bonus RPC
  const bonusPromises = uniqueYearMonths.map(async ({ year, month }) => {
    const { data, error } = await supabase.rpc('get_monthly_crew_bonus', {
      p_month: month,
      p_year: year,
      p_outlet_id: null,
    })
    if (error) {
      console.warn(`Gagal memuat crew bonus (${year}-${month}):`, error.message)
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

  // 6. Outlet operasional (internal & mitra) untuk alokasi manajer
  const qOpOutlets = supabase
    .from('outlets')
    .select('id, name, slug, type, is_active, status')
    .in('type', ['internal', 'mitra'])

  const [payrollRes, staffRes, lastMonthRes, staffOutletsRes, opOutletsRes, officeStaffRes, ...bonusResults] = await Promise.all([
    qPayroll,
    qStaff,
    qLastMonth,
    qStaffOutlets,
    qOpOutlets,
    qOfficeStaff,
    ...(bonusPromises as Promise<any>[]),
  ])

  const ALLOWED_ROLES = ['crew', 'leader', 'kasir', 'kitchen', 'driver', 'area_manager', 'regional_manager']

  // Staf kantor pusat = karyawan sungguhan yang TIDAK lolos saringan kru outlet
  // di bawah (role kantor, atau kru non-manajer yang berpangkalan di Kantor Pusat).
  const isStafKantor = (s: any, effectiveOutletId: string | null | undefined): boolean => {
    if (!s || isTestOrDevStaff(s)) return false
    if (!ALLOWED_ROLES.includes(s.role)) return true
    const isManager = s.role === 'area_manager' || s.role === 'regional_manager'
    return !isManager && (!effectiveOutletId || effectiveOutletId === KANTOR_PUSAT_ID)
  }

  const officePayrollRecords: OfficePayrollRecord[] = ((payrollRes.data ?? []) as any[])
    .filter(r => isStafKantor(r.outlet_staff, r.outlet_id || r.outlet_staff?.outlet_id))
    .map(r => ({
      period_month: Number(r.period_month),
      period_year: Number(r.period_year),
      total_salary: Number(r.total_salary) || 0,
    }))
    .filter(r => r.total_salary > 0)

  const officeStaffMonthlyTotal = ((officeStaffRes.data ?? []) as any[])
    .filter(s => isStafKantor(s, s.outlet_id))
    .reduce((sum, s) => {
      const fin = Array.isArray(s.staff_financials) ? s.staff_financials[0] : s.staff_financials
      return sum + (Number(fin?.basic_salary) || 0) + (Number(fin?.allowance_position) || 0) + (Number(fin?.allowance_presence) || 0)
    }, 0)

  const crewBonusRecords: CrewBonusRecord[] = bonusResults.flat()
  const bonusOutletIds = new Set(crewBonusRecords.map(c => c.outlet_id))

  const operationalOutletIds: string[] = ((opOutletsRes.data ?? []) as any[])
    .filter(o => {
      if (isExcludedOutlet(o)) return false
      // Sawangan internal digantikan oleh Mitra Sawangan DTC agar tidak double-counting
      if (o.slug === 'sawangan-depok-internal') return false
      const isActive = o.is_active === true && o.status === 'active'
      const hadActivityInPeriod = bonusOutletIds.has(o.id)
      return isActive || hadActivityInPeriod
    })
    .map(o => o.id)

  const opOutletIdSet = new Set(operationalOutletIds)

  // Map penugasan outlet untuk manajer & backup crew
  const staffAssignmentsMap = new Map<string, string[]>()
  const managerMap = new Map<string, ManagerAssignment>()

  for (const row of ((staffOutletsRes.data ?? []) as any[])) {
    const sid = row.staff_id
    if (!staffAssignmentsMap.has(sid)) {
      staffAssignmentsMap.set(sid, [])
    }
    staffAssignmentsMap.get(sid)!.push(row.outlet_id)

    const role = (row.outlet_staff as any)?.role || 'area_manager'
    if (role === 'area_manager' || role === 'regional_manager') {
      if (!managerMap.has(sid)) {
        managerMap.set(sid, { staff_id: sid, role, outlet_ids: [] })
      }
      managerMap.get(sid)!.outlet_ids.push(row.outlet_id)
    }
  }
  const managerAssignments: ManagerAssignment[] = Array.from(managerMap.values())

  function getBackupCrewTargets(
    staffId: string,
    homeOutletId: string | undefined | null,
    isBackup: boolean
  ): string[] {
    if (!isBackup) {
      return homeOutletId ? [homeOutletId] : []
    }
    const assigned = staffAssignmentsMap.get(staffId) || []
    const set = new Set<string>()
    if (homeOutletId && opOutletIdSet.has(homeOutletId)) {
      set.add(homeOutletId)
    }
    assigned.forEach(id => {
      if (opOutletIdSet.has(id)) {
        set.add(id)
      }
    })
    if (set.size === 0 && homeOutletId) {
      set.add(homeOutletId)
    }
    return Array.from(set)
  }

  const payrollRecords: {
    staff_id?: string
    outlet_id: string
    total_salary: number
    bonus?: number
    period_month: number
    period_year: number
    role: string
  }[] = []

  ;((payrollRes.data ?? []) as any[])
    .filter(r => {
      const s = r.outlet_staff
      if (!s) return false
      if (isTestOrDevStaff(s)) return false
      if (!ALLOWED_ROLES.includes(s.role)) return false
      const isManager = s.role === 'area_manager' || s.role === 'regional_manager'
      const effectiveOutletId = r.outlet_id || s.outlet_id
      if (!isManager && (!effectiveOutletId || effectiveOutletId === KANTOR_PUSAT_ID)) return false
      return true
    })
    .forEach(r => {
      const s = r.outlet_staff
      const isManager = s?.role === 'area_manager' || s?.role === 'regional_manager'
      const tot = Number(r.total_salary) || 0
      const bon = Number(r.bonus) || 0
      const routine = Math.max(0, tot - bon)
      const isBackup = !isManager && (s?.sub_role === 'crew_backup' || s?.contract_type === 'daily')
      const homeOutletId = (r.outlet_id || s?.outlet_id) as string

      if (isBackup && s?.id) {
        const targets = getBackupCrewTargets(s.id, homeOutletId, true)
        if (targets.length > 1) {
          const splitRoutine = distributeEqualSplit(routine, targets)
          targets.forEach(tId => {
            const allocRoutine = splitRoutine.get(tId) || 0
            const allocBonus = tId === homeOutletId ? bon : 0
            payrollRecords.push({
              staff_id: (s?.id || r.staff_id) as string,
              outlet_id: tId,
              total_salary: allocRoutine + allocBonus,
              bonus: allocBonus,
              period_month: Number(r.period_month),
              period_year: Number(r.period_year),
              role: s?.role as string,
            })
          })
          return
        }
      }

      if (homeOutletId) {
        payrollRecords.push({
          staff_id: (s?.id || r.staff_id) as string,
          outlet_id: homeOutletId,
          total_salary: tot,
          bonus: bon,
          period_month: Number(r.period_month),
          period_year: Number(r.period_year),
          role: s?.role as string,
        })
      }
    })

  const staffFinancials: {
    staff_id?: string
    outlet_id: string
    basic_salary: number
    allowance_position: number
    allowance_presence: number
    role: string
  }[] = []

  ;((staffRes.data ?? []) as any[])
    .filter(s => {
      if (!s || s.status !== 'active') return false
      if (isTestOrDevStaff(s)) return false
      if (!ALLOWED_ROLES.includes(s.role)) return false
      const isManager = s.role === 'area_manager' || s.role === 'regional_manager'
      if (!isManager && (!s.outlet_id || s.outlet_id === KANTOR_PUSAT_ID)) return false
      return true
    })
    .forEach(s => {
      const fin = Array.isArray(s.staff_financials) ? s.staff_financials[0] : s.staff_financials
      const bSalary = Number(fin?.basic_salary) || 0
      const aPos = Number(fin?.allowance_position) || 0
      const aPres = Number(fin?.allowance_presence) || 0
      const isManager = s.role === 'area_manager' || s.role === 'regional_manager'
      const isBackup = !isManager && (s.sub_role === 'crew_backup' || s.contract_type === 'daily')

      if (isBackup) {
        const targets = getBackupCrewTargets(s.id, s.outlet_id, true)
        if (targets.length > 1) {
          const splitBasic = distributeEqualSplit(bSalary, targets)
          const splitPos = distributeEqualSplit(aPos, targets)
          const splitPres = distributeEqualSplit(aPres, targets)
          targets.forEach(tId => {
            staffFinancials.push({
              staff_id: s.id as string,
              outlet_id: tId,
              basic_salary: splitBasic.get(tId) || 0,
              allowance_position: splitPos.get(tId) || 0,
              allowance_presence: splitPres.get(tId) || 0,
              role: s.role as string,
            })
          })
          return
        }
      }

      if (s.outlet_id) {
        staffFinancials.push({
          staff_id: s.id as string,
          outlet_id: s.outlet_id as string,
          basic_salary: bSalary,
          allowance_position: aPos,
          allowance_presence: aPres,
          role: s.role as string,
        })
      }
    })

  const lastMonthExpenses: RolloverExpenseBaseline[] = ((lastMonthRes.data ?? []) as any[]).map(e => ({
    outlet_id: e.outlet_id as string | null,
    category: e.category as string,
    amount: Number(e.amount) || 0,
  }))

  return {
    payrollRecords,
    staffFinancials,
    crewBonusRecords,
    lastMonthExpenses,
    managerAssignments,
    operationalOutletIds,
    officePayrollRecords,
    officeStaffMonthlyTotal,
  }
}
