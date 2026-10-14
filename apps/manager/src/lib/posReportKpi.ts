import { resolveOrderSource } from './order-source'

// KPI laporan POS & Overview Manager — disamakan 100% dengan Dashboard Admin
// (apps/admin-dashboard/src/lib/posReportKpi.ts & posReport/compute.ts).

export interface PosReportKpi {
  /** Omzet sebelum potongan (net + potongan yang tercatat). */
  grossRevenue: number
  /** Uang yang benar-benar diterima. */
  netRevenue: number
  /** Promo + diskon (kartu "Potongan Merchant"). */
  totalDeductions: number
  /** HPP per item (kartu "Total COGS"). */
  totalHpp: number
  /** Gross Revenue - (COGS + potongan). */
  grossProfit: number
}

export interface RevenueOrder {
  status: string
  total_amount: number
}

export function computeNetRevenueVoidAware(orders: RevenueOrder[]): number {
  return orders.reduce((sum, o) => {
    if (o.status === 'completed') return sum + Number(o.total_amount)
    return sum
  }, 0)
}

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

const GRABFOOD_IDENTIFIERS = new Set(['grabfood', 'grab', 'grab_food'])

export function isGrabFoodOrder(order: { channel?: string | null; sales_source?: string | null }): boolean {
  const ch = (order.channel || '').toLowerCase()
  const src = (order.sales_source || '').toLowerCase()
  return (
    GRABFOOD_IDENTIFIERS.has(ch) ||
    GRABFOOD_IDENTIFIERS.has(src) ||
    ch.includes('grab') ||
    src.includes('grab')
  )
}

const SHOPEEFOOD_IDENTIFIERS = new Set(['shopeefood', 'shopee_food'])

export function isShopeeFoodOrder(order: { channel?: string | null; sales_source?: string | null }): boolean {
  const ch = (order.channel || '').toLowerCase()
  const src = (order.sales_source || '').toLowerCase()
  return (
    SHOPEEFOOD_IDENTIFIERS.has(ch) ||
    SHOPEEFOOD_IDENTIFIERS.has(src) ||
    (ch.includes('shopee') && !ch.includes('shop') && !ch.includes('seller')) ||
    (src.includes('shopee') && !src.includes('shop') && !src.includes('seller'))
  )
}

const JAKARTA_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const WIB_OFFSET_MS = 7 * 3600 * 1000
const YEAR_2000_MS = 946_684_800_000
const jakartaDateStrCache = new Map<string, string>()

/** Format tanggal YYYY-MM-DD dalam zona waktu Jakarta (WIB). */
export function getOrderJakartaDateStr(dateOrIso?: string | Date | null): string {
  if (!dateOrIso) return ''
  if (typeof dateOrIso === 'string') {
    const hit = jakartaDateStrCache.get(dateOrIso)
    if (hit !== undefined) return hit
    let res = ''
    try {
      const ms = Date.parse(dateOrIso)
      if (isNaN(ms)) {
        const match = dateOrIso.match(/^(\d{4}-\d{2}-\d{2})/)
        res = match ? match[1] : ''
      } else if (ms >= YEAR_2000_MS) {
        res = new Date(ms + WIB_OFFSET_MS).toISOString().slice(0, 10)
      } else {
        res = JAKARTA_DATE_FORMATTER.format(new Date(ms))
      }
    } catch {
      const match = String(dateOrIso).match(/^(\d{4}-\d{2}-\d{2})/)
      res = match ? match[1] : ''
    }
    if (jakartaDateStrCache.size > 25_000) jakartaDateStrCache.clear()
    jakartaDateStrCache.set(dateOrIso, res)
    return res
  }
  try {
    const ms = dateOrIso.getTime()
    if (isNaN(ms)) return ''
    if (ms >= YEAR_2000_MS) {
      return new Date(ms + WIB_OFFSET_MS).toISOString().slice(0, 10)
    }
    return JAKARTA_DATE_FORMATTER.format(dateOrIso)
  } catch {
    return ''
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
  settlement_promo_merchant?: number | null
  platform_subsidy?: number | null
}

export interface KpiOrderOptions {
  ssOnlineMode?: boolean
  getGofoodSettlementPromo?: (order: KpiOrder) => number | null | undefined
  getSettlementPromo?: (order: KpiOrder) => number | null | undefined
  gofoodSettlementMap?: Map<string | KpiOrder, number> | Record<string, number>
}

function itemValue(item: KpiOrderItem): number {
  return Number(item.subtotal) || (Number(item.quantity) * Number(item.unit_price)) || 0
}

export function getOrderPlatformKey(order: { channel?: string | null; sales_source?: string | null }): 'gofood' | 'grabfood' | 'shopeefood' | 'tiktokgo' | null {
  if (isGoFoodOrder(order)) return 'gofood'
  if (isGrabFoodOrder(order)) return 'grabfood'
  if (isShopeeFoodOrder(order)) return 'shopeefood'
  if (isTikTokGoOrder(order)) return 'tiktokgo'
  return null
}

export function normalizeSettlementPlatformKey(platform?: string | null): 'gofood' | 'grabfood' | 'shopeefood' | 'tiktokgo' | null {
  const p = (platform || '').toLowerCase().trim()
  if (p === 'gofood' || p === 'gojek' || p === 'go_food') return 'gofood'
  if (p === 'grabfood' || p === 'grab' || p === 'grab_food') return 'grabfood'
  if (p === 'shopeefood' || p === 'shopee' || p === 'shopee_food') return 'shopeefood'
  if (p === 'tiktokgo' || p === 'tiktok' || p === 'tiktok_go') return 'tiktokgo'
  return null
}

export function resolveMerchantPromo(order: KpiOrder, opts: KpiOrderOptions = {}): number {
  const promoSubsidy = Number(order.promo_subsidy) || 0

  if (order.settlement_promo_merchant !== undefined && order.settlement_promo_merchant !== null) {
    return Number(order.settlement_promo_merchant) || 0
  }

  if (opts.getSettlementPromo) {
    const settlementPromo = opts.getSettlementPromo(order)
    if (settlementPromo !== undefined && settlementPromo !== null) {
      return Number(settlementPromo) || 0
    }
  }

  if (isGoFoodOrder(order)) {
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
      const platGroupKey = `${order.outlet_id || ''}|gofood|${dateStr}`
      const val = map instanceof Map
        ? (map.get(order.id ?? order) ?? (order.id ? map.get(order.id) : undefined) ?? map.get(platGroupKey) ?? map.get(groupKey))
        : (order.id ? map[order.id] : undefined) ?? map[platGroupKey] ?? map[groupKey]
      if (val !== undefined && val !== null) {
        return Number(val) || 0
      }
    }
    return promoSubsidy
  }

  if (isTikTokGoOrder(order)) {
    return 0
  }

  if (opts.gofoodSettlementMap) {
    const map = opts.gofoodSettlementMap
    const platKey = getOrderPlatformKey(order)
    const dateStr = getOrderJakartaDateStr(order.created_at)
    const platGroupKey = `${order.outlet_id || ''}|${platKey}|${dateStr}`
    const val = map instanceof Map
      ? (map.get(order.id ?? order) ?? (order.id ? map.get(order.id) : undefined) ?? (platKey ? map.get(platGroupKey) : undefined))
      : (order.id ? map[order.id] : undefined) ?? (platKey ? map[platGroupKey] : undefined)
    if (val !== undefined && val !== null) {
      return Number(val) || 0
    }
  }

  return promoSubsidy
}

