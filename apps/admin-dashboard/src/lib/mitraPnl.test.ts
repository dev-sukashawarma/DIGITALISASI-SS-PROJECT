import { describe, it, expect } from 'vitest'

describe('Mitra P&L Calculation Logic', () => {
  it('should compute channel gross profit accurately after deductions and COGS', () => {
    const grossRev = 10000000
    const deductions = 500000 // platform fee & promo
    const cogs = 4200000 // 42% HPP
    const grossProfit = (grossRev - deductions) - cogs
    expect(grossProfit).toBe(5300000)
  })

  it('should distribute profit share when net profit is positive', () => {
    const grossProfit = 5300000
    const opex = 2000000
    const waste = 100000
    const netProfit = grossProfit - opex - waste
    expect(netProfit).toBe(3200000)

    const profitSharingPct = 50
    const mitraShare = netProfit > 0 ? (netProfit * (profitSharingPct / 100)) : 0
    expect(mitraShare).toBe(1600000)
  })

  it('should return zero mitra share when net profit is in deficit without negative charge', () => {
    const grossProfit = 2000000
    const opex = 3000000
    const waste = 500000
    const netProfit = grossProfit - opex - waste
    expect(netProfit).toBe(-1500000)

    const profitSharingPct = 50
    const mitraShare = netProfit > 0 ? (netProfit * (profitSharingPct / 100)) : 0
    expect(mitraShare).toBe(0)
  })

  it('should calculate ROI and cap BEP percentage at 100%', () => {
    const totalModal = 100000000
    const distributedProfit = 120000000
    const roi = (distributedProfit / totalModal) * 100
    const bepPercentage = Math.min(roi, 100)

    expect(roi).toBe(120)
    expect(bepPercentage).toBe(100)
  })

  it('should deduct 3% management fee from gross profit before mitra share calculation', () => {
    const grossRev = 100000000 // 100jt omzet
    const grossProfit = 55000000
    const opex = 20000000
    const waste = 1000000
    const managementFeePct = 3
    const managementFeeAmount = (grossRev * managementFeePct) / 100 // 3.000.000

    const netProfit = grossProfit - opex - waste - managementFeeAmount // 55jt - 20jt - 1jt - 3jt = 31jt
    expect(netProfit).toBe(31000000)

    const profitSharingPct = 50
    const mitraShare = netProfit > 0 ? (netProfit * (profitSharingPct / 100)) : 0 // 15.500.000
    expect(mitraShare).toBe(15500000)
  })
})
