import { describe, it, expect } from 'vitest'
import {
  calculateMonthOverlap,
  calculateProratedExpenses,
  getJakartaCurrentMonthInfo,
} from './opexProrata'
import type { ExpenseRow } from '@/hooks/useExpenses'
import type { ManagerAssignment } from './opexProrata'

describe('opexProrata - Kalkulasi Kalender & Irisan Bulan', () => {
  // Mock 'now' ke 12 September 2026
  const mockNow = new Date('2026-09-12T12:00:00Z')

  it('mengembalikan info bulan berjalan Jakarta dengan benar (September 2026 = 30 hari)', () => {
    const info = getJakartaCurrentMonthInfo(mockNow)
    expect(info.year).toBe(2026)
    expect(info.month).toBe(9)
    expect(info.totalDays).toBe(30)
    expect(info.firstDay).toBe('2026-09-01')
    expect(info.lastDay).toBe('2026-09-30')
  })

  it('menghitung irisan MTD (1 s/d 12 September) tepat 12 hari (rasio 12/30 = 0.4)', () => {
    const overlap = calculateMonthOverlap('2026-09-01', '2026-09-12', mockNow)
    expect(overlap.isCurrentMonth).toBe(true)
    expect(overlap.overlapDays).toBe(12)
    expect(overlap.totalDays).toBe(30)
    expect(overlap.ratio).toBeCloseTo(0.4, 5)
  })

  it('menghitung irisan 1 hari ("Hari Ini" 12 September) tepat 1 hari (rasio 1/30)', () => {
    const overlap = calculateMonthOverlap('2026-09-12', '2026-09-12', mockNow)
    expect(overlap.isCurrentMonth).toBe(true)
    expect(overlap.overlapDays).toBe(1)
    expect(overlap.ratio).toBeCloseTo(1 / 30, 5)
  })

  it('menghitung filter sebulan penuh (1 s/d 30 September) tepat 30 hari (rasio 1.0 = 100%)', () => {
    const overlap = calculateMonthOverlap('2026-09-01', '2026-09-30', mockNow)
    expect(overlap.isCurrentMonth).toBe(true)
    expect(overlap.overlapDays).toBe(30)
    expect(overlap.ratio).toBe(1)
  })

  it('mengembalikan isCurrentMonth = false jika filter berada di bulan lampau (Agustus 2026)', () => {
    const overlap = calculateMonthOverlap('2026-08-01', '2026-08-31', mockNow)
    expect(overlap.isCurrentMonth).toBe(false)
    expect(overlap.overlapDays).toBe(0)
    expect(overlap.ratio).toBe(0)
  })
})

