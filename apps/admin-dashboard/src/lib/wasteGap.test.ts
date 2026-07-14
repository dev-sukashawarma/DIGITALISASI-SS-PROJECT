// apps/admin-dashboard/src/lib/wasteGap.test.ts
import { describe, it, expect } from 'vitest'
import { computeWasteGap } from './wasteGap'

describe('computeWasteGap', () => {
  it('actual melebihi budget: gap positif (over-budget)', () => {
    const r = computeWasteGap(150_000, 100_000)
    expect(r.actual).toBe(150_000)
    expect(r.budget).toBe(100_000)
    expect(r.gapPct).toBeCloseTo(50, 5) // (150k-100k)/100k * 100
  })

  it('actual di bawah budget: gap negatif (efisien)', () => {
    const r = computeWasteGap(60_000, 100_000)
    expect(r.gapPct).toBeCloseTo(-40, 5) // (60k-100k)/100k * 100
  })

  it('actual sama dengan budget: gap 0', () => {
    const r = computeWasteGap(100_000, 100_000)
    expect(r.gapPct).toBe(0)
  })

  it('budget 0: gapPct null (N/A) terlepas dari nilai actual', () => {
    expect(computeWasteGap(50_000, 0).gapPct).toBeNull()
    expect(computeWasteGap(0, 0).gapPct).toBeNull()
  })

  it('actual 0, budget > 0: gap -100% (tidak ada waste sama sekali)', () => {
    const r = computeWasteGap(0, 100_000)
    expect(r.gapPct).toBeCloseTo(-100, 5)
  })
})
