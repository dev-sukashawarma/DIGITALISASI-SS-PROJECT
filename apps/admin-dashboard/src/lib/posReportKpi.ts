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

export const FOOD_APP_CHANNELS = new Set(['gofood', 'grabfood', 'shopeefood', 'tiktok', 'tiktokgo'])

export function isFoodAppOrder(order: { channel?: string | null; sales_source?: string | null }): boolean {
  const ch = (order.channel || '').toLowerCase()
  const src = (order.sales_source || '').toLowerCase()
  return FOOD_APP_CHANNELS.has(ch) || FOOD_APP_CHANNELS.has(src)
}

const GOFOOD_IDENTIFIERS = new Set(['gofood', 'gojek', 'go_food', '1284ac2a-e753-4380-9f32-59219a322459'])

export function isGoFoodOrder(order: { channel?: string | null; sales_source?: string | null }): boolean {
  const ch = (order.channel || '').toLowerCase()
  const src = (order.sales_source || '').toLowerCase()
  return (
    GOFOOD_IDENTIFIERS.has(ch) ||
    GOFOOD_IDENTIFIERS.has(src) ||
    ch.includes('gofood') ||
    src.includes('gofood') ||
    ch.includes('gojek') ||
    src.includes('gojek')
  )
}

const TIKTOK_GO_IDENTIFIERS = new Set(['tiktok', 'tiktokgo', 'tiktok_go'])

export function isTikTokGoOrder(order: { channel?: string | null; sales_source?: string | null }): boolean {
  const ch = (order.channel || '').toLowerCase()
  const src = (order.sales_source || '').toLowerCase()
  return (
    TIKTOK_GO_IDENTIFIERS.has(ch) ||
    TIKTOK_GO_IDENTIFIERS.has(src) ||
    ch.includes('tiktokgo') ||
    src.includes('tiktokgo') ||
    (ch.includes('tiktok') && !ch.includes('shop') && !ch.includes('seller')) ||
    (src.includes('tiktok') && !src.includes('shop') && !src.includes('seller'))
  )
}

/** Format tanggal YYYY-MM-DD dalam zona waktu Jakarta (WIB). */
export function getOrderJakartaDateStr(dateOrIso?: string | Date | null): string {
  if (!dateOrIso) return ''
  try {
    const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso
    if (isNaN(d.getTime())) {
      const match = String(dateOrIso).match(/^(\d{4}-\d{2}-\d{2})/)
      return match ? match[1] : ''
    }
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    const match = String(dateOrIso).match(/^(\d{4}-\d{2}-\d{2})/)
    return match ? match[1] : ''
  }
}

export interface KpiOrderItem {
  subtotal?: number | string | null
  quantity?: number | string | null
  unit_price?: number | string | null
}

export interface KpiOrder {
  id?: string | null
  outlet_id?: string | null
  created_at?: string | null
  total_amount: number | string | null
  discount_amount?: number | string | null
  promo_subsidy?: number | string | null
  order_items?: KpiOrderItem[] | null
  channel?: string | null
  sales_source?: string | null
  /** Promo yang ditanggung merchant dari settlement (override promo_subsidy kasir untuk GoFood). */
  settlement_promo_merchant?: number | null
  /** Subsidi dari platform (misal Gojek) yang bukan merupakan beban restoran. */
  platform_subsidy?: number | null
}

export interface KpiOrderOptions {
  /** Filter "SS Online" terpilih: seluruh potongan dibaca dari discount_amount. */
  ssOnlineMode?: boolean
  /** Fungsi pengambil promo merchant GoFood dari settlement berdasarkan pesanan. */
  getGofoodSettlementPromo?: (order: KpiOrder) => number | null | undefined
  /** Map promo settlement GoFood keyed by order id / order ref / outlet_id|tanggal. */
  gofoodSettlementMap?: Map<string | KpiOrder, number> | Record<string, number>
}

function itemValue(item: KpiOrderItem): number {
  return Number(item.subtotal) || (Number(item.quantity) * Number(item.unit_price)) || 0
}

/**
 * Menghitung porsi promo yang menjadi beban merchant (Potongan Merchant / Card Biru).
 *
 * Aturan Bisnis (Food Apps Rekonsiliasi):
 * - GoFood: kasir sering menginput total promo konsumen yang memuat subsidi Gojek di dalamnya.
 *   Jika ada data settlement GoBiz (via order.settlement_promo_merchant atau options),
 *   Card Biru menggunakan promo_merchant dari settlement (Single Source of Truth).
 *   Jika belum ada data settlement, fallback ke promo_subsidy kasir.
 * - GrabFood & ShopeeFood: input kasir sudah murni diskon merchant (akurat),
 *   tetap memakai promo_subsidy kasir.
 */
