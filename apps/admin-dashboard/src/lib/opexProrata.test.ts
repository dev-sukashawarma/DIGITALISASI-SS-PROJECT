import { describe, it, expect } from 'vitest'
import {
  calculateMonthOverlap,
  calculateProratedExpenses,
  getJakartaCurrentMonthInfo,
} from './opexProrata'
import type { ExpenseRow } from '@/hooks/useExpenses'

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
})

