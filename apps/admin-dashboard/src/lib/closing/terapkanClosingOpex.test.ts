import type { ExpenseRow } from '@/lib/expenseRow'
import { isLemburExpense } from '@/lib/expenseCategories'
import { CLOSING_OPEX_INTERNAL_SEPT_2026 as C } from './opexClosingInternalSeptember2026'
import {
  AWALAN_ID_PENYESUAIAN,
  GUDANG_SS_ONLINE_ID,
  SS_ONLINE_ID,
  barisOutletDari,
  barisPusatDari,
  terapkanClosingOpex,
} from './terapkanClosingOpex'

const BNR = '550e8400-e29b-41d4-a716-446655440001'
const CIRENDEU = '550e8400-e29b-41d4-a716-446655440011'
const MITRA_CIBINONG = '550e8400-e29b-41d4-a716-446655440014'
const PUSAT = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
const SEPT = { from: '2026-09-01', to: '2026-09-30' }

let n = 0
function baris(p: Partial<ExpenseRow> & Pick<ExpenseRow, 'category' | 'amount'>): ExpenseRow {
  n += 1
  return {
    id: `t-${n}`,
    outlet_id: BNR,
    outlet_name: 'SUKA SHAWARMA BNR',
    scope: 'outlet',
    description: '',
    expense_date: '2026-09-15',
    period_month: '2026-09-01',
    source: 'monthly',
    ...p,
  } as ExpenseRow
}

function jumlahPerBaris(rows: ExpenseRow[], outletId: string) {
  const hasil: Record<string, number> = {}
  for (const r of rows.filter(r => r.scope === 'outlet' && r.outlet_id === outletId)) {
    const k = barisOutletDari(r)
    hasil[k] = (hasil[k] ?? 0) + r.amount
  }
  return hasil
}