export function resolveMerchantPromo(order: KpiOrder, opts: KpiOrderOptions = {}): number {
  const promoSubsidy = Number(order.promo_subsidy) || 0

  if (isGoFoodOrder(order)) {
    if (order.settlement_promo_merchant !== undefined && order.settlement_promo_merchant !== null) {
      return Number(order.settlement_promo_merchant) || 0
    }
    if (opts.getGofoodSettlementPromo) {
      const settlementPromo = opts.getGofoodSettlementPromo(order)
      if (settlementPromo !== undefined && settlementPromo !== null) {
        return Number(settlementPromo) || 0
      }
    }
    if (opts.gofoodSettlementMap) {
      const map = opts.gofoodSettlementMap
      const dateStr = getOrderJakartaDateStr(order.created_at)
      const groupKey = `${order.outlet_id || ''}|${dateStr}`
      const val = map instanceof Map
        ? (map.get(order.id ?? order) ?? (order.id ? map.get(order.id) : undefined) ?? map.get(groupKey))
        : (order.id ? map[order.id] : undefined) ?? map[groupKey]
      if (val !== undefined && val !== null) {
        return Number(val) || 0
      }
    }
    // Fallback bila settlement GoFood belum tersedia
    return promoSubsidy
  }

  if (isTikTokGoOrder(order)) {
    // Di TikTok Go, promo voucher disubsidi platform TikTok (Platform incentive).
    // Beban toko (Merchant incentive) hampir Rp 0. Jika kasir menginput diskon di POS,
    // itu bukan beban toko melainkan subsidi voucher TikTok.
    if (order.settlement_promo_merchant !== undefined && order.settlement_promo_merchant !== null) {
      return Number(order.settlement_promo_merchant) || 0
    }
    return 0
  }

  // GrabFood & ShopeeFood atau order umum: kasir input sudah murni diskon merchant (sudah akurat)
  return promoSubsidy
}

/**
 * Subsidi dari platform aplikasi (misal Gojek / TikTok), BUKAN beban resto.
 *
 * Untuk GoFood & TikTok Go:
 *   Selisih = MAX(0, promo_subsidy_kasir - promo_merchant_settlement)
 * Selisih ini dipisahkan dari Card Biru agar laba kotor (Gross Profit) tidak understated.
 */
export function computeOrderPlatformSubsidy(order: KpiOrder, opts: KpiOrderOptions = {}): number {
  if (opts.ssOnlineMode || order.outlet_id === 'ss-online') return 0
  if (!isGoFoodOrder(order) && !isTikTokGoOrder(order)) return 0

  const kasirPromo = Number(order.promo_subsidy) || 0
  const merchantPromo = resolveMerchantPromo(order, opts)

  return Math.max(0, kasirPromo - merchantPromo)
}

/** Potongan satu order, rumus yang sama dengan kartu "Potongan Merchant" (Card Biru). */
export function computeOrderDeduction(order: KpiOrder, opts: KpiOrderOptions = {}): number {
  const discount = Number(order.discount_amount) || 0
  // Baris SS Online adalah baris SINTETIS dari `ecommerce_sales`:
  // `total_amount` sudah net dan `discount_amount` sudah memuat beban
  // platform yang benar, sementara item-nya tidak selalu rekonsiliasi
  // dengan total order.
  if (opts.ssOnlineMode || order.outlet_id === 'ss-online') return discount

  const isFoodApp = isFoodAppOrder(order)
  const merchantPromo = resolveMerchantPromo(order, opts)

  if (isFoodApp) {
    // Pada pesanan Food Apps, potongan promo merchant adalah diskon toko
    // (GoFood dioverride settlement GoBiz; Grab/Shopee dari input kasir).
    // Pesanan Food Apps tidak menggunakan potongan offline kasir.
    return merchantPromo
  }

  const items = order.order_items || []
  if (items.length === 0) {
    return discount + merchantPromo
  }
  const menuValue = items.reduce((sum, i) => sum + itemValue(i), 0)
  const offlineDiscount = Math.max(0, menuValue - (Number(order.total_amount) || 0))

  return offlineDiscount
}

export interface SettlementInputRow {
  platform?: string | null
  outlet_id?: string | null
  tanggal?: string | null
  promo_merchant?: number | string | null
  omzet_kotor?: number | string | null
  commission?: number | string | null
}

/**
 * Membangun peta alokasi promo_merchant settlement GoFood per order.
 *
 * Bila settlement GoFood tersedia untuk (outlet_id, tanggal), total promo_merchant
 * dari settlement dialokasikan secara proporsional ke order-order GoFood pada
 * hari & outlet tersebut.
 *
 * Mengembalikan Map yang bisa diakses via order.id ataupun referensi order langsung.
 */
