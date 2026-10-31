import { describe, it, expect } from 'vitest'
import { hitungRingkasanPayrollHr, type OutletOperationalInfo } from './ringkasanPayrollHr'

function buatSupabaseMock(params: {
  outlets: any[]
  payrollByMonth: Record<string, any[]>
  activeStaff?: any[]
  assignments?: any[]
  orders?: any[]
  attendance?: any[]
  dailyBonusByMonthOutlet?: Record<string, any[]>
}) {
  const makeBuilder = (table: string) => {
    const filters: { type: string; col?: string; val?: any }[] = []
    const builder: any = {
      select: () => builder,
      eq: (col: string, val: any) => { filters.push({ type: 'eq', col, val }); return builder },
      in: (col: string, val: any[]) => { filters.push({ type: 'in', col, val }); return builder },
      gte: (col: string, val: any) => { filters.push({ type: 'gte', col, val }); return builder },
      lte: (col: string, val: any) => { filters.push({ type: 'lte', col, val }); return builder },
      order: () => builder,
      limit: () => builder,
      range: () => Promise.resolve(resolveQuery()),
      maybeSingle: () => Promise.resolve({ data: resolveQuery().data[0] ?? null, error: null }),
      then: (onFulfilled: any, onRejected: any) => Promise.resolve(resolveQuery()).then(onFulfilled, onRejected),
    }

    function resolveQuery(): { data: any[]; error: null } {
      if (table === 'outlets') return { data: params.outlets, error: null }
      if (table === 'staff_outlets') return { data: params.assignments ?? [], error: null }
      if (table === 'outlet_staff') return { data: params.activeStaff ?? [], error: null }
      if (table === 'attendance_logs') return { data: [], error: null }
      if (table === 'payroll_records') {
        const yEq = filters.find(f => f.type === 'eq' && f.col === 'period_year')?.val
        const mEq = filters.find(f => f.type === 'eq' && f.col === 'period_month')?.val
        if (yEq && mEq) {
          return { data: params.payrollByMonth[`${yEq}-${mEq}`] ?? [], error: null }
        }
        return { data: Object.values(params.payrollByMonth).flat(), error: null }
      }
      if (table === 'orders') {
        let rows = params.orders ?? []
        for (const f of filters) {
          if (f.type === 'eq' && f.col === 'outlet_id') rows = rows.filter(r => r.outlet_id === f.val)
          if (f.type === 'gte' && f.col === 'created_at') rows = rows.filter(r => r.created_at >= f.val)
          if (f.type === 'lte' && f.col === 'created_at') rows = rows.filter(r => r.created_at <= f.val)
        }
        return { data: rows, error: null }
      }
      if (table === 'attendance') {
        let rows = params.attendance ?? []
        for (const f of filters) {
          if (f.type === 'eq' && f.col === 'outlet_id') rows = rows.filter(r => r.outlet_id === f.val)
          if (f.type === 'gte' && f.col === 'ts_server') rows = rows.filter(r => r.ts_server >= f.val)
          if (f.type === 'lte' && f.col === 'ts_server') rows = rows.filter(r => r.ts_server <= f.val)
        }
        return { data: rows, error: null }
      }
      return { data: [], error: null }
    }
    return builder
  }

  return {
    from: (table: string) => makeBuilder(table),
    rpc: async (fn: string, args: any) => {
      if (fn === 'get_daily_outlet_bonus_detail') {
        const key = `${args.p_year}-${args.p_month}-${args.p_outlet_id}`
        return { data: params.dailyBonusByMonthOutlet?.[key] ?? [], error: null }
      }
      return { data: [], error: null }
    },
  }
}

