import { describe, it, expect } from 'vitest'
import {
  computeSelisih,
  getThresholdPersen,
  computeSelisihPersen,
  isSelisihFlagged,
} from './selisih'

describe('selisih logic & threshold helpers', () => {
  describe('computeSelisih', () => {
    it('calculates physical minus system stock correctly', () => {
      expect(computeSelisih(100, 80)).toBe(20)
      expect(computeSelisih(80, 100)).toBe(-20)
      expect(computeSelisih(50, 50)).toBe(0)
    })

    it('handles null physical count by treating it as 0', () => {
      expect(computeSelisih(null, 50)).toBe(-50)
    })
  })

  describe('getThresholdPersen', () => {
    it('returns 5% for measurable primary units', () => {
      expect(getThresholdPersen('kg')).toBe(5)
      expect(getThresholdPersen('gram')).toBe(5)
      expect(getThresholdPersen('liter')).toBe(5)
      expect(getThresholdPersen('ml')).toBe(5)
    })

    it('returns 5% for countable primary unit with measurable secondary unit (e.g. Sapi blok + gram)', () => {
      expect(getThresholdPersen('blok', 'gram')).toBe(5)
      expect(getThresholdPersen('kompan', 'ml')).toBe(5)
    })

    it('returns 0% for countable primary unit with pcs (e.g. gas pcs + gram)', () => {
      expect(getThresholdPersen('pcs', 'gram')).toBe(0)
      expect(getThresholdPersen('pcs')).toBe(0)
      expect(getThresholdPersen('pack')).toBe(0)
      expect(getThresholdPersen('box')).toBe(0)
      expect(getThresholdPersen('ikat')).toBe(0)
    })

    it('returns fallback 15% if satuan is undefined', () => {
      expect(getThresholdPersen(undefined)).toBe(15)
    })
  })

  describe('computeSelisihPersen', () => {
    it('calculates loss percentage correctly when selisih is negative', () => {
      const res = computeSelisihPersen(-500, 10000)
      expect(res.persen).toBe(-5.0)
      expect(res.formatted).toBe('-5.0%')
      expect(res.isLoss).toBe(true)
      expect(res.isSurplus).toBe(false)
      expect(res.isZero).toBe(false)
    })

    it('calculates surplus percentage correctly when selisih is positive', () => {
      const res = computeSelisihPersen(300, 10000)
      expect(res.persen).toBe(3.0)
      expect(res.formatted).toBe('+3.0%')
      expect(res.isLoss).toBe(false)
      expect(res.isSurplus).toBe(true)
      expect(res.isZero).toBe(false)
    })

    it('handles exact zero selisih', () => {
      const res = computeSelisihPersen(0, 10000)
      expect(res.persen).toBe(0)
      expect(res.formatted).toBe('0.0%')
      expect(res.isLoss).toBe(false)
      expect(res.isSurplus).toBe(false)
      expect(res.isZero).toBe(true)
    })

    it('handles edge case where qtySystem is zero', () => {
      const zeroSysZeroSel = computeSelisihPersen(0, 0)
      expect(zeroSysZeroSel.persen).toBe(0)
      expect(zeroSysZeroSel.formatted).toBe('0.0%')

      const zeroSysPosSel = computeSelisihPersen(10, 0)
      expect(zeroSysPosSel.persen).toBe(100)
      expect(zeroSysPosSel.formatted).toBe('+100.0%')
      expect(zeroSysPosSel.isSurplus).toBe(true)

      const zeroSysNegSel = computeSelisihPersen(-10, 0)
      expect(zeroSysNegSel.persen).toBe(-100)
      expect(zeroSysNegSel.formatted).toBe('-100.0%')
      expect(zeroSysNegSel.isLoss).toBe(true)
    })
  })

  describe('isSelisihFlagged', () => {
    it('flags when discrepancy exceeds 5% for measurable items', () => {
      // 10,000g system stock -> threshold is 5% = 500g
      expect(isSelisihFlagged(-500, 10000, 'kg', 'gram')).toBe(false) // 5% -> not flagged (strictly > threshold)
      expect(isSelisihFlagged(-501, 10000, 'kg', 'gram')).toBe(true) // >5% -> flagged
      expect(isSelisihFlagged(400, 10000, 'kg', 'gram')).toBe(false)
      expect(isSelisihFlagged(600, 10000, 'kg', 'gram')).toBe(true)
    })

    it('flags any non-zero discrepancy for countable items (0% threshold)', () => {
      expect(isSelisihFlagged(0, 100, 'pcs')).toBe(false)
      expect(isSelisihFlagged(1, 100, 'pcs')).toBe(true)
      expect(isSelisihFlagged(-1, 100, 'pcs')).toBe(true)
    })
  })
})
