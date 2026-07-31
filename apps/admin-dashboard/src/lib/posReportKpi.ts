// KPI laporan POS (/dashboard/reports/pos).
//
// Aturan bisnis (owner, 2026-07-31):
//   Gross Revenue  = omzet SEBELUM dipotong apa pun
//   Admin Platform = promo + diskon
//   Total COGS     = HPP per item
//   Gross Profit   = Gross Revenue - (Total COGS + Admin Platform)
//
// Catatan penting: orders.total_amount di DB SUDAH net (potongan dikurangi
// saat order dibuat di pos-kasir), jadi gross harus direkonstruksi dengan
// menambahkan potongan kembali. Lihat memori orders-total-amount-is-net.

export interface PosReportKpi {
  /** Omzet sebelum potongan (net + potongan yang tercatat). */
  grossRevenue: number
  /** Uang yang benar-benar diterima = SUM(total_amount). */
  netRevenue: number
  /** Promo + diskon (kartu "Admin Platform"). */
  totalDeductions: number
  /** HPP per item (kartu "Total COGS"). */
  totalHpp: number
  /** Gross Revenue - (COGS + potongan). */
  grossProfit: number
}

export function computePosReportKpi(
  netRevenue: number,
  totalDeductions: number,
  totalHpp: number
): PosReportKpi {
  const grossRevenue = netRevenue + totalDeductions
  return {
    grossRevenue,
    netRevenue,
    totalDeductions,
    totalHpp,
    grossProfit: grossRevenue - (totalHpp + totalDeductions),
  }
}
