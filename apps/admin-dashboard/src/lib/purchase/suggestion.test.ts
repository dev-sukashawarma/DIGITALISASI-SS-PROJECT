import { describe, it, expect } from 'vitest'
import { computeSuggestion, sortSuggestions, type SuggestionRow } from './suggestion'

const base: SuggestionRow = {
  bahan_baku_id: 'a', nama: 'Ayam', satuan: 'kg',
  stok: 10, threshold: 20, days_left: 2, permintaan_pending: 5, sudah_dipesan: 0,
}

describe('computeSuggestion', () => {
  it('qty_saran = (threshold + permintaan + kebutuhan periode) - stok - sudah_dipesan, tak negatif', () => {
    // laju/hari = stok/days_left = 10/2 = 5; kebutuhan 7 hari = 35
    // (20 + 5 + 35) - 10 - 0 = 50
    const r = computeSuggestion(base)
    expect(r.qty_saran).toBe(50)
  })
  it('kurangi yang sudah dipesan', () => {
    expect(computeSuggestion({ ...base, sudah_dipesan: 40 }).qty_saran).toBe(10)
  })
  it('tak pernah negatif', () => {
    expect(computeSuggestion({ ...base, sudah_dipesan: 999 }).qty_saran).toBe(0)
  })
  it('days_left null → kebutuhan periode 0', () => {
    // (20 + 5 + 0) - 10 - 0 = 15
    expect(computeSuggestion({ ...base, days_left: null }).qty_saran).toBe(15)
  })
  it('tingkat mendesak bila stok < threshold ATAU days_left <= 3', () => {
    expect(computeSuggestion(base).tingkat).toBe('mendesak')
    expect(computeSuggestion({ ...base, stok: 25, days_left: 10 }).tingkat).toBe('aman')
    expect(computeSuggestion({ ...base, stok: 25, days_left: 2 }).tingkat).toBe('mendesak')
  })
})

describe('sortSuggestions', () => {
  it('mendesak di atas, aman di bawah', () => {
    const rows = [
      computeSuggestion({ ...base, bahan_baku_id: 'x', stok: 25, days_left: 10 }),
      computeSuggestion({ ...base, bahan_baku_id: 'y' }),
    ]
    expect(sortSuggestions(rows).map(r => r.bahan_baku_id)).toEqual(['y', 'x'])
  })
})