describe('terapkanClosingOpex', () => {
  it('rentang selain tepat September: data apa adanya', () => {
    const rows = [baris({ category: 'gaji_crew_outlet', amount: 100 })]
    const agustus = terapkanClosingOpex(rows, { from: '2026-08-01', to: '2026-08-31', outletId: 'all' })
    expect(agustus).toEqual({ rows, diterapkan: false, catatan: null })

    const separuh = terapkanClosingOpex(rows, { from: '2026-09-01', to: '2026-09-15', outletId: 'all' })
    expect(separuh.rows).toBe(rows)
    expect(separuh.diterapkan).toBe(false)
    expect(separuh.catatan).toMatch(/1–30 September/)

    const gabung = terapkanClosingOpex(rows, { from: '2026-08-01', to: '2026-09-30', outletId: 'all' })
    expect(gabung.diterapkan).toBe(false)
    expect(gabung.catatan).toMatch(/1–30 September/)
  })

  it('satu outlet: tiap baris = target Excel, baris asli tetap ada', () => {
    const rows = [
      baris({ category: 'gaji_crew_outlet', amount: 15832715, id: 'hr-gaji-bnr' }),
      baris({ category: 'bonus_crew', amount: 148801 }),
      baris({ category: 'bonus_area_manager', amount: 74400 }),
      baris({ category: 'lembur', amount: 50000, description: 'Lemburan a.n Gilang' }),
      baris({ category: 'internet', amount: 51500, description: 'Pulsa HP Kitchen' }),
      baris({ category: 'pengeluaran_outlet', amount: 7900, source: 'monthly' }),
    ]
    const hasil = terapkanClosingOpex(rows, { ...SEPT, outletId: BNR })
    expect(hasil.diterapkan).toBe(true)
    expect(hasil.rows.slice(0, rows.length)).toEqual(rows)
    const sums = jumlahPerBaris(hasil.rows, BNR)
    for (const [k, v] of Object.entries(C.outlets[BNR].target)) {
      expect(Math.abs((sums[k] ?? 0) - v)).toBeLessThan(0.001)
    }
    const penyesuaian = hasil.rows.filter(r => r.id.startsWith(AWALAN_ID_PENYESUAIAN))
    expect(penyesuaian.every(r => r.outlet_id === BNR && r.source === 'monthly')).toBe(true)
    expect(penyesuaian.find(r => r.category === 'gaji_crew_outlet')?.amount).toBeCloseTo(-4630001, 0)
    expect(penyesuaian.find(r => r.category === 'bonus_regional_manager')?.amount).toBeCloseTo(128224, 0)
    expect(hasil.rows.some(r => r.scope === 'pusat')).toBe(false)
  })

  it('pecahan rupiah dari slip tetap menghasilkan total tepat', () => {
    const rows = [baris({ outlet_id: CIRENDEU, category: 'gaji_crew_outlet', amount: 6267200.38461538 })]
    const hasil = terapkanClosingOpex(rows, { ...SEPT, outletId: CIRENDEU })
    expect(jumlahPerBaris(hasil.rows, CIRENDEU).gaji_crew_outlet).toBeCloseTo(C.outlets[CIRENDEU].target.gaji_crew_outlet, 6)
  })

  it('outlet tanpa baris data tetap disesuaikan penuh (SS Online)', () => {
    const hasil = terapkanClosingOpex([], { ...SEPT, outletId: SS_ONLINE_ID })
    const sums = jumlahPerBaris(hasil.rows, SS_ONLINE_ID)
    expect(sums.gaji_crew_outlet).toBe(6630000)
    expect(sums.internet).toBe(260850)
  })

  it('GUDANG SS ONLINE digabung ke SS Online', () => {
    const rows = [baris({ outlet_id: GUDANG_SS_ONLINE_ID, outlet_name: 'GUDANG SS ONLINE', category: 'internet', amount: 260850 })]
    const hasil = terapkanClosingOpex(rows, { ...SEPT, outletId: 'all' })
    expect(hasil.rows.some(r => r.outlet_id === GUDANG_SS_ONLINE_ID)).toBe(false)
    const ss = hasil.rows.filter(r => r.outlet_id === SS_ONLINE_ID)
    expect(ss.find(r => r.category === 'internet' && !r.id.startsWith(AWALAN_ID_PENYESUAIAN))?.amount).toBe(260850)
    expect(ss.some(r => r.category === 'internet' && r.id.startsWith(AWALAN_ID_PENYESUAIAN))).toBe(false)
  })

  it('semua outlet tanpa data: total penyesuaian = total OPEX internal + HQ Excel', () => {
    const hasil = terapkanClosingOpex([], { ...SEPT, outletId: 'all' })
    const total = hasil.rows.reduce((s, r) => s + r.amount, 0)
    const totalInternal = Object.values(C.outlets).reduce((s, o) => s + o.totalExcel, 0)
    expect(total).toBeCloseTo(totalInternal + C.pusat.totalExcel, 2)
  })

  it('outlet mitra tidak pernah disesuaikan', () => {
    const rows = [baris({ outlet_id: MITRA_CIBINONG, outlet_name: 'MITRA CIBINONG', category: 'gaji_crew_outlet', amount: 999 })]
    const hasil = terapkanClosingOpex(rows, { ...SEPT, outletId: MITRA_CIBINONG })
    expect(hasil.rows).toEqual(rows)
  })

  it('pusat: baris "Lemburan" di pengeluaran global tetap Pengeluaran Global; crew backup pakai kategori salary', () => {
    const rows = [
      baris({ outlet_id: PUSAT, outlet_name: 'Kantor Pusat', scope: 'pusat', category: 'pengeluaran_global', amount: 50000, description: 'Lemburan a.n Aby' }),
      baris({ outlet_id: PUSAT, outlet_name: 'Kantor Pusat', scope: 'pusat', category: 'gaji_staff_kantor', amount: 73755768 }),
    ]
    expect(barisPusatDari(rows[0])).toBe('pengeluaran_global')
    const hasil = terapkanClosingOpex(rows, { ...SEPT, outletId: 'PUSAT' })
    const p = hasil.rows.filter(r => r.id.startsWith(AWALAN_ID_PENYESUAIAN))
    expect(p.every(r => r.scope === 'pusat')).toBe(true)
    expect(p.find(r => r.category === 'gaji_staff_kantor')?.amount).toBe(-2050000)
    expect(p.find(r => r.category === 'salary')?.amount).toBe(8694636)
    expect(p.find(r => r.category === 'pengeluaran_global')?.amount).toBe(124855883 - 50000)
  })

  it('baris penyesuaian non-lembur tidak terbaca sebagai lembur', () => {
    const hasil = terapkanClosingOpex([], { ...SEPT, outletId: 'all' })
    for (const r of hasil.rows) {
      if (r.category !== 'lembur') expect(isLemburExpense(r.category, r.description)).toBe(false)
    }
  })
})
