import { describe, it, expect } from 'vitest'
import { susunBarisPengeluaran } from './susunBaris'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'

const exp = (o: Record<string, unknown>) => ({
  id: 'e1', outlet_id: 'o1', category: 'pengeluaran_outlet', amount: 100, description: 'x',
  expense_date: '2026-10-02', period_month: '2026-10-01', receipt_url: null, type: 'expense',
  outlets: { name: 'EMPANG' }, ...o,
})
const kk = (o: Record<string, unknown>) => ({
  id: 'p1', outlet_id: 'o1', category: 'bb', amount: 50, description: 'y',
  expense_date: '2026-10-03', receipt_url: null, type: 'expense', outlets: { name: 'EMPANG' }, ...o,
})

describe('susunBarisPengeluaran (perilaku sama dengan useExpenses lama)', () => {
  it('kas kecil: kategori lama dipetakan, sumber petty_cash, scope outlet', () => {
    const r = susunBarisPengeluaran([], [kk({}), kk({ id: 'p2', category: 'outlet' }), kk({ id: 'p3', category: 'utilities' })])
    expect(r.map((x) => x.category)).toEqual(['bahan_baku', 'pengeluaran_outlet', 'utilitas'])
    expect(r.every((x) => x.source === 'petty_cash' && x.scope === 'outlet')).toBe(true)
  })

  it('outlet tes dibuang dari kedua sumber', () => {
    expect(susunBarisPengeluaran([exp({ outlet_id: TEST_OUTLET_ID })], [kk({ outlet_id: TEST_OUTLET_ID })])).toEqual([])
  })

  it('baris bulanan tanpa outlet = pusat', () => {
    const r = susunBarisPengeluaran([exp({ outlet_id: null, category: 'pengeluaran_global', outlets: null })], [])
    expect(r[0].scope).toBe('pusat')
  })

  it('kas kecil outlet-bulan yang sudah punya rangkuman OPEX tidak ikut', () => {
    const r = susunBarisPengeluaran(
      [exp({ description: 'OPEX Oktober 2026 - Bahan Baku (Petty Cash)' })],
      [kk({}), kk({ id: 'p9', outlet_id: 'o2' })],
    )
    expect(r.map((x) => x.id)).toEqual(['e1', 'p9'])
  })
})
