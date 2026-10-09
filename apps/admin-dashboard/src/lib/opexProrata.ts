/**
 * Modul Prorata OPEX Realtime untuk Laba Rugi Suka Shawarma.
 * 
 * Mengonversi pos beban tetap bulanan (Gaji Crew Outlet, Sewa Outlet, Internet)
 * menjadi beban akrual harian proporsional khusus pada bulan berjalan,
 * sehingga metrik OPEX harian dan MTD tidak mengalami lonjakan (spike) di akhir bulan.
 */

import type { ExpenseRow } from '@/hooks/useExpenses'
import type { PeriodFilterValue } from '@/lib/types'
import { isTestOutlet, isExcludedOutlet } from '@/lib/outletFilters'
import { getPeriodsInRange } from './opexDateRangeProrata'

export const PRORATED_CATEGORIES = [
  'gaji_crew_outlet',
  'sewa_outlet',
  'internet',
  'bonus_crew',
  'bonus_area_manager',
  'bonus_regional_manager',
] as const
export type ProratedCategory = (typeof PRORATED_CATEGORIES)[number]

export interface StaffSalaryBaseline {
  outlet_id: string
  total_salary: number
  source: 'payroll_record' | 'staff_master'
}

export interface RolloverExpenseBaseline {
  outlet_id: string | null
  category: string
  amount: number
}

export interface CrewBonusRecord {
  outlet_id: string
  total_bonus: number
  total_pcs_outlet?: number
  period_month?: number
  period_year?: number
  crew_id?: string
  outlet_name?: string
}

export interface ProrataMonthInfo {
  year: number
  month: number // 1-indexed (1 = Januari, 9 = September)
  firstDay: string // YYYY-MM-01
  lastDay: string // YYYY-MM-DD
  totalDays: number
  todayDay: number
  overlapDays: number
  ratio: number // overlapDays / totalDays
  isCurrentMonth: boolean
}

/** Mengambil info kalender bulan berjalan menurut zona waktu Asia/Jakarta (UTC+7) */
export function getJakartaCurrentMonthInfo(now = new Date()): {
  year: number
  month: number
  firstDay: string
  lastDay: string
  totalDays: number
  todayStr: string
  todayDay: number
} {
  const jkt = new Date(now.getTime() + 7 * 3600 * 1000)
  const year = jkt.getUTCFullYear()
  const month = jkt.getUTCMonth() + 1
  const todayDay = jkt.getUTCDate()
  const todayStr = jkt.toISOString().slice(0, 10)

  const mm = String(month).padStart(2, '0')
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstDay = `${year}-${mm}-01`
  const lastDay = `${year}-${mm}-${String(totalDays).padStart(2, '0')}`

  return { year, month, firstDay, lastDay, totalDays, todayStr, todayDay }
}

/** Menghitung irisan hari antara rentang filter dan bulan berjalan */
export function calculateMonthOverlap(
  filterFrom: string,
  filterTo: string,
  now = new Date()
): ProrataMonthInfo {
  const cur = getJakartaCurrentMonthInfo(now)

  // Cek apakah filter beririsan dengan bulan berjalan
  const overlapStart = filterFrom > cur.firstDay ? filterFrom : cur.firstDay
  const overlapEnd = filterTo < cur.lastDay ? filterTo : cur.lastDay

  if (overlapStart > overlapEnd || filterTo < cur.firstDay || filterFrom > cur.lastDay) {
    return {
      year: cur.year,
      month: cur.month,
      firstDay: cur.firstDay,
      lastDay: cur.lastDay,
      totalDays: cur.totalDays,
      todayDay: cur.todayDay,
      overlapDays: 0,
      ratio: 0,
      isCurrentMonth: false,
    }
  }

  // Hitung jumlah hari irisan (inklusif)
  const msDiff = Date.parse(overlapEnd + 'T00:00:00Z') - Date.parse(overlapStart + 'T00:00:00Z')
  const overlapDays = Math.round(msDiff / 86400000) + 1
  const ratio = cur.totalDays > 0 ? Math.min(1, Math.max(0, overlapDays / cur.totalDays)) : 0

  return {
    year: cur.year,
    month: cur.month,
    firstDay: cur.firstDay,
    lastDay: cur.lastDay,
    totalDays: cur.totalDays,
    todayDay: cur.todayDay,
    overlapDays,
    ratio,
    isCurrentMonth: true,
  }
}

export interface ProratedExpenseResult {
  rows: ExpenseRow[]
  isProrated: boolean
  monthInfo: ProrataMonthInfo
  categoryBreakdown: {
    gaji_crew_outlet: { nominalBulanan: number; nominalProrata: number; source: string }
    sewa_outlet: { nominalBulanan: number; nominalProrata: number; source: string }
    internet: { nominalBulanan: number; nominalProrata: number; source: string }
    bonus_crew: { nominalBulanan: number; nominalProrata: number; source: string }
    bonus_area_manager: { nominalBulanan: number; nominalProrata: number; source: string }
    bonus_regional_manager: { nominalBulanan: number; nominalProrata: number; source: string }
  }
}

export interface ManagerAssignment {
  staff_id?: string
  role?: 'area_manager' | 'regional_manager' | string
  outlet_ids: string[]
}

export interface CalculateProrataInput {
  filter: PeriodFilterValue
  rawExpenses: ExpenseRow[]
  payrollRecords?: {
    staff_id?: string
    outlet_id: string
    total_salary: number
    basic_salary?: number
    bonus?: number
    period_month?: number
    period_year?: number
    role?: string
  }[]
  staffFinancials?: {
    staff_id?: string
    outlet_id: string
    basic_salary: number
    allowance_position?: number
    allowance_presence?: number
    role?: string
  }[]
  lastMonthExpenses?: RolloverExpenseBaseline[]
  crewBonusRecords?: CrewBonusRecord[]
  now?: Date
  outlets?: { id: string; name: string; is_active?: boolean; type?: string }[]
  managerAssignments?: ManagerAssignment[]
  operationalOutletIds?: string[]
}

