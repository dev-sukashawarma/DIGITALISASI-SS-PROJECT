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
