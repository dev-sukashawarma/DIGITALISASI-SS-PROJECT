import { describe, expect, it } from 'vitest'
import { computeCompanyProfit } from './profit'

describe('computeCompanyProfit', () => {
  it('tanpa pendapatan lain = perilaku lama', () => {
    expect(computeCompanyProfit(1_000_000, 300_000).labaPerusahaan).toBe(700_000)
  })
  it('Income Lainnya menambah laba perusahaan', () => {
    expect(computeCompanyProfit(1_000_000, 300_000, 150_000).labaPerusahaan).toBe(850_000)
  })
})
