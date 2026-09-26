import { buildOpexSummary, previousMonth } from './opex'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'

const outlets = [
  { id: 'emp', name: 'SUKA SHAWARMA EMPANG', type: 'outlet', is_active: true },
  { id: 'saw', name: 'MITRA SAWANGAN', type: 'outlet', is_active: true },
  { id: 'cbn', name: 'MITRA CIBINONG', type: 'mitra', is_active: true },
  { id: 'jat', name: 'SUKA SHAWARMA JATIASIH', type: 'outlet', is_active: false },
]

const r = (outlet_id: string | null, category: string, amount: number, scope: 'outlet' | 'pusat' = 'outlet') =>
  ({ outlet_id, category, amount, scope })

describe('buildOpexSummary', () => {
  const prev = [
    r('emp', 'pln', 900_000), r('emp', 'sewa_outlet', 5_000_000),
    r('cbn', 'pln', 700_000), r('cbn', 'internet', 350_000),
    r('jat', 'pln', 100_000),
    r(null, 'gaji_staff_kantor', 20_000_000, 'pusat'), r(null, 'pengeluaran_global', 3_000_000, 'pusat'),
  ]
  const curr = [
    r('emp', 'pln', 950_000), r('emp', 'sewa_outlet', 5_000_000), r('emp', 'ads', 200_000),
    r('saw', 'pln', 400_000),
    r('cbn', 'pln', 720_000),
    r(null, 'pengeluaran_global', 1_000_000, 'pusat'),
    r(TEST_OUTLET_ID, 'pln', 999_999),
  ]
  const s = buildOpexSummary(curr, prev, outlets)
  const unit = (id: string) => s.units.find((u) => u.unitId === id)!

  it('mengelompokkan berdasarkan outlets.type (Sawangan = internal), pusat = global', () => {
    expect(unit('saw').group).toBe('internal')
    expect(unit('cbn').group).toBe('mitra')
    expect(unit('PUSAT').group).toBe('global')
  })

  it('total per kelompok = jumlah baris (outlet tes dikecualikan)', () => {
    expect(s.totals.internal.total).toBe(950_000 + 5_000_000 + 200_000 + 400_000)
    expect(s.totals.mitra.total).toBe(720_000)
    expect(s.totals.global.total).toBe(1_000_000)
    expect(s.units.some((u) => u.unitId === TEST_OUTLET_ID)).toBe(false)
  })

  it('kategori bulan lalu yang belum diisi ditandai', () => {
    expect(unit('cbn').missing).toEqual(['internet'])
    expect(unit('PUSAT').missing).toEqual(['gaji_staff_kantor'])
    expect(unit('emp').missing).toEqual([])
    expect(unit('emp').added).toEqual(['ads'])
  })

  it('menyimpan angka per kategori bulan lalu untuk rincian PDF', () => {
    expect(unit('cbn').byCategoryPrev).toEqual({ pln: 700_000, internet: 350_000 })
    expect(unit('cbn').byCategory).toEqual({ pln: 720_000 })
  })

  it('outlet nonaktif tidak diwajibkan mengisi', () => {
    expect(s.units.some((u) => u.unitId === 'jat')).toBe(false)
  })

  it('bulan sebelumnya', () => {
    expect(previousMonth(2026, 9)).toEqual({ year: 2026, month: 8 })
    expect(previousMonth(2026, 1)).toEqual({ year: 2025, month: 12 })
  })
})
