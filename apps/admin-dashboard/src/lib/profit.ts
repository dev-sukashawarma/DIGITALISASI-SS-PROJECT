// apps/admin-dashboard/src/lib/profit.ts
export interface ProfitResult {
  labaKotor: number
  labaBersih: number
  marginKotor: number
  marginBersih: number
  netRevenue: number
}

/** Laba Kotor = Gross Revenue − HPP - Deductions; Laba Bersih = Laba Kotor − Expenses − Kerugian Waste. Margin % thd Gross Revenue. */
export function computeProfit(grossRevenue: number, deductions: number, hpp: number, expenses: number, wasteValue: number = 0): ProfitResult {
  const netRevenue = grossRevenue - deductions
  const labaKotor = grossRevenue - hpp - deductions
  const labaBersih = labaKotor - expenses - wasteValue
  return {
    netRevenue,
    labaKotor,
    labaBersih,
    marginKotor: grossRevenue > 0 ? (labaKotor / grossRevenue) * 100 : 0,
    marginBersih: grossRevenue > 0 ? (labaBersih / grossRevenue) * 100 : 0,
  }
}

export type OutletProfit = ProfitResult

/** Laba Outlet = Gross Revenue − HPP - Deductions − Pengeluaran Outlet − Kerugian Waste (outlet itu saja). */
export function computeOutletProfit(grossRevenue: number, deductions: number, hpp: number, pengeluaranOutlet: number, wasteValue: number = 0): OutletProfit {
  const netRevenue = grossRevenue - deductions
  const labaKotor = grossRevenue - hpp - deductions
  const labaBersih = labaKotor - pengeluaranOutlet - wasteValue
  return {
    netRevenue,
    labaKotor,
    labaBersih,
    marginKotor: grossRevenue > 0 ? (labaKotor / grossRevenue) * 100 : 0,
    marginBersih: grossRevenue > 0 ? (labaBersih / grossRevenue) * 100 : 0,
  }
}

/** Laba Perusahaan = Σ Laba Outlet − Σ Pengeluaran Pusat. (Waste sudah terpotong di level outlet.) */
export function computeCompanyProfit(sumLabaOutlet: number, pengeluaranPusat: number) {
  return { labaPerusahaan: sumLabaOutlet - pengeluaranPusat }
}
