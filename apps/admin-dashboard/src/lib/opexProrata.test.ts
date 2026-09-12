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
})
