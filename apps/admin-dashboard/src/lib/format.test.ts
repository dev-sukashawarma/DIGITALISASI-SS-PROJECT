import { describe, it, expect } from 'vitest'
import { rupiah, aov, pct, deltaPct, normalizeMenuName } from './format'

describe('rupiah', () => {
  it('format ribuan dengan pemisah titik', () => {
    expect(rupiah(1500000)).toBe('Rp\u00A01.500.000')
  })
  it('nol', () => expect(rupiah(0)).toBe('Rp\u00A00'))
})

describe('aov', () => {
  it('omzet / jumlah order', () => expect(aov(100000, 4)).toBe(25000))
  it('guard pembagi nol → 0', () => expect(aov(100000, 0)).toBe(0))
})

describe('pct', () => {
  it('rasio dalam persen 1 desimal', () => expect(pct(3, 4)).toBe(75))
  it('guard nol → 0', () => expect(pct(1, 0)).toBe(0))
})

describe('deltaPct', () => {
  it('kenaikan', () => expect(deltaPct(150, 100)).toBe(50))
  it('baseline nol → null (tak terdefinisi)', () => expect(deltaPct(150, 0)).toBeNull())
})

describe('normalizeMenuName', () => {
  it('lowercase, trim, rapatkan spasi', () => {
    expect(normalizeMenuName('  Shawarma   Ayam ')).toBe('shawarma ayam')
  })
})