export function buildGofoodSettlementPromoMap(
  orders: KpiOrder[],
  settlements: SettlementInputRow[] = []
): Map<string | KpiOrder, number> {
  const promoMap = new Map<string | KpiOrder, number>()
  if (!orders || orders.length === 0 || !settlements || settlements.length === 0) {
    return promoMap
  }

  // 1. Kumpulkan settlement GoFood per groupKey `${outlet_id}|${tanggal}`
  const settlementByGroup = new Map<string, number>()
  for (const s of settlements) {
    const plat = (s.platform || '').toLowerCase()
    if (plat !== 'gofood') continue
    const oid = s.outlet_id || ''
    const tgl = (s.tanggal || '').slice(0, 10)
    if (!tgl) continue
    const key = `${oid}|${tgl}`
    const val = Number(s.promo_merchant) || 0
    settlementByGroup.set(key, (settlementByGroup.get(key) || 0) + Math.max(0, val))
  }

  if (settlementByGroup.size === 0) return promoMap

  // 2. Kelompokkan order GoFood berdasarkan groupKey `${outlet_id}|${tanggal}`
  const ordersByGroup = new Map<string, KpiOrder[]>()
  for (const o of orders) {
    if (!isGoFoodOrder(o)) continue
    const oid = o.outlet_id || ''
    const tgl = getOrderJakartaDateStr(o.created_at)
    if (!tgl) continue
    const key = `${oid}|${tgl}`
    if (!settlementByGroup.has(key)) continue

    const list = ordersByGroup.get(key) || []
    list.push(o)
    ordersByGroup.set(key, list)
  }

  // 3. Alokasikan total promo_merchant settlement ke masing-masing order
  for (const [key, groupOrders] of ordersByGroup.entries()) {
    const totalSettlementPromo = settlementByGroup.get(key) || 0
    if (groupOrders.length === 0) continue

    if (groupOrders.length === 1) {
      const o = groupOrders[0]
      promoMap.set(o, totalSettlementPromo)
      if (o.id) promoMap.set(o.id, totalSettlementPromo)
      continue
    }

    const totalKasirPromo = groupOrders.reduce((sum, o) => sum + (Number(o.promo_subsidy) || 0), 0)

    if (totalKasirPromo > 0) {
      // Proporsional berdasarkan promo_subsidy kasir
      let allocatedSoFar = 0
      groupOrders.forEach((o, idx) => {
        const kasirPromo = Number(o.promo_subsidy) || 0
        let sharePromo: number
        if (idx === groupOrders.length - 1) {
          sharePromo = Math.max(0, totalSettlementPromo - allocatedSoFar)
        } else {
          sharePromo = Math.round(totalSettlementPromo * (kasirPromo / totalKasirPromo))
          allocatedSoFar += sharePromo
        }
        promoMap.set(o, sharePromo)
        if (o.id) promoMap.set(o.id, sharePromo)
      })
    } else {
      // Kasir tidak input promo (semua 0) -> alokasi proporsional berdasarkan omzet gross
      const totalGross = groupOrders.reduce((sum, o) => sum + computeOrderGross(o), 0)
      let allocatedSoFar = 0
      groupOrders.forEach((o, idx) => {
        const gross = computeOrderGross(o)
        let sharePromo: number
        if (idx === groupOrders.length - 1) {
          sharePromo = Math.max(0, totalSettlementPromo - allocatedSoFar)
        } else if (totalGross > 0) {
          sharePromo = Math.round(totalSettlementPromo * (gross / totalGross))
          allocatedSoFar += sharePromo
        } else {
          sharePromo = Math.round(totalSettlementPromo / groupOrders.length)
          allocatedSoFar += sharePromo
        }
        promoMap.set(o, sharePromo)
        if (o.id) promoMap.set(o.id, sharePromo)
      })
    }
  }

  return promoMap
}

/** Omzet kotor satu order = total nilai menu sebelum diskon. */
export function computeOrderGross(order: KpiOrder, opts: KpiOrderOptions = {}): number {
  if (opts.ssOnlineMode || order.outlet_id === 'ss-online') {
    return (Number(order.total_amount) || 0) + (Number(order.discount_amount) || 0)
  }

  const isFoodApp = isFoodAppOrder(order)

  if (isFoodApp) {
    // Di Food Apps (pasca 19 Agu 2026), total_amount SUDAH harga menu utuh (Gross),
    // tidak boleh ditambahkan promo_subsidy lagi agar omzet tidak berlipat ganda,
    // dan tidak dipengaruhi anomali subtotal item di pos-kasir.
    return Number(order.total_amount) || 0
  }

  return (Number(order.total_amount) || 0) + computeOrderDeduction(order, opts)
}

/** Omzet bersih satu order = omzet kotor - potongan. */
export function computeOrderNet(order: KpiOrder, opts: KpiOrderOptions = {}): number {
  return computeOrderGross(order, opts) - computeOrderDeduction(order, opts)
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
