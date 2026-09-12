/**
 * Modul Prorata OPEX Realtime untuk Laba Rugi Suka Shawarma.
 * 
 * Mengonversi pos beban tetap bulanan (Gaji Crew Outlet, Sewa Outlet, Internet)
 * menjadi beban akrual harian proporsional khusus pada bulan berjalan,
 * sehingga metrik OPEX harian dan MTD tidak mengalami lonjakan (spike) di akhir bulan.
 */

import type { ExpenseRow } from '@/hooks/useExpenses'
import type { PeriodFilterValue } from '@/lib/types'
import { isTestOutlet } from '@/lib/outletFilters'

export const PRORATED_CATEGORIES = ['gaji_crew_outlet', 'sewa_outlet', 'internet'] as const
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

export interface ProrataMonthInfo {
  year: number
  month: number // 1-indexed (1 = Januari, 9 = September)
  firstDay: string // YYYY-MM-01
  lastDay: string // YYYY-MM-DD
  totalDays: number
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
} {
  const jkt = new Date(now.getTime() + 7 * 3600 * 1000)
  const year = jkt.getUTCFullYear()
  const month = jkt.getUTCMonth() + 1
  const todayStr = jkt.toISOString().slice(0, 10)

  const mm = String(month).padStart(2, '0')
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstDay = `${year}-${mm}-01`
  const lastDay = `${year}-${mm}-${String(totalDays).padStart(2, '0')}`

  return { year, month, firstDay, lastDay, totalDays, todayStr }
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
  }
}

export interface CalculateProrataInput {
  filter: PeriodFilterValue
  rawExpenses: ExpenseRow[]
  payrollRecords?: { outlet_id: string; total_salary: number }[]
  staffFinancials?: {
    outlet_id: string
    basic_salary: number
    allowance_position?: number
    allowance_presence?: number
  }[]
  lastMonthExpenses?: RolloverExpenseBaseline[]
  now?: Date
  outlets?: { id: string; name: string }[]
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
    now = new Date(),
    outlets = [],
  } = input

  const monthInfo = calculateMonthOverlap(filter.from, filter.to, now)

  // Default breakdown
  const emptyBreakdown = {
    gaji_crew_outlet: { nominalBulanan: 0, nominalProrata: 0, source: 'none' },
    sewa_outlet: { nominalBulanan: 0, nominalProrata: 0, source: 'none' },
    internet: { nominalBulanan: 0, nominalProrata: 0, source: 'none' },
  }

  // Jika bukan bulan berjalan atau tidak ada irisan hari, kembalikan data riil 100%
  if (!monthInfo.isCurrentMonth || monthInfo.overlapDays === 0) {
    return {
      rows: rawExpenses,
      isProrated: false,
      monthInfo,
      categoryBreakdown: emptyBreakdown,
    }
  }

  // Nama outlet lookup
  const outletNameMap = new Map<string, string>()
  outlets.forEach(o => outletNameMap.set(o.id, o.name))
  rawExpenses.forEach(r => {
    if (r.outlet_id && r.outlet_name) outletNameMap.set(r.outlet_id, r.outlet_name)
  })

  // 1. Pisahkan transaksi riil: variabel (petty cash, lembur, dll) vs beban tetap yang akan diprorata
  const variableExpenses: ExpenseRow[] = []
  // Map per outlet untuk transaksi riil bulan berjalan yang masuk kategori tetap
  const currentMonthRealFixed = new Map<string, Map<ProratedCategory, number>>()

  const isProratedCat = (cat: string): cat is ProratedCategory =>
    PRORATED_CATEGORIES.includes(cat as ProratedCategory) ||
    cat === 'salary' ||
    cat === 'gaji' ||
    cat === 'sewa' ||
    cat === 'wifi'

  const normalizeCategory = (cat: string): ProratedCategory => {
    if (cat === 'salary' || cat === 'gaji' || cat === 'gaji_crew_outlet') return 'gaji_crew_outlet'
    if (cat === 'sewa' || cat === 'sewa_outlet') return 'sewa_outlet'
    if (cat === 'wifi' || cat === 'internet') return 'internet'
    return cat as ProratedCategory
  }

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

  // 2. Tentukan himpunan outlet target
  const targetOutletIds = new Set<string>()
  if (filter.outletId && filter.outletId !== 'all') {
    targetOutletIds.add(filter.outletId)
  } else {
    outlets.forEach(o => {
      if (!isTestOutlet(o.id)) targetOutletIds.add(o.id)
    })
    payrollRecords.forEach(p => {
      if (p.outlet_id && !isTestOutlet(p.outlet_id)) targetOutletIds.add(p.outlet_id)
    })
    staffFinancials.forEach(s => {
      if (s.outlet_id && !isTestOutlet(s.outlet_id)) targetOutletIds.add(s.outlet_id)
    })
    lastMonthExpenses.forEach(l => {
      if (l.outlet_id && !isTestOutlet(l.outlet_id)) targetOutletIds.add(l.outlet_id)
    })
    currentMonthRealFixed.forEach((_, oid) => {
      if (oid !== 'ALL' && !isTestOutlet(oid)) targetOutletIds.add(oid)
    })
  }

  // 3. Hitung baseline per kategori untuk setiap outlet
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

  for (const outletId of targetOutletIds) {
    const outletName = outletNameMap.get(outletId) ?? 'Outlet'

    // --- A. GAJI CREW OUTLET ---
    let gajiMonthly = 0
    let oGajiSource: 'payroll_record' | 'staff_master' | 'expenses_real' | 'none' = 'none'

    // 1. Cek payroll_records
    const pRows = payrollRecords.filter(p => p.outlet_id === outletId)
    if (pRows.length > 0) {
      gajiMonthly = pRows.reduce((sum, p) => sum + (Number(p.total_salary) || 0), 0)
      oGajiSource = 'payroll_record'
    }

    // 2. Fallback ke staffFinancials (master staf)
    if (gajiMonthly === 0) {
      const sRows = staffFinancials.filter(s => s.outlet_id === outletId)
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
        description: `Prorata Gaji Crew (${monthInfo.overlapDays}/${monthInfo.totalDays} hr)`,
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
      // Rollover bulan lalu
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
        description: `Prorata Sewa Outlet (${monthInfo.overlapDays}/${monthInfo.totalDays} hr)`,
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
      // Rollover bulan lalu
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
        description: `Prorata Internet (${monthInfo.overlapDays}/${monthInfo.totalDays} hr)`,
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
    },
  }
}
