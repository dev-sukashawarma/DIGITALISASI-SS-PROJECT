import { describe, it, expect } from 'vitest'
import { bagiPersis, barisPayrollDariHr, gajiRutinBulananKartu, gantiPayrollDenganHr } from './opexDariHr'

const hr = (o: Record<string, unknown> = {}) => ({
  totalSalary: 10, totalStaff: 3, basicSalary: 9_000_000, allowances: 1_000_000, bonus: 0, deductions: 100_000,
  draftCount: 0, draftAmount: 0, finalizedCount: 0, finalizedAmount: 0, status: 'draft',
  crewBonus: 301, managerBonusAllocation: 500,
  outlets: [
    { outletId: 'a', outletName: 'EMPANG', staffCount: 2, totalSalary: 0, draftCount: 0, finalizedCount: 0, status: 'draft', managerRoutineAllocation: 900_000, managerBonusAllocation: 500 },
    { outletId: 'b', outletName: 'MITRA SENTUL', staffCount: 1, totalSalary: 0, draftCount: 0, finalizedCount: 0, status: 'draft', managerRoutineAllocation: 0, managerBonusAllocation: 0 },
  ],
  staffDetails: [
    { staffId: '1', outletId: 'a', outletName: 'EMPANG', routineSalary: 5_000_000 },
    { staffId: '2', outletId: 'b', outletName: 'MITRA SENTUL', routineSalary: 3_000_000 },
    { staffId: 'm', outletId: 'PUSAT', outletName: 'Alokasi Management', routineSalary: 900_000, isManagerAllocation: true },
  ],
  crewBonusDetails: [
    { staffId: '1', outletName: 'EMPANG', bonus: 200 },
    { staffId: '2', outletName: 'MITRA SENTUL', bonus: 101 },
  ],
  ...o,
}) as any

const jumlah = (rows: any[], k: string) => rows.filter(r => r.category === k).reduce((s, r) => s + r.amount, 0)

describe('bagiPersis', () => {
  it('jumlah hasil selalu sama dengan total', () => {
    const h = bagiPersis(100, new Map([['a', 1], ['b', 1], ['c', 1]]))
    expect([...h.values()].reduce((s, v) => s + v, 0)).toBe(100)
  })
})

describe('barisPayrollDariHr', () => {
  it('bulan penuh: jumlah per kategori sama persis dengan angka kartu Buku Kas', () => {
    const h = hr()
    const rows = barisPayrollDariHr({ hr: h, from: '2026-09-01', to: '2026-09-30' })!
    expect(jumlah(rows, 'gaji_crew_outlet')).toBe(gajiRutinBulananKartu(h, false))
    expect(jumlah(rows, 'bonus_crew')).toBe(301)
    expect(jumlah(rows, 'bonus_area_manager')).toBe(500)
    expect(rows.every(r => r.scope === 'outlet')).toBe(true)
  })

  it('sebagian bulan: gaji diprorata, bonus tidak', () => {
    const h = hr()
    const rows = barisPayrollDariHr({ hr: h, from: '2026-10-01', to: '2026-10-13' })!
    expect(jumlah(rows, 'gaji_crew_outlet')).toBe(Math.round(gajiRutinBulananKartu(h, false) * 13 / 31))
    expect(jumlah(rows, 'bonus_crew')).toBe(301)
  })

  it('bonus AM/RM hanya di outlet yang punya alokasi manajer', () => {
    const rows = barisPayrollDariHr({ hr: hr(), from: '2026-09-01', to: '2026-09-30' })!
    expect(rows.filter(r => r.category === 'bonus_area_manager').map(r => r.outlet_id)).toEqual(['a'])
  })

  it('tanpa slip HR mengembalikan null', () => {
    expect(barisPayrollDariHr({ hr: hr({ totalStaff: 0 }), from: '2026-09-01', to: '2026-09-30' })).toBeNull()
    expect(barisPayrollDariHr({ hr: undefined, from: '2026-09-01', to: '2026-09-30' })).toBeNull()
  })
})

describe('gantiPayrollDenganHr', () => {
  const baris = (o: Record<string, unknown>) => ({
    id: 'x', outlet_id: 'a', outlet_name: 'EMPANG', category: 'internet', scope: 'outlet', amount: 1,
    description: '', expense_date: '2026-10-13', period_month: '2026-10-01', source: 'monthly', ...o,
  }) as any

  it('hanya baris gaji/bonus buatan mesin yang diganti', () => {
    const rows = [
      baris({ id: 'prorata-gaji-a', category: 'gaji_crew_outlet' }),
      baris({ id: 'prorata-bonus-rm-a', category: 'bonus_regional_manager' }),
      baris({ id: 'prorata-internet-a' }),
      baris({ id: 'manual', category: 'gaji_crew_outlet' }),
    ]
    const hasil = gantiPayrollDenganHr(rows, [baris({ id: 'hr-gaji-a', category: 'gaji_crew_outlet' })])
    expect(hasil.map(r => r.id)).toEqual(['prorata-internet-a', 'manual', 'hr-gaji-a'])
  })

  it('tanpa baris HR, daftar tidak berubah', () => {
    const rows = [baris({})]
    expect(gantiPayrollDenganHr(rows, null)).toBe(rows)
  })
})
