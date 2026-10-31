/* ── Ringkasan payroll HR (inti hitungan) ────────────────────────────────────
 *
 * BUKAN berkas 'use server': fungsi di sini berjalan dengan service-role client
 * (melewati RLS) dan mengembalikan gaji tiap karyawan, jadi tidak boleh bisa
 * dipanggil langsung dari browser. Pintu yang boleh dipanggil browser ada di
 * app/actions/hrPayroll.ts dan memeriksa peran lebih dulu. Kode server lain
 * yang sudah punya penjaganya sendiri (mitraPnl, mitraRoi) memanggil inti ini.
 */

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
  fullAllocatedBasicSalary?: number
  fullAllocatedAllowances?: number
  fullAllocatedDeductions?: number
  fullAllocatedRoutine?: number
  coachedOutletsCount: number
  totalPcs?: number
  status: 'draft' | 'finalized'
  partialRatio?: number
  partialDays?: number
  partialTotalDays?: number
  partialNote?: string
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

export interface CrewOutletBreakdown {
  outletId: string
  outletName: string
  attendanceDays: number
  basicSalary: number
  allowances: number
  deductions: number
  routineSalary: number
  ratio?: number
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
  allocatedOutletIds?: string[]
  outletBreakdowns?: CrewOutletBreakdown[]
  attendanceDays?: number
  totalWorkDays?: number
  attendanceRatio?: number
  partialNote?: string
  splitNote?: string
}

export interface OutletOperationalInfo {
  isPartial: boolean
  activeDays: number
  totalMonthDays: number
  /** Selalu diisi oleh setiap titik yang mengisi outletOperationalMap. */
  operationalCalendarDays: number
  calendarRatio?: number
  firstDate?: string
  lastDate?: string
  note?: string
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
  isPartial?: boolean
  operationalFirstDate?: string
  operationalLastDate?: string
  operationalCalendarDays?: number
}

export interface HRPayrollPeriodEntry {
  year: number
  month: number
  from: string
  to: string
  summary: HRPayrollSummary
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
  fullCrewBasicSalary?: number
  fullCrewAllowances?: number
  fullCrewDeductions?: number
  fullCrewRoutineSalary?: number
  fullManagerAllocation?: number
  fullTotalRoutineSalary?: number
  managerAllocation?: number
  managerRoutineAllocation?: number
  managerBonusAllocation?: number
  managerBasicSalaryAllocation?: number
  managerAllowancesAllocation?: number
  managerDeductionsAllocation?: number
  managerDetails?: ManagerAllocationDetail[]
  bonusDetails?: StaffBonusDetail[]
  crewBonusDetails?: StaffBonusDetail[]
  /** Bonus kru per outlet tempat bonus itu DIPEROLEH (outletId → rupiah). Jumlahnya = crewBonus. */
  crewBonusByOutlet?: Record<string, number>
  /** Rincian bonus kru per outlet (outletId → penerima). Dipakai untuk memotong tampilan per kelompok (Internal/Mitra). Hanya tampilan multi-outlet. */
  crewBonusDetailsByOutlet?: Record<string, StaffBonusDetail[]>
  /** Alokasi AM/RM/SC per outlet (outletId → manajer). Dipakai untuk memotong tampilan per kelompok. Hanya tampilan multi-outlet. */
  managerDetailsByOutlet?: Record<string, ManagerAllocationDetail[]>
  managerBonusDetails?: StaffBonusDetail[]
  staffDetails?: StaffPayrollDetail[]
  outletOperationalInfo?: OutletOperationalInfo
  /** Rincian per bulan kalender saat rentang tanggal melintasi > 1 bulan. */
  periodBreakdown?: HRPayrollPeriodEntry[]
}

