import { describe, it, expect } from 'vitest'
import { buildBusinessReportRows } from './businessReport'

describe('buildBusinessReportRows', () => {
  it('subtracts platform_fee commission from channel revenue and GP so Rekap Bulanan aligns with Laba Rugi', () => {
    const outlets = [{ id: 'o1', name: 'SUKA SHAWARMA MARGONDA' }]
    const salesRows = [
      { outlet_id: 'o1', sales_source: 'pos', omzet: 1_000_000, platform_fee: 0 },
      { outlet_id: 'o1', sales_source: 'gofood', omzet: 800_000, platform_fee: 150_000 },
      { outlet_id: 'o1', sales_source: 'tiktok', omzet: 500_000, platform_fee: 45_000 },
    ]
    const hppRows = [
      { outlet_id: 'o1', sales_source: 'pos', hpp: 400_000 },
      { outlet_id: 'o1', sales_source: 'gofood', hpp: 350_000 },
      { outlet_id: 'o1', sales_source: 'tiktok', hpp: 220_000 },
    ]
    const pcsRows = [
      { outlet_id: 'o1', sales_source: 'pos', pcs: 30 },
      { outlet_id: 'o1', sales_source: 'gofood', pcs: 25 },
      { outlet_id: 'o1', sales_source: 'tiktok', pcs: 15 },
    ]
    const expenseRows = [
      { outlet_id: 'o1', category: 'gaji_crew_outlet', scope: 'outlet', amount: 200_000 },
      { outlet_id: 'o1', category: 'pln', scope: 'outlet', amount: 100_000 },
    ]

    const { rows, total } = buildBusinessReportRows(outlets, salesRows, hppRows, pcsRows, expenseRows)
    const row = rows[0]

    expect(row.offline.revenue).toBe(1_000_000)
    expect(row.foodapps.revenue).toBe(650_000) // 800k - 150k komisi
    expect(row.foodapps.gp).toBe(300_000) // 650k - 350k HPP
    expect(row.tiktok.revenue).toBe(455_000) // 500k - 45k komisi
    expect(row.tiktok.gp).toBe(235_000) // 455k - 220k HPP
    expect(total.totalPerformance.revenue).toBe(2_105_000)
    expect(total.totalGrossProfit).toBe(835_000) // (600k + 300k + 235k) - 300k OPEX
  })
})
