import { describe, it, expect } from 'vitest'
import { bagiPersis, barisPayrollDariHr, gajiRutinBulananKartu, gantiPayrollDenganHr, ringkasanHrKelompok } from './opexDariHr'

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

  it('outlet parsial: beban Rp 0 di Laba Rugi jika filter sebelum tanggal buka outlet', () => {
    const h = hr({
      outlets: [
        { outletId: 'a', outletName: 'EMPANG', staffCount: 1, totalSalary: 0, draftCount: 0, finalizedCount: 0, status: 'draft', isPartial: false },
        {
          outletId: 'paledang', outletName: 'PALEDANG', staffCount: 1, totalSalary: 0, draftCount: 0, finalizedCount: 0, status: 'draft',
          isPartial: true, operationalFirstDate: '2026-10-26', operationalLastDate: '2026-10-31', operationalCalendarDays: 6
        },
      ],
      staffDetails: [
        { staffId: '1', outletId: 'a', outletName: 'EMPANG', routineSalary: 5_000_000 },
        { staffId: '2', outletId: 'paledang', outletName: 'PALEDANG', routineSalary: 1_000_000 },
      ]
    })
    // Filter rentang 1 s/d 15 Okt (sebelum Paledang buka tgl 26)
    const rows = barisPayrollDariHr({ hr: h, from: '2026-10-01', to: '2026-10-15' })!
    const rowPaledang = rows.find(r => r.outlet_id === 'paledang' && r.category === 'gaji_crew_outlet')
    expect(rowPaledang).toBeUndefined() // Tidak ada beban gaji untuk Paledang sebelum toko buka
  })

  it('kru backup dibagi rata ke outlet tempatnya bertugas, bukan menumpuk di outlet asal', () => {
    const h = hr({
      basicSalary: 2_000_000, allowances: 390_000, deductions: 77_000,
      outlets: [
        { outletId: 'a', outletName: 'CIMANGGU', staffCount: 1, totalSalary: 0, draftCount: 0, finalizedCount: 0, status: 'draft' },
        { outletId: 'b', outletName: 'DRAMAGA', staffCount: 0, totalSalary: 0, draftCount: 0, finalizedCount: 0, status: 'draft' },
      ],
      staffDetails: [{
        staffId: 'bk', outletId: 'a', outletName: 'CIMANGGU', routineSalary: 2_313_000,
        isBackupAllocation: true, allocatedOutletIds: ['a', 'b'],
        fullBasicSalary: 2_000_000, fullAllowances: 390_000, fullDeductions: 77_000,
      }],
      crewBonusDetails: [], crewBonus: 0, managerBonusAllocation: 0,
    })
    const rows = barisPayrollDariHr({ hr: h, from: '2026-10-01', to: '2026-10-31' })!
    const gaji = (id: string) => rows.find(r => r.category === 'gaji_crew_outlet' && r.outlet_id === id)?.amount
    expect(gaji('a')).toBe(1_156_500)
    expect(gaji('b')).toBe(1_156_500)
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

describe('ringkasanHrKelompok', () => {
  const mgr = (staffId: string, role: string, pokok: number, tunj: number, pot: number, bonus: number, pcs: number) => ({
    staffId, staffName: staffId, role, totalSalary: 0, allocatedAmount: pokok + tunj - pot + bonus,
    routineAmount: pokok + tunj - pot, bonusAmount: bonus, allocatedBasicSalary: pokok, allocatedAllowances: tunj,
    allocatedDeductions: pot, coachedOutletsCount: 1, totalPcs: pcs, status: 'draft',
  })
  const semua = () => hr({
    staffDetails: [
      { staffId: '1', outletId: 'a', outletName: 'EMPANG', basicSalary: 3_000_000, allowances: 500_000, deductions: 100_000, routineSalary: 3_400_000, status: 'draft' },
      { staffId: '2', outletId: 'b', outletName: 'MITRA SENTUL', basicSalary: 2_000_000, allowances: 300_000, deductions: 0, routineSalary: 2_300_000, status: 'draft' },
    ],
    crewBonusByOutlet: { a: 200, b: 101 },
    crewBonusDetailsByOutlet: {
      a: [{ staffId: '1', staffName: '1', bonus: 200, totalPcs: 2, status: 'draft' }],
      b: [{ staffId: '2', staffName: '2', bonus: 101, totalPcs: 1, status: 'draft' }],
    },
    managerDetailsByOutlet: {
      a: [mgr('rm', 'regional_manager', 261_000, 50_000, 0, 100, 2), mgr('am1', 'area_manager', 900_000, 100_000, 0, 100, 2)],
      b: [mgr('rm', 'regional_manager', 261_000, 50_000, 0, 50, 1)],
    },
  })

  it('Internal dan Mitra saling melengkapi: gaji, bonus, dan alokasi manajer cocok dengan total', () => {
    const h = semua()
    const internal = ringkasanHrKelompok(h, id => id === 'a')!
    const mitra = ringkasanHrKelompok(h, id => id === 'b')!
    expect(internal.crewBasicSalary).toBe(3_000_000)
    expect(mitra.crewBasicSalary).toBe(2_000_000)
    expect(internal.crewBonus).toBe(200)
    expect(mitra.crewBonus).toBe(101)
    // RM menanggung dua outlet (a dan b), AM hanya outlet a
    expect(internal.managerDetails!.map(m => m.staffId).sort()).toEqual(['am1', 'rm'])
    expect(mitra.managerDetails!.map(m => m.staffId)).toEqual(['rm'])
    // rincian per cabang hanya memuat outlet dalam kelompok
    expect(Object.keys(internal.managerDetailsByOutlet!)).toEqual(['a'])
    expect(Object.keys(mitra.managerDetailsByOutlet!)).toEqual(['b'])
    expect(internal.managerBonusAllocation).toBe(200)
    expect(mitra.managerBonusAllocation).toBe(50)
    expect(internal.managerAllocation! + mitra.managerAllocation!).toBe(261_000 * 2 + 50_000 * 2 + 1_000_000)
  })

  it('"Internal + Kantor Pusat" menambahkan staf pusat sebagai kru', () => {
    const pusat = hr({ basicSalary: 4_000_000, allowances: 200_000, deductions: 0, staffDetails: [{ staffId: 'p', outletId: 'PUSAT', routineSalary: 4_200_000 }] })
    const r = ringkasanHrKelompok(semua(), id => id === 'a', pusat)!
    expect(r.crewBasicSalary).toBe(7_000_000)
    expect(r.crewCount).toBe(2)
    expect(r.totalSalary).toBe(r.basicSalary + r.allowances + r.bonus - r.deductions)
  })

  it('tanpa data HR mengembalikan null', () => {
    expect(ringkasanHrKelompok(null, () => true)).toBeNull()
  })
})