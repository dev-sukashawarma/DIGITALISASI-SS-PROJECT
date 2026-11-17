import { describe, it, expect } from 'vitest'
import { susunBarisGajiKantor, gabungGajiKantor } from './gajiKantorPusat'
import type { ExpenseRow } from '@/lib/expenseRow'

const slip = (m: number, total: number, y = 2026) => ({ period_month: m, period_year: y, total_salary: total })

describe('susunBarisGajiKantor', () => {
  it('bulan penuh: satu baris pusat sebesar total slip', () => {
    const r = susunBarisGajiKantor({ from: '2026-09-01', to: '2026-09-30', officePayrollRecords: [slip(9, 40_000_000), slip(9, 10_000_000), slip(10, 99)] })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ scope: 'pusat', category: 'gaji_staff_kantor', outlet_id: null, amount: 50_000_000, period_month: '2026-09-01' })
  })

  it('sebagian bulan diprorata per hari', () => {
    const r = susunBarisGajiKantor({ from: '2026-10-01', to: '2026-10-13', officePayrollRecords: [slip(10, 31_000_000)] })
    expect(r[0].amount).toBe(13_000_000)
  })

  it('Agustus 2026 dan sebelumnya tidak disentuh', () => {
    const r = susunBarisGajiKantor({ from: '2026-08-01', to: '2026-09-30', officePayrollRecords: [slip(8, 5_000_000), slip(9, 7_000_000)] })
    expect(r.map(x => x.period_month)).toEqual(['2026-09-01'])
  })

  it('bulan berjalan tanpa slip memakai master gaji; bulan lampau tanpa slip tidak', () => {
    const base = { officePayrollRecords: [], officeStaffMonthlyTotal: 30_000_000, currentMonthFirstDay: '2026-11-01' }
    expect(susunBarisGajiKantor({ from: '2026-11-01', to: '2026-11-30', ...base })[0].amount).toBe(30_000_000)
    expect(susunBarisGajiKantor({ from: '2026-10-01', to: '2026-10-31', ...base })).toEqual([])
  })
})

describe('gabungGajiKantor', () => {
  const manual = (o: Partial<ExpenseRow>): ExpenseRow => ({
    id: 'm', outlet_id: null, outlet_name: 'Kantor Pusat', category: 'gaji_staff_kantor', scope: 'pusat',
    amount: 1, description: '', expense_date: '2026-09-01', period_month: '2026-09-01', source: 'monthly', ...o,
  })

  it('baris manual gaji kantor di bulan yang sama dibuang, lainnya tetap', () => {
    const hr = susunBarisGajiKantor({ from: '2026-09-01', to: '2026-09-30', officePayrollRecords: [slip(9, 100)] })
    const hasil = gabungGajiKantor([
      manual({ id: 'dobel' }),
      manual({ id: 'bulan-lain', expense_date: '2026-08-01', period_month: '2026-08-01' }),
      manual({ id: 'kategori-lain', category: 'pengeluaran_global' }),
      manual({ id: 'outlet', scope: 'outlet', outlet_id: 'o1' }),
    ], hr)
    expect(hasil.map(r => r.id)).toEqual(['bulan-lain', 'kategori-lain', 'outlet', 'hr-gaji-kantor-2026-9'])
  })

  it('tanpa baris HR, daftar tidak berubah', () => {
    const rows = [manual({})]
    expect(gabungGajiKantor(rows, [])).toBe(rows)
  })
})
