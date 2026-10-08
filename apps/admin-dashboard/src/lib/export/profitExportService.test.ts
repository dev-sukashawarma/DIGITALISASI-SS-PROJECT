import { describe, it, expect } from 'vitest'
import { buildOutletFinancialCalculations, type OutletExportItem, type ExportContext } from './profitExportService'

describe('buildOutletFinancialCalculations', () => {
  it('correctly calculates totalAdminFee including Food Apps deductions and TikTok Go commission', () => {
    const item: OutletExportItem = {
      id: 'd9a2ef93-c298-4501-a471-1c5e2b3dff08',
      name: 'MITRA CICURUG',
      omzet: 132_874_764,
      deductions: 11_879_173,
      netRev: 120_995_591,
      expense: 15_000_000,
      hpp: 40_000_000,
      waste: 500_000,
      mgmtFee: 3_986_243,
      mgmtFeePct: 3,
      isBep: false,
      isMitra: true,
      labaKotor: 80_495_591,
      net: 60_995_591,
      margin: 45.9,
      totalCost: 71_365_416,
    }

    const salesRows = [
      { outlet_id: item.id, sales_source: 'pos', sales_date: '2026-09-15', omzet: 68_002_000, total_deductions: 0 },
      { outlet_id: item.id, sales_source: 'gofood', sales_date: '2026-09-15', omzet: 2_456_065, total_deductions: 478_935 },
      { outlet_id: item.id, sales_source: 'shopeefood', sales_date: '2026-09-15', omzet: 30_465_762, total_deductions: 11_400_238 },
      { outlet_id: item.id, sales_source: 'tiktok', sales_date: '2026-09-15', omzet: 18_916_000, total_deductions: 0 },
      { outlet_id: item.id, sales_source: 'online', sales_date: '2026-09-15', omzet: 1_155_764, total_deductions: 0 },
    ]

    const tiktokSettlements = {
      [item.id]: {
        outletId: item.id,
        omzetKotor: 18_916_000,
        promoMerchant: 0,
        commission: 1_773_230,
        totalSettlement: 17_142_770,
      },
    }

    const platformSettlements = {
      [`${item.id}|gofood`]: { promoMerchant: 478_935, commission: 537_213, omzetKotor: 2_935_000 },
      [`${item.id}|shopeefood`]: { promoMerchant: 11_400_238, commission: 9_001_668, omzetKotor: 41_866_000 },
      [`${item.id}|tiktokgo`]: { promoMerchant: 0, commission: 1_773_230, omzetKotor: 18_916_000 },
    }

    const ctx: ExportContext = {
      salesRows,
      expenseRows: [],
      mitraInvestments: {
        [item.id]: {
          outlet_id: item.id,
          modal_investasi: 100_000_000,
          persentase_bagi_hasil: 50,
          management_fee: 3,
        },
      },
      tiktokSettlements,
      platformSettlements,
      filter: { from: '2026-09-01', to: '2026-09-30' },
      effectiveFilter: { from: '2026-09-01', to: '2026-09-30' },
    }

    const calc = buildOutletFinancialCalculations(item, ctx)

    // 1. Food Apps Admin Fee (Card Biru Potongan Merchant)
    expect(calc.channels.food_apps.adminFee).toBe(11_879_173)

    // 2. TikTok Go Admin Fee (Komisi)
    expect(calc.adminSettlementTikTok).toBe(1_773_230)
    expect(calc.settlementTikTok).toBe(17_142_770)

    // 3. Section 5 Total Admin Fee (Must include BOTH Food Apps and TikTok Go)
    expect(calc.totalAdminFee).toBe(13_652_403)
    expect(calc.totalAdminFee).toBe(calc.channels.food_apps.adminFee + calc.adminSettlementTikTok)

    // 4. Gross Profit calculation consistency
    const sumChannelsGp = calc.gpOutlet + calc.gpFoodApps + calc.gpTikTok + calc.gpWebsite
    const expectedGp = sumChannelsGp - item.waste - calc.managementFee
    expect(calc.totalGrossProfit).toBe(expectedGp)
  })
})
