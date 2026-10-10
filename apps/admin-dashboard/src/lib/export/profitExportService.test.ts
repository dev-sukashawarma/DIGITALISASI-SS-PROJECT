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

    // 1. Food Apps Admin Fee (Promo Resto + Komisi Platform)
    expect(calc.channels.food_apps.promo).toBe(11_879_173)
    expect(calc.channels.food_apps.commission).toBe(9_538_881)
    expect(calc.channels.food_apps.adminFee).toBe(21_418_054)

    // 2. TikTok Go Admin Fee (Komisi)
    expect(calc.adminSettlementTikTok).toBe(1_773_230)
    expect(calc.settlementTikTok).toBe(17_142_770)

    // 3. Section 5 Total Admin Fee (Must include BOTH Food Apps and TikTok Go)
    expect(calc.totalAdminFee).toBe(23_191_284)
    expect(calc.totalAdminFee).toBe(calc.channels.food_apps.adminFee + calc.adminSettlementTikTok)

    // 4. Gross Profit calculation consistency
    const sumChannelsGp = calc.gpOutlet + calc.gpFoodApps + calc.gpTikTok + calc.gpWebsite
    const expectedGp = sumChannelsGp - item.waste - calc.managementFee
    expect(calc.totalGrossProfit).toBe(expectedGp)
  })

  it('accurately reproduces Mitra Cibinong September 2026 Food Apps Admin Fee matching POS Report', () => {
    const item: OutletExportItem = {
      id: '550e8400-e29b-41d4-a716-446655440014',
      name: 'MITRA CIBINONG',
      omzet: 128_058_280,
      deductions: 38_189_961,
      netRev: 89_868_319,
      expense: 20_000_000,
      hpp: 40_000_000,
      waste: 0,
      mgmtFee: 0,
      mgmtFeePct: 0,
      isBep: false,
      isMitra: true,
      labaKotor: 49_868_319,
      net: 29_868_319,
      margin: 23.3,
      totalCost: 98_189_961,
    }

    const salesRows = [
      { outlet_id: item.id, sales_source: 'pos', sales_date: '2026-09-15', omzet: 38_235_384, total_deductions: 0, platform_fee: 0 },
      { outlet_id: item.id, sales_source: 'gofood', sales_date: '2026-09-15', omzet: 8_685_155, total_deductions: 1_594_845, platform_fee: 1_885_031 },
      { outlet_id: item.id, sales_source: 'shopeefood', sales_date: '2026-09-15', omzet: 37_627_303, total_deductions: 15_380_697, platform_fee: 11_243_804 },
      // GrabFood: Single Source of Truth dari settlement GrabMerchant (promo_merchant 5_167_712)
      { outlet_id: item.id, sales_source: 'grabfood', sales_date: '2026-09-15', omzet: 9_708_288, total_deductions: 5_167_712, platform_fee: 1_941_658 },
      { outlet_id: item.id, sales_source: 'tiktok', sales_date: '2026-09-15', omzet: 11_257_000, total_deductions: 0, platform_fee: 1_032_620 },
      { outlet_id: item.id, sales_source: 'online', sales_date: '2026-09-15', omzet: 401_896, total_deductions: 0, platform_fee: 0 },
    ]

    const tiktokSettlements = {
      [item.id]: {
        outletId: item.id,
        omzetKotor: 11_257_000,
        promoMerchant: 0,
        commission: 1_032_620,
        totalSettlement: 10_224_380,
      },
    }

    const platformSettlements = {
      [`${item.id}|gofood`]: { promoMerchant: 1_594_845, commission: 1_885_031, omzetKotor: 10_280_000 },
      [`${item.id}|shopeefood`]: { promoMerchant: 15_380_697, commission: 11_243_804, omzetKotor: 53_008_000 },
      [`${item.id}|grabfood`]: { promoMerchant: 5_167_712, commission: 1_941_658, omzetKotor: 14_876_000 },
    }

    const ctx: ExportContext = {
      salesRows,
      expenseRows: [],
      mitraInvestments: {},
      tiktokSettlements,
      platformSettlements,
      filter: { from: '2026-09-01', to: '2026-09-30' },
      effectiveFilter: { from: '2026-09-01', to: '2026-09-30' },
    }

    const calc = buildOutletFinancialCalculations(item, ctx)

    // Food Apps Revenue must match exactly Rp 78.164.000
    expect(calc.channels.food_apps.revenue).toBe(78_164_000)

    // Promo must match reconciliation file Single Source of Truth: Rp 22.143.254 (1.594.845 + 15.380.697 + 5.167.712)
    expect(calc.channels.food_apps.promo).toBe(22_143_254)

    // Commission must match reconciliation file Single Source of Truth: Rp 15.070.493 (1.885.031 + 11.243.804 + 1.941.658)
    expect(calc.channels.food_apps.commission).toBe(15_070_493)

    // Admin Fee must match reconciliation file Single Source of Truth: Rp 37.213.747 (22.143.254 + 15.070.493)
    expect(calc.channels.food_apps.adminFee).toBe(37_213_747)

    // Estimasi Masuk Bank must match reconciliation file Single Source of Truth: Rp 40.950.253 (78.164.000 - 37.213.747)
    expect(calc.channels.food_apps.revenue - calc.channels.food_apps.adminFee).toBe(40_950_253)
  })
})
