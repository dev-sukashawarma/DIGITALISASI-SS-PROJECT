import { describe, it, expect } from 'vitest'
import { reconcileSalesRowsWithSettlements } from './settlementReconciliation'

describe('reconcileSalesRowsWithSettlements', () => {
  it('reconciles GoFood promo with GoBiz settlement promo while preserving gross revenue', () => {
    const outletId = 'outlet-cicurug'
    const salesRows = [
      { outlet_id: outletId, sales_source: 'gofood', sales_date: '2026-09-01', omzet: 100_000, total_deductions: 20_000 },
      { outlet_id: outletId, sales_source: 'gofood', sales_date: '2026-09-02', omzet: 200_000, total_deductions: 40_000 },
    ]
    // Total cashier deductions = 60,000. Total gross = 120,000 + 240,000 = 360,000.
    // Target settlement promo = 80,000.
    const settlementsMap = {
      [`${outletId}|gofood`]: { promoMerchant: 80_000, commission: 50_000, omzetKotor: 360_000 },
    }

    const reconciled = reconcileSalesRowsWithSettlements(salesRows, settlementsMap)

    const totalReconciledDeductions = reconciled.reduce((sum, r) => sum + r.total_deductions, 0)
    const totalReconciledGross = reconciled.reduce((sum, r) => sum + r.omzet + r.total_deductions, 0)

    expect(totalReconciledDeductions).toBe(80_000)
    expect(totalReconciledGross).toBe(360_000)
  })

  it('accurately reproduces Mitra Cicurug September 2026 reconciliation numbers matching Card Biru', () => {
    const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08'
    const salesRows = [
      { outlet_id: cicurugId, sales_source: 'pos', sales_date: '2026-09-15', omzet: 68_002_000, total_deductions: 0 },
      { outlet_id: cicurugId, sales_source: 'gofood', sales_date: '2026-09-15', omzet: 2_536_975, total_deductions: 398_025 },
      { outlet_id: cicurugId, sales_source: 'shopeefood', sales_date: '2026-09-15', omzet: 30_453_762, total_deductions: 11_412_238 },
      { outlet_id: cicurugId, sales_source: 'tiktok', sales_date: '2026-09-15', omzet: 18_916_000, total_deductions: 0 },
    ]

    const settlementsMap = {
      [`${cicurugId}|gofood`]: { promoMerchant: 478_935, commission: 537_213, omzetKotor: 2_935_000 },
      [`${cicurugId}|shopeefood`]: { promoMerchant: 11_400_238, commission: 9_001_668, omzetKotor: 41_866_000 },
      [`${cicurugId}|tiktokgo`]: { promoMerchant: 0, commission: 1_773_230, omzetKotor: 18_916_000 },
    }

    const reconciled = reconcileSalesRowsWithSettlements(salesRows, settlementsMap)

    const gofoodRow = reconciled.find(r => r.sales_source === 'gofood')!
    const shopeeRow = reconciled.find(r => r.sales_source === 'shopeefood')!
    const posRow = reconciled.find(r => r.sales_source === 'pos')!
    const tiktokRow = reconciled.find(r => r.sales_source === 'tiktok')!

    expect(gofoodRow.total_deductions).toBe(478_935)
    expect(gofoodRow.omzet + gofoodRow.total_deductions).toBe(2_935_000)

    expect(shopeeRow.total_deductions).toBe(11_400_238)
    expect(shopeeRow.omzet + shopeeRow.total_deductions).toBe(41_866_000)

    expect(posRow.total_deductions).toBe(0)
    expect(tiktokRow.total_deductions).toBe(0)

    // Total Potongan Merchant Food Apps = 478,935 + 11,400,238 = 11,879,173 (Card Biru)
    const foodAppsDeductions = gofoodRow.total_deductions + shopeeRow.total_deductions
    expect(foodAppsDeductions).toBe(11_879_173)
  })

  it('does nothing when no settlement is present', () => {
    const salesRows = [
      { outlet_id: 'outlet-1', sales_source: 'gofood', sales_date: '2026-09-01', omzet: 100_000, total_deductions: 20_000 },
    ]
    const reconciled = reconcileSalesRowsWithSettlements(salesRows, {})
    expect(reconciled[0].total_deductions).toBe(20_000)
    expect(reconciled[0].omzet).toBe(100_000)
  })
})
