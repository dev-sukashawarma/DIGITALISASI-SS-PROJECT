import { describe, it, expect } from 'vitest'
import { calculateProratedExpenses, adalahOutletTanpaSewa } from './opexProrata'

const CIBINONG = '550e8400-e29b-41d4-a716-446655440014'
const PEKAYON = '550e8400-e29b-41d4-a716-446655440018'
const LAIN = 'outlet-lain'
const now = new Date('2026-11-25T05:00:00Z')

describe('Cibinong & Pekayon tanpa sewa mulai November 2026', () => {
  it('aturan berlaku mulai November, tidak mundur ke Oktober', () => {
    expect(adalahOutletTanpaSewa(CIBINONG, '2026-11-01')).toBe(true)
    expect(adalahOutletTanpaSewa(PEKAYON, '2026-12-01')).toBe(true)
    expect(adalahOutletTanpaSewa(CIBINONG, '2026-10-01')).toBe(false)
    expect(adalahOutletTanpaSewa(LAIN, '2026-11-01')).toBe(false)
  })

  it('sewa bawaan Oktober & input November tidak dibebankan ke kedua outlet', () => {
    const res = calculateProratedExpenses({
      filter: { from: '2026-11-01', to: '2026-11-25', outletId: 'all', source: 'all' },
      rawExpenses: [
        { id: 'x', outlet_id: PEKAYON, outlet_name: 'MITRA PEKAYON', category: 'sewa_outlet' as any, scope: 'outlet', amount: 1_750_000, description: '', expense_date: '2026-11-01', period_month: '2026-11-01', source: 'monthly' } as any,
      ],
      lastMonthExpenses: [
        { outlet_id: CIBINONG, category: 'sewa_outlet', amount: 1_834_000 },
        { outlet_id: PEKAYON, category: 'sewa_outlet', amount: 1_750_000 },
        { outlet_id: LAIN, category: 'sewa_outlet', amount: 3_000_000 },
      ],
      now,
      outlets: [
        { id: CIBINONG, name: 'MITRA CIBINONG' },
        { id: PEKAYON, name: 'MITRA PEKAYON' },
        { id: LAIN, name: 'MITRA LAIN' },
      ],
    })
    const sewa = res.rows.filter(r => r.category === 'sewa_outlet')
    expect(sewa.map(r => r.outlet_id)).toEqual([LAIN])
    expect(sewa[0].amount).toBe(2_500_000) // 25/30 x 3.000.000
  })
})
