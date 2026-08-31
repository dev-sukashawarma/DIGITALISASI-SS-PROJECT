import { describe, it, expect } from 'vitest'
import { buildLeaderboard, getPerformanceTier } from './leaderboard'
import type { SalesSummaryRow } from './types'

describe('Leaderboard & Performance Tier Classification', () => {
  it('should correctly classify performance tiers based on avg daily qty (Option C)', () => {
    // Pesimis: <= 75 pcs/hari
    expect(getPerformanceTier(0)).toBe('PESIMIS')
    expect(getPerformanceTier(50)).toBe('PESIMIS')
    expect(getPerformanceTier(75)).toBe('PESIMIS')

    // Moderat: 76 - 150 pcs/hari
    expect(getPerformanceTier(76)).toBe('MODERAT')
    expect(getPerformanceTier(110)).toBe('MODERAT')
    expect(getPerformanceTier(150)).toBe('MODERAT')

    // Progresif: 151 - 299 pcs/hari
    expect(getPerformanceTier(151)).toBe('PROGRESIF')
    expect(getPerformanceTier(220)).toBe('PROGRESIF')
    expect(getPerformanceTier(299)).toBe('PROGRESIF')

    // Optimis: >= 300 pcs/hari
    expect(getPerformanceTier(300)).toBe('OPTIMIS')
    expect(getPerformanceTier(450)).toBe('OPTIMIS')
  })

  it('should calculate avgDailyQty and performance tier across 30 days', () => {
    const curRows: SalesSummaryRow[] = [
      {
        outlet_id: 'outlet-1',
        outlet_name: 'SUKA SHAWARMA MARGONDA',
        sales_source: 'pos',
        sales_date: '2026-08-01',
        omzet: 243000000,
        jumlah_order_completed: 3000,
        jumlah_order_all: 3000,
        total_qty: 9000 // 9000 / 30 = 300 pcs/hari -> OPTIMIS
      },
      {
        outlet_id: 'outlet-2',
        outlet_name: 'SUKA SHAWARMA DRAMAGA',
        sales_source: 'pos',
        sales_date: '2026-08-01',
        omzet: 120000000,
        jumlah_order_completed: 1800,
        jumlah_order_all: 1800,
        total_qty: 4500 // 4500 / 30 = 150 pcs/hari -> MODERAT
      },
      {
        outlet_id: 'outlet-3',
        outlet_name: 'SUKA SHAWARMA KELAPA DUA',
        sales_source: 'pos',
        sales_date: '2026-08-01',
        omzet: 150000000,
        jumlah_order_completed: 2000,
        jumlah_order_all: 2000,
        total_qty: 6000 // 6000 / 30 = 200 pcs/hari -> PROGRESIF
      },
      {
        outlet_id: 'outlet-4',
        outlet_name: 'SUKA SHAWARMA BINTARO',
        sales_source: 'pos',
        sales_date: '2026-08-01',
        omzet: 50000000,
        jumlah_order_completed: 800,
        jumlah_order_all: 800,
        total_qty: 1800 // 1800 / 30 = 60 pcs/hari -> PESIMIS
      }
    ]

    const prevRows: SalesSummaryRow[] = [
      {
        outlet_id: 'outlet-1',
        outlet_name: 'SUKA SHAWARMA MARGONDA',
        sales_source: 'pos',
        sales_date: '2026-07-01',
        omzet: 200000000,
        jumlah_order_completed: 2500,
        jumlah_order_all: 2500,
        total_qty: 7500
      }
    ]

    const result = buildLeaderboard(curRows, prevRows, 30)

    expect(result).toHaveLength(4)

    // Sorted by omzet descending: outlet-1 (243M), outlet-3 (150M), outlet-2 (120M), outlet-4 (50M)
    expect(result[0].outlet_id).toBe('outlet-1')
    expect(result[0].avg_daily_qty).toBe(300)
    expect(result[0].performance_tier).toBe('OPTIMIS')
    expect(result[0].deltaPct).toBe(21.5) // (243M - 200M)/200M * 100

    expect(result[1].outlet_id).toBe('outlet-3')
    expect(result[1].avg_daily_qty).toBe(200)
    expect(result[1].performance_tier).toBe('PROGRESIF')

    expect(result[2].outlet_id).toBe('outlet-2')
    expect(result[2].avg_daily_qty).toBe(150)
    expect(result[2].performance_tier).toBe('MODERAT')

    expect(result[3].outlet_id).toBe('outlet-4')
    expect(result[3].avg_daily_qty).toBe(60)
    expect(result[3].performance_tier).toBe('PESIMIS')
  })
})
