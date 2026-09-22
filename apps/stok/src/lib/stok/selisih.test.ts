import { describe, it, expect } from 'vitest'
import {
  computeSelisih,
  getThresholdPersen,
  computeSelisihPersen,
  isSelisihFlagged,
  getMaterialType,
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
    it('returns 20% for measurable primary units (bulk)', () => {
      expect(getThresholdPersen('kg')).toBe(20)
      expect(getThresholdPersen('gram')).toBe(20)
      expect(getThresholdPersen('liter')).toBe(20)
      expect(getThresholdPersen('ml')).toBe(20)
    })

    it('returns 20% for countable primary unit with measurable secondary unit (e.g. Sapi blok + gram)', () => {
      expect(getThresholdPersen('blok', 'gram')).toBe(20)
      expect(getThresholdPersen('kompan', 'ml')).toBe(20)
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
    it('flags when discrepancy exceeds 20% for measurable items', () => {
      // 10,000g system stock -> threshold is 20% = 2000g
      expect(isSelisihFlagged(-2000, 10000, 'kg', 'gram')).toBe(false) // tepat 20% -> tidak di-flag (strictly > threshold)
      expect(isSelisihFlagged(-2001, 10000, 'kg', 'gram')).toBe(true) // >20% -> flagged
      expect(isSelisihFlagged(1900, 10000, 'kg', 'gram')).toBe(false)
      expect(isSelisihFlagged(2100, 10000, 'kg', 'gram')).toBe(true)
    })

    it('flags any non-zero discrepancy for countable items (0% threshold)', () => {
      expect(isSelisihFlagged(0, 100, 'pcs')).toBe(false)
      expect(isSelisihFlagged(1, 100, 'pcs')).toBe(true)
      expect(isSelisihFlagged(-1, 100, 'pcs')).toBe(true)
    })
  })

  describe('toleransi khusus per bahan', () => {
    it('SAPI & AYAM 40%, KENTANG 20%', () => {
      expect(getThresholdPersen('kg', 'gram', 'SAPI')).toBe(40)
      expect(getThresholdPersen('kg', 'gram', 'ayam')).toBe(40)
      expect(getThresholdPersen('dus', 'gram', 'KENTANG')).toBe(20)
    })
    it('selisih di bawah batas tidak di-flag, di atas batas di-flag', () => {
      expect(isSelisihFlagged(-3900, 10000, 'kg', 'gram', 'SAPI')).toBe(false)
      expect(isSelisihFlagged(-4100, 10000, 'kg', 'gram', 'SAPI')).toBe(true)
      expect(isSelisihFlagged(-1900, 10000, 'dus', 'gram', 'KENTANG')).toBe(false)
      expect(isSelisihFlagged(-2100, 10000, 'dus', 'gram', 'KENTANG')).toBe(true)
    })
    it('bahan lain tetap memakai aturan satuan', () => {
      expect(isSelisihFlagged(-1900, 10000, 'kg', 'gram', 'MINYAK')).toBe(false)
      expect(isSelisihFlagged(-2100, 10000, 'kg', 'gram', 'MINYAK')).toBe(true)
    })
  })
})

describe('getMaterialType', () => {
  it('count = toleransi 0% (barang hitung)', () => {
    expect(getMaterialType('Pcs', null, 'AQUA')).toBe('count')
    expect(getMaterialType('Pack', 'Lembar', 'KULIT 25')).toBe('count')
  })

  it('bulk = toleransi di atas 0% (timbang/ukur & toleransi khusus)', () => {
    expect(getMaterialType('kg', 'gram', 'TEPUNG')).toBe('bulk')
    expect(getMaterialType('Blok', 'gram', 'SAPI')).toBe('bulk')
    expect(getMaterialType('Kg', 'gram', 'AYAM')).toBe('bulk')
  })

  it('selalu sepakat dengan getThresholdPersen', () => {
    const kasus: [string, string | null, string][] = [
      ['Pcs', null, 'AQUA'], ['kg', 'gram', 'TEPUNG'], ['Kg', 'gram', 'KENTANG'],
    ]
    for (const [s, sk, n] of kasus) {
      expect(getMaterialType(s, sk, n) === 'bulk').toBe(getThresholdPersen(s, sk, n) > 0)
    }
  })
})