describe('opexProrata - calculateProratedExpenses', () => {
  const mockNow = new Date('2026-09-12T12:00:00Z')

  const dummyPettyCash: ExpenseRow = {
    id: 'pc-1',
    outlet_id: 'outlet-1',
    outlet_name: 'SS Pogung',
    category: 'pengeluaran_outlet',
    scope: 'outlet',
    amount: 150_000,
    description: 'Beli es batu',
    expense_date: '2026-09-05',
    period_month: '2026-09-01',
    source: 'petty_cash',
  }

  it('tidak memprorata jika filter di bulan lampau (Agustus 2026)', () => {
    const res = calculateProratedExpenses({
      filter: { from: '2026-08-01', to: '2026-08-31', outletId: 'all', source: 'all' },
      rawExpenses: [dummyPettyCash],
      now: mockNow,
    })

    expect(res.isProrated).toBe(false)
    expect(res.rows).toEqual([dummyPettyCash])
  })

  it('memprorata gaji crew dari HR payroll_records secara akrual harian', () => {
    // Outlet-1 memiliki gaji bulanan Rp 6.000.000 di payroll HR
    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-12', outletId: 'outlet-1', source: 'all' },
      rawExpenses: [dummyPettyCash],
      payrollRecords: [{ outlet_id: 'outlet-1', total_salary: 6_000_000 }],
      now: mockNow,
      outlets: [{ id: 'outlet-1', name: 'SS Pogung' }],
    })

    expect(res.isProrated).toBe(true)
    // Petty cash tetap ada
    expect(res.rows.find(r => r.id === 'pc-1')).toBeDefined()

    // Gaji crew diprorata 12/30 hari dari Rp 6.000.000 = Rp 2.400.000
    const gajiRow = res.rows.find(r => r.category === 'gaji_crew_outlet')
    expect(gajiRow).toBeDefined()
    expect(gajiRow?.amount).toBe(2_400_000)
    expect(res.categoryBreakdown.gaji_crew_outlet.nominalBulanan).toBe(6_000_000)
    expect(res.categoryBreakdown.gaji_crew_outlet.nominalProrata).toBe(2_400_000)
    expect(res.categoryBreakdown.gaji_crew_outlet.source).toBe('payroll_record')
  })

  it('fallback ke staff_financials jika payroll HR bulan berjalan belum di-generate', () => {
    // Staf aktif memiliki basic 2.500.000 + allowance_position 500.000 = 3.000.000
    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-12', outletId: 'outlet-1', source: 'all' },
      rawExpenses: [],
      payrollRecords: [], // belum di-generate
      staffFinancials: [
        {
          outlet_id: 'outlet-1',
          basic_salary: 2_500_000,
          allowance_position: 500_000,
          allowance_presence: 0,
        },
      ],
      now: mockNow,
      outlets: [{ id: 'outlet-1', name: 'SS Pogung' }],
    })

    // 12/30 * 3.000.000 = 1.200.000
    const gajiRow = res.rows.find(r => r.category === 'gaji_crew_outlet')
    expect(gajiRow?.amount).toBe(1_200_000)
    expect(res.categoryBreakdown.gaji_crew_outlet.source).toBe('staff_master')
  })

  it('memprorata rollover sewa & internet bulan lalu jika bulan berjalan belum diinput', () => {
    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-12', outletId: 'outlet-1', source: 'all' },
      rawExpenses: [],
      lastMonthExpenses: [
        { outlet_id: 'outlet-1', category: 'sewa_outlet', amount: 3_000_000 },
        { outlet_id: 'outlet-1', category: 'internet', amount: 300_000 },
      ],
      now: mockNow,
      outlets: [{ id: 'outlet-1', name: 'SS Pogung' }],
    })

    // Sewa: 12/30 * 3.000.000 = 1.200.000
    const sewaRow = res.rows.find(r => r.category === 'sewa_outlet')
    expect(sewaRow?.amount).toBe(1_200_000)
    expect(res.categoryBreakdown.sewa_outlet.source).toBe('last_month_rollover')

    // Internet: 12/30 * 300.000 = 120.000
    const netRow = res.rows.find(r => r.category === 'internet')
    expect(netRow?.amount).toBe(120_000)
    expect(res.categoryBreakdown.internet.source).toBe('last_month_rollover')
  })

  it('menggunakan angka riil bulan berjalan jika transaksi sewa/internet sudah diinput', () => {
    // Finance sudah menginput internet Rp 270.000 pada tanggal 2 September
    const realInternet: ExpenseRow = {
      id: 'net-real',
      outlet_id: 'outlet-1',
      outlet_name: 'SS Pogung',
      category: 'internet',
      scope: 'outlet',
      amount: 270_000,
      description: 'Langganan Indihome Sept',
      expense_date: '2026-09-02',
      period_month: '2026-09-01',
      source: 'monthly',
    }

    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-12', outletId: 'outlet-1', source: 'all' },
      rawExpenses: [realInternet],
      lastMonthExpenses: [
        // Bulan lalu 300.000, tapi bulan ini sudah ada 270.000 -> harus pakai 270.000
        { outlet_id: 'outlet-1', category: 'internet', amount: 300_000 },
      ],
      now: mockNow,
      outlets: [{ id: 'outlet-1', name: 'SS Pogung' }],
    })

    // 12/30 * 270.000 = 108.000
    const netRow = res.rows.find(r => r.category === 'internet')
    expect(netRow?.amount).toBe(108_000)
    expect(res.categoryBreakdown.internet.source).toBe('current_month_real')
    // Memastikan tidak terjadi double-counting (baris net-real digantikan baris prorata)
    expect(res.rows.filter(r => r.category === 'internet').length).toBe(1)
  })

  it('mengembalikan 100% nominal bulanan jika filter 1 bulan penuh (1 s/d 30 September)', () => {
    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-30', outletId: 'outlet-1', source: 'all' },
      rawExpenses: [],
      payrollRecords: [{ outlet_id: 'outlet-1', total_salary: 5_000_000 }],
      now: mockNow,
      outlets: [{ id: 'outlet-1', name: 'SS Pogung' }],
    })

    // 30/30 * 5.000.000 = 5.000.000
    const gajiRow = res.rows.find(r => r.category === 'gaji_crew_outlet')
    expect(gajiRow?.amount).toBe(5_000_000)
  })

  it('memprorata bonus crew, AM, dan RM berdasarkan data penjualan porsi pcs MTD', () => {
    // Outlet-1 memiliki penjualan 1.000 pcs dalam 12 hari (MTD)
    // Bonus Kru: 1.000 pcs * Rp 100 = Rp 100.000
    // Bonus AM: 1.000 pcs * Rp 50 = Rp 50.000
    // Bonus RM: 1.000 pcs * Rp 50 = Rp 50.000
    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-12', outletId: 'outlet-1', source: 'all' },
      rawExpenses: [],
      crewBonusRecords: [
        {
          outlet_id: 'outlet-1',
          total_bonus: 100_000,
          total_pcs_outlet: 1_000,
        },
      ],
      now: mockNow,
      outlets: [{ id: 'outlet-1', name: 'SS Pogung' }],
    })

    expect(res.isProrated).toBe(true)

    // Bonus Crew
    const crewRow = res.rows.find(r => r.category === 'bonus_crew')
    expect(crewRow).toBeDefined()
    expect(crewRow?.amount).toBe(100_000)
    expect(res.categoryBreakdown.bonus_crew.source).toBe('sales_pcs_mtd')

    // Bonus AM
    const amRow = res.rows.find(r => r.category === 'bonus_area_manager')
    expect(amRow).toBeDefined()
    expect(amRow?.amount).toBe(50_000)
    expect(res.categoryBreakdown.bonus_area_manager.source).toBe('sales_pcs_mtd')

    // Bonus RM
    const rmRow = res.rows.find(r => r.category === 'bonus_regional_manager')
    expect(rmRow).toBeDefined()
    expect(rmRow?.amount).toBe(50_000)
    expect(res.categoryBreakdown.bonus_regional_manager.source).toBe('sales_pcs_mtd')
  })

  it('memprorata bonus harian (1 hari) secara proporsional', () => {
    // Filter 1 hari (12 September), overlapDays = 1, curDay = 12
    // MTD bonus kru = 120.000 -> projected bulanan = 120.000 / 12 * 30 = 300.000
    // Prorata 1 hari = round(300.000 * 1/30) = 10.000
    const res = calculateProratedExpenses({
      filter: { from: '2026-09-12', to: '2026-09-12', outletId: 'outlet-1', source: 'all' },
      rawExpenses: [],
      crewBonusRecords: [
        {
          outlet_id: 'outlet-1',
          total_bonus: 120_000,
          total_pcs_outlet: 1_200,
        },
      ],
      now: mockNow,
      outlets: [{ id: 'outlet-1', name: 'SS Pogung' }],
    })

    const crewRow = res.rows.find(r => r.category === 'bonus_crew')
    expect(crewRow?.amount).toBe(10_000)

    // Bonus AM: MTD pcs = 1200 * 50 = 60.000 -> projected = 150.000 -> 1 hari = 5.000
    const amRow = res.rows.find(r => r.category === 'bonus_area_manager')
    expect(amRow?.amount).toBe(5_000)
  })

  it('menggunakan transaksi riil bonus jika Finance sudah menginput di tabel expenses', () => {
    const realBonus: ExpenseRow = {
      id: 'bonus-real-1',
      outlet_id: 'outlet-1',
      outlet_name: 'SS Pogung',
      category: 'bonus_crew',
      scope: 'outlet',
      amount: 1_500_000,
      description: 'Bonus kru riil',
      expense_date: '2026-09-10',
      period_month: '2026-09-01',
      source: 'monthly',
    }

    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-12', outletId: 'outlet-1', source: 'all' },
      rawExpenses: [realBonus],
      crewBonusRecords: [
        // Meskipun ada hitungan live pcs, transaksi riil harus merekonsiliasi (menggantikan)
        { outlet_id: 'outlet-1', total_bonus: 100_000, total_pcs_outlet: 1_000 },
      ],
      now: mockNow,
      outlets: [{ id: 'outlet-1', name: 'SS Pogung' }],
    })

    // 12/30 * 1.500.000 = 600.000
    const crewRow = res.rows.find(r => r.category === 'bonus_crew')
    expect(crewRow?.amount).toBe(600_000)
    expect(res.categoryBreakdown.bonus_crew.source).toBe('expenses_real')
    // Hanya 1 baris bonus crew yang dihasilkan (tidak double count)
    expect(res.rows.filter(r => r.category === 'bonus_crew').length).toBe(1)
  })

  it('fallback ke rollover bonus bulan lalu jika belum ada porsi terjual di bulan berjalan', () => {
    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-12', outletId: 'outlet-1', source: 'all' },
      rawExpenses: [],
      crewBonusRecords: [], // belum ada pcs penjualan
      lastMonthExpenses: [
        { outlet_id: 'outlet-1', category: 'bonus_area_manager', amount: 900_000 },
      ],
      now: mockNow,
      outlets: [{ id: 'outlet-1', name: 'SS Pogung' }],
    })

    // 12/30 * 900.000 = 360.000
    const amRow = res.rows.find(r => r.category === 'bonus_area_manager')
    expect(amRow?.amount).toBe(360_000)
    expect(res.categoryBreakdown.bonus_area_manager.source).toBe('last_month_rollover')
  })

  it('tidak membuat beban prorata atau rollover untuk outlet nonaktif (is_active = false)', () => {
    const res = calculateProratedExpenses({
      filter: { from: '2026-10-01', to: '2026-10-31', outletId: 'all', source: 'all' },
      rawExpenses: [],
      lastMonthExpenses: [
        { outlet_id: 'outlet-closed', category: 'internet', amount: 316_350 },
        { outlet_id: 'outlet-closed', category: 'sewa_outlet', amount: 5_000_000 },
        { outlet_id: 'outlet-active', category: 'internet', amount: 300_000 },
      ],
      payrollRecords: [
        { outlet_id: 'outlet-closed', total_salary: 4_000_000 },
        { outlet_id: 'outlet-active', total_salary: 5_000_000 },
      ],
      now: new Date('2026-10-15T12:00:00Z'),
      outlets: [
        { id: 'outlet-closed', name: 'Sawangan Lama (Internal)', is_active: false },
        { id: 'outlet-active', name: 'Mitra Sawangan DTC', is_active: true },
      ],
    })

    // Outlet nonaktif tidak boleh mendapatkan baris prorata/rollover sintetis
    expect(res.rows.find(r => r.outlet_id === 'outlet-closed')).toBeUndefined()
    // Outlet aktif tetap mendapatkan prorata normal
    expect(res.rows.find(r => r.outlet_id === 'outlet-active')).toBeDefined()
  })

  it('mengikutsertakan gaji crew dari HR payroll_records pada bulan lampau sebulan penuh (September 2026 = 100% nominal)', () => {
    // Simulasi Mitra Cibinong di bulan September 2026 saat diakses di bulan Oktober 2026
    const octNow = new Date('2026-10-03T10:00:00Z')
    const realExpenses: ExpenseRow[] = [
      {
        id: 'net-1',
        outlet_id: 'outlet-cibinong',
        outlet_name: 'MITRA CIBINONG',
        category: 'internet',
        scope: 'outlet',
        amount: 260_850,
        description: 'Indihome Cibinong',
        expense_date: '2026-09-19',
        period_month: '2026-09-01',
        source: 'monthly',
      },
      {
        id: 'pln-1',
        outlet_id: 'outlet-cibinong',
        outlet_name: 'MITRA CIBINONG',
        category: 'pln',
        scope: 'outlet',
        amount: 870_406,
        description: 'PLN Cibinong',
        expense_date: '2026-09-04',
        period_month: '2026-09-01',
        source: 'monthly',
      },
    ]

    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-30', outletId: 'outlet-cibinong', source: 'all' },
      rawExpenses: realExpenses,
      payrollRecords: [
        { outlet_id: 'outlet-cibinong', total_salary: 2_390_000, period_month: 9, period_year: 2026 },
        { outlet_id: 'outlet-cibinong', total_salary: 2_390_000, period_month: 9, period_year: 2026 },
        { outlet_id: 'outlet-cibinong', total_salary: 2_390_000, period_month: 9, period_year: 2026 },
      ],
      now: octNow,
      outlets: [{ id: 'outlet-cibinong', name: 'MITRA CIBINONG', is_active: true }],
    })

    // Bukan prorata karena 1 bulan kalender penuh (isProrated: false)
    expect(res.isProrated).toBe(false)
    // Transaksi riil non-gaji tetap utuh
    expect(res.rows.find(r => r.id === 'net-1')?.amount).toBe(260_850)
    expect(res.rows.find(r => r.id === 'pln-1')?.amount).toBe(870_406)

    // Gaji crew outlet masuk sebesar 100% nominal (3 * 2.390.000 = 7.170.000)
    const gajiRow = res.rows.find(r => r.category === 'gaji_crew_outlet')
    expect(gajiRow).toBeDefined()
    expect(gajiRow?.amount).toBe(7_170_000)
    expect(gajiRow?.description).toContain('HR Payroll')
    expect(res.categoryBreakdown.gaji_crew_outlet.nominalBulanan).toBe(7_170_000)
    expect(res.categoryBreakdown.gaji_crew_outlet.nominalProrata).toBe(7_170_000)
    expect(res.categoryBreakdown.gaji_crew_outlet.source).toBe('payroll_record')
  })

  it('memprorata gaji crew dari HR payroll_records pada bulan lampau untuk rentang tanggal parsial', () => {
    const octNow = new Date('2026-10-03T10:00:00Z')
    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-15', outletId: 'outlet-cibinong', source: 'all' },
      rawExpenses: [],
      payrollRecords: [
        { outlet_id: 'outlet-cibinong', total_salary: 7_170_000, period_month: 9, period_year: 2026 },
      ],
      now: octNow,
      outlets: [{ id: 'outlet-cibinong', name: 'MITRA CIBINONG', is_active: true }],
    })

    // Parsial 15/30 hari -> isProrated: true, amount = 3.585.000
    expect(res.isProrated).toBe(true)
    expect(res.monthInfo.overlapDays).toBe(15)
    expect(res.monthInfo.totalDays).toBe(30)
    const gajiRow = res.rows.find(r => r.category === 'gaji_crew_outlet')
    expect(gajiRow?.amount).toBe(3_585_000)
    expect(gajiRow?.description).toContain('15 Hari')
  })

  it('mencegah double-counting jika expenses memiliki gaji manual lama dan HR payroll_records juga tersedia', () => {
    const octNow = new Date('2026-10-03T10:00:00Z')
    // Di tabel expenses pernah diinput manual gaji Rp 5.000.000
    const manualGaji: ExpenseRow = {
      id: 'manual-gaji-old',
      outlet_id: 'outlet-1',
      outlet_name: 'SS Pogung',
      category: 'gaji_crew_outlet',
      scope: 'outlet',
      amount: 5_000_000,
      description: 'Gaji manual lama',
      expense_date: '2026-08-01',
      period_month: '2026-08-01',
      source: 'monthly',
    }

    const res = calculateProratedExpenses({
      filter: { from: '2026-08-01', to: '2026-08-31', outletId: 'outlet-1', source: 'all' },
      rawExpenses: [manualGaji],
      payrollRecords: [
        // Di HR modul payroll resmi tercatat Rp 6.000.000
        { outlet_id: 'outlet-1', total_salary: 6_000_000, period_month: 8, period_year: 2026 },
      ],
      now: octNow,
      outlets: [{ id: 'outlet-1', name: 'SS Pogung', is_active: true }],
    })

    // Hanya 1 baris gaji yang boleh muncul (angka resmi dari HR modul)
    const gajiRows = res.rows.filter(r => r.category === 'gaji_crew_outlet')
    expect(gajiRows.length).toBe(1)
    expect(gajiRows[0].amount).toBe(6_000_000)
    expect(gajiRows[0].id).not.toBe('manual-gaji-old')
  })

  it('fallback ke master staf (staff_financials) jika payroll_records belum dibuat pada bulan lampau', () => {
    const octNow = new Date('2026-10-03T10:00:00Z')
    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-30', outletId: 'outlet-1', source: 'all' },
      rawExpenses: [],
      payrollRecords: [],
      staffFinancials: [
        {
          outlet_id: 'outlet-1',
          basic_salary: 2_000_000,
          allowance_position: 200_000,
          allowance_presence: 190_000,
        },
      ],
      now: octNow,
      outlets: [{ id: 'outlet-1', name: 'SS Pogung', is_active: true }],
    })

    const gajiRow = res.rows.find(r => r.category === 'gaji_crew_outlet')
    expect(gajiRow).toBeDefined()
    expect(gajiRow?.amount).toBe(2_390_000)
    expect(res.categoryBreakdown.gaji_crew_outlet.source).toBe('staff_master')
  })

  it('mengotomasi bonus kru, bonus AM, dan bonus RM dari modul bonus kru pada bulan lampau (MODE 2)', () => {
    const octNow = new Date('2026-10-03T10:00:00Z')
    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-30', outletId: 'outlet-1', source: 'all' },
      rawExpenses: [],
      crewBonusRecords: [
        {
          outlet_id: 'outlet-1',
          total_bonus: 404_101,
          total_pcs_outlet: 4_041,
          period_month: 9,
          period_year: 2026,
        },
      ],
      now: octNow,
      outlets: [{ id: 'outlet-1', name: 'Mitra Cicurug', is_active: true }],
    })

    // Bonus Crew: 404.101
    const crewRow = res.rows.find(r => r.category === 'bonus_crew')
    expect(crewRow).toBeDefined()
    expect(crewRow?.amount).toBe(404_101)
    expect(crewRow?.description).toContain('Modul Bonus Crew')
    expect(res.categoryBreakdown.bonus_crew.nominalBulanan).toBe(404_101)
    expect(res.categoryBreakdown.bonus_crew.source).toBe('crew_bonus_module')

    // Bonus AM: 4.041 pcs * 50 = 202.050
    const amRow = res.rows.find(r => r.category === 'bonus_area_manager')
    expect(amRow).toBeDefined()
    expect(amRow?.amount).toBe(202_050)
    expect(res.categoryBreakdown.bonus_area_manager.nominalBulanan).toBe(202_050)
    expect(res.categoryBreakdown.bonus_area_manager.source).toBe('crew_bonus_module')

    // Bonus RM: 4.041 pcs * 50 = 202.050
    const rmRow = res.rows.find(r => r.category === 'bonus_regional_manager')
    expect(rmRow).toBeDefined()
    expect(rmRow?.amount).toBe(202_050)
    expect(res.categoryBreakdown.bonus_regional_manager.nominalBulanan).toBe(202_050)
    expect(res.categoryBreakdown.bonus_regional_manager.source).toBe('crew_bonus_module')
  })

  it('mencegah double-counting bonus manual jika modul bonus sudah memiliki data outlet (MODE 2)', () => {
    const octNow = new Date('2026-10-03T10:00:00Z')
    const manualBonusCrew: ExpenseRow = {
      id: 'manual-bonus-old',
      outlet_id: 'outlet-1',
      outlet_name: 'Mitra Cicurug',
      category: 'bonus_crew',
      scope: 'outlet',
      amount: 500_000,
      description: 'Bonus kru manual finance',
      expense_date: '2026-09-15',
      period_month: '2026-09-01',
      source: 'monthly',
    }

    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-30', outletId: 'outlet-1', source: 'all' },
      rawExpenses: [manualBonusCrew],
      crewBonusRecords: [
        {
          outlet_id: 'outlet-1',
          total_bonus: 404_101,
          total_pcs_outlet: 4_041,
          period_month: 9,
          period_year: 2026,
        },
      ],
      now: octNow,
      outlets: [{ id: 'outlet-1', name: 'Mitra Cicurug', is_active: true }],
    })

    // Hanya 1 baris bonus crew resmi yang ada (input manual dibuang)
    const crewRows = res.rows.filter(r => r.category === 'bonus_crew')
    expect(crewRows.length).toBe(1)
    expect(crewRows[0].amount).toBe(404_101)
    expect(crewRows[0].id).not.toBe('manual-bonus-old')
  })

  it('memprorata bonus secara proporsional jika rentang filter bulan lampau hanya sebagian (misal 15 hari)', () => {
    const octNow = new Date('2026-10-03T10:00:00Z')
    // 15 hari dari 30 hari September = ratio 0.5
    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-15', outletId: 'outlet-1', source: 'all' },
      rawExpenses: [],
      crewBonusRecords: [
        {
          outlet_id: 'outlet-1',
          total_bonus: 400_000,
          total_pcs_outlet: 4_000,
          period_month: 9,
          period_year: 2026,
        },
      ],
      now: octNow,
      outlets: [{ id: 'outlet-1', name: 'Mitra Cicurug', is_active: true }],
    })

    expect(res.isProrated).toBe(true)

    // Bonus Crew: 400.000 * 15/30 = 200.000
    const crewRow = res.rows.find(r => r.category === 'bonus_crew')
    expect(crewRow?.amount).toBe(200_000)

    // Bonus AM: (4.000 * 50) * 15/30 = 100.000
    const amRow = res.rows.find(r => r.category === 'bonus_area_manager')
    expect(amRow?.amount).toBe(100_000)

    // Bonus RM: (4.000 * 50) * 15/30 = 100.000
    const rmRow = res.rows.find(r => r.category === 'bonus_regional_manager')
    expect(rmRow?.amount).toBe(100_000)
  })

  it('memisahkan komponen bonus dari gaji_crew_outlet ketika slip HR memiliki bonus agar tidak dobel hitung (MODE 2)', () => {
    const octNow = new Date('2026-10-03T10:00:00Z')
    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-30', outletId: 'outlet-1', source: 'all' },
      rawExpenses: [],
      payrollRecords: [
        {
          outlet_id: 'outlet-1',
          total_salary: 2_500_000,
          bonus: 500_000,
          period_month: 9,
          period_year: 2026,
        },
      ],
      crewBonusRecords: [
        {
          outlet_id: 'outlet-1',
          total_bonus: 480_000,
          total_pcs_outlet: 4_800,
          period_month: 9,
          period_year: 2026,
        },
      ],
      now: octNow,
      outlets: [{ id: 'outlet-1', name: 'Mitra Cicurug', is_active: true }],
    })

    // Gaji pokok & tunjangan bersih = 2.500.000 - 500.000 = 2.000.000
    const gajiRow = res.rows.find(r => r.category === 'gaji_crew_outlet')
    expect(gajiRow).toBeDefined()
    expect(gajiRow?.amount).toBe(2_000_000)

    // Bonus crew mengambil bonus tervalidasi dari slip HR (500.000)
    const crewRow = res.rows.find(r => r.category === 'bonus_crew')
    expect(crewRow).toBeDefined()
    expect(crewRow?.amount).toBe(500_000)

    // Total gaji + bonus crew harus PERSIS sama dengan total_salary dari slip HR (2.500.000)
    expect((gajiRow?.amount || 0) + (crewRow?.amount || 0)).toBe(2_500_000)
  })

  it('mendistribusikan beban gaji bersih AM secara equal split ke outlet-outlet binaan dan membebaskan home outlet dari beban 100%', () => {
    const octNow = new Date('2026-10-03T10:00:00Z')
    const outlets = [
      { id: 'sukmajaya', name: 'SS Sukmajaya', is_active: true, type: 'internal' },
      { id: 'cibubur', name: 'Mitra Cibubur', is_active: true, type: 'mitra' },
      { id: 'cileungsi', name: 'Mitra Cileungsi', is_active: true, type: 'mitra' },
      { id: 'kalisari', name: 'Mitra Kalisari', is_active: true, type: 'mitra' },
      { id: 'pajajaran', name: 'SS Pajajaran', is_active: true, type: 'internal' }, // outlet di luar binaan
    ]

    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-30', outletId: 'all', source: 'all' },
      rawExpenses: [],
      payrollRecords: [
        // AM Tri Rizky (home outlet sukmajaya): total 4.000.000, bonus 500.000 -> gaji bersih 3.500.000
        {
          staff_id: 'tri-rizky',
          outlet_id: 'sukmajaya',
          role: 'area_manager',
          total_salary: 4_000_000,
          bonus: 500_000,
          period_month: 9,
          period_year: 2026,
        },
      ],
      managerAssignments: [
        {
          staff_id: 'tri-rizky',
          role: 'area_manager',
          outlet_ids: ['sukmajaya', 'cibubur', 'cileungsi', 'kalisari'],
        },
      ],
      operationalOutletIds: ['sukmajaya', 'cibubur', 'cileungsi', 'kalisari', 'pajajaran'],
      now: octNow,
      outlets,
    })

    // Gaji bersih 3.500.000 dibagi 4 outlet binaan = 875.000 per outlet
    const sukmajayaGaji = res.rows.find(r => r.outlet_id === 'sukmajaya' && r.category === 'gaji_crew_outlet')
    const cibuburGaji = res.rows.find(r => r.outlet_id === 'cibubur' && r.category === 'gaji_crew_outlet')
    const cileungsiGaji = res.rows.find(r => r.outlet_id === 'cileungsi' && r.category === 'gaji_crew_outlet')
    const kalisariGaji = res.rows.find(r => r.outlet_id === 'kalisari' && r.category === 'gaji_crew_outlet')
    const pajajaranGaji = res.rows.find(r => r.outlet_id === 'pajajaran' && r.category === 'gaji_crew_outlet')

    expect(sukmajayaGaji?.amount).toBe(875_000)
    expect(cibuburGaji?.amount).toBe(875_000)
    expect(cileungsiGaji?.amount).toBe(875_000)
    expect(kalisariGaji?.amount).toBe(875_000)
    expect(pajajaranGaji).toBeUndefined() // Pajajaran tidak binaan Tri, jadi Rp 0

    // Total alokasi seluruh outlet harus persis 3.500.000 (invariant selisih Rp 0)
    const totalGajiRows = res.rows
      .filter(r => r.category === 'gaji_crew_outlet')
      .reduce((s, r) => s + r.amount, 0)
    expect(totalGajiRows).toBe(3_500_000)
  })

  it('mendistribusikan gaji bersih RM secara equal split ke seluruh cabang operasional aktif', () => {
    const octNow = new Date('2026-10-03T10:00:00Z')
    const operationalOutletIds = ['o1', 'o2', 'o3', 'o4', 'o5']
    const outlets = operationalOutletIds.map(id => ({ id, name: `Outlet ${id}`, is_active: true, type: 'internal' }))

    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-30', outletId: 'all', source: 'all' },
      rawExpenses: [],
      payrollRecords: [
        // RM Indra: total 8.000.000, bonus 3.000.000 -> gaji bersih 5.000.000
        {
          staff_id: 'indra-rm',
          outlet_id: 'o1',
          role: 'regional_manager',
          total_salary: 8_000_000,
          bonus: 3_000_000,
          period_month: 9,
          period_year: 2026,
        },
      ],
      operationalOutletIds,
      now: octNow,
      outlets,
    })

    // 5.000.000 / 5 = 1.000.000 per outlet
    for (const oid of operationalOutletIds) {
      const row = res.rows.find(r => r.outlet_id === oid && r.category === 'gaji_crew_outlet')
      expect(row?.amount).toBe(1_000_000)
    }

    const totalAllocated = res.rows
      .filter(r => r.category === 'gaji_crew_outlet')
      .reduce((s, r) => s + r.amount, 0)
    expect(totalAllocated).toBe(5_000_000)
  })

  it('menangani sisa pembulatan rupiah secara presisi (zero discrepancy invariant)', () => {
    const octNow = new Date('2026-10-03T10:00:00Z')
    // 6 outlet: 3.500.000 / 6 = 583.333 sisa 2
    const targetIds = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6']
    const outlets = targetIds.map(id => ({ id, name: `Outlet ${id}`, is_active: true, type: 'internal' }))

    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-30', outletId: 'all', source: 'all' },
      rawExpenses: [],
      payrollRecords: [
        {
          staff_id: 'am-1',
          outlet_id: 'o1',
          role: 'area_manager',
          total_salary: 3_500_000,
          bonus: 0,
          period_month: 9,
          period_year: 2026,
        },
      ],
      managerAssignments: [
        {
          staff_id: 'am-1',
          role: 'area_manager',
          outlet_ids: targetIds,
        },
      ],
      operationalOutletIds: targetIds,
      now: octNow,
      outlets,
    })

    const rows = res.rows.filter(r => r.category === 'gaji_crew_outlet')
    const totalAllocated = rows.reduce((s, r) => s + r.amount, 0)
    // Harus persis 3.500.000 tanpa kurang atau lebih 1 rupiah pun
    expect(totalAllocated).toBe(3_500_000)

    // Remainder 2 harus dialokasikan ke 2 outlet teratas (+1 menjadi 583.334)
    const count334 = rows.filter(r => r.amount === 583_334).length
    const count333 = rows.filter(r => r.amount === 583_333).length
    expect(count334).toBe(2)
    expect(count333).toBe(4)
  })

  it('memastikan baris bonus AM dan RM tetap terpisah dihitung dari pcs x 50 dan tidak tercampur ke gaji', () => {
    const octNow = new Date('2026-10-03T10:00:00Z')
    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-30', outletId: 'o1', source: 'all' },
      rawExpenses: [],
      payrollRecords: [
        {
          outlet_id: 'o1',
          role: 'crew',
          total_salary: 2_000_000,
          bonus: 0,
          period_month: 9,
          period_year: 2026,
        },
        {
          staff_id: 'am-1',
          outlet_id: 'o1',
          role: 'area_manager',
          total_salary: 3_000_000,
          bonus: 500_000,
          period_month: 9,
          period_year: 2026,
        },
      ],
      managerAssignments: [
        { staff_id: 'am-1', role: 'area_manager', outlet_ids: ['o1', 'o2'] },
      ],
      crewBonusRecords: [
        {
          outlet_id: 'o1',
          total_bonus: 0,
          total_pcs_outlet: 3_000,
          period_month: 9,
          period_year: 2026,
        },
      ],
      operationalOutletIds: ['o1', 'o2'],
      now: octNow,
      outlets: [
        { id: 'o1', name: 'Outlet 1', is_active: true },
        { id: 'o2', name: 'Outlet 2', is_active: true },
      ],
    })

    // Gaji kru toko = 2.000.000, Gaji bersih AM = 2.500.000 / 2 = 1.250.000. Total gaji = 3.250.000
    const gajiRow = res.rows.find(r => r.category === 'gaji_crew_outlet')
    expect(gajiRow?.amount).toBe(3_250_000)

    // Bonus AM tetap terpisah = 3.000 pcs * 50 = 150.000
    const amBonusRow = res.rows.find(r => r.category === 'bonus_area_manager')
    expect(amBonusRow?.amount).toBe(150_000)

    // Bonus RM tetap terpisah = 3.000 pcs * 50 = 150.000
    const rmBonusRow = res.rows.find(r => r.category === 'bonus_regional_manager')
    expect(rmBonusRow?.amount).toBe(150_000)
  })

  it('mengabaikan outlet dummy/backup seperti SS BACKUP dari alokasi manajer', () => {
    const octNow = new Date('2026-10-03T10:00:00Z')
    // 20 outlet operasional nyata + 1 outlet backup dummy
    const realOutlets = Array.from({ length: 20 }, (_, i) => ({
      id: `outlet-${i + 1}`,
      name: `SUKA SHAWARMA CABANG ${i + 1}`,
      is_active: true,
      type: 'internal',
    }))
    const backupOutlet = {
      id: 'ss-backup-dummy',
      name: 'SS BACKUP',
      slug: 'ss-backup',
      is_active: true,
      type: 'internal',
    }
    const allOutlets = [...realOutlets, backupOutlet]

    const res = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-30', outletId: 'all', source: 'all' },
      rawExpenses: [],
      payrollRecords: [
        {
          staff_id: 'rm-indra',
          outlet_id: 'outlet-1',
          role: 'regional_manager',
          total_salary: 8_179_700,
          bonus: 2_692_700, // clean salary = 5.487.000
          period_month: 9,
          period_year: 2026,
        },
      ],
      now: octNow,
      outlets: allOutlets,
    })

    const rows = res.rows.filter(r => r.category === 'gaji_crew_outlet')
    // SS BACKUP sama sekali tidak boleh mendapatkan alokasi
    const backupRow = rows.find(r => r.outlet_id === 'ss-backup-dummy')
    expect(backupRow).toBeUndefined()

    // 20 outlet nyata masing-masing mendapatkan tepat 5.487.000 / 20 = 274.350
    expect(rows.length).toBe(20)
    for (const row of rows) {
      expect(row.amount).toBe(274_350)
    }

    const totalAllocated = rows.reduce((s, r) => s + r.amount, 0)
    expect(totalAllocated).toBe(5_487_000)
  })

  it('mendukung Opsi A: outlet yang tutup di tengah bulan (misal Mitra Paledang) tetap menerima bonus dan alokasi manajer', () => {
    const octNow = new Date('2026-10-03T10:00:00Z')
    // Paledang berstatus inactive di akhir bulan, tapi aktif 1-21 September
    const paledang = {
      id: 'outlet-paledang',
      name: 'MITRA PALEDANG',
      is_active: false,
      status: 'inactive',
      type: 'mitra',
    }
    const other4Branches = Array.from({ length: 4 }, (_, i) => ({
      id: `outlet-am-${i + 1}`,
      name: `Cabang AM ${i + 1}`,
      is_active: true,
      status: 'active',
      type: 'mitra',
    }))
    const other16Branches = Array.from({ length: 16 }, (_, i) => ({
      id: `outlet-other-${i + 1}`,
      name: `Cabang Lain ${i + 1}`,
      is_active: true,
      status: 'active',
      type: 'internal',
    }))

    const all21Outlets = [paledang, ...other4Branches, ...other16Branches]
    const amBranches = [paledang.id, ...other4Branches.map(o => o.id)]
    const operationalOutletIds = all21Outlets.map(o => o.id)

    // AM Abu Bakar membawahi 5 outlet (4 aktif + Paledang)
    const amAssignment: ManagerAssignment = {
      staff_id: 'am-abu-bakar',
      role: 'area_manager',
      outlet_ids: amBranches,
    }

    // Slip HR AM Abu Bakar: Total 5.378.400, bonus 878.400 -> clean salary 4.500.000 (900.000 per outlet)
    // Slip HR RM Indra: Total 8.179.700, bonus 2.692.700 -> clean salary 5.487.000 (261.285 - 261.286 per outlet)
    const payrollRecords = [
      {
        staff_id: 'am-abu-bakar',
        outlet_id: 'outlet-am-1',
        role: 'area_manager',
        total_salary: 5_378_400,
        bonus: 878_400,
        period_month: 9,
        period_year: 2026,
      },
      {
        staff_id: 'rm-indra',
        outlet_id: 'outlet-other-1',
        role: 'regional_manager',
        total_salary: 8_179_700,
        bonus: 2_692_700,
        period_month: 9,
        period_year: 2026,
      },
      // Slip kru Paledang (Jamaludin)
      {
        staff_id: 'kru-paledang',
        outlet_id: 'outlet-paledang',
        role: 'crew',
        total_salary: 459_615,
        bonus: 0,
        period_month: 9,
        period_year: 2026,
      },
    ]

    const crewBonusRecords = [
      {
        outlet_id: 'outlet-paledang',
        total_bonus: 122_200, // Agung Wardhana 58.850 + Emul Mulyana 63.350
        total_pcs_outlet: 1_293,
        period_month: 9,
        period_year: 2026,
      },
    ]

    // 1. Cek dari sudut pandang Paledang saja (single outlet filter)
    const resPaledang = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-30', outletId: 'outlet-paledang', source: 'all' },
      rawExpenses: [],
      payrollRecords,
      crewBonusRecords,
      managerAssignments: [amAssignment],
      operationalOutletIds,
      now: octNow,
      outlets: all21Outlets,
    })

    // Pastikan baris bonus crew, bonus AM, bonus RM ada untuk Paledang
    const bonusCrewRow = resPaledang.rows.find(r => r.category === 'bonus_crew')
    expect(bonusCrewRow).toBeDefined()
    expect(bonusCrewRow?.amount).toBe(122_200)

    const bonusAmRow = resPaledang.rows.find(r => r.category === 'bonus_area_manager')
    expect(bonusAmRow).toBeDefined()
    // 1.293 pcs * Rp 50 = Rp 64.650
    expect(bonusAmRow?.amount).toBe(64_650)

    const bonusRmRow = resPaledang.rows.find(r => r.category === 'bonus_regional_manager')
    expect(bonusRmRow).toBeDefined()
    // 1.293 pcs * Rp 50 = Rp 64.650
    expect(bonusRmRow?.amount).toBe(64_650)

    // Alokasi gaji bersih manajer untuk Paledang:
    // Gaji kru Jamaludin = 459.615
    // AM share = 4.500.000 / 5 = 900.000
    // RM share = 5.487.000 / 21 = 261.285 (base 261.285, remainder 15 disebar ke 15 outlet pertama)
    // Total gaji_crew_outlet Paledang = 459.615 + 900.000 + 261.285 = 1.620.900
    const gajiRow = resPaledang.rows.find(r => r.category === 'gaji_crew_outlet')
    expect(gajiRow).toBeDefined()
    expect(gajiRow?.amount).toBe(1_620_900)

    // 2. Cek integritas all-outlet (tidak ada selisih alokasi se-perusahaan)
    const resAll = calculateProratedExpenses({
      filter: { from: '2026-09-01', to: '2026-09-30', outletId: 'all', source: 'all' },
      rawExpenses: [],
      payrollRecords,
      crewBonusRecords,
      managerAssignments: [amAssignment],
      operationalOutletIds,
      now: octNow,
      outlets: all21Outlets,
    })

    const allGajiRows = resAll.rows.filter(r => r.category === 'gaji_crew_outlet')
    const totalGajiAllocated = allGajiRows.reduce((sum, r) => sum + r.amount, 0)
    // Total kru (459.615) + Clean AM (4.500.000) + Clean RM (5.487.000) = 10.446.615
    expect(totalGajiAllocated).toBe(10_446_615)
  })
})



