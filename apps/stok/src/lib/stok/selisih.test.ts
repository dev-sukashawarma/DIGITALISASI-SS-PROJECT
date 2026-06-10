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
  it('flags when |selisih| exceeds 15% of qty_system', () => {
    expect(isSelisihFlagged(-5, 20)).toBe(true)
    expect(isSelisihFlagged(-2, 20)).toBe(false)
  })
  it('does not flag when qty_system is 0 (first opname)', () => {
    expect(isSelisihFlagged(50, 0)).toBe(false)
  })
})