export function computeOrderPlatformSubsidy(order: KpiOrder, opts: KpiOrderOptions = {}): number {
  if (opts.ssOnlineMode || order.outlet_id === 'ss-online') return 0
  if (!isFoodAppOrder(order)) return 0

  const kasirPromo = Number(order.promo_subsidy) || 0
  const merchantPromo = resolveMerchantPromo(order, opts)

  return Math.max(0, kasirPromo - merchantPromo)
}

export function computeOrderDeduction(order: KpiOrder, opts: KpiOrderOptions = {}): number {
  const discount = Number(order.discount_amount) || 0
  if (opts.ssOnlineMode || order.outlet_id === 'ss-online') return discount

  const isFoodApp = isFoodAppOrder(order)
  const merchantPromo = resolveMerchantPromo(order, opts)

  if (isFoodApp) {
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

export function buildFoodAppsSettlementPromoMap(
  orders: KpiOrder[],
  settlements: SettlementInputRow[] = []
): Map<string | KpiOrder, number> {
  const promoMap = new Map<string | KpiOrder, number>()
  if (!orders || orders.length === 0 || !settlements || settlements.length === 0) {
    return promoMap
  }

  const settlementByGroup = new Map<string, number>()
  for (const s of settlements) {
    const platKey = normalizeSettlementPlatformKey(s.platform)
    if (!platKey) continue
    const oid = s.outlet_id || ''
    const tgl = (s.tanggal || '').slice(0, 10)
    if (!tgl) continue
    const key = `${oid}|${platKey}|${tgl}`
    const val = Number(s.promo_merchant) || 0
    settlementByGroup.set(key, (settlementByGroup.get(key) || 0) + Math.max(0, val))
  }

  if (settlementByGroup.size === 0) return promoMap

  const ordersByGroup = new Map<string, KpiOrder[]>()
  for (const o of orders) {
    const platKey = getOrderPlatformKey(o)
    if (!platKey) continue
    const oid = o.outlet_id || ''
    const tgl = getOrderJakartaDateStr(o.created_at)
    if (!tgl) continue
    const key = `${oid}|${platKey}|${tgl}`
    if (!settlementByGroup.has(key)) continue

    const list = ordersByGroup.get(key) || []
    list.push(o)
    ordersByGroup.set(key, list)
  }

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

export function buildGofoodSettlementPromoMap(
  orders: KpiOrder[],
  settlements: SettlementInputRow[] = []
): Map<string | KpiOrder, number> {
  const goOrders = orders.filter(isGoFoodOrder)
  const goSettlements = settlements.filter(s => normalizeSettlementPlatformKey(s.platform) === 'gofood')
  return buildFoodAppsSettlementPromoMap(goOrders, goSettlements)
}

export function computeOrderGross(order: KpiOrder, opts: KpiOrderOptions = {}): number {
  if (opts.ssOnlineMode || order.outlet_id === 'ss-online') {
    return (Number(order.total_amount) || 0) + (Number(order.discount_amount) || 0)
  }

  const isFoodApp = isFoodAppOrder(order)

  if (isFoodApp) {
    return Number(order.total_amount) || 0
  }

  return (Number(order.total_amount) || 0) + computeOrderDeduction(order, opts)
}

export function computeOrderNet(order: KpiOrder, opts: KpiOrderOptions = {}): number {
  return computeOrderGross(order, opts) - computeOrderDeduction(order, opts)
}

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

/**
 * Konversi 1 baris `ecommerce_sales` (SS Online: TikTok Shop / Shopee Seller)
 * ke bentuk OrderRow agar bisa dihitung bersama dengan fungsi KPI yang sama
 * seperti di Dashboard Admin (apps/admin-dashboard/src/lib/posReport/load.ts).
 */
export function mapEcommerceSaleToOrder(saleRecord: any) {
  const raw = saleRecord.raw_data || {}
  const totalPotongan = Math.abs(Number(raw.total_potongan || raw.admin_fee || raw.discount_amount) || 0)
  const omzetNet = Math.max(0, (Number(saleRecord.total_amount) || 0) - totalPotongan)
  return {
    id: saleRecord.id,
    order_number: 0,
    status: 'completed',
    payment_method: saleRecord.channel_id,
    total_amount: omzetNet,
    discount_amount: totalPotongan,
    promo_subsidy: 0,
    created_at: saleRecord.order_date,
    outlet_id: 'ss-online',
    channel: saleRecord.channel_id,
    sales_source: 'Online',
    customer_name: 'SS Online Customer',
    cashier_name: null,
    external_order_id: saleRecord.order_id,
    is_endorse: false,
    raw_data: raw,
    order_items: (saleRecord.ecommerce_sale_items || []).map((item: any) => ({
      id: item.id,
      menu_item_id: item.menu_id,
      menu_item_name: item.menu_items?.name || 'Unknown Item',
      quantity: Number(item.quantity) || 0,
      unit_price: Number(item.price) || 0,
      subtotal: Number(item.subtotal) || (Number(item.price) * Number(item.quantity)) || 0,
      package_choices: null,
      menu_items: item.menu_items,
    })),
  }
}

const isFoodAppSrc = (ch: string) =>
  ['gofood', 'grabfood', 'shopeefood', 'generic_food_app', 'food_apps', 'foodapp', 'foodapps', 'tiktokgo', 'tiktok', 'tiktok_go'].includes(ch.toLowerCase())

/**
 * Pencocokan filter channel yang selaras dengan Admin (`posReport/compute.ts`)
 * sekaligus mendukung opsi `'offline'` dan `'ss_online'` di halaman Laporan Manager.
 */
export function isChannelSelected(target: string, order: any, src: string): boolean {
  const t = target.toLowerCase()
  if (t === 'all') return true
  if (t === 'food_apps') return isFoodAppSrc(src) || isFoodAppOrder(order)
  if (t === 'offline' || t === 'pos_kasir') {
    if (order.outlet_id === 'ss-online') return false
    return src === 'pos_kasir' || src === 'endors' || src === 'pos_pawoon' || src === 'pos'
  }
  if (t === 'online' || t === 'website') return src === 'online'
  if (t === 'ss_online') return order.outlet_id === 'ss-online' || src === 'tiktok_shop' || src === 'shopee_shop'
  if (t === 'tiktokgo' || t === 'tiktok') return ['tiktokgo', 'tiktok', 'tiktok_go'].includes(src) || isTikTokGoOrder(order)
  if (t === 'tiktok_shop' || t === 'tiktokshop') {
    return (
      ['tiktok_shop', 'tiktokshop', 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5'].includes(src) ||
      ['tiktok_shop', 'tiktokshop', 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5'].includes((order.channel || '').toLowerCase())
    )
  }
  if (t === 'shopee_shop' || t === 'shopeeseller' || t === 'shopee_seller') {
    return (
      ['shopee_shop', 'shopeeseller', 'shopee_seller', 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584'].includes(src) ||
      ['shopee_shop', 'shopeeseller', 'shopee_seller', 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584'].includes((order.channel || '').toLowerCase())
    )
  }
  return src === t
}

export function filterOrdersByChannel(orders: any[], channelFilter: string): any[] {
  if (!channelFilter || channelFilter === 'all') return orders
  return orders.filter((o) => {
    const src = resolveOrderSource(o.channel, o.sales_source, o.customer_name, o.is_endorse).key.toLowerCase()
    return isChannelSelected(channelFilter, o, src)
  })
}
