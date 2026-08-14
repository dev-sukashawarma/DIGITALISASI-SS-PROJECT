// apps/admin-dashboard/src/lib/profit.ts
export interface ProfitResult {
  labaKotor: number
  labaBersih: number
  marginKotor: number
  marginBersih: number
  netRevenue: number
}

/** Laba Kotor = Net Revenue − HPP; Laba Bersih = Laba Kotor − Expenses − Kerugian Waste. Margin % thd Net Revenue. */
export function computeProfit(grossRevenue: number, deductions: number, hpp: number, expenses: number, wasteValue: number = 0): ProfitResult {
  const netRevenue = grossRevenue - deductions
  const labaKotor = netRevenue - hpp
  const labaBersih = labaKotor - expenses - wasteValue
  return {
    netRevenue,
    labaKotor,
    labaBersih,
    marginKotor: netRevenue > 0 ? (labaKotor / netRevenue) * 100 : 0,
    marginBersih: netRevenue > 0 ? (labaBersih / netRevenue) * 100 : 0,
  }
}

export type OutletProfit = ProfitResult

/** Laba Outlet = Net Revenue − HPP − Pengeluaran Outlet − Kerugian Waste (outlet itu saja). */
export function computeOutletProfit(grossRevenue: number, deductions: number, hpp: number, pengeluaranOutlet: number, wasteValue: number = 0): OutletProfit {
  const netRevenue = grossRevenue - deductions
  const labaKotor = netRevenue - hpp
  const labaBersih = labaKotor - pengeluaranOutlet - wasteValue
  return {
    netRevenue,
    labaKotor,
    labaBersih,
    marginKotor: netRevenue > 0 ? (labaKotor / netRevenue) * 100 : 0,
    marginBersih: netRevenue > 0 ? (labaBersih / netRevenue) * 100 : 0,
  }
}

/** Laba Perusahaan = Σ Laba Outlet − Σ Pengeluaran Pusat. (Waste sudah terpotong di level outlet.) */
export function computeCompanyProfit(sumLabaOutlet: number, pengeluaranPusat: number) {
  return { labaPerusahaan: sumLabaOutlet - pengeluaranPusat }
}
