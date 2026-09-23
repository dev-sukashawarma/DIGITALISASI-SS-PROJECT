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
 * Omset NET: Hanya menghitung order `completed`. Order `cancelled` (void)
 * tidak memotong maupun menambah Omzet Gross/Net di Laporan POS.
 */
export function computeNetRevenueVoidAware(orders: RevenueOrder[]): number {
  return orders.reduce((sum, o) => {
    if (o.status === 'completed') return sum + Number(o.total_amount)
    return sum
  }, 0)
}

// ─── Acuan per order (kartu KPI + semua ekspor PDF/CSV/Excel) ───────────────
//
// ACUAN TUNGGAL Omzet Kotor (lihat migration 20300128000000):
//   Potongan = nilai menu - total_amount  (tak pernah negatif)
//   Gross    = total_amount + Potongan
// BUKAN total_amount + discount_amount + promo_subsidy: sejak 19 Agustus 2026
// (commit b41efc7a) order Food Apps menyimpan harga UTUH di total_amount
// sementara promo_subsidy tetap diisi, sehingga menjumlahkannya menghitung
// subsidi platform dua kali. Ekspor dulu memakai rumus lama itu, jadi Grand
// Total PDF/CSV/Excel tidak sama dengan kartu Gross Revenue di layar.

export interface KpiOrderItem {
  subtotal?: number | string | null
  quantity?: number | string | null
  unit_price?: number | string | null
}

export interface KpiOrder {
  outlet_id?: string | null
  total_amount: number | string | null
  discount_amount?: number | string | null
  promo_subsidy?: number | string | null
  order_items?: KpiOrderItem[] | null
}

export interface KpiOrderOptions {
  /** Filter "SS Online" terpilih: seluruh potongan dibaca dari discount_amount. */
  ssOnlineMode?: boolean
}

function itemValue(item: KpiOrderItem): number {
  return Number(item.subtotal) || (Number(item.quantity) * Number(item.unit_price)) || 0
}

/** Potongan satu order, rumus yang sama dengan kartu "Potongan Merchant". */
export function computeOrderDeduction(order: KpiOrder, opts: KpiOrderOptions = {}): number {
  const discount = Number(order.discount_amount) || 0
  // Baris SS Online adalah baris SINTETIS dari `ecommerce_sales`:
  // `total_amount` sudah net dan `discount_amount` sudah memuat beban
  // platform yang benar, sementara item-nya tidak selalu rekonsiliasi
  // dengan total order. Memakai selisih item di sini menggeser beban
  // platform Agustus 2026 dari Rp 12,48 jt jadi Rp 20,24 jt (998 dari
  // 1.377 baris berubah). Jadi baris ini tetap memakai discount_amount.
  if (opts.ssOnlineMode || order.outlet_id === 'ss-online') return discount

  const items = order.order_items || []
  if (items.length === 0) {
    // Tanpa baris item tak ada nilai menu untuk dibandingkan.
    return discount + (Number(order.promo_subsidy) || 0)
  }
  const menuValue = items.reduce((sum, i) => sum + itemValue(i), 0)
  return Math.max(0, menuValue - (Number(order.total_amount) || 0))
}

/** Omzet kotor satu order = total_amount + potongan. */
export function computeOrderGross(order: KpiOrder, opts: KpiOrderOptions = {}): number {
  return (Number(order.total_amount) || 0) + computeOrderDeduction(order, opts)
}

/**
 * Bobot tiap item untuk membagi gross/potongan order secara proporsional.
 * Jumlahnya selalu 1 (bila ada item), jadi seluruh gross order teralokasi —
 * termasuk order yang itemnya bernilai 0 (item gratis) yang dulu hilang dari
 * ekspor. Urutan fallback: nilai item → quantity → sama rata.
 */
export function computeItemShares(items: KpiOrderItem[]): number[] {
  if (items.length === 0) return []
  const values = items.map(itemValue)
  const valueSum = values.reduce((s, v) => s + v, 0)
  if (valueSum > 0) return values.map(v => v / valueSum)
  const qtys = items.map(i => Number(i.quantity) || 0)
  const qtySum = qtys.reduce((s, q) => s + q, 0)
  if (qtySum > 0) return qtys.map(q => q / qtySum)
  return items.map(() => 1 / items.length)
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