/**
 * Membagi rata total nilai secara presisi ke target outlet (deterministic & zero discrepancy).
 * Sisa pecahan pembulatan (remainder) disebar secara berurutan (+1) ke outlet target teratas.
 */
export function distributeEqualSplit(
  totalAmount: number,
  targetOutletIds: string[]
): Map<string, number> {
  const result = new Map<string, number>()
  if (!targetOutletIds || targetOutletIds.length === 0 || totalAmount <= 0) return result

  const sortedIds = [...targetOutletIds].sort()
  const n = sortedIds.length
  const base = Math.floor(totalAmount / n)
  let remainder = totalAmount - (base * n)

  for (const outletId of sortedIds) {
    const extra = remainder > 0 ? 1 : 0
    if (remainder > 0) remainder--
    result.set(outletId, base + extra)
  }
  return result
}

function computeManagerAllocationsForPeriod(
  periodMonth: number,
  periodYear: number,
  payrollRecords: NonNullable<CalculateProrataInput['payrollRecords']>,
  staffFinancials: NonNullable<CalculateProrataInput['staffFinancials']>,
  managerAssignments: ManagerAssignment[],
  operationalOutletIds: string[]
): Map<string, number> {
  const allocationsByOutlet = new Map<string, number>()

  // 1. Cek payrollRecords untuk periode ini
  const mgrPayroll = payrollRecords.filter(p => {
    const isMgr = p.role === 'area_manager' || p.role === 'regional_manager'
    const matchPeriod = p.period_month && p.period_year
      ? (p.period_month === periodMonth && p.period_year === periodYear)
      : true
    return isMgr && matchPeriod
  })

  if (mgrPayroll.length > 0) {
    for (const p of mgrPayroll) {
      const tot = Number(p.total_salary) || 0
      const bon = Number(p.bonus) || 0
      const cleanSalary = Math.max(0, tot - bon)
      if (cleanSalary <= 0) continue

      let targets: string[] = []
      if (p.role === 'regional_manager') {
        targets = [...operationalOutletIds]
      } else {
        // area_manager
        const assignment = managerAssignments.find(ma =>
          (p.staff_id && ma.staff_id && ma.staff_id === p.staff_id) ||
          (ma.role === 'area_manager' && ma.outlet_ids.includes(p.outlet_id))
        )
        const candidateOutlets = assignment ? assignment.outlet_ids : [p.outlet_id]
        targets = candidateOutlets.filter(id => operationalOutletIds.includes(id))
        if (targets.length === 0) targets = [p.outlet_id]
      }

      const split = distributeEqualSplit(cleanSalary, targets)
      for (const [outletId, amt] of split.entries()) {
        allocationsByOutlet.set(outletId, (allocationsByOutlet.get(outletId) || 0) + amt)
      }
    }
  } else if (staffFinancials.length > 0) {
    // 2. Fallback ke staffFinancials (untuk bulan berjalan sebelum ada payroll_records)
    const mgrFinancials = staffFinancials.filter(s =>
      s.role === 'area_manager' || s.role === 'regional_manager'
    )
    for (const s of mgrFinancials) {
      const b = Number(s.basic_salary) || 0
      const ap = Number(s.allowance_position) || 0
      const ah = Number(s.allowance_presence) || 0
      const cleanSalary = b + ap + ah
      if (cleanSalary <= 0) continue

      let targets: string[] = []
      if (s.role === 'regional_manager') {
        targets = [...operationalOutletIds]
      } else {
        const assignment = managerAssignments.find(ma =>
          (s.staff_id && ma.staff_id && ma.staff_id === s.staff_id) ||
          (ma.role === 'area_manager' && ma.outlet_ids.includes(s.outlet_id))
        )
        const candidateOutlets = assignment ? assignment.outlet_ids : [s.outlet_id]
        targets = candidateOutlets.filter(id => operationalOutletIds.includes(id))
        if (targets.length === 0) targets = [s.outlet_id]
      }

      const split = distributeEqualSplit(cleanSalary, targets)
      for (const [outletId, amt] of split.entries()) {
        allocationsByOutlet.set(outletId, (allocationsByOutlet.get(outletId) || 0) + amt)
      }
    }
  }

  return allocationsByOutlet
}

/**
 * Mesin kalkulasi prorata OPEX untuk halaman Laba Rugi.
 */
