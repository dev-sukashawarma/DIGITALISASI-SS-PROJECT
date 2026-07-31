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

/** Order minimal yang dibutuhkan {@link computeNetRevenueVoidAware}. */
export interface RevenueOrder {
  status: string
  total_amount: number
}

/**
 * Omset NET: order `completed` ditambah, order `cancelled` (void) DIKURANGKAN
 * — bukan di-exclude total. Status selain keduanya (mis. `pending`) diabaikan.
 *
 * Konsisten dengan halaman Laba Kotor (`pawoon-import/profit/page.tsx`), yang
 * memakai metodologi ini sejak keputusan owner 2026-07-29 supaya angkanya
 * cocok dengan Grand Total Excel Pawoon. Sebelum perbaikan ini, kartu Gross
 * Revenue di halaman Laporan POS mengecualikan order cancelled sepenuhnya
 * (bukan menguranginya) — konfirmasi 2026-07-31 (EMPANG 24 Juli: order void
 * P7KY2P6LD8NY7 Rp94.000 tidak pernah mengurangi Rp4.015.000).
 */
export function computeNetRevenueVoidAware(orders: RevenueOrder[]): number {
  return orders.reduce((sum, o) => {
    if (o.status === 'completed') return sum + Number(o.total_amount)
    if (o.status === 'cancelled') return sum - Number(o.total_amount)
    return sum
  }, 0)
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
