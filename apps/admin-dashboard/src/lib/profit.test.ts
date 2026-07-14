// apps/admin-dashboard/src/lib/profit.test.ts
import { describe, it, expect } from 'vitest'
import { computeProfit, computeOutletProfit, computeCompanyProfit } from './profit'

describe('computeProfit', () => {
  it('menghitung laba kotor, laba bersih, dan margin', () => {
    const r = computeProfit(10_000_000, 4_000_000, 2_000_000)
    expect(r.labaKotor).toBe(6_000_000)   // omzet - hpp
    expect(r.labaBersih).toBe(4_000_000)  // labaKotor - expenses
    expect(r.marginKotor).toBeCloseTo(60, 5)
    expect(r.marginBersih).toBeCloseTo(40, 5)
  })
  it('margin 0 saat omzet 0 (hindari bagi nol)', () => {
    const r = computeProfit(0, 0, 0)
    expect(r.marginKotor).toBe(0)
    expect(r.marginBersih).toBe(0)
  })
  it('laba kotor bisa negatif bila HPP > omzet', () => {
    const r = computeProfit(1_000_000, 1_500_000, 0)
    expect(r.labaKotor).toBe(-500_000)
    expect(r.marginKotor).toBeCloseTo(-50, 5)
  })
})

describe('computeOutletProfit', () => {
  it('laba outlet = omzet - hpp - pengeluaran outlet', () => {
    const r = computeOutletProfit(1_000_000, 300_000, 200_000)
    expect(r.labaKotor).toBe(700_000)
    expect(r.labaBersih).toBe(500_000)
    expect(r.marginBersih).toBeCloseTo(50, 5)
  })
  it('margin 0 saat omzet 0', () => {
    expect(computeOutletProfit(0, 0, 100_000).marginBersih).toBe(0)
  })
})

describe('computeCompanyProfit', () => {
  it('laba perusahaan = Σ laba outlet - pengeluaran pusat', () => {
    const r = computeCompanyProfit(5_000_000, 1_200_000)
    expect(r.labaPerusahaan).toBe(3_800_000)
  })
})

describe('computeProfit dengan waste', () => {
  it('kerugian waste mengurangi laba bersih, tidak menyentuh laba kotor/HPP', () => {
    const r = computeProfit(10_000_000, 4_000_000, 2_000_000, 500_000)
    expect(r.labaKotor).toBe(6_000_000)      // omzet - hpp, tidak berubah
    expect(r.labaBersih).toBe(3_500_000)     // labaKotor - expenses - waste
  })
  it('wasteValue default 0 kalau tidak diberikan (backward compatible)', () => {
    const r = computeProfit(10_000_000, 4_000_000, 2_000_000)
    expect(r.labaBersih).toBe(4_000_000)
  })
  it('wasteValue negatif menambah laba bersih (tidak divalidasi/clamped)', () => {
    const r = computeProfit(10_000_000, 4_000_000, 2_000_000, -100_000)
    expect(r.labaBersih).toBe(4_100_000)
  })
  it('omzet 0 dengan waste: labaBersih negatif, margin tetap 0 (hindari bagi nol)', () => {
    const r = computeProfit(0, 0, 0, 100_000)
    expect(r.labaBersih).toBe(-100_000)
    expect(r.marginBersih).toBe(0)
  })
})

describe('computeOutletProfit dengan waste', () => {
  it('laba outlet = omzet - hpp - pengeluaran outlet - waste', () => {
    const r = computeOutletProfit(1_000_000, 300_000, 200_000, 50_000)
    expect(r.labaKotor).toBe(700_000)
    expect(r.labaBersih).toBe(450_000)
  })
})