function formatTanggalIndo(dateStr?: string | null): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${Number(d)} ${bulan[Number(m) - 1] || ''} ${y}`
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

function toJakartaDateStr(ts?: string | null): string {
  if (!ts) return ''
  const s = String(ts).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s.slice(0, 10)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

async function fetchAllAttendanceRows(supabase: any, attFrom: string, attTo: string): Promise<any[]> {
  const all: any[] = []
  const pageSize = 1000
  for (let offset = 0; offset < 50000; offset += pageSize) {
    const { data, error } = await supabase
      .from('attendance')
      .select('id, outlet_staff_id, outlet_id, ts_server')
      .gte('ts_server', `${attFrom}T00:00:00+07:00`)
      .lte('ts_server', `${attTo}T23:59:59+07:00`)
      .in('type', ['in', 'masuk'])
      .order('ts_server', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
  }
  return all
}

async function fetchAllAttendanceLogs(supabase: any, attFrom: string, attTo: string): Promise<any[]> {
  const all: any[] = []
  const pageSize = 1000
  for (let offset = 0; offset < 50000; offset += pageSize) {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('id, staff_id, outlet_id, date')
      .gte('date', attFrom)
      .lte('date', attTo)
      .eq('status', 'hadir')
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
  }
  return all
}

async function runInBatches<T>(factories: (() => Promise<T>)[], batchSize = 6): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < factories.length; i += batchSize) {
    const chunk = factories.slice(i, i + batchSize)
    const chunkRes = await Promise.all(chunk.map(fn => fn()))
    results.push(...chunkRes)
  }
  return results
}

function emptyHrSummary(): HRPayrollSummary {
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

const HR_SUMMARY_CACHE_TTL_MS = 10_000
const hrSummaryMemo = new Map<string, { expiresAt: number; promise: Promise<HRPayrollSummary> }>()

function gabungDaftarBonus(lists: (StaffBonusDetail[] | undefined)[]): StaffBonusDetail[] {
  const map = new Map<string, StaffBonusDetail>()
  for (const list of lists) {
    for (const item of list ?? []) {
      const existing = map.get(item.staffId)
      if (!existing) {
        map.set(item.staffId, {
          ...item,
          backupDates: item.backupDates ? [...item.backupDates] : undefined
        })
        continue
      }
      existing.bonus += item.bonus
      existing.totalPcs = (existing.totalPcs || 0) + (item.totalPcs || 0)
      if (item.backupDates && item.backupDates.length > 0) {
        const mergedDates = Array.from(new Set([...(existing.backupDates || []), ...item.backupDates])).sort()
        existing.backupDates = mergedDates
        existing.backupDatesFormatted = formatBackupDatesSummary(mergedDates)
        if (existing.isBackup && mergedDates.length > 0) {
          existing.backupNote = `Tanggal backup: ${existing.backupDatesFormatted} (${mergedDates.length} hari)`
        }
      }
      if (item.status === 'draft') existing.status = 'draft'
    }
  }
  return Array.from(map.values()).sort((a, b) => b.bonus - a.bonus)
}

function gabungRingkasanMultiPeriode(
  entries: HRPayrollPeriodEntry[],
  target: string
): HRPayrollSummary {
  const nonEmpty = entries.filter(e => e.summary.status !== 'empty' && e.summary.totalStaff > 0)
  if (nonEmpty.length === 0) {
    return {
      ...(entries[entries.length - 1]?.summary ?? emptyHrSummary()),
      periodBreakdown: entries
    }
  }

  // Gunakan periode aktif terakhir sebagai baseline acuan 1 bulan penuh (agar kartu "Baseline 1 bln"
  // dan daftar kru tidak membengkak 2x lipat atau memicu duplikasi key={staffId}), sementara seluruh
  // perhitungan aktual lintas bulan membaca `periodBreakdown` secara eksak per bulan kalender.
  const base = nonEmpty[nonEmpty.length - 1].summary

  const crewBonus = entries.reduce((s, e) => s + (e.summary.crewBonus || 0), 0)
  const managerBonusAllocation = entries.reduce((s, e) => s + (e.summary.managerBonusAllocation || 0), 0)
  const bonus = target === 'PUSAT' ? crewBonus : (crewBonus + managerBonusAllocation)

  const crewBonusByOutlet: Record<string, number> = {}
  const crewBonusListsByOutlet = new Map<string, StaffBonusDetail[][]>()
  const mgrBonusByOutlet = new Map<string, number>()

  for (const e of entries) {
    for (const [oid, amt] of Object.entries(e.summary.crewBonusByOutlet ?? {})) {
      crewBonusByOutlet[oid] = (crewBonusByOutlet[oid] || 0) + (Number(amt) || 0)
    }
    for (const [oid, list] of Object.entries(e.summary.crewBonusDetailsByOutlet ?? {})) {
      if (!crewBonusListsByOutlet.has(oid)) crewBonusListsByOutlet.set(oid, [])
      crewBonusListsByOutlet.get(oid)!.push(list)
    }
    for (const o of e.summary.outlets ?? []) {
      if (o.outletId && o.managerBonusAllocation) {
        mgrBonusByOutlet.set(o.outletId, (mgrBonusByOutlet.get(o.outletId) || 0) + o.managerBonusAllocation)
      }
    }
  }

  const crewBonusDetails = gabungDaftarBonus(entries.map(e => e.summary.crewBonusDetails))
  const getPriority = (role: string = '') => {
    const r = role.toLowerCase()
    if (r === 'regional_manager' || r === 'rm') return 1
    if (r === 'area_manager' || r === 'am') return 2
    if (r === 'stock_controller' || r === 'sc') return 3
    return 4
  }
  const managerBonusDetails = gabungDaftarBonus(entries.map(e => e.summary.managerBonusDetails)).sort((a, b) => {
    const diff = getPriority(a.role) - getPriority(b.role)
    return diff !== 0 ? diff : b.bonus - a.bonus
  })
  const bonusDetails = [...crewBonusDetails, ...managerBonusDetails].sort((a, b) => b.bonus - a.bonus)

  const crewBonusDetailsByOutlet: Record<string, StaffBonusDetail[]> = {}
  for (const [oid, lists] of crewBonusListsByOutlet.entries()) {
    crewBonusDetailsByOutlet[oid] = gabungDaftarBonus(lists)
  }

  // Gabungkan daftar outlet: pertahankan baseline rutin 1 bulan dari `base`, dan sertakan juga
  // outlet yang hanya aktif di bulan awal rentang (misal tutup di bulan pertama) agar tabel cabang utuh.
  const mergedOutletsMap = new Map<string, HRPayrollOutletSummary>()
  for (const o of base.outlets ?? []) {
    const routine1Bln = Math.max(0, o.totalSalary - (o.bonus || 0))
    const cBon = o.outletId === 'PUSAT' ? 0 : (crewBonusByOutlet[o.outletId] || 0)
    const mBon = o.outletId === 'PUSAT' ? 0 : (mgrBonusByOutlet.get(o.outletId) || 0)
    const totBon = cBon + mBon
    const crewRoutine1Bln = Math.max(0, routine1Bln - (o.managerRoutineAllocation ?? o.managerAllocation ?? 0))
    mergedOutletsMap.set(o.outletId, {
      ...o,
      crewSalary: crewRoutine1Bln + cBon,
      managerBonusAllocation: mBon,
      bonus: totBon,
      totalSalary: routine1Bln + totBon
    })
  }
  for (const e of entries) {
    for (const o of e.summary.outlets ?? []) {
      if (mergedOutletsMap.has(o.outletId)) continue
      const cBon = o.outletId === 'PUSAT' ? 0 : (crewBonusByOutlet[o.outletId] || 0)
      const mBon = o.outletId === 'PUSAT' ? 0 : (mgrBonusByOutlet.get(o.outletId) || 0)
      const totBon = cBon + mBon
      const prevRoutine = Math.max(0, o.totalSalary - (o.bonus || 0))
      if (prevRoutine <= 0 && totBon <= 0) continue
      mergedOutletsMap.set(o.outletId, {
        ...o,
        basicSalary: 0,
        crewSalary: cBon,
        managerAllocation: 0,
        managerRoutineAllocation: 0,
        managerBonusAllocation: mBon,
        bonus: totBon,
        totalSalary: totBon
      })
    }
  }

  const baseRoutine = Math.max(0, base.basicSalary + base.allowances - base.deductions)
  const baseCrewRoutine = Math.max(
    0,
    (base.crewBasicSalary ?? base.basicSalary) + (base.crewAllowances ?? base.allowances) - (base.crewDeductions ?? base.deductions)
  )

  return {
    ...base,
    bonus,
    crewBonus,
    managerBonusAllocation,
    crewSalary: baseCrewRoutine + crewBonus,
    totalSalary: Math.max(1, baseRoutine + bonus),
    outlets: Array.from(mergedOutletsMap.values()).sort((a, b) => b.totalSalary - a.totalSalary),
    crewBonusDetails,
    crewBonusByOutlet,
    crewBonusDetailsByOutlet,
    managerBonusDetails,
    bonusDetails,
    periodBreakdown: entries
  }
}

export async function hitungRingkasanPayrollHr(
  filter: {
    from: string
    to: string
    outletId: string
  },
  customSupabase?: any,
): Promise<HRPayrollSummary> {
  const isTestEnv = Boolean(customSupabase || process.env.VITEST || process.env.NODE_ENV === 'test')
  const cacheKey = `${filter.from}|${filter.to}|${filter.outletId}`
  if (!isTestEnv) {
    const now = Date.now()
    const cached = hrSummaryMemo.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return cached.promise
    }
    if (hrSummaryMemo.size > 100) {
      for (const [k, v] of hrSummaryMemo.entries()) {
        if (v.expiresAt <= now) hrSummaryMemo.delete(k)
      }
    }
  }

  const computePromise = hitungRingkasanPayrollHrInti(filter, customSupabase)
  if (!isTestEnv) {
    hrSummaryMemo.set(cacheKey, {
      expiresAt: Date.now() + HR_SUMMARY_CACHE_TTL_MS,
      promise: computePromise
    })
    computePromise.catch(() => {
      if (hrSummaryMemo.get(cacheKey)?.promise === computePromise) {
        hrSummaryMemo.delete(cacheKey)
      }
    })
  }
  return computePromise
}

async function hitungRingkasanPayrollHrInti(
  filter: {
    from: string
    to: string
    outletId: string
  },
  customSupabase?: any,
): Promise<HRPayrollSummary> {
  try {
    const supabase = customSupabase ?? getServiceSupabase()

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
      return emptyHrSummary()
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
        supabase.from('outlets').select('id, name, slug, type, is_active, status, created_at'),
        supabase
          .from('staff_outlets')
          .select('staff_id, outlet_id, outlet_staff!inner(id, role, is_active)')
          .eq('outlet_staff.is_active', true)
      ])

    if (payrollError) {
      console.error('Error fetching payroll_records for HR summary:', payrollError)
      throw payrollError
    }

    const validPayrollRows = (payrollData || []).filter((r: any) => {
      const staffRaw: any = r.outlet_staff
      const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
      return !isTestOrDevStaff(staffInfo)
    })

    const jakartaToday = toJakartaDateStr(new Date().toISOString())
    const currentMonthFirstDay = `${jakartaToday.slice(0, 7)}-01`

    // Pre-fetch master staf aktif sekali saja bila ada periode >= Sep 2026 s/d bulan berjalan yang belum punya slip HR
    const needsActiveStaffFallback = periods.some(p => {
      const pFirstDay = `${p.year}-${String(p.month).padStart(2, '0')}-01`
      if (pFirstDay < '2026-09-01' || pFirstDay > currentMonthFirstDay) return false
      return !validPayrollRows.some((r: any) => r.period_month === p.month && r.period_year === p.year)
    })

    let activeStaffList: any[] | null = null
    if (needsActiveStaffFallback) {
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
        .not('role', 'in', '("kiosk","mitra","owner")')
      activeStaffList = (activeStaffData || []).filter((s: any) => !isTestOrDevStaff(s))
    }

    const periodEntries: HRPayrollPeriodEntry[] = []
    for (const p of periods) {
      const mm = String(p.month).padStart(2, '0')
      const totalDays = new Date(p.year, p.month, 0).getDate()
      const pStart = `${p.year}-${mm}-01`
      const pEnd = `${p.year}-${mm}-${String(totalDays).padStart(2, '0')}`
      const subFrom = filter.from > pStart ? filter.from : pStart
      const subTo = filter.to < pEnd ? filter.to : pEnd

      const summary = await hitungSatuPeriodePayrollHr({
        supabase,
        period: p,
        subFrom,
        subTo,
        target: filter.outletId,
        outletData: outletData || [],
        assignmentData: assignmentData || [],
        validPayrollRows,
        activeStaffList,
        jakartaToday,
      })

      periodEntries.push({
        year: p.year,
        month: p.month,
        from: subFrom,
        to: subTo,
        summary,
      })
    }

    if (periodEntries.length === 1) {
      return periodEntries[0].summary
    }

    return gabungRingkasanMultiPeriode(periodEntries, filter.outletId)
  } catch (err: any) {
    console.error('Failed to get HR payroll summary:', err)
    return emptyHrSummary()
  }
}

async function hitungSatuPeriodePayrollHr(params: {
  supabase: any
  period: { month: number; year: number }
  subFrom: string
  subTo: string
  target: string
  outletData: any[]
  assignmentData: any[]
  validPayrollRows: any[]
  activeStaffList: any[] | null
  jakartaToday: string
}): Promise<HRPayrollSummary> {
  try {
    const {
      supabase,
      period: primaryPeriod,
      subFrom,
      subTo,
      target,
      outletData,
      assignmentData,
      validPayrollRows,
      activeStaffList,
      jakartaToday,
    } = params

    const periodYm = `${primaryPeriod.year}-${String(primaryPeriod.month).padStart(2, '0')}`
    const periodMonthStart = `${periodYm}-01`
    const totalMonthDays = new Date(primaryPeriod.year, primaryPeriod.month, 0).getDate()
    const periodMonthEnd = `${periodYm}-${String(totalMonthDays).padStart(2, '0')}`
    const currentYm = jakartaToday.slice(0, 7)
    const currentMonthFirstDay = `${currentYm}-01`
    const isRunningIncompleteMonth = periodYm === currentYm && jakartaToday < periodMonthEnd

    let matchingPeriodRows: any[] = validPayrollRows.filter(
      (r: any) => r.period_month === primaryPeriod.month && r.period_year === primaryPeriod.year
    )

    const isSingleOutlet = target !== 'all' && target !== 'PUSAT' && target !== 'ALL_OUTLETS'

    // 1. Build outlet mapping and operational retail outlet set for this calendar month
    const outletNameMap = new Map<string, string>()
    const outletMetaMap = new Map<string, any>()
    const operationalOutletIds: string[] = []
    ;(outletData || []).forEach((o: any) => {
      outletNameMap.set(o.id, o.name)
      outletMetaMap.set(o.id, o)
      if (isExcludedOutlet(o)) return
      if (o.slug === 'sawangan-depok-internal') return
      const createdStr = toJakartaDateStr(o.created_at)
      // Outlet yang baru dibuat setelah akhir bulan periode ini tidak dianggap aktif di bulan sebelumnya,
      // kecuali terbukti punya transaksi selesai pada cekAktivitas di bawah.
      if (createdStr && createdStr > periodMonthEnd) return
      const isOperational = (o.is_active === true || o.is_active !== false) && (o.status === 'active' || !o.status)
      if (isOperational) {
        operationalOutletIds.push(o.id)
      }
    })

    // 1b. Outlet nonaktif (atau dibuat belakangan) yang punya order selesai dalam BULAN KALENDER ini
    // tetap menanggung alokasi gaji manajer 1/N agar baseline bulanan tidak bergeser saat filter sub-rentang tanggal berubah.
    const idAktifSaatIni = new Set(operationalOutletIds)
    const kandidatHistoris = (outletData || []).filter((o: any) =>
      !idAktifSaatIni.has(o.id) &&
      !isExcludedOutlet(o) &&
      o.slug !== 'sawangan-depok-internal' &&
      (!o.type || o.type === 'internal' || o.type === 'mitra')
    )
    if (kandidatHistoris.length > 0 && periodMonthStart <= periodMonthEnd) {
      const cekAktivitas = await runInBatches(
        kandidatHistoris.map((o: any) => async () => {
          const { data } = await supabase
            .from('orders')
            .select('id')
            .eq('outlet_id', o.id)
            .eq('status', 'completed')
            .gte('created_at', `${periodMonthStart}T00:00:00+07:00`)
            .lte('created_at', `${periodMonthEnd}T23:59:59+07:00`)
            .limit(1)
          return (data && data.length > 0) ? (o.id as string) : null
        }),
        6
      )
      cekAktivitas.forEach(id => { if (id) operationalOutletIds.push(id) })
    }

    // 2. Build staff assignment mapping (staff_id -> outlet_id[]) from staff_outlets
    const staffAssignmentsMap = new Map<string, string[]>()
    ;(assignmentData || []).forEach((a: any) => {
      if (!staffAssignmentsMap.has(a.staff_id)) {
        staffAssignmentsMap.set(a.staff_id, [])
      }
      staffAssignmentsMap.get(a.staff_id)!.push(a.outlet_id)
    })
    const managerAssignmentsMap = staffAssignmentsMap

    // Staff info lookup map
    const staffInfoMap = new Map<string, any>()
    ;(validPayrollRows || []).forEach((r: any) => {
      const s = Array.isArray(r.outlet_staff) ? r.outlet_staff[0] : r.outlet_staff
      if (s?.id && !staffInfoMap.has(s.id)) staffInfoMap.set(s.id, s)
    })
    ;(assignmentData || []).forEach((a: any) => {
      const s = Array.isArray(a.outlet_staff) ? a.outlet_staff[0] : a.outlet_staff
      if (s?.id && !staffInfoMap.has(s.id)) staffInfoMap.set(s.id, s)
    })

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

    // Query MTD bonus and pcs for this calendar month + daily bonus detail (batched to prevent 57014 statement timeouts)
    const bonusMap = new Map<string, number>()
    const pcsMap = new Map<string, number>()
    const allCrewBonusRpcRows: any[] = []
    const allDailyBonusRows: any[] = []
    let dailyBonusRpcSucceeded = false

    // Map: `${staff_id}_${outlet_id}` -> { bonus: number, pcs: number, attendanceDays: number }
    const crewOutletBonusMap = new Map<string, { bonus: number; pcs: number; attendanceDays: number }>()

    // Map: `${staff_id}_${outlet_id}` -> Set of dates ('YYYY-MM-DD')
    const staffOutletAttendanceDates = new Map<string, Set<string>>()
    // Map: staff_id -> Map<outlet_id, Set<string>>
    const staffAllOutletsAttendance = new Map<string, Map<string, Set<string>>>()

    try {
      const p = primaryPeriod
      const attFrom = periodMonthStart
      const attTo = periodMonthEnd

      const dailyBonusFactories: (() => Promise<any>)[] = []
      if (target === 'PUSAT') {
        // Kantor Pusat tidak memiliki pool penjualan toko
      } else if (isSingleOutlet) {
        dailyBonusFactories.push(() =>
          supabase.rpc('get_daily_outlet_bonus_detail', {
            p_month: p.month,
            p_year: p.year,
            p_outlet_id: target
          })
        )
      } else {
        const bonusTargetOutletIds = new Set<string>(operationalOutletIds)
        ;(outletData || []).forEach((o: any) => {
          if (o?.type === 'gudang' && o?.is_active === true && o?.status === 'active') {
            bonusTargetOutletIds.add(o.id)
          }
        })
        bonusTargetOutletIds.forEach(oid => {
          dailyBonusFactories.push(() =>
            supabase.rpc('get_daily_outlet_bonus_detail', {
              p_month: p.month,
              p_year: p.year,
              p_outlet_id: oid
            })
          )
        })
      }

      const [crewRes, amRes, rmRes, attRows, logRows, dailyResList] = await Promise.all([
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
        attFrom <= attTo ? fetchAllAttendanceRows(supabase, attFrom, attTo) : Promise.resolve([]),
        attFrom <= attTo ? fetchAllAttendanceLogs(supabase, attFrom, attTo) : Promise.resolve([]),
        runInBatches(dailyBonusFactories, 6)
      ])

      dailyResList.forEach((dRes: any) => {
        if (dRes && !dRes.error && Array.isArray(dRes.data)) {
          dailyBonusRpcSucceeded = true
          allDailyBonusRows.push(...dRes.data)
        }
      })

      if (crewRes.data && Array.isArray(crewRes.data)) {
        allCrewBonusRpcRows.push(...crewRes.data)
        crewRes.data.forEach((b: any) => {
          if (b.crew_id && b.outlet_id) {
            const k = `${b.crew_id}_${b.outlet_id}`
            const prev = crewOutletBonusMap.get(k) || { bonus: 0, pcs: 0, attendanceDays: 0 }
            crewOutletBonusMap.set(k, {
              bonus: prev.bonus + (Number(b.total_bonus) || 0),
              pcs: prev.pcs + (Number(b.total_pcs_outlet) || 0),
              attendanceDays: prev.attendanceDays + (Number(b.attendance_days) || 0)
            })
          }
          if (b.crew_id) {
            const prev = bonusMap.get(b.crew_id) || 0
            bonusMap.set(b.crew_id, prev + (Number(b.total_bonus) || 0))
            pcsMap.set(b.crew_id, (pcsMap.get(b.crew_id) || 0) + (Number(b.total_pcs_outlet) || 0))
          }
        })
      }

      if (Array.isArray(attRows)) {
        attRows.forEach((a: any) => {
          const date = toJakartaDateStr(a.ts_server)
          if (!date || date < attFrom || date > attTo || !a.outlet_staff_id) return
          const k = `${a.outlet_staff_id}_${a.outlet_id}`
          if (!staffOutletAttendanceDates.has(k)) staffOutletAttendanceDates.set(k, new Set())
          staffOutletAttendanceDates.get(k)!.add(date)

          if (!staffAllOutletsAttendance.has(a.outlet_staff_id)) staffAllOutletsAttendance.set(a.outlet_staff_id, new Map())
          const m = staffAllOutletsAttendance.get(a.outlet_staff_id)!
          if (!m.has(a.outlet_id)) m.set(a.outlet_id, new Set())
          m.get(a.outlet_id)!.add(date)
        })
      }

      if (Array.isArray(logRows)) {
        logRows.forEach((l: any) => {
          const date = toJakartaDateStr(l.date)
          if (!date || date < attFrom || date > attTo || !l.staff_id) return
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

    // Deteksi tanggal aktif operasional per outlet (buka lambat / tutup cepat di tengah bulan)
    const outletOperationalMap = new Map<string, OutletOperationalInfo>()
    const outletActiveDatesMap = new Map<string, Set<string>>()

    allDailyBonusRows.forEach((d: any) => {
      if (d.outlet_id && d.bonus_date && (Number(d.total_pcs) > 0 || Number(d.pool_amount) > 0)) {
        if (!outletActiveDatesMap.has(d.outlet_id)) outletActiveDatesMap.set(d.outlet_id, new Set())
        outletActiveDatesMap.get(d.outlet_id)!.add(d.bonus_date)
      }
    })

    staffOutletAttendanceDates.forEach((datesSet, key) => {
      const parts = key.split('_')
      const oid = parts[1]
      if (oid) {
        if (!outletActiveDatesMap.has(oid)) outletActiveDatesMap.set(oid, new Set())
        datesSet.forEach(d => outletActiveDatesMap.get(oid)!.add(d))
      }
    })

    const allCandidateOutlets = new Set<string>([...operationalOutletIds, ...(outletData || []).map((o: any) => o.id)])
    allCandidateOutlets.forEach(oid => {
      const dates = Array.from(outletActiveDatesMap.get(oid) || []).sort()
      const meta = outletMetaMap.get(oid)
      const isInactive = meta?.is_active === false || meta?.status === 'inactive'
      const createdStr = toJakartaDateStr(meta?.created_at)
      const createdAfterPeriod = Boolean(createdStr && createdStr > periodMonthEnd)

      if (dates.length === 0) {
        if (isInactive || createdAfterPeriod) {
          outletOperationalMap.set(oid, {
            isPartial: true,
            activeDays: 0,
            totalMonthDays,
            operationalCalendarDays: 0,
            calendarRatio: 0,
            firstDate: periodMonthStart,
            lastDate: periodMonthStart,
            note: createdAfterPeriod
              ? 'Outlet belum beroperasi pada bulan ini'
              : 'Outlet nonaktif (tidak ada aktivitas operasional di bulan ini)'
          })
        } else {
          outletOperationalMap.set(oid, {
            isPartial: false,
            activeDays: 0,
            totalMonthDays,
            operationalCalendarDays: totalMonthDays,
            calendarRatio: 1,
            firstDate: periodMonthStart,
            lastDate: periodMonthEnd
          })
        }
        return
      }

      const firstDate = dates[0]
      const lastDate = dates[dates.length - 1]

      // Toko buka di tengah bulan jika:
      // 1. Outlet baru dibuat di bulan ini dan mulai aktif setelah tgl 1 (misal Pondok Aren, Ciledug)
      // 2. ATAU aktivitas operasional pertama >= tanggal 7 bulan berjalan (toko yang baru buka operasional seperti Paledang tgl 26)
      const isNewlyCreated = Boolean(createdStr && createdStr >= periodMonthStart)
      const isLateStart = firstDate > periodMonthStart && (isNewlyCreated || firstDate >= `${primaryPeriod.year}-${String(primaryPeriod.month).padStart(2, '0')}-07`)
      // Toko tutup di tengah bulan jika outlet inactive dan aktivitas terakhir < akhir bulan
      const isEarlyEnd = isInactive && lastDate < periodMonthEnd

      if (isLateStart || isEarlyEnd) {
        const opStart = isLateStart ? firstDate : periodMonthStart
        const opEnd = isEarlyEnd ? lastDate : periodMonthEnd
        const diffMs = new Date(opEnd).getTime() - new Date(opStart).getTime()
        const opCalendarDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1)
        const calendarRatio = Math.min(1, Math.max(0, opCalendarDays / totalMonthDays))

        let note = ''
        if (isLateStart && isEarlyEnd) {
          note = `Outlet beroperasi parsial ${formatTanggalIndo(opStart)} s/d ${formatTanggalIndo(opEnd)} (${dates.length} hari kerja aktif, ${opCalendarDays} hari kalender)`
        } else if (isLateStart) {
          note = `Outlet mulai beroperasi pada ${formatTanggalIndo(opStart)} (${dates.length} hari kerja aktif, ${opCalendarDays} hari kalender)`
        } else {
          note = `Outlet nonaktif sejak ${formatTanggalIndo(opEnd)} (${dates.length} hari kerja aktif, ${opCalendarDays} hari kalender)`
        }

        outletOperationalMap.set(oid, {
          isPartial: true,
          activeDays: dates.length,
          totalMonthDays,
          operationalCalendarDays: opCalendarDays,
          calendarRatio,
          firstDate: opStart,
          lastDate: opEnd,
          note
        })
      } else {
        outletOperationalMap.set(oid, {
          isPartial: false,
          activeDays: dates.length,
          totalMonthDays,
          operationalCalendarDays: totalMonthDays,
          calendarRatio: 1,
          firstDate: periodMonthStart,
          lastDate: periodMonthEnd
        })
      }
    })

    // Fallback bulan berjalan: hanya aktif untuk periode >= Sep 2026 s/d bulan berjalan saat slip HR belum digenerate
    if (
      matchingPeriodRows.length === 0 &&
      activeStaffList &&
      periodMonthStart >= '2026-09-01' &&
      periodMonthStart <= currentMonthFirstDay
    ) {
      matchingPeriodRows = activeStaffList
        .filter((s: any) => {
          // Jangan bebankan staf yang berpangkalan di outlet yang baru dibuat setelah akhir periode ini
          if (s.outlet_id) {
            const oMeta = outletMetaMap.get(s.outlet_id)
            const cStr = toJakartaDateStr(oMeta?.created_at)
            if (cStr && cStr > periodMonthEnd && !operationalOutletIds.includes(s.outlet_id)) {
              return false
            }
          }
          return true
        })
        .map((s: any) => {
          const finRaw = Array.isArray(s.staff_financials) ? s.staff_financials[0] : s.staff_financials
          const bSalary = Number(finRaw?.basic_salary || 0)
          const aMeal = Number(finRaw?.allowance_meal || 0)
          const aTransport = Number(finRaw?.allowance_transport || 0)
          const aComm = Number(finRaw?.allowance_communication || 0)
          const aPres = Number(finRaw?.allowance_presence || 0)
          const aPos = Number(finRaw?.allowance_position || 0)
          // Kolom allowance_meal dan allowance_presence merupakan kolom cerminan (mirrored) di DB HR; ambil salah satu agar tidak double-count
          const effMealOrPres = aMeal || aPres
          const deductions = Number(finRaw?.deduction_kasbon || 0) + Number(finRaw?.deduction_bpjs || 0)
          const isCrewRole = ['crew', 'leader', 'kasir', 'kitchen', 'driver'].includes(s.role)
          const crewOutletBonus = isCrewRole && s.outlet_id ? crewOutletBonusMap.get(`${s.id}_${s.outlet_id}`) : null
          const rpcBonus = crewOutletBonus ? crewOutletBonus.bonus : (bonusMap.get(s.id) || 0)
          const bBonus = rpcBonus > 0 ? rpcBonus : (isCrewRole ? 0 : Number(finRaw?.sales_bonus || 0))
          const totalPcs = crewOutletBonus ? crewOutletBonus.pcs : (pcsMap.get(s.id) || (bBonus > 0 ? (s.role === 'area_manager' || s.role === 'regional_manager' ? Math.round(bBonus / 50) : Math.round(bBonus / 100)) : 0))
          const total = Math.max(0, bSalary + effMealOrPres + aTransport + aComm + aPos + bBonus - deductions)

          return {
            id: `draft-${s.id}`,
            period_month: primaryPeriod.month,
            period_year: primaryPeriod.year,
            outlet_id: s.outlet_id,
            basic_salary: bSalary,
            allowance_meal: aMeal,
            allowance_transport: aTransport,
            allowance_communication: aComm,
            allowance_presence: aPres,
            allowance_position: aPos,
            bonus: bBonus,
            total_pcs: totalPcs,
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

    // Populate active staff into staffInfoMap if available
    ;(matchingPeriodRows || []).forEach((r: any) => {
      const s = Array.isArray(r.outlet_staff) ? r.outlet_staff[0] : r.outlet_staff
      if (s?.id && !staffInfoMap.has(s.id)) staffInfoMap.set(s.id, s)
    })

    // Aggregate daily bonus detail strictly within [subFrom, subTo]
    interface DailyCrewBonusAccumulator {
      staffId: string
      staffName: string
      role: string
      subRole: string
      outletId: string
      outletName: string
      bonus: number
      totalPcs: number
      dates: Set<string>
    }

    // Key: isSingleOutlet ? staffId : `${staffId}_${outletId}`
    const dailyCrewBonusMap = new Map<string, DailyCrewBonusAccumulator>()
    // Outlet ID -> total pcs sold in date range
    const outletDailyPcsMap = new Map<string, number>()

    allDailyBonusRows.forEach((d: any) => {
      if (!d.bonus_date) return
      if (d.bonus_date < subFrom || d.bonus_date > subTo) return
      if (isSingleOutlet && d.outlet_id !== target) return

      const totalPcs = Number(d.total_pcs) || 0
      const poolAmount = Number(d.pool_amount) || 0
      const crewCount = Number(d.crew_count) || 0
      const bonusPerCrew = Number(d.bonus_per_crew) || (crewCount > 0 ? Math.floor(poolAmount / crewCount) : 0)

      if (d.outlet_id) {
        outletDailyPcsMap.set(d.outlet_id, (outletDailyPcsMap.get(d.outlet_id) || 0) + totalPcs)
      }

      if (crewCount > 0 && Array.isArray(d.crew_list) && d.crew_list.length > 0) {
        const remainder = totalPcs % crewCount
        d.crew_list.forEach((c: any, idx: number) => {
          if (!c.crew_id) return
          const pcsToday = Math.floor(totalPcs / crewCount) + (idx < remainder ? 1 : 0)
          const bonusToday = bonusPerCrew

          const key = isSingleOutlet ? c.crew_id : `${c.crew_id}_${d.outlet_id}`
          let entry = dailyCrewBonusMap.get(key)
          if (!entry) {
            entry = {
              staffId: c.crew_id,
              staffName: c.crew_name || 'Staff',
              role: c.role || 'crew',
              subRole: c.sub_role || 'crew_regular',
              outletId: d.outlet_id,
              outletName: d.outlet_name || outletNameMap.get(d.outlet_id) || 'Outlet',
              bonus: 0,
              totalPcs: 0,
              dates: new Set<string>()
            }
            dailyCrewBonusMap.set(key, entry)
          }

          entry.bonus += bonusToday
          entry.totalPcs += pcsToday
          entry.dates.add(d.bonus_date)
        })
      }
    })

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

    // (staff_id|outlet_id) yang bonus porsinya sudah dihitung — lihat penjaga di bawah.
    const bonusPcsSudahDihitung = new Set<string>()

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
        const fullG = gSplit.get(tId) || 0
        const fullA = aSplit.get(tId) || 0
        const fullDed = dedSplit.get(tId) || 0
        const fullRoutine = fullG + fullA - fullDed

        let g = fullG
        let a = fullA
        let ded = fullDed

        const opInfo = outletOperationalMap.get(tId)
        let partialRatio: number | undefined
        let partialDays: number | undefined
        let partialTotalDays: number | undefined
        let partialNote: string | undefined

        if (opInfo?.isPartial && opInfo.calendarRatio !== undefined) {
          partialRatio = opInfo.calendarRatio
          partialDays = opInfo.operationalCalendarDays
          partialTotalDays = opInfo.totalMonthDays
          g = Math.round(g * partialRatio)
          a = Math.round(a * partialRatio)
          ded = Math.round(ded * partialRatio)
          partialNote = `Alokasi parsial operasional toko: ${partialDays}/${partialTotalDays} hari (${Math.round(partialRatio * 100)}%)`
        }

        let bon = bonSplit.get(tId) || 0
        let managerPcs = 0
        if (dailyBonusRpcSucceeded || outletDailyPcsMap.size > 0 || isSingleOutlet) {
          // Porsi di outletDailyPcsMap sudah total SELURUH rentang tanggal, sedangkan
          // manajer punya satu slip per bulan. Tanpa penjaga ini, rentang dua bulan
          // memberi bonus "porsi seluruh rentang x 50" ke tiap slip = dua kali lipat.
          const kunciBonus = `${m.staff_id}|${tId}`
          const sudahDihitung = bonusPcsSudahDihitung.has(kunciBonus)
          bonusPcsSudahDihitung.add(kunciBonus)
          const outletPcs = sudahDihitung ? 0 : (outletDailyPcsMap.get(tId) || 0)
          if (role === 'regional_manager') {
            bon = outletPcs * 50
            managerPcs = outletPcs
          } else if (role === 'area_manager') {
            bon = targets.includes(tId) ? (outletPcs * 50) : 0
            managerPcs = targets.includes(tId) ? outletPcs : 0
          } else if (role === 'stock_controller') {
            bon = 0
            managerPcs = 0
          }
        } else {
          managerPcs = Math.round(bon / 50)
        }

        const tot = g + a + bon - ded
        const routineTot = g + a - ded

        let alloc = outletManagerAllocations.get(tId) as (typeof outletManagerAllocations extends Map<string, infer V> ? V : never) & {
          fullBasicSalary?: number
          fullAllowances?: number
          fullDeductions?: number
          fullRoutineSalary?: number
        }
        if (!alloc) {
          alloc = {
            basicSalary: 0,
            allowances: 0,
            bonus: 0,
            deductions: 0,
            totalSalary: 0,
            fullBasicSalary: 0,
            fullAllowances: 0,
            fullDeductions: 0,
            fullRoutineSalary: 0,
            details: []
          }
          outletManagerAllocations.set(tId, alloc as any)
        }
        alloc.basicSalary += g
        alloc.allowances += a
        alloc.bonus += bon
        alloc.deductions += ded
        alloc.totalSalary += tot
        alloc.fullBasicSalary = (alloc.fullBasicSalary || 0) + fullG
        alloc.fullAllowances = (alloc.fullAllowances || 0) + fullA
        alloc.fullDeductions = (alloc.fullDeductions || 0) + fullDed
        alloc.fullRoutineSalary = (alloc.fullRoutineSalary || 0) + fullRoutine
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
          fullAllocatedBasicSalary: fullG,
          fullAllocatedAllowances: fullA,
          fullAllocatedDeductions: fullDed,
          fullAllocatedRoutine: fullRoutine,
          coachedOutletsCount: targets.length,
          totalPcs: managerPcs,
          status: m.status === 'finalized' ? 'finalized' : 'draft',
          partialRatio,
          partialDays,
          partialTotalDays,
          partialNote
        })
      })
    })

    // 4. Canonical per-crew allocation (dipakai bersama oleh outletGroups, tampilan 1 outlet,
    //    Semua Outlet, dan Semua Unit agar angka Buku Kas, Laba Rugi, dan Ringkasan Bisnis identik Rp 0 selisih)
    const ALLOWED_STORE_ROLES = new Set(['crew', 'leader', 'kasir', 'kitchen', 'driver'])
    const isNonRetailBucket = (oid?: string | null): boolean => {
      if (!oid || oid === 'ffffffff-ffff-ffff-ffff-ffffffffffff' || oid === 'PUSAT') return true
      const m = outletMetaMap.get(oid)
      if (!m) return false
      if (m.slug === 'sawangan-depok-internal') return true
      if (m.type === 'office' || m.type === 'test' || m.type === 'system' || m.type === 'marketplace' || m.type === 'online') return true
      return isExcludedOutlet(m) && m.type !== 'gudang'
    }

    interface CanonicalCrewShare {
      outletId: string
      outletName: string
      basic: number
      allowances: number
      deductions: number
      routine: number
      slipBonus: number
      attendanceDays: number
      totalWorkDays: number
      ratio: number
      isSplitBackup: boolean
      partialNote?: string
      splitNote?: string
    }

    interface CanonicalCrewRow {
      rawRow: any
      staffId: string
      staffName: string
      role: string
      staffOutletId?: string
      isPusat: boolean
      contractType: string | null
      subRole: string | null
      onboardingStage: string | null
      isBackup: boolean
      isTrainee: boolean
      isOjt: boolean
      isRegular: boolean
      rawBasic: number
      rawAllowances: number
      rawDeductions: number
      rawRoutine: number
      rawBonus: number
      rawTotal: number
      status: 'draft' | 'finalized'
      targets: string[]
      hasMultiOutletAtt: boolean
      denom: number
      shares: CanonicalCrewShare[]
    }

    const processedCrewRows: CanonicalCrewRow[] = crewRows.map(r => {
      const rawBasic = Number(r.basic_salary || 0)
      const rawAllowances =
        Number(r.allowance_meal || r.allowance_presence || 0) +
        Number(r.allowance_transport || 0) +
        Number(r.allowance_communication || 0) +
        Number(r.allowance_position || 0)
      const rawBonus = Number(r.bonus || 0)
      const rawDeductions = Number(r.deductions || 0)
      const rawRoutine = rawBasic + rawAllowances - rawDeductions
      const rawTotal = Number(r.total_salary || 0)

      const staffRaw: any = r.outlet_staff
      const staffInfo = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
      const staffId: string = r.staff_id
      const staffName: string = staffInfo?.name || 'Staff'
      const role: string = staffInfo?.role || 'crew'
      const staffOutletId: string | undefined = r.outlet_id || staffInfo?.outlet_id || undefined
      const isPusat = !staffOutletId || staffOutletId === 'ffffffff-ffff-ffff-ffff-ffffffffffff' || !ALLOWED_STORE_ROLES.has(role)

      const contractType = staffInfo?.contract_type || (r as any).contract_type || null
      const subRole = staffInfo?.sub_role || (r as any).sub_role || null
      const onboardingStage = staffInfo?.onboarding_stage || (r as any).onboarding_stage || null
      const isBackup = contractType === 'daily' || subRole === 'crew_backup'
      const isTrainee = contractType === 'probation' || subRole === 'crew_trainee'
      const isOjt = contractType === 'intern' || onboardingStage === 'ojt'
      const isRegular = !isBackup && !isTrainee && !isOjt
      const status: 'draft' | 'finalized' = r.status === 'finalized' ? 'finalized' : 'draft'
      // Slip HR karyawan baru / trainee tengah bulan yang gapoknya sudah diprorata HR (< Rp 1,8 jt).
      // Baris draft sintetis bulan berjalan (`draft-*`) dikecualikan agar staf OJT/part-time tetap diprorata wajar di outlet parsial.
      const isHrSlipRow = !String(r.id || '').startsWith('draft-')
      const isAlreadyProratedSlip = isHrSlipRow && rawBasic > 0 && rawBasic < 1_800_000

      if (isPusat) {
        return {
          rawRow: r,
          staffId,
          staffName,
          role,
          staffOutletId: 'PUSAT',
          isPusat: true,
          contractType,
          subRole,
          onboardingStage,
          isBackup,
          isTrainee,
          isOjt,
          isRegular,
          rawBasic,
          rawAllowances,
          rawDeductions,
          rawRoutine,
          rawBonus,
          rawTotal,
          status,
          targets: ['PUSAT'],
          hasMultiOutletAtt: false,
          denom: 26,
          shares: [{
            outletId: 'PUSAT',
            outletName: 'Kantor Pusat',
            basic: rawBasic,
            allowances: rawAllowances,
            deductions: rawDeductions,
            routine: rawRoutine,
            slipBonus: rawBonus,
            attendanceDays: 0,
            totalWorkDays: 26,
            ratio: 1,
            isSplitBackup: false
          }]
        }
      }

      const rawTargets = getCrewBackupTargets(staffId, staffOutletId, isBackup).filter(oid => !isNonRetailBucket(oid))
      const targets = rawTargets.length > 0 ? rawTargets : (staffOutletId && !isNonRetailBucket(staffOutletId) ? [staffOutletId] : [])
      const rawAttMap = staffAllOutletsAttendance.get(staffId)
      const retailAttEntries = rawAttMap
        ? Array.from(rawAttMap.entries()).filter(([oid, dSet]) => !isNonRetailBucket(oid) && dSet.size > 0)
        : []
      const hasMultiOutletAtt = Boolean(rawAttMap && rawAttMap.size > 1 && retailAttEntries.length > 0)

      if (hasMultiOutletAtt && rawAttMap) {
        const totalAttDays = Array.from(rawAttMap.values()).reduce((s, dSet) => s + dSet.size, 0)
        // Di bulan berjalan yang belum selesai, pembagi menggunakan total hari hadir aktual agar tidak terjadi
        // double-proration saat dikalikan lagi dengan rasio kalender berjalan (hari_berjalan / hari_bulan).
        const denom = (isAlreadyProratedSlip || isRunningIncompleteMonth)
          ? Math.max(1, totalAttDays)
          : Math.max(26, totalAttDays)
        const retailAttDays = retailAttEntries.reduce((s, [, dSet]) => s + dSet.size, 0)

        const shares: CanonicalCrewShare[] = retailAttEntries.map(([attOid, dSet]) => {
          const attCount = dSet.size
          const cRatio = Math.min(1, attCount / denom)
          const g = Math.round(rawBasic * cRatio)
          const a = Math.round(rawAllowances * cRatio)
          const ded = Math.round(rawDeductions * cRatio)
          const otherDescs = Array.from(rawAttMap.entries())
            .filter(([oid]) => oid !== attOid)
            .map(([oid, ds]) => {
              const nm = oid === 'ffffffff-ffff-ffff-ffff-ffffffffffff' ? 'Kantor Pusat' : (outletNameMap.get(oid) || 'Cabang Lain')
              return `${nm} (${ds.size} hr)`
            })
            .join(', ')
          return {
            outletId: attOid,
            outletName: outletNameMap.get(attOid) || 'Outlet',
            basic: g,
            allowances: a,
            deductions: ded,
            routine: g + a - ded,
            slipBonus: 0,
            attendanceDays: attCount,
            totalWorkDays: denom,
            ratio: cRatio,
            isSplitBackup: false,
            splitNote: `${attCount}/${denom} hari di outlet ini · Mutasi/tugas lain di: ${otherDescs}`
          }
        })

        // Jika seluruh hari pembagi berada di outlet ritel (mis. 26/26, 27/27, atau slip prorata 13/13),
        // sesuaikan sisa pembulatan ±1 rupiah ke cabang dengan hari hadir terbanyak agar total = 100% slip.
        if (retailAttDays === denom && shares.length > 0) {
          let maxIdx = 0
          for (let i = 1; i < shares.length; i++) {
            if (shares[i].attendanceDays > shares[maxIdx].attendanceDays) maxIdx = i
          }
          shares[maxIdx].basic += rawBasic - shares.reduce((s, x) => s + x.basic, 0)
          shares[maxIdx].allowances += rawAllowances - shares.reduce((s, x) => s + x.allowances, 0)
          shares[maxIdx].deductions += rawDeductions - shares.reduce((s, x) => s + x.deductions, 0)
          shares[maxIdx].routine = shares[maxIdx].basic + shares[maxIdx].allowances - shares[maxIdx].deductions
        }

        if (rawBonus > 0 && shares.length > 0) {
          const homeShare = shares.find(sh => sh.outletId === staffOutletId) || shares[0]
          homeShare.slipBonus = rawBonus
        }

        return {
          rawRow: r,
          staffId,
          staffName,
          role,
          staffOutletId,
          isPusat: false,
          contractType,
          subRole,
          onboardingStage,
          isBackup,
          isTrainee,
          isOjt,
          isRegular,
          rawBasic,
          rawAllowances,
          rawDeductions,
          rawRoutine,
          rawBonus,
          rawTotal,
          status,
          targets: shares.map(sh => sh.outletId),
          hasMultiOutletAtt: true,
          denom,
          shares
        }
      }

      if (isBackup && targets.length > 1 && retailAttEntries.length === 0) {
        const gSplit = distributeEqualSplit(rawBasic, targets)
        const aSplit = distributeEqualSplit(rawAllowances, targets)
        const dedSplit = distributeEqualSplit(rawDeductions, targets)
        const shares: CanonicalCrewShare[] = targets.map(tId => {
          const g = gSplit.get(tId) || 0
          const a = aSplit.get(tId) || 0
          const ded = dedSplit.get(tId) || 0
          return {
            outletId: tId,
            outletName: outletNameMap.get(tId) || 'Outlet',
            basic: g,
            allowances: a,
            deductions: ded,
            routine: g + a - ded,
            slipBonus: tId === staffOutletId ? rawBonus : 0,
            attendanceDays: 0,
            totalWorkDays: 26,
            ratio: 1 / targets.length,
            isSplitBackup: true
          }
        })
        if (rawBonus > 0 && !shares.some(sh => sh.slipBonus > 0) && shares.length > 0) {
          shares[0].slipBonus = rawBonus
        }
        return {
          rawRow: r,
          staffId,
          staffName,
          role,
          staffOutletId,
          isPusat: false,
          contractType,
          subRole,
          onboardingStage,
          isBackup,
          isTrainee,
          isOjt,
          isRegular,
          rawBasic,
          rawAllowances,
          rawDeductions,
          rawRoutine,
          rawBonus,
          rawTotal,
          status,
          targets,
          hasMultiOutletAtt: false,
          denom: 26,
          shares
        }
      }

      // Di bulan berjalan yang belum selesai: bila kru backup multi-cabang baru tercatat absen sedikit hari di 1 cabang,
      // bebankan porsi hari hadir riil ke cabang tersebut dan bagi rata sisa kapasitas standby ke seluruh cabang binaan
      // agar tidak menumpuk 100% beban bulanan ke satu cabang hanya karena 1 hari kunjungan backup.
      if (isBackup && targets.length > 1 && retailAttEntries.length === 1 && isRunningIncompleteMonth) {
        const [earnedOid, earnedSet] = retailAttEntries[0]
        const attCount = earnedSet.size
        const elapsedMonthDays = Math.max(1, Number(jakartaToday.slice(8, 10)) || 1)
        const expectedWorkDays = Math.max(attCount, Math.max(1, Math.round((elapsedMonthDays * 26) / Math.max(1, totalMonthDays))))
        if (attCount < expectedWorkDays) {
          const earnedRatio = attCount / expectedWorkDays
          const earnedG = Math.round(rawBasic * earnedRatio)
          const earnedA = Math.round(rawAllowances * earnedRatio)
          const earnedDed = Math.round(rawDeductions * earnedRatio)

          const allSplitTargets = targets.includes(earnedOid) ? targets : [earnedOid, ...targets]
          const gSplit = distributeEqualSplit(rawBasic - earnedG, allSplitTargets)
          const aSplit = distributeEqualSplit(rawAllowances - earnedA, allSplitTargets)
          const dedSplit = distributeEqualSplit(rawDeductions - earnedDed, allSplitTargets)

          const shares: CanonicalCrewShare[] = allSplitTargets.map(tId => {
            const isEarned = tId === earnedOid
            const g = (gSplit.get(tId) || 0) + (isEarned ? earnedG : 0)
            const a = (aSplit.get(tId) || 0) + (isEarned ? earnedA : 0)
            const ded = (dedSplit.get(tId) || 0) + (isEarned ? earnedDed : 0)
            const shRatio = rawBasic > 0 ? g / rawBasic : (1 / allSplitTargets.length)
            return {
              outletId: tId,
              outletName: outletNameMap.get(tId) || 'Outlet',
              basic: g,
              allowances: a,
              deductions: ded,
              routine: g + a - ded,
              slipBonus: tId === earnedOid ? rawBonus : 0,
              attendanceDays: isEarned ? attCount : 0,
              totalWorkDays: expectedWorkDays,
              ratio: shRatio,
              isSplitBackup: true,
              splitNote: isEarned
                ? `${attCount} hr backup di cabang ini + bagi rata standby (${allSplitTargets.length} cbg)`
                : `Alokasi standby kru backup (${allSplitTargets.length} cbg)`
            }
          })
          return {
            rawRow: r,
            staffId,
            staffName,
            role,
            staffOutletId,
            isPusat: false,
            contractType,
            subRole,
            onboardingStage,
            isBackup,
            isTrainee,
            isOjt,
            isRegular,
            rawBasic,
            rawAllowances,
            rawDeductions,
            rawRoutine,
            rawBonus,
            rawTotal,
            status,
            targets: allSplitTargets,
            hasMultiOutletAtt: true,
            denom: expectedWorkDays,
            shares
          }
        }
      }

      const singleOid = retailAttEntries[0]?.[0] || targets[0] || staffOutletId || 'PUSAT'
      if (singleOid === 'PUSAT' || isNonRetailBucket(singleOid)) {
        return {
          rawRow: r,
          staffId,
          staffName,
          role,
          staffOutletId: 'PUSAT',
          isPusat: true,
          contractType,
          subRole,
          onboardingStage,
          isBackup,
          isTrainee,
          isOjt,
          isRegular,
          rawBasic,
          rawAllowances,
          rawDeductions,
          rawRoutine,
          rawBonus,
          rawTotal,
          status,
          targets: ['PUSAT'],
          hasMultiOutletAtt: false,
          denom: 26,
          shares: [{
            outletId: 'PUSAT',
            outletName: 'Kantor Pusat',
            basic: rawBasic,
            allowances: rawAllowances,
            deductions: rawDeductions,
            routine: rawRoutine,
            slipBonus: rawBonus,
            attendanceDays: 0,
            totalWorkDays: 26,
            ratio: 1,
            isSplitBackup: false
          }]
        }
      }

      const attCount = staffOutletAttendanceDates.get(`${staffId}_${singleOid}`)?.size || 0
      const opInfo = outletOperationalMap.get(singleOid)
      let cRatio = 1
      let partialNote: string | undefined

      if (opInfo?.isPartial) {
        if ((opInfo.operationalCalendarDays ?? 1) <= 0 && attCount === 0) {
          cRatio = 0
          partialNote = 'Outlet nonaktif (0 hari kerja)'
        } else if (isAlreadyProratedSlip) {
          cRatio = 1
          const effDays = attCount > 0 ? attCount : (opInfo.operationalCalendarDays || 0)
          partialNote = `${effDays}/26 hari kerja · Slip HR sudah proporsional hari masuk`
        } else {
          const metaSingle = outletMetaMap.get(singleOid)
          const isInactiveSingle = metaSingle?.is_active === false || metaSingle?.status === 'inactive'
          const projectedOpWorkDays = (isRunningIncompleteMonth && !isInactiveSingle)
            ? Math.max(attCount, Math.round(((opInfo.operationalCalendarDays || 0) * 26) / Math.max(1, totalMonthDays)))
            : 0
          const effectiveDays = projectedOpWorkDays > 0
            ? projectedOpWorkDays
            : (attCount > 0 ? attCount : (opInfo.operationalCalendarDays || 0))
          cRatio = Math.min(1, effectiveDays / 26)
          partialNote = `${effectiveDays}/26 hari kerja · Proporsional operasional toko (${opInfo.operationalCalendarDays} hari kalender)`
        }
      }

      const g = Math.round(rawBasic * cRatio)
      const a = Math.round(rawAllowances * cRatio)
      const ded = Math.round(rawDeductions * cRatio)

      return {
        rawRow: r,
        staffId,
        staffName,
        role,
        staffOutletId: singleOid,
        isPusat: false,
        contractType,
        subRole,
        onboardingStage,
        isBackup,
        isTrainee,
        isOjt,
        isRegular,
        rawBasic,
        rawAllowances,
        rawDeductions,
        rawRoutine,
        rawBonus,
        rawTotal,
        status,
        targets: [singleOid],
        hasMultiOutletAtt: false,
        denom: 26,
        shares: [{
          outletId: singleOid,
          outletName: outletNameMap.get(singleOid) || 'Outlet',
          basic: g,
          allowances: a,
          deductions: ded,
          routine: g + a - ded,
          slipBonus: rawBonus,
          attendanceDays: attCount,
          totalWorkDays: 26,
          ratio: cRatio,
          isSplitBackup: false,
          partialNote
        }]
      }
    })

    // 4b. Group data per outlet for breakdown list
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

    processedCrewRows.forEach(pc => {
      pc.shares.forEach(sh => {
        const totPortion = sh.routine + sh.slipBonus
        let group = outletGroups.get(sh.outletId)
        if (!group) {
          group = {
            outletId: sh.outletId,
            outletName: sh.outletName,
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
          outletGroups.set(sh.outletId, group)
        }
        group.staffCount++
        group.crewSalary += totPortion
        group.totalSalary += totPortion
        group.basicSalary += sh.basic
        group.bonus += sh.slipBonus
        if (pc.status === 'finalized') {
          group.finalizedCount++
        } else {
          group.draftCount++
        }
      })
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

    // 5. Build Final Aggregation according to target filter
    if (isSingleOutlet) {
      // Filtered to one specific outlet (e.g. SUKA SHAWARMA EMPANG or MITRA PALEDANG)
      const isPartialTarget = Boolean(outletOperationalMap.get(target)?.isPartial)

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
        baselineBasic: number
        baselineAllowances: number
        baselineDeductions: number
        fullBasic: number
        fullAllowances: number
        fullDeductions: number
        fullRoutine: number
        targets: string[]
        status: 'draft' | 'finalized'
        attendanceDays?: number
        totalWorkDays?: number
        attendanceRatio?: number
        partialNote?: string
        splitNote?: string
      }

      const outletCrewItems: ProcessedCrewDetail[] = []

      processedCrewRows.forEach(pc => {
        if (pc.isPusat) return
        const sh = pc.shares.find(x => x.outletId === target)
        if (!sh) return

        const dailyEntry = dailyCrewBonusMap.get(pc.staffId)
        const bonusAtTarget = dailyEntry ? dailyEntry.bonus : ((dailyBonusRpcSucceeded || dailyCrewBonusMap.size > 0) ? 0 : sh.slipBonus)
        const allocatedTotal = sh.routine + bonusAtTarget

        // Untuk outlet parsial (kecuali kru backup 1/N), baseline kontrak 1 bulan adalah kontrak utuh 100%.
        // Untuk outlet reguler (termasuk kru mutasi lintas cabang), baseline di cabang ini adalah porsi cabang ini
        // agar header Card 1 sama persis dengan penjumlahan baris staf di dalamnya.
        const useRawForBaseline = isPartialTarget && !sh.isSplitBackup
        const baselineBasic = useRawForBaseline ? pc.rawBasic : sh.basic
        const baselineAllowances = useRawForBaseline ? pc.rawAllowances : sh.allowances
        const baselineDeductions = useRawForBaseline ? pc.rawDeductions : sh.deductions

        outletCrewItems.push({
          rawRow: pc.rawRow,
          staffId: pc.staffId,
          staffName: pc.staffName,
          role: pc.role,
          contractType: pc.contractType,
          subRole: pc.subRole,
          onboardingStage: pc.onboardingStage,
          isBackup: pc.isBackup,
          isTrainee: pc.isTrainee,
          isOjt: pc.isOjt,
          isRegular: pc.isRegular,
          isSplitBackup: sh.isSplitBackup,
          backupOutletsCount: pc.targets.length,
          allocatedBasic: sh.basic,
          allocatedAllowances: sh.allowances,
          allocatedDeductions: sh.deductions,
          allocatedRoutine: sh.routine,
          allocatedBonus: bonusAtTarget,
          allocatedTotal,
          baselineBasic,
          baselineAllowances,
          baselineDeductions,
          fullBasic: pc.rawBasic,
          fullAllowances: pc.rawAllowances,
          fullDeductions: pc.rawDeductions,
          fullRoutine: pc.rawRoutine,
          targets: pc.targets,
          status: pc.status,
          attendanceDays: sh.attendanceDays,
          totalWorkDays: sh.totalWorkDays,
          attendanceRatio: sh.ratio,
          partialNote: sh.partialNote,
          splitNote: sh.splitNote
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

      let crewBasicSalary = 0
      let crewAllowances = 0
      let crewDeductions = 0
      let fullCrewBasicSalary = 0
      let fullCrewAllowances = 0
      let fullCrewDeductions = 0
      let finalizedCount = 0
      let draftCount = 0
      let crewRegularCount = 0
      let crewBackupCount = 0
      let crewTraineeCount = 0
      let crewOjtCount = 0

      outletCrewItems.forEach(item => {
        crewBasicSalary += item.allocatedBasic
        crewAllowances += item.allocatedAllowances
        crewDeductions += item.allocatedDeductions

        fullCrewBasicSalary += item.baselineBasic
        fullCrewAllowances += item.baselineAllowances
        fullCrewDeductions += item.baselineDeductions

        if (item.isBackup) crewBackupCount++
        else if (item.isTrainee) crewTraineeCount++
        else if (item.isOjt) crewOjtCount++
        else crewRegularCount++

        if (item.status === 'finalized') finalizedCount++
        else draftCount++
      })

      // Dideklarasikan SEBELUM dipakai sebagai cadangan di bawah: outlet tanpa
      // alokasi manajer memakai objek bawaan tanpa fullRoutineSalary, sehingga
      // `??` mengevaluasi variabel ini. Kalau dideklarasikan sesudahnya, JS
      // melempar ReferenceError (temporal dead zone) dan ringkasan payroll gagal.
      const managerRoutineAllocation = mgrAlloc.basicSalary + mgrAlloc.allowances - mgrAlloc.deductions

      const fullCrewRoutineSalary = Math.max(0, fullCrewBasicSalary + fullCrewAllowances - fullCrewDeductions)
      const fullManagerAllocation = (mgrAlloc as any).fullRoutineSalary ?? managerRoutineAllocation
      const fullTotalRoutineSalary = fullCrewRoutineSalary + fullManagerAllocation

      const managerBonusAllocation = mgrAlloc.bonus
      const basicSalary = crewBasicSalary
      const allowances = crewAllowances
      const deductions = crewDeductions

      let status: 'draft' | 'finalized' | 'partial' | 'empty' = 'empty'
      if (outletCrewItems.length > 0) {
        if (finalizedCount > 0 && draftCount === 0) status = 'finalized'
        else if (draftCount > 0 && finalizedCount === 0) status = 'draft'
        else if (draftCount > 0 && finalizedCount > 0) status = 'partial'
      } else if (mgrAlloc.details.length > 0) {
        const mFinal = mgrAlloc.details.filter(d => d.status === 'finalized').length
        const mDraft = mgrAlloc.details.length - mFinal
        if (mFinal > 0 && mDraft === 0) status = 'finalized'
        else if (mDraft > 0 && mFinal === 0) status = 'draft'
        else status = 'partial'
      }

      const seenCrewIds = new Set<string>()
      const combinedCrewBonusList: StaffBonusDetail[] = []

      if (dailyBonusRpcSucceeded || dailyCrewBonusMap.size > 0) {
        // Build directly from exact daily attendance & sales pool (termasuk 0 bonus jika cabang belum beroperasi pada sub-rentang tanggal)
        Array.from(dailyCrewBonusMap.values())
          .filter(e => e.bonus > 0 || e.totalPcs > 0)
          .forEach(entry => {
            const staffId = entry.staffId
            seenCrewIds.add(staffId)

            const staffInfo = staffInfoMap.get(staffId)
            const subRole = entry.subRole || staffInfo?.sub_role || null
            const contractType = staffInfo?.contract_type || null
            const isHome = (staffInfo?.outlet_id === target) || (outletCrewItems.some(i => i.staffId === staffId && !i.isSplitBackup))
            const isBackup = !isHome || subRole === 'crew_backup' || contractType === 'daily'

            const datesAtOutlet = Array.from(entry.dates).sort()
            const backupDatesFormatted = formatBackupDatesSummary(datesAtOutlet)
            let backupNote = ''
            if (isBackup) {
              if (datesAtOutlet.length > 0) {
                backupNote = `Tanggal backup di outlet ini: ${backupDatesFormatted} (${datesAtOutlet.length} hari)`
              } else {
                backupNote = 'Jadwal backup fleksibel di outlet ini'
              }
            }

            const matchingItem = outletCrewItems.find(i => i.staffId === staffId)
            const rowStatus = (matchingItem?.status || 'draft') as 'draft' | 'finalized'

            combinedCrewBonusList.push({
              staffId,
              staffName: entry.staffName,
              role: entry.role,
              subRole,
              contractType,
              isBackup,
              backupDates: datesAtOutlet,
              backupDatesFormatted,
              backupNote,
              outletName: outletNameMap.get(target) || entry.outletName || 'Cabang',
              bonus: entry.bonus,
              totalPcs: entry.totalPcs,
              status: rowStatus
            })
          })
      } else {
        // Fallback: previous logic if no daily records found
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
                backupNote = 'Jadwal backup fleksibel di outlet ini'
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
              : (b.attendance_days ? `Tanggal backup di outlet ini (${b.attendance_days} hari)` : 'Jadwal backup fleksibel di outlet ini')

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
      }

      const crewBonusDetails = combinedCrewBonusList.sort((a, b) => b.bonus - a.bonus)
      const extraBonusCrew = crewBonusDetails.filter(c => !outletCrewItems.some(i => i.staffId === c.staffId))
      const finalCrewBonus = crewBonusDetails.reduce((sum, c) => sum + c.bonus, 0)
      const finalCrewRoutine = Math.max(0, crewBasicSalary + crewAllowances - crewDeductions)
      const finalCrewSalary = finalCrewRoutine + finalCrewBonus
      const finalBonus = finalCrewBonus + mgrAlloc.bonus
      const finalTotalSalary = finalCrewRoutine + managerRoutineAllocation + finalBonus

      const singleGroup = outletGroups.get(target)
      const outletsSummary: HRPayrollOutletSummary[] = singleGroup ? [{
        ...singleGroup,
        crewSalary: finalCrewSalary,
        totalSalary: finalTotalSalary,
        bonus: finalBonus,
        managerAllocation: managerRoutineAllocation,
        managerRoutineAllocation,
        managerBonusAllocation,
        isPartial: outletOperationalMap.get(target)?.isPartial,
        operationalFirstDate: outletOperationalMap.get(target)?.firstDate,
        operationalLastDate: outletOperationalMap.get(target)?.lastDate,
        operationalCalendarDays: outletOperationalMap.get(target)?.operationalCalendarDays,
        status: (singleGroup.finalizedCount > 0 && singleGroup.draftCount === 0
          ? 'finalized'
          : singleGroup.draftCount > 0 && singleGroup.finalizedCount === 0
          ? 'draft'
          : singleGroup.draftCount > 0 && singleGroup.finalizedCount > 0
          ? 'partial'
          : status) as 'draft' | 'finalized' | 'partial' | 'empty'
      }] : []

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
      const finalizedCrewAmount = outletCrewItems.filter(i => i.status === 'finalized').reduce((s, i) => s + i.allocatedTotal, 0)
      const effectiveTotalStaff = outletCrewItems.length > 0
        ? outletCrewItems.length
        : (mgrAlloc.details.length + extraBonusCrew.length)

      return {
        totalSalary: finalTotalSalary,
        totalStaff: effectiveTotalStaff,
        basicSalary,
        allowances,
        bonus: finalBonus,
        deductions,
        draftCount,
        draftAmount: draftCount > 0 ? Math.max(0, finalCrewSalary - finalizedCrewAmount) : 0,
        finalizedCount,
        finalizedAmount: finalizedCrewAmount,
        status,
        outlets: outletsSummary,
        crewSalary: finalCrewSalary,
        crewCount: outletCrewItems.length,
        crewRegularCount,
        crewBackupCount,
        crewTraineeCount,
        crewOjtCount,
        crewBasicSalary,
        crewAllowances,
        crewBonus: finalCrewBonus,
        crewDeductions,
        fullCrewBasicSalary,
        fullCrewAllowances,
        fullCrewDeductions,
        fullCrewRoutineSalary,
        fullManagerAllocation,
        fullTotalRoutineSalary,
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
            allocatedOutletNames: item.targets.map(id => outletNameMap.get(id) || 'Cabang'),
            allocatedOutletIds: item.targets,
            attendanceDays: item.attendanceDays,
            totalWorkDays: item.totalWorkDays,
            attendanceRatio: item.attendanceRatio,
            partialNote: item.partialNote,
            splitNote: item.splitNote
          })),
          ...extraBonusCrew.map(c => ({
            staffId: c.staffId,
            staffName: c.staffName,
            role: c.role || 'crew',
            contractType: c.contractType,
            subRole: c.subRole,
            onboardingStage: null,
            outletId: target,
            outletName: outletNameMap.get(target) || 'Outlet',
            basicSalary: 0,
            allowances: 0,
            bonus: c.bonus,
            deductions: 0,
            routineSalary: 0,
            totalSalary: c.bonus,
            status: c.status,
            isManagerAllocation: false,
            isBackupAllocation: true,
            backupOutletsCount: 1,
            fullRoutineSalary: 0,
            fullBasicSalary: 0,
            fullAllowances: 0,
            fullDeductions: 0,
            allocatedOutletNames: [outletNameMap.get(target) || 'Cabang'],
            allocatedOutletIds: [target]
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
              allocationNote: mgr.partialNote
                ? `${mgr.role === 'area_manager' ? 'Alokasi AM' : mgr.role === 'regional_manager' ? 'Alokasi RM' : 'Alokasi SC'} (1/${mgr.coachedOutletsCount} cbg) · ${mgr.partialNote}`
                : mgr.role === 'area_manager'
                ? `Alokasi 1/${mgr.coachedOutletsCount} cabang (AM)`
                : mgr.role === 'regional_manager'
                ? `Alokasi 1/${mgr.coachedOutletsCount} cabang (RM)`
                : `Alokasi 1/${mgr.coachedOutletsCount} cabang (Stock Controller)`,
              partialNote: mgr.partialNote,
              partialRatio: mgr.partialRatio,
              partialDays: mgr.partialDays,
              partialTotalDays: mgr.partialTotalDays
            }
          })
        ],
        outletOperationalInfo: outletOperationalMap.get(target)
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

    const shareMatchesTarget = (oid: string) => {
      if (target === 'PUSAT') return oid === 'PUSAT'
      if (target === 'ALL_OUTLETS') return oid !== 'PUSAT'
      return true
    }

    const targetProcessedCrew = processedCrewRows.filter(pc => {
      if (target === 'PUSAT') return pc.isPusat
      if (target === 'ALL_OUTLETS') return !pc.isPusat
      return true
    })

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
    let crewBasicSum = 0
    let crewAllowSum = 0
    let crewDedSum = 0
    let fullCrewBasicSum = 0
    let fullCrewAllowSum = 0
    let fullCrewDedSum = 0
    let multiCrewRegularCount = 0
    let multiCrewBackupCount = 0
    let multiCrewTraineeCount = 0
    let multiCrewOjtCount = 0

    const multiCrewStaffDetails: StaffPayrollDetail[] = []

    targetProcessedCrew.forEach(pc => {
      const activeShares = pc.shares.filter(sh => shareMatchesTarget(sh.outletId))
      if (activeShares.length === 0) return

      const shBasic = activeShares.reduce((s, x) => s + x.basic, 0)
      const shAllow = activeShares.reduce((s, x) => s + x.allowances, 0)
      const shDed = activeShares.reduce((s, x) => s + x.deductions, 0)
      const shSlipBonus = activeShares.reduce((s, x) => s + x.slipBonus, 0)
      const shRoutine = shBasic + shAllow - shDed
      const shTotal = shRoutine + shSlipBonus

      crewBasicSum += shBasic
      crewAllowSum += shAllow
      crewDedSum += shDed
      fullCrewBasicSum += pc.rawBasic
      fullCrewAllowSum += pc.rawAllowances
      fullCrewDedSum += pc.rawDeductions

      basicSalary += shBasic
      allowances += shAllow
      deductions += shDed
      bonus += shSlipBonus
      crewBonus += shSlipBonus
      totalSalary += shTotal
      totalStaff++

      if (pc.status === 'finalized') {
        finalizedCount++
        finalizedAmount += shTotal
      } else {
        draftCount++
        draftAmount += shTotal
      }

      if (pc.isBackup) multiCrewBackupCount++
      else if (pc.isTrainee) multiCrewTraineeCount++
      else if (pc.isOjt) multiCrewOjtCount++
      else multiCrewRegularCount++

      const primaryShare = activeShares[0]
      const displayOutletId = pc.isPusat
        ? 'PUSAT'
        : (activeShares.length === 1 ? primaryShare.outletId : (pc.staffOutletId || primaryShare.outletId))
      const displayOutletName = pc.isPusat
        ? 'Kantor Pusat'
        : (activeShares.length > 1
            ? activeShares.map(x => x.outletName).join(' + ')
            : (primaryShare.outletName || outletNameMap.get(displayOutletId || '') || 'Outlet'))

      const totalAttInTarget = activeShares.reduce((s, x) => s + x.attendanceDays, 0)
      const multiSplitNote = pc.hasMultiOutletAtt
        ? `Mutasi/lintas cabang (${totalAttInTarget}/${pc.denom} hr): ${activeShares.map(x => `${x.outletName} (${x.attendanceDays} hr)`).join(', ')}`
        : undefined
      const singlePartialNote = !pc.hasMultiOutletAtt && activeShares.length === 1 ? primaryShare.partialNote : undefined
      const isBackupSplit = activeShares.some(x => x.isSplitBackup) && pc.targets.length > 1

      multiCrewStaffDetails.push({
        staffId: pc.staffId,
        staffName: pc.staffName,
        role: pc.role,
        contractType: pc.contractType,
        subRole: pc.subRole,
        onboardingStage: pc.onboardingStage,
        outletId: displayOutletId,
        outletName: displayOutletName,
        basicSalary: shBasic,
        allowances: shAllow,
        bonus: shSlipBonus,
        deductions: shDed,
        routineSalary: shRoutine,
        totalSalary: shTotal,
        status: pc.status,
        isManagerAllocation: false,
        isBackupAllocation: isBackupSplit,
        backupOutletsCount: pc.targets.length,
        fullRoutineSalary: pc.rawRoutine,
        fullBasicSalary: pc.rawBasic,
        fullAllowances: pc.rawAllowances,
        fullDeductions: pc.rawDeductions,
        allocatedOutletNames: pc.targets.map(id => id === 'PUSAT' ? 'Kantor Pusat' : (outletNameMap.get(id) || 'Cabang')),
        allocatedOutletIds: pc.targets,
        outletBreakdowns: pc.isPusat
          ? undefined
          : activeShares.map(sh => ({
              outletId: sh.outletId,
              outletName: sh.outletName,
              attendanceDays: sh.attendanceDays,
              basicSalary: sh.basic,
              allowances: sh.allowances,
              deductions: sh.deductions,
              routineSalary: sh.routine,
              ratio: sh.ratio
            })),
        attendanceDays: totalAttInTarget,
        totalWorkDays: pc.denom,
        attendanceRatio: activeShares.length === 1 ? primaryShare.ratio : Math.min(1, totalAttInTarget / pc.denom),
        partialNote: singlePartialNote,
        splitNote: multiSplitNote
      })
    })

    // Alokasi manajer (AM/RM/SC) yang benar-benar dibebankan ke outlet, dijumlah lintas outlet.
    let mgrBasicAlloc = 0
    let mgrAllowAlloc = 0
    let mgrDedAlloc = 0
    let mgrBonusFromAlloc = 0
    let fullMgrRoutineAlloc = 0
    const manajerAgregat = new Map<string, ManagerAllocationDetail>()
    const manajerOutlet = new Map<string, Set<string>>()
    if (target !== 'PUSAT') {
      for (const [oid, alloc] of outletManagerAllocations.entries()) {
        mgrBasicAlloc += alloc.basicSalary
        mgrAllowAlloc += alloc.allowances
        mgrDedAlloc += alloc.deductions
        mgrBonusFromAlloc += alloc.bonus
        alloc.details.forEach(d => {
          const sebelumnya = manajerAgregat.get(d.staffId)
          const outletSet = manajerOutlet.get(d.staffId) ?? new Set<string>()
          outletSet.add(oid)
          manajerOutlet.set(d.staffId, outletSet)
          const dFullBasic = d.fullAllocatedBasicSalary ?? d.allocatedBasicSalary ?? 0
          const dFullAllow = d.fullAllocatedAllowances ?? d.allocatedAllowances ?? 0
          const dFullDed = d.fullAllocatedDeductions ?? d.allocatedDeductions ?? 0
          const dFullRoutine = d.fullAllocatedRoutine ?? (dFullBasic + dFullAllow - dFullDed)
          fullMgrRoutineAlloc += dFullRoutine

          if (!sebelumnya) {
            manajerAgregat.set(d.staffId, {
              ...d,
              fullAllocatedBasicSalary: dFullBasic,
              fullAllocatedAllowances: dFullAllow,
              fullAllocatedDeductions: dFullDed,
              fullAllocatedRoutine: dFullRoutine,
              coachedOutletsCount: outletSet.size
            })
            return
          }
          sebelumnya.allocatedAmount += d.allocatedAmount
          sebelumnya.routineAmount = (sebelumnya.routineAmount ?? 0) + (d.routineAmount ?? 0)
          sebelumnya.bonusAmount = (sebelumnya.bonusAmount ?? 0) + (d.bonusAmount ?? 0)
          sebelumnya.allocatedBasicSalary = (sebelumnya.allocatedBasicSalary ?? 0) + (d.allocatedBasicSalary ?? 0)
          sebelumnya.allocatedAllowances = (sebelumnya.allocatedAllowances ?? 0) + (d.allocatedAllowances ?? 0)
          sebelumnya.allocatedDeductions = (sebelumnya.allocatedDeductions ?? 0) + (d.allocatedDeductions ?? 0)
          sebelumnya.fullAllocatedBasicSalary = (sebelumnya.fullAllocatedBasicSalary ?? 0) + dFullBasic
          sebelumnya.fullAllocatedAllowances = (sebelumnya.fullAllocatedAllowances ?? 0) + dFullAllow
          sebelumnya.fullAllocatedDeductions = (sebelumnya.fullAllocatedDeductions ?? 0) + dFullDed
          sebelumnya.fullAllocatedRoutine = (sebelumnya.fullAllocatedRoutine ?? 0) + dFullRoutine
          sebelumnya.totalPcs = (sebelumnya.totalPcs ?? 0) + (d.totalPcs ?? 0)
          sebelumnya.coachedOutletsCount = outletSet.size
        })
      }

      basicSalary += mgrBasicAlloc
      allowances += mgrAllowAlloc
      deductions += mgrDedAlloc
      managerBonusAllocation = mgrBonusFromAlloc
      bonus += mgrBonusFromAlloc
      totalSalary += (mgrBasicAlloc + mgrAllowAlloc - mgrDedAlloc + mgrBonusFromAlloc)

      manajerAgregat.forEach(mgr => {
        totalStaff++
        if (mgr.status === 'finalized') {
          finalizedCount++
          finalizedAmount += mgr.allocatedAmount
        } else {
          draftCount++
          draftAmount += mgr.allocatedAmount
        }
      })
    }
    const mgrRoutineAlloc = mgrBasicAlloc + mgrAllowAlloc - mgrDedAlloc

    let status: 'draft' | 'finalized' | 'partial' | 'empty' = 'empty'
    if (totalStaff > 0) {
      if (finalizedCount > 0 && draftCount === 0) status = 'finalized'
      else if (draftCount > 0 && finalizedCount === 0) status = 'draft'
      else if (draftCount > 0 && finalizedCount > 0) status = 'partial'
    }

    let crewBonusDetails: StaffBonusDetail[] = []
    // Rincian per staf di bawah menaruh seluruh bonus seseorang di satu nama outlet;
    // peta ini menyimpan bonus per outlet yang sebenarnya, untuk Laba Rugi per outlet.
    const crewBonusByOutlet: Record<string, number> = {}
    if ((dailyBonusRpcSucceeded && target !== 'PUSAT') || dailyCrewBonusMap.size > 0) {
      const multiCrewMap = new Map<string, StaffBonusDetail>()
      dailyCrewBonusMap.forEach(entry => {
        // Bonus penjualan POS adalah beban cabang ritel tempat transaksi terjadi;
        // jangan masukkan ke Kantor Pusat, tetapi tetap masukkan di ALL_OUTLETS / all
        // meskipun yang mem-backup hari itu adalah staf Kantor Pusat (agar selisih Rp 0 dengan tampilan 1 outlet).
        if (target === 'PUSAT') return

        const staffInfo = staffInfoMap.get(entry.staffId)
        let agg = multiCrewMap.get(entry.staffId)
        if (!agg) {
          const subRole = entry.subRole || staffInfo?.sub_role || null
          const contractType = staffInfo?.contract_type || null
          const isBackup = subRole === 'crew_backup' || contractType === 'daily'
          const matchingPc = targetProcessedCrew.find(pc => pc.staffId === entry.staffId)
          agg = {
            staffId: entry.staffId,
            staffName: entry.staffName,
            role: entry.role,
            subRole,
            contractType,
            isBackup,
            backupDates: [],
            backupDatesFormatted: '',
            backupNote: '',
            outletName: outletNameMap.get(entry.outletId) || entry.outletName || 'Cabang',
            bonus: 0,
            totalPcs: 0,
            status: (matchingPc?.status === 'finalized' ? 'finalized' : 'draft') as 'draft' | 'finalized'
          }
          multiCrewMap.set(entry.staffId, agg)
        }

        agg.bonus += entry.bonus
        if (entry.outletId) crewBonusByOutlet[entry.outletId] = (crewBonusByOutlet[entry.outletId] || 0) + entry.bonus
        agg.totalPcs = (agg.totalPcs || 0) + entry.totalPcs
        entry.dates.forEach(d => {
          if (!agg!.backupDates!.includes(d)) agg!.backupDates!.push(d)
        })
      })

      crewBonusDetails = Array.from(multiCrewMap.values())
        .map(c => {
          c.backupDates!.sort()
          c.backupDatesFormatted = formatBackupDatesSummary(c.backupDates!)
          if (c.isBackup && c.backupDates!.length > 0) {
            c.backupNote = `Tanggal backup: ${c.backupDatesFormatted} (${c.backupDates!.length} hari)`
          }
          return c
        })
        .sort((a, b) => b.bonus - a.bonus)

      if (target !== 'PUSAT' && (dailyBonusRpcSucceeded || outletDailyPcsMap.size > 0)) {
        managerBonusAllocation = Array.from(outletManagerAllocations.values()).reduce((sum, a) => sum + a.bonus, 0)
      }
      crewBonus = crewBonusDetails.reduce((sum, c) => sum + c.bonus, 0)
      bonus = crewBonus + (target === 'PUSAT' ? 0 : managerBonusAllocation)
      totalSalary = basicSalary + allowances + bonus - deductions
    } else {
      crewBonusDetails = targetProcessedCrew
        .filter(pc => pc.rawBonus > 0)
        .map(pc => {
          const staffOutletId = pc.staffOutletId || 'PUSAT'
          const outletName = staffOutletId === 'PUSAT' ? 'Kantor Pusat' : (outletNameMap.get(staffOutletId) || 'Outlet')
          const datesAtOutlet = Array.from(staffOutletAttendanceDates.get(`${pc.staffId}_${staffOutletId}`) || []).sort()
          const backupDatesFormatted = formatBackupDatesSummary(datesAtOutlet)

          let backupNote = ''
          if (pc.isBackup) {
            if (datesAtOutlet.length > 0) {
              backupNote = `Tanggal backup: ${backupDatesFormatted} (${datesAtOutlet.length} hari)`
            } else {
              const otherMap = staffAllOutletsAttendance.get(pc.staffId)
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
            staffId: pc.staffId,
            staffName: pc.staffName,
            role: pc.role,
            subRole: pc.subRole,
            contractType: pc.contractType,
            isBackup: pc.isBackup,
            backupDates: datesAtOutlet,
            backupDatesFormatted,
            backupNote,
            outletName,
            bonus: pc.rawBonus,
            totalPcs: Number((pc.rawRow as any).total_pcs || 0) || Math.round(pc.rawBonus / 100),
            status: pc.status
          }
        })
        .sort((a, b) => b.bonus - a.bonus)
    }

    const outletsSummary: HRPayrollOutletSummary[] = Array.from(relevantGroups.values()).map(g => {
      const op = outletOperationalMap.get(g.outletId)
      const groupRoutine = Math.max(0, g.totalSalary - g.bonus)
      const groupCrewRoutine = Math.max(0, groupRoutine - (g.managerRoutineAllocation ?? g.managerAllocation ?? 0))
      const useRealtimeCrewBonus = (dailyBonusRpcSucceeded || dailyCrewBonusMap.size > 0) && g.outletId !== 'PUSAT'
      const groupCrewBonus = useRealtimeCrewBonus ? (crewBonusByOutlet[g.outletId] || 0) : Math.max(0, g.bonus - (g.managerBonusAllocation || 0))
      const groupBonus = groupCrewBonus + (g.managerBonusAllocation || 0)
      const groupTotal = groupRoutine + groupBonus

      return {
        ...g,
        crewSalary: groupCrewRoutine + groupCrewBonus,
        bonus: groupBonus,
        totalSalary: groupTotal,
        isPartial: op?.isPartial,
        operationalFirstDate: op?.firstDate,
        operationalLastDate: op?.lastDate,
        operationalCalendarDays: op?.operationalCalendarDays,
        status: (g.finalizedCount > 0 && g.draftCount === 0
          ? 'finalized'
          : g.draftCount > 0 && g.finalizedCount === 0
          ? 'draft'
          : g.draftCount > 0 && g.finalizedCount > 0
          ? 'partial'
          : 'empty') as 'draft' | 'finalized' | 'partial' | 'empty'
      }
    }).sort((a, b) => b.totalSalary - a.totalSalary)

    const managerBonusDetails = target !== 'PUSAT' ? managerRows
      // Satu baris per manajer: bonus porsi dihitung per rentang, bukan per slip bulanan.
      .filter((m, i, arr) => (!dailyBonusRpcSucceeded && outletDailyPcsMap.size === 0) || arr.findIndex(x => x.staff_id === m.staff_id) === i)
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

        let mBonus = 0
        let totalPcs = 0
        if (dailyBonusRpcSucceeded || outletDailyPcsMap.size > 0) {
          for (const alloc of outletManagerAllocations.values()) {
            const found = alloc.details.find(d => d.staffId === m.staff_id)
            if (found) {
              mBonus += (found.bonusAmount || 0)
              totalPcs += (found.totalPcs || 0)
            }
          }
        } else {
          const rawBonus = Number(m.bonus || 0)
          mBonus = rawBonus > 0 ? rawBonus : (bonusMap.get(m.staff_id) || 0)
          totalPcs = Number((m as any).total_pcs || 0) || (pcsMap.get(m.staff_id) || 0) || (mBonus > 0 ? Math.round(mBonus / 50) : 0)
        }

        return {
          staffId: m.staff_id,
          staffName: staffInfo?.name || (role === 'regional_manager' ? 'Regional Manager' : 'Area Manager'),
          role,
          outletName: role === 'regional_manager' ? 'Rp 50 / pcs (Wilayah Regional)' : 'Rp 50 / pcs (Cabang Binaan)',
          bonus: mBonus,
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

    // Rincian per outlet agar tampilan bisa dipotong per kelompok (Internal / Mitra).
    const managerDetailsByOutlet: Record<string, ManagerAllocationDetail[]> = {}
    if (target !== 'PUSAT') {
      for (const [oid, alloc] of outletManagerAllocations.entries()) {
        if (alloc.details.length > 0) managerDetailsByOutlet[oid] = alloc.details
      }
    }
    const crewBonusDetailsByOutlet: Record<string, StaffBonusDetail[]> = {}
    if (target !== 'PUSAT') {
      dailyCrewBonusMap.forEach(entry => {
        if (!entry.outletId) return
        const info = staffInfoMap.get(entry.staffId)
        const subRole = entry.subRole || info?.sub_role || null
        const contractType = info?.contract_type || null
        const dates = Array.from(entry.dates).sort()
        const matchingPc = targetProcessedCrew.find(pc => pc.staffId === entry.staffId)
        ;(crewBonusDetailsByOutlet[entry.outletId] ??= []).push({
          staffId: entry.staffId,
          staffName: entry.staffName,
          role: entry.role,
          subRole,
          contractType,
          isBackup: subRole === 'crew_backup' || contractType === 'daily',
          backupDates: dates,
          backupDatesFormatted: formatBackupDatesSummary(dates),
          backupNote: '',
          outletName: outletNameMap.get(entry.outletId) || entry.outletName || 'Cabang',
          bonus: entry.bonus,
          totalPcs: entry.totalPcs,
          status: matchingPc?.status === 'finalized' ? 'finalized' : 'draft'
        })
      })
    }

    const fullCrewRoutineSum = Math.max(0, fullCrewBasicSum + fullCrewAllowSum - fullCrewDedSum)
    const effectiveFullMgrRoutine = fullMgrRoutineAlloc > 0 ? fullMgrRoutineAlloc : mgrRoutineAlloc

    return {
      totalSalary,
      totalStaff,
      crewCount: multiCrewStaffDetails.length,
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
      crewBonusByOutlet,
      crewBasicSalary: crewBasicSum,
      crewAllowances: crewAllowSum,
      crewDeductions: crewDedSum,
      fullCrewBasicSalary: fullCrewBasicSum,
      fullCrewAllowances: fullCrewAllowSum,
      fullCrewDeductions: fullCrewDedSum,
      fullCrewRoutineSalary: fullCrewRoutineSum,
      fullManagerAllocation: effectiveFullMgrRoutine,
      fullTotalRoutineSalary: fullCrewRoutineSum + effectiveFullMgrRoutine,
      managerAllocation: mgrRoutineAlloc,
      managerRoutineAllocation: mgrRoutineAlloc,
      managerBasicSalaryAllocation: mgrBasicAlloc,
      managerAllowancesAllocation: mgrAllowAlloc,
      managerDeductionsAllocation: mgrDedAlloc,
      managerDetails: Array.from(manajerAgregat.values()),
      managerDetailsByOutlet,
      crewBonusDetailsByOutlet,
      managerBonusDetails,
      bonusDetails,
      staffDetails: [
        ...multiCrewStaffDetails,
        ...(target !== 'PUSAT' ? Array.from(manajerAgregat.values()).map(mgr => {
          const routine = mgr.routineAmount ?? (mgr.allocatedAmount - (mgr.bonusAmount || 0))
          const mBonus = mgr.bonusAmount || 0
          return {
            staffId: mgr.staffId,
            staffName: mgr.staffName,
            role: mgr.role,
            outletId: 'PUSAT',
            outletName: 'Alokasi Management',
            basicSalary: mgr.allocatedBasicSalary ?? 0,
            allowances: mgr.allocatedAllowances ?? 0,
            bonus: mBonus,
            deductions: mgr.allocatedDeductions ?? 0,
            routineSalary: routine,
            totalSalary: mgr.allocatedAmount,
            status: mgr.status,
            isManagerAllocation: true,
            allocatedAmount: mgr.allocatedAmount
          }
        }) : [])
      ],
      outletOperationalInfo: isSingleOutlet ? outletOperationalMap.get(target) : undefined
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
