'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { isTestOrDevStaff, KANTOR_PUSAT_ID } from '@/lib/staffFilters'
import { calculateMonthOverlap, type RolloverExpenseBaseline, type CrewBonusRecord } from '@/lib/opexProrata'
import { getPeriodsInRange } from '@/lib/opexDateRangeProrata'
import { monthRange } from '@/lib/period'

export interface ProrataAuxiliaryData {
  payrollRecords: {
    outlet_id: string
    total_salary: number
    period_month: number
    period_year: number
    role: string
  }[]
  staffFinancials: {
    outlet_id: string
    basic_salary: number
    allowance_position: number
    allowance_presence: number
    role: string
  }[]
  crewBonusRecords: CrewBonusRecord[]
  lastMonthExpenses: RolloverExpenseBaseline[]
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
    .in('role', ['crew', 'leader', 'kasir', 'kitchen', 'driver'])

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

  // 4. Crew bonus RPC
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

  const [payrollRes, staffRes, lastMonthRes, ...bonusResults] = await Promise.all([
    qPayroll,
    qStaff,
    qLastMonth,
    ...bonusPromises,
  ])

  const OUTLET_CREW_ROLES = ['crew', 'leader', 'kasir', 'kitchen', 'driver']

  const payrollRecords = ((payrollRes.data ?? []) as any[])
    .filter(r => {
      const s = r.outlet_staff
      if (!s || s.status !== 'active') return false
      if (isTestOrDevStaff(s)) return false
      if (!OUTLET_CREW_ROLES.includes(s.role)) return false
      if (!s.outlet_id || s.outlet_id === KANTOR_PUSAT_ID) return false
      return true
    })
    .map(r => ({
      outlet_id: r.outlet_staff?.outlet_id as string,
      total_salary: Number(r.total_salary) || 0,
      period_month: Number(r.period_month),
      period_year: Number(r.period_year),
      role: r.outlet_staff?.role as string,
    }))
    .filter(r => Boolean(r.outlet_id))

  const staffFinancials = ((staffRes.data ?? []) as any[])
    .filter(s => !isTestOrDevStaff(s) && s.outlet_id && s.outlet_id !== KANTOR_PUSAT_ID)
    .map(s => {
      const fin = Array.isArray(s.staff_financials) ? s.staff_financials[0] : s.staff_financials
      return {
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

  return {
    payrollRecords,
    staffFinancials,
    crewBonusRecords,
    lastMonthExpenses,
  }
}
