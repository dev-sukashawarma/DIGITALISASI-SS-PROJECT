'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { isTestOrDevStaff, KANTOR_PUSAT_ID } from '@/lib/staffFilters'
import { isExcludedOutlet } from '@/lib/outletFilters'
import {
  calculateMonthOverlap,
  type RolloverExpenseBaseline,
  type CrewBonusRecord,
  type ManagerAssignment,
} from '@/lib/opexProrata'
import { getPeriodsInRange } from '@/lib/opexDateRangeProrata'
import { monthRange } from '@/lib/period'

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

  // 4. Staff outlets untuk manajer
  const qManagerStaffOutlets = supabase
    .from('staff_outlets')
    .select(`
      staff_id,
      outlet_id,
      outlet_staff!inner(id, role, is_active)
    `)
    .in('outlet_staff.role', ['area_manager', 'regional_manager'])
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

  // 6. Outlet operasional aktif (internal & mitra) untuk alokasi manajer
  const qOpOutlets = supabase
    .from('outlets')
    .select('id, name, type, is_active, status')
    .in('type', ['internal', 'mitra'])
    .eq('is_active', true)
    .eq('status', 'active')

  const [payrollRes, staffRes, lastMonthRes, managerRes, opOutletsRes, ...bonusResults] = await Promise.all([
    qPayroll,
    qStaff,
    qLastMonth,
    qManagerStaffOutlets,
    qOpOutlets,
    ...bonusPromises,
  ])

  const ALLOWED_ROLES = ['crew', 'leader', 'kasir', 'kitchen', 'driver', 'area_manager', 'regional_manager']

  const payrollRecords = ((payrollRes.data ?? []) as any[])
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

  const staffFinancials = ((staffRes.data ?? []) as any[])
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
    })
    .filter(s => Boolean(s.outlet_id))

  const lastMonthExpenses: RolloverExpenseBaseline[] = ((lastMonthRes.data ?? []) as any[]).map(e => ({
    outlet_id: e.outlet_id as string | null,
    category: e.category as string,
    amount: Number(e.amount) || 0,
  }))

  const crewBonusRecords: CrewBonusRecord[] = bonusResults.flat()

  const managerMap = new Map<string, ManagerAssignment>()
  for (const row of ((managerRes.data ?? []) as any[])) {
    const sid = row.staff_id
    const role = (row.outlet_staff as any)?.role || 'area_manager'
    if (!managerMap.has(sid)) {
      managerMap.set(sid, { staff_id: sid, role, outlet_ids: [] })
    }
    managerMap.get(sid)!.outlet_ids.push(row.outlet_id)
  }
  const managerAssignments: ManagerAssignment[] = Array.from(managerMap.values())

  const operationalOutletIds: string[] = ((opOutletsRes.data ?? []) as any[])
    .filter(o => !isExcludedOutlet(o))
    .map(o => o.id)

  return {
    payrollRecords,
    staffFinancials,
    crewBonusRecords,
    lastMonthExpenses,
    managerAssignments,
    operationalOutletIds,
  }
}