export function calculateProratedExpenses(input: CalculateProrataInput): ProratedExpenseResult {
  const {
    filter,
    rawExpenses,
    payrollRecords = [],
    staffFinancials = [],
    lastMonthExpenses = [],
    crewBonusRecords = [],
    now = new Date(),
    outlets = [],
  } = input

  const cur = getJakartaCurrentMonthInfo(now)
  const monthInfo = calculateMonthOverlap(filter.from, filter.to, now)
  const periods = getPeriodsInRange(filter.from, filter.to)

  // Default breakdown
  const emptyBreakdown = {
    gaji_crew_outlet: { nominalBulanan: 0, nominalProrata: 0, source: 'none' },
    sewa_outlet: { nominalBulanan: 0, nominalProrata: 0, source: 'none' },
    internet: { nominalBulanan: 0, nominalProrata: 0, source: 'none' },
    bonus_crew: { nominalBulanan: 0, nominalProrata: 0, source: 'none' },
    bonus_area_manager: { nominalBulanan: 0, nominalProrata: 0, source: 'none' },
    bonus_regional_manager: { nominalBulanan: 0, nominalProrata: 0, source: 'none' },
  }

  const isCurrentMonthProrata = monthInfo.isCurrentMonth && monthInfo.overlapDays > 0
  const hasHrData = payrollRecords.length > 0 || staffFinancials.length > 0
  const hasBonusData = crewBonusRecords.length > 0

  // Jika bukan bulan berjalan dan tidak ada data HR maupun modul bonus sama sekali, kembalikan data riil 100%
  if (!isCurrentMonthProrata && !hasHrData && !hasBonusData) {
    return {
      rows: rawExpenses,
      isProrated: false,
      monthInfo,
      categoryBreakdown: emptyBreakdown,
    }
  }

  // Nama outlet lookup & daftar outlet nonaktif
  const outletNameMap = new Map<string, string>()
  const inactiveOutletIds = new Set<string>()
  outlets.forEach(o => {
    outletNameMap.set(o.id, o.name)
    if (o.is_active === false) {
      inactiveOutletIds.add(o.id)
    }
  })
  rawExpenses.forEach(r => {
    if (r.outlet_id && r.outlet_name) outletNameMap.set(r.outlet_id, r.outlet_name)
  })

  // Kategori yang berkaitan dengan gaji
  const isSalaryCat = (cat: string): boolean =>
    cat === 'salary' || cat === 'gaji' || cat === 'gaji_crew_outlet'

  // Kategori yang berkaitan dengan bonus
  const isBonusCat = (cat: string): boolean =>
    cat === 'bonus_crew' ||
    cat === 'bonus_leader' ||
    cat === 'bonus_area_manager' ||
    cat === 'bonus_regional_manager' ||
    cat === 'bonus_korlap'

  const isProratedCat = (cat: string): cat is ProratedCategory =>
    PRORATED_CATEGORIES.includes(cat as ProratedCategory) ||
    isSalaryCat(cat) ||
    isBonusCat(cat) ||
    cat === 'sewa' ||
    cat === 'wifi'

  const normalizeCategory = (cat: string): ProratedCategory => {
    if (isSalaryCat(cat)) return 'gaji_crew_outlet'
    if (cat === 'sewa' || cat === 'sewa_outlet') return 'sewa_outlet'
    if (cat === 'wifi' || cat === 'internet') return 'internet'
    if (cat === 'bonus_leader' || cat === 'bonus_crew') return 'bonus_crew'
    if (cat === 'bonus_area_manager' || cat === 'bonus_korlap') return 'bonus_area_manager'
    if (cat === 'bonus_regional_manager') return 'bonus_regional_manager'
    return cat as ProratedCategory
  }

  // Tentukan himpunan outlet target (outlet nonaktif tidak diberikan beban estimasi prorata berjalan,
  // tetapi outlet historis yang memiliki payroll atau bonus tetap dihitung)
  const targetOutletIds = new Set<string>()
  if (filter.outletId && filter.outletId !== 'all') {
    targetOutletIds.add(filter.outletId)
  } else {
    outlets.forEach(o => {
      if (!isTestOutlet(o.id) && !isExcludedOutlet(o) && o.is_active !== false) targetOutletIds.add(o.id)
    })
    payrollRecords.forEach(p => {
      if (p.outlet_id && !isTestOutlet(p.outlet_id) && !isExcludedOutlet(p.outlet_id)) targetOutletIds.add(p.outlet_id)
    })
    staffFinancials.forEach(s => {
      if (s.outlet_id && !isTestOutlet(s.outlet_id) && !isExcludedOutlet(s.outlet_id) && !inactiveOutletIds.has(s.outlet_id)) targetOutletIds.add(s.outlet_id)
    })
    lastMonthExpenses.forEach(l => {
      if (l.outlet_id && !isTestOutlet(l.outlet_id) && !isExcludedOutlet(l.outlet_id) && !inactiveOutletIds.has(l.outlet_id)) targetOutletIds.add(l.outlet_id)
    })
    crewBonusRecords.forEach(c => {
      if (c.outlet_id && !isTestOutlet(c.outlet_id) && !isExcludedOutlet(c.outlet_id)) targetOutletIds.add(c.outlet_id)
    })
    rawExpenses.forEach(r => {
      if (r.outlet_id && r.outlet_id !== 'ALL' && !isTestOutlet(r.outlet_id) && !isExcludedOutlet(r.outlet_id)) {
        targetOutletIds.add(r.outlet_id)
      }
    })
  }

  // Tentukan outlet operasional aktif untuk alokasi manajer (AM & RM)
  const defaultOperationalOutletIds = (outlets || [])
    .filter(o => {
      if (inactiveOutletIds.has(o.id)) return false
      if (isExcludedOutlet(o)) return false
      const oType = (o as any).type
      if (oType && ['office', 'gudang', 'marketplace', 'system', 'test'].includes(oType)) return false
      const nameLower = (o.name || '').toLowerCase()
      if (
        nameLower.includes('kantor pusat') ||
        nameLower.includes('gudang') ||
        nameLower.includes('hq') ||
        nameLower.includes('test') ||
        nameLower.includes('tes ') ||
        nameLower === 'tes' ||
        nameLower.includes('backup')
      ) {
        return false
      }
      return true
    })
    .map(o => o.id)

  const effectiveOperationalOutletIds =
    (input.operationalOutletIds && input.operationalOutletIds.length > 0)
      ? input.operationalOutletIds.filter(id => {
          const name = outletNameMap.get(id) || id
          return !isExcludedOutlet({ id, name })
        })
      : (defaultOperationalOutletIds.length > 0
          ? defaultOperationalOutletIds
          : Array.from(targetOutletIds).filter(id => {
              const name = outletNameMap.get(id) || id
              return !isExcludedOutlet({ id, name })
            }))

  // =========================================================================
  // MODE 1: BULAN BERJALAN (CURRENT MONTH ACCRUAL)
  // Prorata akrual harian untuk mencegah lonjakan di akhir bulan.
  // =========================================================================
  if (isCurrentMonthProrata) {
    const variableExpenses: ExpenseRow[] = []
    const currentMonthRealFixed = new Map<string, Map<ProratedCategory, number>>()

    rawExpenses.forEach(r => {
      const rawCat = r.category?.toLowerCase() || ''
      if (isProratedCat(rawCat)) {
        const normCat = normalizeCategory(rawCat)
        const oid = r.outlet_id || 'ALL'
        if (!currentMonthRealFixed.has(oid)) {
          currentMonthRealFixed.set(oid, new Map())
        }
        const catMap = currentMonthRealFixed.get(oid)!
        catMap.set(normCat, (catMap.get(normCat) ?? 0) + r.amount)
      } else {
        variableExpenses.push(r)
      }
    })

    const durationDesc = monthInfo.overlapDays === 1
      ? `Beban 1 Hari · 1/${monthInfo.totalDays} bln`
      : `Beban ${monthInfo.overlapDays} Hari · ${monthInfo.overlapDays}/${monthInfo.totalDays} bln`

    const proratedRows: ExpenseRow[] = []
    let totalGajiBulanan = 0
    let totalGajiProrata = 0
    let gajiSource = 'none'

    let totalSewaBulanan = 0
    let totalSewaProrata = 0
    let sewaSource = 'none'

    let totalInternetBulanan = 0
    let totalInternetProrata = 0
    let internetSource = 'none'

    let totalBonusCrewBulanan = 0
    let totalBonusCrewProrata = 0
    let bonusCrewSource = 'none'

    let totalBonusAmBulanan = 0
    let totalBonusAmProrata = 0
    let bonusAmSource = 'none'

    let totalBonusRmBulanan = 0
    let totalBonusRmProrata = 0
    let bonusRmSource = 'none'

    const curDay = Math.max(1, Math.min(monthInfo.todayDay, monthInfo.totalDays))

    const managerAllocations = computeManagerAllocationsForPeriod(
      monthInfo.month,
      monthInfo.year,
      payrollRecords,
      staffFinancials,
      input.managerAssignments || [],
      effectiveOperationalOutletIds
    )

    for (const outletId of targetOutletIds) {
      if (inactiveOutletIds.has(outletId)) continue
      const outletName = outletNameMap.get(outletId) ?? 'Outlet'

      // --- A. GAJI CREW OUTLET ---
      let gajiMonthly = 0
      let oGajiSource: 'payroll_record' | 'staff_master' | 'expenses_real' | 'none' = 'none'

      // 1. Cek payroll_records (hanya kru toko non-manajer)
      const pRows = payrollRecords.filter(p =>
        p.outlet_id === outletId &&
        p.role !== 'area_manager' &&
        p.role !== 'regional_manager' &&
        (p.period_month && p.period_year ? (p.period_month === monthInfo.month && p.period_year === monthInfo.year) : true)
      )
      if (pRows.length > 0) {
        gajiMonthly = pRows.reduce((sum, p) => {
          const tot = Number(p.total_salary) || 0
          const bon = Number(p.bonus) || 0
          return sum + Math.max(0, tot - bon)
        }, 0)
        oGajiSource = 'payroll_record'
      }

      // 2. Fallback ke staffFinancials (master staf non-manajer)
      if (gajiMonthly === 0) {
        const sRows = staffFinancials.filter(s =>
          s.outlet_id === outletId &&
          s.role !== 'area_manager' &&
          s.role !== 'regional_manager'
        )
        if (sRows.length > 0) {
          gajiMonthly = sRows.reduce((sum, s) => {
            const b = Number(s.basic_salary) || 0
            const ap = Number(s.allowance_position) || 0
            const ah = Number(s.allowance_presence) || 0
            return sum + b + ap + ah
          }, 0)
          oGajiSource = 'staff_master'
        }
      }

      // 3. Fallback ke input riil di tabel expenses jika belum ada di HR
      if (gajiMonthly === 0) {
        const realGaji = currentMonthRealFixed.get(outletId)?.get('gaji_crew_outlet') ?? 0
        if (realGaji > 0) {
          gajiMonthly = realGaji
          oGajiSource = 'expenses_real'
        }
      }

      // 4. Tambahkan alokasi beban gaji manajer (AM & RM) untuk outlet ini
      const allocatedMgrSalary = managerAllocations.get(outletId) || 0
      if (allocatedMgrSalary > 0) {
        gajiMonthly += allocatedMgrSalary
        if (oGajiSource === 'none') oGajiSource = 'payroll_record'
      }

      if (gajiMonthly > 0) {
        const proratedGaji = Math.round(gajiMonthly * monthInfo.ratio)
        totalGajiBulanan += gajiMonthly
        totalGajiProrata += proratedGaji
        gajiSource = oGajiSource

        proratedRows.push({
          id: `prorata-gaji-${outletId}`,
          outlet_id: outletId,
          outlet_name: outletName,
          category: 'gaji_crew_outlet',
          scope: 'outlet',
          amount: proratedGaji,
          description: `Prorata Gaji Crew (${durationDesc})`,
          expense_date: filter.to,
          period_month: monthInfo.firstDay,
          source: 'monthly',
        })
      }

      // --- B. BIAYA SEWA OUTLET ---
      let sewaMonthly = currentMonthRealFixed.get(outletId)?.get('sewa_outlet') ?? 0
      let oSewaSource: 'current_month_real' | 'last_month_rollover' | 'none' = 'none'

      if (sewaMonthly > 0) {
        oSewaSource = 'current_month_real'
      } else {
        const lastMonthSewa = lastMonthExpenses
          .filter(e => e.outlet_id === outletId && (e.category === 'sewa_outlet' || e.category === 'sewa'))
          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
        if (lastMonthSewa > 0) {
          sewaMonthly = lastMonthSewa
          oSewaSource = 'last_month_rollover'
        }
      }

      if (sewaMonthly > 0) {
        const proratedSewa = Math.round(sewaMonthly * monthInfo.ratio)
        totalSewaBulanan += sewaMonthly
        totalSewaProrata += proratedSewa
        sewaSource = oSewaSource

        proratedRows.push({
          id: `prorata-sewa-${outletId}`,
          outlet_id: outletId,
          outlet_name: outletName,
          category: 'sewa_outlet',
          scope: 'outlet',
          amount: proratedSewa,
          description: `Prorata Sewa Outlet (${durationDesc})`,
          expense_date: filter.to,
          period_month: monthInfo.firstDay,
          source: 'monthly',
        })
      }

      // --- C. INTERNET / WIFI ---
      let internetMonthly = currentMonthRealFixed.get(outletId)?.get('internet') ?? 0
      let oInternetSource: 'current_month_real' | 'last_month_rollover' | 'none' = 'none'

      if (internetMonthly > 0) {
        oInternetSource = 'current_month_real'
      } else {
        const lastMonthInternet = lastMonthExpenses
          .filter(e => e.outlet_id === outletId && (e.category === 'internet' || e.category === 'wifi'))
          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
        if (lastMonthInternet > 0) {
          internetMonthly = lastMonthInternet
          oInternetSource = 'last_month_rollover'
        }
      }

      if (internetMonthly > 0) {
        const proratedInternet = Math.round(internetMonthly * monthInfo.ratio)
        totalInternetBulanan += internetMonthly
        totalInternetProrata += proratedInternet
        internetSource = oInternetSource

        proratedRows.push({
          id: `prorata-internet-${outletId}`,
          outlet_id: outletId,
          outlet_name: outletName,
          category: 'internet',
          scope: 'outlet',
          amount: proratedInternet,
          description: `Prorata Internet (${durationDesc})`,
          expense_date: filter.to,
          period_month: monthInfo.firstDay,
          source: 'monthly',
        })
      }

      // --- D. BONUS CREW ---
      let crewBonusMonthly = 0
      let oCrewBonusSource: 'expenses_real' | 'sales_pcs_mtd' | 'last_month_rollover' | 'none' = 'none'
      let effectiveCrewMtdBonus = 0

      const realCrewBonus = currentMonthRealFixed.get(outletId)?.get('bonus_crew') ?? 0
      if (realCrewBonus > 0) {
        crewBonusMonthly = realCrewBonus
        oCrewBonusSource = 'expenses_real'
      } else {
        const cRows = crewBonusRecords.filter(c =>
          c.outlet_id === outletId &&
          (c.period_month && c.period_year ? (c.period_month === monthInfo.month && c.period_year === monthInfo.year) : true)
        )
        const outletCrewBonusMtd = cRows.reduce((sum, c) => sum + (Number(c.total_bonus) || 0), 0)
        const outletPcs = cRows.length > 0 ? (Number(cRows[0].total_pcs_outlet) || 0) : 0
        effectiveCrewMtdBonus = outletCrewBonusMtd > 0 ? outletCrewBonusMtd : outletPcs * 100

        if (effectiveCrewMtdBonus > 0) {
          crewBonusMonthly = Math.round((effectiveCrewMtdBonus / curDay) * monthInfo.totalDays)
          oCrewBonusSource = 'sales_pcs_mtd'
        } else {
          const lastMonthBonus = lastMonthExpenses
            .filter(e => e.outlet_id === outletId && (e.category === 'bonus_crew' || e.category === 'bonus_leader'))
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
          if (lastMonthBonus > 0) {
            crewBonusMonthly = lastMonthBonus
            oCrewBonusSource = 'last_month_rollover'
          }
        }
      }

      if (crewBonusMonthly > 0) {
        const proratedCrewBonus = (oCrewBonusSource === 'sales_pcs_mtd' && monthInfo.overlapDays === curDay)
          ? effectiveCrewMtdBonus
          : Math.round(crewBonusMonthly * monthInfo.ratio)

        totalBonusCrewBulanan += crewBonusMonthly
        totalBonusCrewProrata += proratedCrewBonus
        if (bonusCrewSource === 'none') bonusCrewSource = oCrewBonusSource

        proratedRows.push({
          id: `prorata-bonus-crew-${outletId}`,
          outlet_id: outletId,
          outlet_name: outletName,
          category: 'bonus_crew',
          scope: 'outlet',
          amount: proratedCrewBonus,
          description: `Prorata Bonus Crew (${durationDesc})`,
          expense_date: filter.to,
          period_month: monthInfo.firstDay,
          source: 'monthly',
        })
      }

      // --- E. BONUS AREA MANAGER (AM) ---
      let amBonusMonthly = 0
      let oAmBonusSource: 'expenses_real' | 'sales_pcs_mtd' | 'last_month_rollover' | 'none' = 'none'
      let effectiveAmMtdBonus = 0

      const realAmBonus = currentMonthRealFixed.get(outletId)?.get('bonus_area_manager') ?? 0
      if (realAmBonus > 0) {
        amBonusMonthly = realAmBonus
        oAmBonusSource = 'expenses_real'
      } else {
        const cRows = crewBonusRecords.filter(c =>
          c.outlet_id === outletId &&
          (c.period_month && c.period_year ? (c.period_month === monthInfo.month && c.period_year === monthInfo.year) : true)
        )
        const outletPcs = cRows.length > 0 ? (Number(cRows[0].total_pcs_outlet) || 0) : 0
        effectiveAmMtdBonus = outletPcs * 50

        if (effectiveAmMtdBonus > 0) {
          amBonusMonthly = Math.round((effectiveAmMtdBonus / curDay) * monthInfo.totalDays)
          oAmBonusSource = 'sales_pcs_mtd'
        } else {
          const lastMonthAM = lastMonthExpenses
            .filter(e => e.outlet_id === outletId && (e.category === 'bonus_area_manager' || e.category === 'bonus_korlap'))
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
          if (lastMonthAM > 0) {
            amBonusMonthly = lastMonthAM
            oAmBonusSource = 'last_month_rollover'
          }
        }
      }

      if (amBonusMonthly > 0) {
        const proratedAmBonus = (oAmBonusSource === 'sales_pcs_mtd' && monthInfo.overlapDays === curDay)
          ? effectiveAmMtdBonus
          : Math.round(amBonusMonthly * monthInfo.ratio)

        totalBonusAmBulanan += amBonusMonthly
        totalBonusAmProrata += proratedAmBonus
        if (bonusAmSource === 'none') bonusAmSource = oAmBonusSource

        proratedRows.push({
          id: `prorata-bonus-am-${outletId}`,
          outlet_id: outletId,
          outlet_name: outletName,
          category: 'bonus_area_manager',
          scope: 'outlet',
          amount: proratedAmBonus,
          description: `Prorata Bonus Area Manager (${durationDesc})`,
          expense_date: filter.to,
          period_month: monthInfo.firstDay,
          source: 'monthly',
        })
      }

      // --- F. BONUS REGIONAL MANAGER (RM) ---
      let rmBonusMonthly = 0
      let oRmBonusSource: 'expenses_real' | 'sales_pcs_mtd' | 'last_month_rollover' | 'none' = 'none'
      let effectiveRmMtdBonus = 0

      const realRmBonus = currentMonthRealFixed.get(outletId)?.get('bonus_regional_manager') ?? 0
      if (realRmBonus > 0) {
        rmBonusMonthly = realRmBonus
        oRmBonusSource = 'expenses_real'
      } else {
        const cRows = crewBonusRecords.filter(c =>
          c.outlet_id === outletId &&
          (c.period_month && c.period_year ? (c.period_month === monthInfo.month && c.period_year === monthInfo.year) : true)
        )
        const outletPcs = cRows.length > 0 ? (Number(cRows[0].total_pcs_outlet) || 0) : 0
        effectiveRmMtdBonus = outletPcs * 50

        if (effectiveRmMtdBonus > 0) {
          rmBonusMonthly = Math.round((effectiveRmMtdBonus / curDay) * monthInfo.totalDays)
          oRmBonusSource = 'sales_pcs_mtd'
        } else {
          const lastMonthRM = lastMonthExpenses
            .filter(e => e.outlet_id === outletId && (e.category === 'bonus_regional_manager' || e.category === 'bonus_korlap'))
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
          if (lastMonthRM > 0) {
            rmBonusMonthly = lastMonthRM
            oRmBonusSource = 'last_month_rollover'
          }
        }
      }

      if (rmBonusMonthly > 0) {
        const proratedRmBonus = (oRmBonusSource === 'sales_pcs_mtd' && monthInfo.overlapDays === curDay)
          ? effectiveRmMtdBonus
          : Math.round(rmBonusMonthly * monthInfo.ratio)

        totalBonusRmBulanan += rmBonusMonthly
        totalBonusRmProrata += proratedRmBonus
        if (bonusRmSource === 'none') bonusRmSource = oRmBonusSource

        proratedRows.push({
          id: `prorata-bonus-rm-${outletId}`,
          outlet_id: outletId,
          outlet_name: outletName,
          category: 'bonus_regional_manager',
          scope: 'outlet',
          amount: proratedRmBonus,
          description: `Prorata Bonus Regional Manager (${durationDesc})`,
          expense_date: filter.to,
          period_month: monthInfo.firstDay,
          source: 'monthly',
        })
      }
    }

    return {
      rows: [...variableExpenses, ...proratedRows],
      isProrated: true,
      monthInfo,
      categoryBreakdown: {
        gaji_crew_outlet: {
          nominalBulanan: totalGajiBulanan,
          nominalProrata: totalGajiProrata,
          source: gajiSource,
        },
        sewa_outlet: {
          nominalBulanan: totalSewaBulanan,
          nominalProrata: totalSewaProrata,
          source: sewaSource,
        },
        internet: {
          nominalBulanan: totalInternetBulanan,
          nominalProrata: totalInternetProrata,
          source: internetSource,
        },
        bonus_crew: {
          nominalBulanan: totalBonusCrewBulanan,
          nominalProrata: totalBonusCrewProrata,
          source: bonusCrewSource,
        },
        bonus_area_manager: {
          nominalBulanan: totalBonusAmBulanan,
          nominalProrata: totalBonusAmProrata,
          source: bonusAmSource,
        },
        bonus_regional_manager: {
          nominalBulanan: totalBonusRmBulanan,
          nominalProrata: totalBonusRmProrata,
          source: bonusRmSource,
        },
      },
    }
  }

  // =========================================================================
  // MODE 2: BULAN LAMPAU / BUKAN BULAN BERJALAN (HISTORICAL / CLOSED PERIODS)
  // Beban sewa, internet, dan operasional diambil murni dari tabel expenses.
  // Beban gaji crew outlet disuplai langsung dari modul HR (payroll_records / staff_financials)
  // sebagai single source of truth.
  // Baris manual gaji di expenses dihapus agar tidak terjadi double-counting.
  // =========================================================================
  const activePeriods = periods.length > 0 ? periods : [{
    year: cur.year,
    month: cur.month,
    firstDay: cur.firstDay,
    lastDay: cur.lastDay,
    totalDays: cur.totalDays,
    overlapDays: 0,
    ratio: 1,
    isFullMonth: true,
  }]

  // Outlet-outlet yang memiliki slip gaji atau master staf aktif di HR (kru toko)
  const outletsWithHrSalary = new Set<string>()
  payrollRecords.forEach(p => {
    if (p.outlet_id && (Number(p.total_salary) || 0) > 0 && p.role !== 'area_manager' && p.role !== 'regional_manager') {
      outletsWithHrSalary.add(p.outlet_id)
    }
  })
  staffFinancials.forEach(s => {
    if (s.outlet_id && s.role !== 'area_manager' && s.role !== 'regional_manager') {
      outletsWithHrSalary.add(s.outlet_id)
    }
  })

  // Outlet-outlet yang memiliki data di modul bonus crew atau di slip HR
  const outletsWithBonus = new Set<string>()
  crewBonusRecords.forEach(c => {
    if (c.outlet_id && ((Number(c.total_bonus) || 0) > 0 || (Number(c.total_pcs_outlet) || 0) > 0)) {
      outletsWithBonus.add(c.outlet_id)
    }
  })
  payrollRecords.forEach(p => {
    if (p.outlet_id && (Number(p.bonus) || 0) > 0) {
      outletsWithBonus.add(p.outlet_id)
    }
  })

  // Pisahkan transaksi riil: jika ada baris gaji manual atau bonus manual di expenses
  // untuk outlet yang sudah disuplai dari HR/Bonus modul, buang baris manual tersebut
  // untuk mencegah double counting.
  const variableExpenses = rawExpenses.filter(r => {
    const rawCat = r.category?.toLowerCase() || ''
    const oid = r.outlet_id || ''
    if (isSalaryCat(rawCat) && outletsWithHrSalary.has(oid)) return false
    if (isBonusCat(rawCat) && outletsWithBonus.has(oid)) return false
    return true
  })

  const proratedRows: ExpenseRow[] = []
  let totalGajiBulanan = 0
  let totalGajiProrata = 0
  let gajiSource = 'none'

  let totalBonusCrewBulanan = 0
  let totalBonusCrewProrata = 0
  let bonusCrewSource = 'none'

  let totalBonusAmBulanan = 0
  let totalBonusAmProrata = 0
  let bonusAmSource = 'none'

  let totalBonusRmBulanan = 0
  let totalBonusRmProrata = 0
  let bonusRmSource = 'none'

  for (const p of activePeriods) {
    const pDurationDesc = p.isFullMonth
      ? `1 Bulan Penuh`
      : (p.overlapDays === 1 ? `Beban 1 Hari · 1/${p.totalDays} bln` : `Beban ${p.overlapDays} Hari · ${p.overlapDays}/${p.totalDays} bln`)

    const managerAllocations = computeManagerAllocationsForPeriod(
      p.month,
      p.year,
      payrollRecords,
      staffFinancials,
      input.managerAssignments || [],
      effectiveOperationalOutletIds
    )

    for (const outletId of targetOutletIds) {
      if (
        inactiveOutletIds.has(outletId) &&
        !outletsWithHrSalary.has(outletId) &&
        !outletsWithBonus.has(outletId) &&
        !managerAllocations.has(outletId)
      ) {
        continue
      }
      const outletName = outletNameMap.get(outletId) ?? 'Outlet'

      // 1. Gaji Crew Outlet
      let gajiMonthly = 0
      let oGajiSource: 'payroll_record' | 'staff_master' | 'none' = 'none'

      // Cek payroll_records untuk periode bulan & tahun yang bersangkutan (kru toko non-manajer)
      const pRows = payrollRecords.filter(pr =>
        pr.outlet_id === outletId &&
        pr.role !== 'area_manager' &&
        pr.role !== 'regional_manager' &&
        (pr.period_month && pr.period_year ? (pr.period_month === p.month && pr.period_year === p.year) : true)
      )
      if (pRows.length > 0) {
        gajiMonthly = pRows.reduce((sum, pr) => {
          const tot = Number(pr.total_salary) || 0
          const bon = Number(pr.bonus) || 0
          return sum + Math.max(0, tot - bon)
        }, 0)
        oGajiSource = 'payroll_record'
      }

      // Fallback ke staffFinancials (master staf aktif non-manajer)
      if (gajiMonthly === 0) {
        const sRows = staffFinancials.filter(s =>
          s.outlet_id === outletId &&
          s.role !== 'area_manager' &&
          s.role !== 'regional_manager'
        )
        if (sRows.length > 0) {
          gajiMonthly = sRows.reduce((sum, s) => {
            const b = Number(s.basic_salary) || 0
            const ap = Number(s.allowance_position) || 0
            const ah = Number(s.allowance_presence) || 0
            return sum + b + ap + ah
          }, 0)
          oGajiSource = 'staff_master'
        }
      }

      // Tambahkan alokasi beban gaji manajer (AM & RM) untuk outlet ini
      const allocatedMgrSalary = managerAllocations.get(outletId) || 0
      if (allocatedMgrSalary > 0) {
        gajiMonthly += allocatedMgrSalary
        if (oGajiSource === 'none') oGajiSource = 'payroll_record'
      }

      if (gajiMonthly > 0) {
        const proratedGaji = Math.round(gajiMonthly * p.ratio)
        totalGajiBulanan += gajiMonthly
        totalGajiProrata += proratedGaji
        if (gajiSource === 'none') gajiSource = oGajiSource

        proratedRows.push({
          id: `prorata-gaji-${outletId}-${p.year}-${p.month}`,
          outlet_id: outletId,
          outlet_name: outletName,
          category: 'gaji_crew_outlet',
          scope: 'outlet',
          amount: proratedGaji,
          description: p.isFullMonth
            ? `Gaji Crew Outlet (HR Payroll)`
            : `Prorata Gaji Crew (${pDurationDesc})`,
          expense_date: p.lastDay < filter.to ? p.lastDay : filter.to,
          period_month: p.firstDay,
          source: 'monthly',
        })
      }

      // 2. Bonus Crew Outlet (Modul Bonus Crew / Slip HR)
      const cRows = crewBonusRecords.filter(c =>
        c.outlet_id === outletId &&
        (c.period_month && c.period_year ? (c.period_month === p.month && c.period_year === p.year) : true)
      )
      const outletCrewBonusMonthly = cRows.reduce((sum, c) => sum + (Number(c.total_bonus) || 0), 0)
      const outletPcs = cRows.length > 0 ? (Number(cRows[0].total_pcs_outlet) || 0) : 0
      const hrBonus = pRows.reduce((sum, pr) => sum + (Number(pr.bonus) || 0), 0)
      const finalCrewBonus = hrBonus > 0
        ? hrBonus
        : (outletCrewBonusMonthly > 0 ? outletCrewBonusMonthly : outletPcs * 100)

      if (finalCrewBonus > 0) {
        const proratedCrewBonus = Math.round(finalCrewBonus * p.ratio)
        totalBonusCrewBulanan += finalCrewBonus
        totalBonusCrewProrata += proratedCrewBonus
        if (bonusCrewSource === 'none') {
          bonusCrewSource = hrBonus > 0 ? 'payroll_record' : 'crew_bonus_module'
        }

        proratedRows.push({
          id: `prorata-bonus-crew-${outletId}-${p.year}-${p.month}`,
          outlet_id: outletId,
          outlet_name: outletName,
          category: 'bonus_crew',
          scope: 'outlet',
          amount: proratedCrewBonus,
          description: p.isFullMonth
            ? `Bonus Crew Outlet (Modul Bonus Crew)`
            : `Prorata Bonus Crew (${pDurationDesc})`,
          expense_date: p.lastDay < filter.to ? p.lastDay : filter.to,
          period_month: p.firstDay,
          source: 'monthly',
        })
      }

      // 3. Bonus Area Manager (AM)
      if (outletPcs > 0) {
        const finalAmBonus = outletPcs * 50
        const proratedAmBonus = Math.round(finalAmBonus * p.ratio)
        totalBonusAmBulanan += finalAmBonus
        totalBonusAmProrata += proratedAmBonus
        if (bonusAmSource === 'none') bonusAmSource = 'crew_bonus_module'

        proratedRows.push({
          id: `prorata-bonus-am-${outletId}-${p.year}-${p.month}`,
          outlet_id: outletId,
          outlet_name: outletName,
          category: 'bonus_area_manager',
          scope: 'outlet',
          amount: proratedAmBonus,
          description: p.isFullMonth
            ? `Bonus Area Manager (Modul Bonus Crew)`
            : `Prorata Bonus AM (${pDurationDesc})`,
          expense_date: p.lastDay < filter.to ? p.lastDay : filter.to,
          period_month: p.firstDay,
          source: 'monthly',
        })
      }

      // 4. Bonus Regional Manager (RM)
      if (outletPcs > 0) {
        const finalRmBonus = outletPcs * 50
        const proratedRmBonus = Math.round(finalRmBonus * p.ratio)
        totalBonusRmBulanan += finalRmBonus
        totalBonusRmProrata += proratedRmBonus
        if (bonusRmSource === 'none') bonusRmSource = 'crew_bonus_module'

        proratedRows.push({
          id: `prorata-bonus-rm-${outletId}-${p.year}-${p.month}`,
          outlet_id: outletId,
          outlet_name: outletName,
          category: 'bonus_regional_manager',
          scope: 'outlet',
          amount: proratedRmBonus,
          description: p.isFullMonth
            ? `Bonus Regional Manager (Modul Bonus Crew)`
            : `Prorata Bonus RM (${pDurationDesc})`,
          expense_date: p.lastDay < filter.to ? p.lastDay : filter.to,
          period_month: p.firstDay,
          source: 'monthly',
        })
      }
    }
  }

  const isProrated = activePeriods.some(p => !p.isFullMonth)
  const p0 = activePeriods[0]
  const effectiveMonthInfo: ProrataMonthInfo = (activePeriods.length === 1 && p0)
    ? {
        year: p0.year,
        month: p0.month,
        firstDay: p0.firstDay,
        lastDay: p0.lastDay,
        totalDays: p0.totalDays,
        todayDay: cur.todayDay,
        overlapDays: p0.overlapDays,
        ratio: p0.ratio,
        isCurrentMonth: false,
      }
    : monthInfo

  return {
    rows: [...variableExpenses, ...proratedRows],
    isProrated,
    monthInfo: effectiveMonthInfo,
    categoryBreakdown: {
      ...emptyBreakdown,
      gaji_crew_outlet: {
        nominalBulanan: totalGajiBulanan,
        nominalProrata: totalGajiProrata,
        source: gajiSource,
      },
      bonus_crew: {
        nominalBulanan: totalBonusCrewBulanan,
        nominalProrata: totalBonusCrewProrata,
        source: bonusCrewSource,
      },
      bonus_area_manager: {
        nominalBulanan: totalBonusAmBulanan,
        nominalProrata: totalBonusAmProrata,
        source: bonusAmSource,
      },
      bonus_regional_manager: {
        nominalBulanan: totalBonusRmBulanan,
        nominalProrata: totalBonusRmProrata,
        source: bonusRmSource,
      },
    },
  }
}


export * from './opexDateRangeProrata'
