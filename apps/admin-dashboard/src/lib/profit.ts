// apps/admin-dashboard/src/lib/profit.ts
export interface ProfitResult {
  labaKotor: number
  labaBersih: number
  marginKotor: number
  marginBersih: number
}

/** Laba Kotor = Omzet − HPP; Laba Bersih = Laba Kotor − Expenses. Margin % thd omzet. */
export function computeProfit(omzet: number, hpp: number, expenses: number): ProfitResult {
  const labaKotor = omzet - hpp
  const labaBersih = labaKotor - expenses
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

/** Laba Outlet = Omzet − HPP − Pengeluaran Outlet (outlet itu saja). */
export function computeOutletProfit(omzet: number, hpp: number, pengeluaranOutlet: number): OutletProfit {
  const labaKotor = omzet - hpp
  const labaBersih = labaKotor - pengeluaranOutlet
  return {
    labaKotor,
    labaBersih,
    marginKotor: omzet > 0 ? (labaKotor / omzet) * 100 : 0,
    marginBersih: omzet > 0 ? (labaBersih / omzet) * 100 : 0,
  }
}

/** Laba Perusahaan = Σ Laba Outlet − Σ Pengeluaran Pusat. */
export function computeCompanyProfit(sumLabaOutlet: number, pengeluaranPusat: number) {
  return { labaPerusahaan: sumLabaOutlet - pengeluaranPusat }
}