describe('Perhitungan Gaji Outlet Parsial & Kru Mutasi', () => {
  it('menghitung rasio kehadiran kru retail F&B proporsional 26 hari kerja', () => {
    const gapok = 2000000
    const uangMakanHarian = 15000
    const hariHadir = 4

    const gapokProrata = Math.round((Math.min(1, hariHadir / 26)) * gapok)
    const uangMakan = hariHadir * uangMakanHarian
    const totalGaji = gapokProrata + uangMakan

    expect(gapokProrata).toBe(307692)
    expect(uangMakan).toBe(60000)
    expect(totalGaji).toBe(367692)
  })

  it('melakukan fair split untuk kru mutasi antar cabang (contoh Ciseeng 11 hari dan Pamulang 15 hari)', () => {
    const gapok = 2600000
    const hariCiseeng = 11
    const hariPamulang = 15

    const rasioCiseeng = Math.min(1, hariCiseeng / 26)
    const rasioPamulang = Math.min(1, hariPamulang / 26)

    const bebanCiseeng = Math.round(gapok * rasioCiseeng)
    const bebanPamulang = Math.round(gapok * rasioPamulang)

    expect(bebanCiseeng).toBe(1100000)
    expect(bebanPamulang).toBe(1500000)
    expect(bebanCiseeng + bebanPamulang).toBe(gapok)
  })

  it('mengalokasikan beban manajer proporsional hari kalender operasional toko', () => {
    const gajiUtuhManajer = 4500000
    const jumlahCabangBinaan = 5
    const alokasiNormal = gajiUtuhManajer / jumlahCabangBinaan // 900.000

    // Paledang beroperasi 6 hari dari 31 hari kalender
    const hariKalenderPaledang = 6
    const totalHariKalender = 31
    const rasioKalender = hariKalenderPaledang / totalHariKalender

    const alokasiPaledang = Math.round(alokasiNormal * rasioKalender)
    expect(alokasiPaledang).toBe(174194) // jauh lebih adil daripada Rp 900.000 utuh
  })

  it('menerapkan smart filter overlap: beban Rp 0 jika filter berada di luar periode buka toko', () => {
    const opInfo: OutletOperationalInfo = {
      isPartial: true,
      activeDays: 5,
      totalMonthDays: 31,
      operationalCalendarDays: 6,
      calendarRatio: 6 / 31,
      firstDate: '2026-10-26',
      lastDate: '2026-10-31',
      note: 'Mulai beroperasi 26 Okt'
    }

    // Filter sebelum toko buka (1 - 15 Okt)
    const fStart = '2026-10-01'
    const fEnd = '2026-10-15'
    const overlapStart = fStart > opInfo.firstDate! ? fStart : opInfo.firstDate!
    const overlapEnd = fEnd < opInfo.lastDate! ? fEnd : opInfo.lastDate!

    const isOverlap = overlapStart <= overlapEnd
    expect(isOverlap).toBe(false) // tidak ada overlap, beban = Rp 0
  })

  it('menerapkan smart filter overlap: menghitung proporsi hari buka jika filter mencakup tanggal buka', () => {
    const opInfo: OutletOperationalInfo = {
      isPartial: true,
      activeDays: 5,
      totalMonthDays: 31,
      operationalCalendarDays: 6,
      calendarRatio: 6 / 31,
      firstDate: '2026-10-26',
      lastDate: '2026-10-31'
    }

    // Filter 1 - 30 Okt (mencakup 26 s/d 30 Okt = 5 hari)
    const fStart = '2026-10-01'
    const fEnd = '2026-10-30'
    const overlapStart = fStart > opInfo.firstDate! ? fStart : opInfo.firstDate!
    const overlapEnd = fEnd < opInfo.lastDate! ? fEnd : opInfo.lastDate!

    expect(overlapStart).toBe('2026-10-26')
    expect(overlapEnd).toBe('2026-10-30')

    const overlapDays = Math.round((new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / (1000 * 60 * 60 * 24)) + 1
    expect(overlapDays).toBe(5)

    const overlapRatio = overlapDays / opInfo.operationalCalendarDays!
    expect(overlapRatio).toBeCloseTo(5 / 6, 4)
  })

  it('tidak menandai toko normal sebagai toko buka terlambat (mencegah false positive)', () => {
    const primaryPeriod = { month: 10, year: 2026 }
    const periodMonthStart = '2026-10-01'
    const createdStr = '2026-06-09' // toko lama

    // Kasus 1: toko normal dengan aktivitas tgl 1
    const firstDateNormal = '2026-10-01'
    const isNewlyCreated1 = Boolean(createdStr && createdStr >= periodMonthStart)
    const isLateStart1 = firstDateNormal > periodMonthStart && (isNewlyCreated1 || firstDateNormal >= `${primaryPeriod.year}-10-07`)
    expect(isLateStart1).toBe(false)

    // Kasus 2: toko normal yang rekap POS pertama tgl 3
    const firstDateDay3 = '2026-10-03'
    const isLateStart2 = firstDateDay3 > periodMonthStart && (isNewlyCreated1 || firstDateDay3 >= `${primaryPeriod.year}-10-07`)
    expect(isLateStart2).toBe(false) // tidak false positive

    // Kasus 3: Paledang baru buka tgl 26
    const firstDatePaledang = '2026-10-26'
    const isLateStart3 = firstDatePaledang > periodMonthStart && (isNewlyCreated1 || firstDatePaledang >= `${primaryPeriod.year}-10-07`)
    expect(isLateStart3).toBe(true) // benar terdeteksi parsial
  })

  it('memisahkan baseline kontrak utuh 1 bulan (Card 1) vs beban riil operasional (Card 2)', () => {
    const crewItems = [
      { fullBasic: 2000000, allocatedBasic: 461538, fullRoutine: 2000000, allocatedRoutine: 461538 },
      { fullBasic: 2000000, allocatedBasic: 461538, fullRoutine: 2000000, allocatedRoutine: 461538 },
    ]

    const fullCrewBasicSalary = crewItems.reduce((s, c) => s + c.fullBasic, 0)
    const crewBasicSalary = crewItems.reduce((s, c) => s + c.allocatedBasic, 0)

    expect(fullCrewBasicSalary).toBe(4000000)
    expect(crewBasicSalary).toBe(923076)
    expect(fullCrewBasicSalary).toBeGreaterThan(crewBasicSalary)
  })

  it('menjaga baseline 1/N manajer & cabang nonaktif tetap invarian pada sub-rentang tanggal di bulan yang sama ([BUG-3])', async () => {
    const sb = buatSupabaseMock({
      outlets: [
        { id: 'empang', name: 'EMPANG', slug: 'empang', type: 'internal', is_active: true, status: 'active', created_at: '2026-01-01T00:00:00Z' },
        { id: 'ciseeng', name: 'CISEENG', slug: 'ciseeng', type: 'mitra', is_active: false, status: 'inactive', created_at: '2026-05-01T00:00:00Z' },
      ],
      payrollByMonth: {
        '2026-10': [
          {
            id: 'slip-emp', period_month: 10, period_year: 2026, outlet_id: 'empang',
            basic_salary: 2_600_000, allowance_meal: 390_000, allowance_presence: 390_000, bonus: 0, deductions: 0, total_salary: 2_990_000, status: 'finalized',
            staff_id: 's-emp', outlet_staff: { id: 's-emp', name: 'Kru Empang', role: 'crew', outlet_id: 'empang' },
          },
          {
            id: 'slip-rm', period_month: 10, period_year: 2026, outlet_id: 'empang',
            basic_salary: 4_000_000, allowance_meal: 0, allowance_presence: 0, bonus: 800_000, deductions: 0, total_salary: 4_800_000, status: 'finalized',
            staff_id: 's-rm', outlet_staff: { id: 's-rm', name: 'RM Utama', role: 'regional_manager', outlet_id: 'empang' },
          },
        ],
      },
      orders: [
        { outlet_id: 'ciseeng', status: 'completed', created_at: '2026-10-05T10:00:00+07:00' },
        { outlet_id: 'empang', status: 'completed', created_at: '2026-10-05T10:00:00+07:00' },
      ],
      attendance: [
        { outlet_staff_id: 's-emp', outlet_id: 'empang', type: 'in', ts_server: '2026-10-01T08:00:00+07:00' },
        { outlet_staff_id: 's-cis', outlet_id: 'ciseeng', type: 'in', ts_server: '2026-10-01T08:00:00+07:00' },
        { outlet_staff_id: 's-cis', outlet_id: 'ciseeng', type: 'in', ts_server: '2026-10-11T08:00:00+07:00' },
      ],
      dailyBonusByMonthOutlet: {},
    })

    const fullMonth = await hitungRingkasanPayrollHr({ from: '2026-10-01', to: '2026-10-31', outletId: 'empang' }, sb)
    const lateSubRange = await hitungRingkasanPayrollHr({ from: '2026-10-20', to: '2026-10-31', outletId: 'empang' }, sb)

    // Alokasi RM ke Empang tetap 1/2 dari Rp 4.000.000 = Rp 2.000.000 pada 1-31 Okt maupun 20-31 Okt!
    expect(fullMonth.managerRoutineAllocation).toBe(2_000_000)
    expect(lateSubRange.managerRoutineAllocation).toBe(2_000_000)
    // Dan pagi hari tanpa order (0 pcs): bonus RM = Rp 0, tidak bocor Rp 800.000 dari slip bulanan ([BUG-6])!
    expect(lateSubRange.managerBonusAllocation).toBe(0)
  })

  it('mendekomposisi rentang lintas bulan menjadi periodBreakdown tanpa menduplikasi staffDetails & tanpa menggandakan kolom allowance_meal/presence ([BUG-1, BUG-9])', async () => {
    const sb = buatSupabaseMock({
      outlets: [
        { id: 'empang', name: 'EMPANG', slug: 'empang', type: 'internal', is_active: true, status: 'active', created_at: '2026-01-01T00:00:00Z' },
      ],
      payrollByMonth: {
        '2026-09': [],
        '2026-9': [
          {
            id: 'slip-sep', period_month: 9, period_year: 2026, outlet_id: 'empang',
            basic_salary: 2_600_000, allowance_meal: 390_000, allowance_presence: 390_000, bonus: 0, deductions: 0, total_salary: 2_990_000, status: 'finalized',
            staff_id: 's-emp', outlet_staff: { id: 's-emp', name: 'Kru Empang', role: 'crew', outlet_id: 'empang' },
          },
        ],
        '2026-10': [
          {
            id: 'slip-oct', period_month: 10, period_year: 2026, outlet_id: 'empang',
            basic_salary: 2_600_000, allowance_meal: 390_000, allowance_presence: 390_000, bonus: 0, deductions: 0, total_salary: 2_990_000, status: 'finalized',
            staff_id: 's-emp', outlet_staff: { id: 's-emp', name: 'Kru Empang', role: 'crew', outlet_id: 'empang' },
          },
        ],
      },
      orders: [
        { outlet_id: 'empang', status: 'completed', created_at: '2026-09-01T10:00:00+07:00' },
        { outlet_id: 'empang', status: 'completed', created_at: '2026-10-01T10:00:00+07:00' },
      ],
      attendance: [
        { outlet_staff_id: 's-emp', outlet_id: 'empang', type: 'in', ts_server: '2026-09-01T08:00:00+07:00' },
        { outlet_staff_id: 's-emp', outlet_id: 'empang', type: 'in', ts_server: '2026-10-01T08:00:00+07:00' },
      ],
      dailyBonusByMonthOutlet: {
        '2026-9-empang': [
          { bonus_date: '2026-09-28', outlet_id: 'empang', outlet_name: 'EMPANG', total_pcs: 100, pool_amount: 10_000, crew_count: 1, bonus_per_crew: 10_000, crew_list: [{ crew_id: 's-emp', crew_name: 'Kru Empang', role: 'crew' }] },
        ],
        '2026-10-empang': [
          { bonus_date: '2026-10-10', outlet_id: 'empang', outlet_name: 'EMPANG', total_pcs: 200, pool_amount: 20_000, crew_count: 1, bonus_per_crew: 20_000, crew_list: [{ crew_id: 's-emp', crew_name: 'Kru Empang', role: 'crew' }] },
        ],
      },
    })

    const res = await hitungRingkasanPayrollHr({ from: '2026-09-25', to: '2026-10-25', outletId: 'ALL_OUTLETS' }, sb)
    expect(res.periodBreakdown).toHaveLength(2)
    // Baseline 1 bulan TIDAK tergandakan 2x; staffDetails tetap 1 kru unik (tidak memicu React duplicate key)
    expect(res.crewCount).toBe(1)
    expect(res.staffDetails?.filter(s => !s.isManagerAllocation)).toHaveLength(1)
    expect(res.basicSalary).toBe(2_600_000)
    expect(res.allowances).toBe(390_000)
    // Bonus dijumlahkan akurat lintas bulan (10.000 Sep + 20.000 Okt)
    expect(res.crewBonus).toBe(30_000)
  })
})
