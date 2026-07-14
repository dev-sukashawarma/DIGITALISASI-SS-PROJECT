// apps/admin-dashboard/src/lib/profit.ts
export interface ProfitResult {
  labaKotor: number
  labaBersih: number
  marginKotor: number
  marginBersih: number
}

/** Laba Kotor = Omzet − HPP; Laba Bersih = Laba Kotor − Expenses − Kerugian Waste. Margin % thd omzet. */
export function computeProfit(omzet: number, hpp: number, expenses: number, wasteValue: number = 0): ProfitResult {
  const labaKotor = omzet - hpp
  const labaBersih = labaKotor - expenses - wasteValue
  return {
    labaKotor,
    labaBersih,
    marginKotor: omzet > 0 ? (labaKotor / omzet) * 100 : 0,
    marginBersih: omzet > 0 ? (labaBersih / omzet) * 100 : 0,
  }
}

export interface OutletProfit {
  labaKotor: number; labaBersih: number; marginKotor: number; marginBersih: number
}

/** Laba Outlet = Omzet − HPP − Pengeluaran Outlet − Kerugian Waste (outlet itu saja). */
export function computeOutletProfit(omzet: number, hpp: number, pengeluaranOutlet: number, wasteValue: number = 0): OutletProfit {
  const labaKotor = omzet - hpp
  const labaBersih = labaKotor - pengeluaranOutlet - wasteValue
  return {
    labaKotor,
    labaBersih,
    marginKotor: omzet > 0 ? (labaKotor / omzet) * 100 : 0,
    marginBersih: omzet > 0 ? (labaBersih / omzet) * 100 : 0,
  }
}

/** Laba Perusahaan = Σ Laba Outlet − Σ Pengeluaran Pusat. (Waste sudah terpotong di level outlet.) */
export function computeCompanyProfit(sumLabaOutlet: number, pengeluaranPusat: number) {
  return { labaPerusahaan: sumLabaOutlet - pengeluaranPusat }
}
