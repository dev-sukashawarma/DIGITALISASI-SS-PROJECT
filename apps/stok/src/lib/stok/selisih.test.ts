import { describe, it, expect } from 'vitest'
import { computeSelisih, isSelisihFlagged } from './selisih'

describe('computeSelisih', () => {
  it('returns fisik - system', () => {
    expect(computeSelisih(18, 15)).toBe(3)
    expect(computeSelisih(13, 15)).toBe(-2)
  })
  it('treats null fisik (not counted) as 0', () => {
    expect(computeSelisih(null, 15)).toBe(-15)
  })
})

describe('isSelisihFlagged', () => {
  it('flags when |selisih| exceeds fallback 15% if no satuan provided', () => {
    expect(isSelisihFlagged(-4, 20)).toBe(true) // 4 > 0.15 * 20 = 3
    expect(isSelisihFlagged(-2, 20)).toBe(false)
  })
  it('does not flag when qty_system is 0 (first opname)', () => {
    expect(isSelisihFlagged(50, 0)).toBe(false)
  })
  it('flags discrepancy when qty_system is negative (negative system stock)', () => {
    expect(isSelisihFlagged(15, -5, 'pcs')).toBe(true)
    expect(isSelisihFlagged(-15, -5, 'pcs')).toBe(true)
  })
  it('flags any discrepancy for countable items (0% threshold)', () => {
    expect(isSelisihFlagged(1, 10, 'pcs')).toBe(true)
    expect(isSelisihFlagged(-1, 10, 'box')).toBe(true)
    expect(isSelisihFlagged(0, 10, 'pcs')).toBe(false)
  })
  it('flags when |selisih| exceeds 5% for measurable items', () => {
    expect(isSelisihFlagged(5, 100, 'gram')).toBe(false) // 5 is exactly 5%, so not flagged
    expect(isSelisihFlagged(6, 100, 'gram')).toBe(true)
    expect(isSelisihFlagged(-4, 100, 'ml')).toBe(false)
    expect(isSelisihFlagged(-6, 100, 'liter')).toBe(true)
  })
  it('SAPI (blok+gram): applies 5% because satuan_kecil=gram', () => {
    // SAPI: satuan=blok, satuan_kecil=gram → ditimbang → threshold 5%
    expect(isSelisihFlagged(-50, 1000, 'blok', 'gram')).toBe(false)  // 5%  ≤ 5% → aman
    expect(isSelisihFlagged(-60, 1000, 'blok', 'gram')).toBe(true)   // 6%  >  5% → flag
    expect(isSelisihFlagged(100, 1000, 'blok', 'gram')).toBe(true)   // 10% >  5% → flag
  })
  it('GAS (pcs+gram): stays 0% because satuan utama=pcs (dihitung, bukan timbang)', () => {
    // GAS: satuan=pcs, satuan_kecil=gram → dihitung per tabung → threshold 0%
    expect(isSelisihFlagged(1, 4, 'pcs', 'gram')).toBe(true)   // selisih 1 tabung → flag
    expect(isSelisihFlagged(-1, 4, 'pcs', 'gram')).toBe(true)  // kurang 1 tabung → flag
    expect(isSelisihFlagged(0, 4, 'pcs', 'gram')).toBe(false)  // pas → aman
  })
  it('items dengan satuan_kecil=lembar/cm tetap 0% (bukan timbang)', () => {
    // KEJU: satuan=crt, satuan_kecil=lembar → countable → 0%
    expect(isSelisihFlagged(1, 5, 'crt', 'lembar')).toBe(true)
    // FOIL: satuan=pcs, satuan_kecil=cm → countable → 0%
    expect(isSelisihFlagged(1, 5, 'pcs', 'cm')).toBe(true)
  })
})
