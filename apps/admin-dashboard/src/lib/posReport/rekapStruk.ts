/* ── Rumus Rekap & Audit Kepatuhan Cetak Struk (/dashboard/reports/rekap-struk) ──
 *
 * Menghitung secara presisi khusus untuk ORDERAN OFFLINE (POS Kasir / POS Pawoon)
 * dan ORDER WEBSITE (mengabaikan Food Apps seperti GoFood, GrabFood, ShopeeFood, TikTok Go):
 * 1. Rekap per Kasir & Outlet:
 *    - Nama Kasir
 *    - Nama Outlet / Cabang
 *    - Nama AM (Area Manager)
 *    - Total Transaksi (Offline + Website)
 *    - Jumlah Struk Dicetak
 *    - Jumlah Struk Tidak Dicetak (beserta rincian Customer / Dapur)
 *    - Persentase Struk yang Dicetak dari Total Transaksi (%) & Persentase Tidak Dicetak (%)
 * 2. Daftar orderan detail yang tidak dicetak struknya.
 *
 * Modul ini murni (tanpa dependensi Next/Supabase) agar ringan, deterministik,
 * dan mudah diuji.
 */

import { filterOrdersByChannels, type OrderRow } from './compute'
import { receiptChips } from './receiptReprint'
import { resolveOrderSource } from '@/lib/order-source'

const EXCLUDED_FOOD_APP_AND_MARKETPLACE_KEYS = new Set([
  'gofood',
  'gojek',
  'go_food',
  '1284ac2a-e753-4380-9f32-59219a322459',
  'grabfood',
  'grab',
  'grab_food',
  'shopeefood',
  'shopee',
  'shopee_food',
  'tiktokgo',
  'tiktok',
  'tiktok_go',
  'generic_food_app',
  'food_apps',
  'foodapp',
  'food_app',
  'tiktok_shop',
  'tiktokshop',
  'f3305089-b9e4-4b92-95da-14bf6e7fb6d5',
  'shopee_shop',
  'shopeeseller',
  'shopee_seller',
  'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584',
])

/**
 * Menentukan apakah sebuah order termasuk cakupan Rekap Cetak Struk:
 * HANYA Orderan Offline (POS Kasir / POS Pawoon non-FA) dan Order Website.
 * Order Food Apps (GoFood, GrabFood, ShopeeFood, TikTok Go, dll) serta Marketplace
 * dihiraukan sepenuhnya.
 */
export function isOfflineOrWebsiteOrder(
  order: Partial<
    Pick<
      OrderRow,
      'outlet_id' | 'channel' | 'sales_source' | 'customer_name' | 'is_endorse' | 'order_items'
    >
  >
): boolean {
  if (order.outlet_id === 'ss-online') return false

  const rawCh = (order.channel || '').trim().toLowerCase()
  const rawSrc = (order.sales_source || '').trim().toLowerCase()
  if (
    EXCLUDED_FOOD_APP_AND_MARKETPLACE_KEYS.has(rawCh) ||
    EXCLUDED_FOOD_APP_AND_MARKETPLACE_KEYS.has(rawSrc)
  ) {
    return false
  }

  const resolvedKey = resolveOrderSource(
    order.channel,
    order.sales_source,
    order.customer_name,
    order.is_endorse
  ).key.toLowerCase()

  if (EXCLUDED_FOOD_APP_AND_MARKETPLACE_KEYS.has(resolvedKey)) {
    return false
  }

  // Abaikan order lama Pawoon yang merupakan Food Apps (item mengandung 'FA')
  if (
    resolvedKey === 'pos_pawoon' &&
    Array.isArray(order.order_items) &&
    order.order_items.some((item) => item?.menu_item_name?.includes('FA'))
  ) {
    return false
  }

  // Khusus orderan Offline (pos_kasir, pos_pawoon, endors) dan Order Website (online)
  return (
    resolvedKey === 'pos_kasir' ||
    resolvedKey === 'pos_pawoon' ||
    resolvedKey === 'online' ||
    resolvedKey === 'endors'
  )
}

/** Pilihan channel filter khusus halaman Rekap Cetak Struk (hanya Offline & Website). */
export function computeAvailableRekapStrukChannels(isPawoonVisible: boolean) {
  return [
    { key: 'pos_kasir', label: 'Order Offline (POS Kasir)' },
    ...(isPawoonVisible ? [{ key: 'pos_pawoon', label: 'Order Offline (POS Pawoon)' }] : []),
    { key: 'online', label: 'Order Website' },
  ]
}

export const SKIP_KIND_FILTERS = [
  'all_not_printed',
  'both_skipped',
  'customer_skipped',
  'kitchen_skipped',
  'late',
  'all_tracked',
] as const

export type SkipKindFilter = (typeof SKIP_KIND_FILTERS)[number]

export const SKIP_KIND_LABELS: Record<SkipKindFilter, string> = {
  all_not_printed: 'Semua Tidak Cetak Struk',
  both_skipped: 'Customer & Dapur Tidak Dicetak',
  customer_skipped: 'Struk Customer Tidak Dicetak',
  kitchen_skipped: 'Struk Dapur Tidak Dicetak',
  late: 'Dicetak Susulan (Terlambat)',
  all_tracked: 'Semua Order Transaksi',
}

export function toSkipKindFilter(val: unknown): SkipKindFilter {
  return (SKIP_KIND_FILTERS as readonly unknown[]).includes(val)
    ? (val as SkipKindFilter)
    : 'all_not_printed'
}

export type OrderReceiptClassification = {
  isTracked: boolean
  isNotPrinted: boolean
  isLatePrinted: boolean
  isPrintedNormal: boolean
  customerSkipped: boolean
  kitchenSkipped: boolean
  bothSkipped: boolean
}

export function classifyOrderReceipt(
  order: Partial<
    Pick<
      OrderRow,
      | 'outlet_id'
      | 'channel'
      | 'sales_source'
      | 'customer_name'
      | 'is_endorse'
      | 'order_items'
      | 'customer_receipt_print_count'
      | 'kitchen_receipt_print_count'
      | 'customer_receipt_skipped'
      | 'kitchen_receipt_skipped'
    >
  >
): OrderReceiptClassification {
  // Jika order adalah Food Apps atau Marketplace (bukan Offline / Website),
  // jangan pernah mendeteksinya sebagai struk tidak dicetak.
  const hasChannelMeta =
    order.channel !== undefined ||
    order.sales_source !== undefined ||
    order.outlet_id !== undefined
  if (hasChannelMeta && !isOfflineOrWebsiteOrder(order)) {
    return {
      isTracked: false,
      isNotPrinted: false,
      isLatePrinted: false,
      isPrintedNormal: false,
      customerSkipped: false,
      kitchenSkipped: false,
      bothSkipped: false,
    }
  }

  const chips = receiptChips(order)
  const isTracked = chips.length > 0
  const customerChip = chips.find((c) => c.kind === 'customer')
  const kitchenChip = chips.find((c) => c.kind === 'kitchen')

  const customerSkipped = customerChip?.tone === 'skipped'
  const kitchenSkipped = kitchenChip?.tone === 'skipped'
  const bothSkipped = customerSkipped && kitchenSkipped
  const isNotPrinted = customerSkipped || kitchenSkipped
  const isLatePrinted = !isNotPrinted && chips.some((c) => c.tone === 'late')
  const isPrintedNormal = isTracked && !isNotPrinted && !isLatePrinted

  return {
    isTracked,
    isNotPrinted,
    isLatePrinted,
    isPrintedNormal,
    customerSkipped,
    kitchenSkipped,
    bothSkipped,
  }
}

export function matchesSkipKindFilter(
  cls: OrderReceiptClassification,
  filter: SkipKindFilter
): boolean {
  if (filter === 'all_not_printed') return cls.isNotPrinted
  if (filter === 'both_skipped') return cls.bothSkipped
  if (filter === 'customer_skipped') return cls.customerSkipped
  if (filter === 'kitchen_skipped') return cls.kitchenSkipped
  if (filter === 'late') return cls.isLatePrinted
  if (filter === 'all_tracked') return true
  return cls.isNotPrinted
}

export interface OutletStrukRecapRow {
  outletId: string
  outletName: string
  outletType: string
  amName: string
  totalOrders: number
  trackedOrders: number
  printedOrders: number
  latePrintedOrders: number
  notPrintedOrders: number
  customerSkippedOrders: number
  kitchenSkippedOrders: number
  bothSkippedOrders: number
  /** Persentase struk yang dicetak dari total transaksi (0–100, 1 desimal). */
  printedRate: number
  /** Persentase tidak cetak struk dari total transaksi (0–100, 1 desimal). */
  notPrintedRate: number
  notPrintedRateAll: number
  notPrintedRevenue: number
  totalRevenue: number
  topCashiers: {
    cashierName: string
    notPrintedOrders: number
    printedOrders: number
    trackedOrders: number
    totalOrders: number
    printedRate: number
    notPrintedRate: number
  }[]
}

export interface CashierStrukRecapRow {
  key: string
  cashierName: string
  outletId: string
  outletName: string
  amName: string
  totalOrders: number
  trackedOrders: number
  /** Jumlah transaksi yang struknya dicetak (totalOrders - notPrintedOrders). */
  printedOrders: number
  latePrintedOrders: number
  /** Jumlah transaksi yang struknya TIDAK dicetak. */
  notPrintedOrders: number
  customerSkippedOrders: number
  kitchenSkippedOrders: number
  bothSkippedOrders: number
  /** Persentase struk yang dicetak dari total transaksi (0–100, 1 desimal). */
  printedRate: number
  /** Persentase struk yang tidak dicetak dari total transaksi (0–100, 1 desimal). */
  notPrintedRate: number
  notPrintedRateAll: number
  notPrintedRevenue: number
  totalRevenue: number
  lastNotPrintedAt: string | null
}

export interface RekapStrukSummary {
  totalOrders: number
  trackedOrders: number
  printedOrders: number
  latePrintedOrders: number
  notPrintedOrders: number
  customerSkippedOrders: number
  kitchenSkippedOrders: number
  bothSkippedOrders: number
  printedRate: number
  notPrintedRate: number
  notPrintedRateAll: number
  notPrintedRevenue: number
  totalRevenue: number
  affectedOutletsCount: number
  totalActiveOutletsCount: number
  affectedCashiersCount: number
  totalActiveCashiersCount: number
}

export interface RekapStrukOrderRow extends OrderRow {
  outletName: string
  amName: string
  receiptMeta: OrderReceiptClassification
}

function roundPct(num: number, den: number): number {
  if (den <= 0 || num <= 0) return 0
  return Math.round((num / den) * 1000) / 10
}

export function normalizeCashierName(raw?: string | null): string {
  const trimmed = (raw || '').trim()
  return trimmed.length > 0 ? trimmed : 'Tanpa Nama Kasir'
}

export interface ComputeRekapStrukInput {
  orders: OrderRow[]
  outlets: { id: string; name: string; type?: string | null; amName?: string | null }[]
  selectedChannels: string[]
}

export function computeRekapStrukBase({
  orders,
  outlets,
  selectedChannels,
}: ComputeRekapStrukInput) {
  const outletMap = new Map<string, { name: string; type: string; amName: string }>()
  const amSet = new Set<string>()
  for (let i = 0; i < outlets.length; i++) {
    const o = outlets[i]
    const amName = (o.amName || '').trim() || '-'
    outletMap.set(o.id, {
      name: o.name || 'Cabang',
      type: o.type || 'outlet',
      amName,
    })
    if (amName !== '-') {
      amName.split(',').forEach((part) => {
        const clean = part.trim()
        if (clean) amSet.add(clean)
      })
    }
  }

  // Rekap Cetak Struk KHUSUS orderan Offline (POS Kasir / POS Pawoon) dan Order Website;
  // Food Apps (GoFood, GrabFood, ShopeeFood, TikTok Go) & Marketplace dihiraukan sepenuhnya.
  const eligibleOrders = orders.filter((o) => Boolean(o.outlet_id) && isOfflineOrWebsiteOrder(o))
  const channelFiltered = filterOrdersByChannels(eligibleOrders, selectedChannels)

  const completedOrders: RekapStrukOrderRow[] = []
  const outletAgg = new Map<
    string,
    {
      outletId: string
      outletName: string
      outletType: string
      amName: string
      totalOrders: number
      trackedOrders: number
      latePrintedOrders: number
      notPrintedOrders: number
      customerSkippedOrders: number
      kitchenSkippedOrders: number
      bothSkippedOrders: number
      notPrintedRevenue: number
      totalRevenue: number
      cashiers: Map<
        string,
        {
          cashierName: string
          totalOrders: number
          trackedOrders: number
          notPrintedOrders: number
        }
      >
    }
  >()

  const cashierAgg = new Map<
    string,
    {
      key: string
      cashierName: string
      outletId: string
      outletName: string
      amName: string
      totalOrders: number
      trackedOrders: number
      latePrintedOrders: number
      notPrintedOrders: number
      customerSkippedOrders: number
      kitchenSkippedOrders: number
      bothSkippedOrders: number
      notPrintedRevenue: number
      totalRevenue: number
      lastNotPrintedAt: string | null
    }
  >()

  let totalOrders = 0
  let trackedOrders = 0
  let latePrintedOrders = 0
  let notPrintedOrders = 0
  let customerSkippedOrders = 0
  let kitchenSkippedOrders = 0
  let bothSkippedOrders = 0
  let notPrintedRevenue = 0
  let totalRevenue = 0

  for (let i = 0; i < channelFiltered.length; i++) {
    const o = channelFiltered[i]
    if (o.status !== 'completed' && o.status !== 'settled') continue

    const outletInfo = outletMap.get(o.outlet_id) || {
      name: 'Cabang Tidak Dikenal',
      type: 'outlet',
      amName: '-',
    }
    const cls = classifyOrderReceipt(o)
    const amount = Number(o.total_amount) || 0
    const cashierName = normalizeCashierName(o.cashier_name)

    const enriched: RekapStrukOrderRow = {
      ...o,
      cashier_name: cashierName,
      outletName: outletInfo.name,
      amName: outletInfo.amName,
      receiptMeta: cls,
    }
    completedOrders.push(enriched)

    totalOrders++
    totalRevenue += amount
    if (cls.isTracked) trackedOrders++
    if (cls.isLatePrinted) latePrintedOrders++
    if (cls.isNotPrinted) {
      notPrintedOrders++
      notPrintedRevenue += amount
    }
    if (cls.customerSkipped) customerSkippedOrders++
    if (cls.kitchenSkipped) kitchenSkippedOrders++
    if (cls.bothSkipped) bothSkippedOrders++

    // Agregasi Outlet
    let oa = outletAgg.get(o.outlet_id)
    if (!oa) {
      oa = {
        outletId: o.outlet_id,
        outletName: outletInfo.name,
        outletType: outletInfo.type,
        amName: outletInfo.amName,
        totalOrders: 0,
        trackedOrders: 0,
        latePrintedOrders: 0,
        notPrintedOrders: 0,
        customerSkippedOrders: 0,
        kitchenSkippedOrders: 0,
        bothSkippedOrders: 0,
        notPrintedRevenue: 0,
        totalRevenue: 0,
        cashiers: new Map(),
      }
      outletAgg.set(o.outlet_id, oa)
    }
    oa.totalOrders++
    oa.totalRevenue += amount
    if (cls.isTracked) oa.trackedOrders++
    if (cls.isLatePrinted) oa.latePrintedOrders++
    if (cls.isNotPrinted) {
      oa.notPrintedOrders++
      oa.notPrintedRevenue += amount
    }
    if (cls.customerSkipped) oa.customerSkippedOrders++
    if (cls.kitchenSkipped) oa.kitchenSkippedOrders++
    if (cls.bothSkipped) oa.bothSkippedOrders++

    let oca = oa.cashiers.get(cashierName)
    if (!oca) {
      oca = {
        cashierName,
        totalOrders: 0,
        trackedOrders: 0,
        notPrintedOrders: 0,
      }
      oa.cashiers.set(cashierName, oca)
    }
    oca.totalOrders++
    if (cls.isTracked) oca.trackedOrders++
    if (cls.isNotPrinted) oca.notPrintedOrders++

    // Agregasi Kasir per Outlet
    const cashierKey = `${o.outlet_id}__${cashierName}`
    let ca = cashierAgg.get(cashierKey)
    if (!ca) {
      ca = {
        key: cashierKey,
        cashierName,
        outletId: o.outlet_id,
        outletName: outletInfo.name,
        amName: outletInfo.amName,
        totalOrders: 0,
        trackedOrders: 0,
        latePrintedOrders: 0,
        notPrintedOrders: 0,
        customerSkippedOrders: 0,
        kitchenSkippedOrders: 0,
        bothSkippedOrders: 0,
        notPrintedRevenue: 0,
        totalRevenue: 0,
        lastNotPrintedAt: null,
      }
      cashierAgg.set(cashierKey, ca)
    }
    ca.totalOrders++
    ca.totalRevenue += amount
    if (cls.isTracked) ca.trackedOrders++
    if (cls.isLatePrinted) ca.latePrintedOrders++
    if (cls.isNotPrinted) {
      ca.notPrintedOrders++
      ca.notPrintedRevenue += amount
      if (!ca.lastNotPrintedAt || o.created_at > ca.lastNotPrintedAt) {
        ca.lastNotPrintedAt = o.created_at
      }
    }
    if (cls.customerSkipped) ca.customerSkippedOrders++
    if (cls.kitchenSkipped) ca.kitchenSkippedOrders++
    if (cls.bothSkipped) ca.bothSkippedOrders++
  }

  const outletRecap: OutletStrukRecapRow[] = Array.from(outletAgg.values())
    .map((oa) => {
      const printedOrders = Math.max(0, oa.totalOrders - oa.notPrintedOrders)
      const topCashiers = Array.from(oa.cashiers.values())
        .filter((c) => c.notPrintedOrders > 0)
        .map((c) => {
          const cPrinted = Math.max(0, c.totalOrders - c.notPrintedOrders)
          return {
            cashierName: c.cashierName,
            notPrintedOrders: c.notPrintedOrders,
            printedOrders: cPrinted,
            trackedOrders: c.trackedOrders,
            totalOrders: c.totalOrders,
            printedRate: roundPct(cPrinted, c.totalOrders),
            notPrintedRate: roundPct(c.notPrintedOrders, c.totalOrders),
          }
        })
        .sort((a, b) => b.notPrintedOrders - a.notPrintedOrders || b.notPrintedRate - a.notPrintedRate)

      return {
        outletId: oa.outletId,
        outletName: oa.outletName,
        outletType: oa.outletType,
        amName: oa.amName,
        totalOrders: oa.totalOrders,
        trackedOrders: oa.trackedOrders,
        printedOrders,
        latePrintedOrders: oa.latePrintedOrders,
        notPrintedOrders: oa.notPrintedOrders,
        customerSkippedOrders: oa.customerSkippedOrders,
        kitchenSkippedOrders: oa.kitchenSkippedOrders,
        bothSkippedOrders: oa.bothSkippedOrders,
        printedRate: roundPct(printedOrders, oa.totalOrders),
        notPrintedRate: roundPct(oa.notPrintedOrders, oa.totalOrders),
        notPrintedRateAll: roundPct(oa.notPrintedOrders, oa.totalOrders),
        notPrintedRevenue: oa.notPrintedRevenue,
        totalRevenue: oa.totalRevenue,
        topCashiers,
      }
    })
    .sort(
      (a, b) =>
        b.notPrintedOrders - a.notPrintedOrders ||
        b.notPrintedRate - a.notPrintedRate ||
        b.totalOrders - a.totalOrders
    )

  const cashierRecap: CashierStrukRecapRow[] = Array.from(cashierAgg.values())
    .map((ca) => {
      const printedOrders = Math.max(0, ca.totalOrders - ca.notPrintedOrders)
      return {
        key: ca.key,
        cashierName: ca.cashierName,
        outletId: ca.outletId,
        outletName: ca.outletName,
        amName: ca.amName,
        totalOrders: ca.totalOrders,
        trackedOrders: ca.trackedOrders,
        printedOrders,
        latePrintedOrders: ca.latePrintedOrders,
        notPrintedOrders: ca.notPrintedOrders,
        customerSkippedOrders: ca.customerSkippedOrders,
        kitchenSkippedOrders: ca.kitchenSkippedOrders,
        bothSkippedOrders: ca.bothSkippedOrders,
        printedRate: roundPct(printedOrders, ca.totalOrders),
        notPrintedRate: roundPct(ca.notPrintedOrders, ca.totalOrders),
        notPrintedRateAll: roundPct(ca.notPrintedOrders, ca.totalOrders),
        notPrintedRevenue: ca.notPrintedRevenue,
        totalRevenue: ca.totalRevenue,
        lastNotPrintedAt: ca.lastNotPrintedAt,
      }
    })
    .sort(
      (a, b) =>
        b.notPrintedOrders - a.notPrintedOrders ||
        a.printedRate - b.printedRate ||
        b.totalOrders - a.totalOrders
    )

  const printedOrders = Math.max(0, totalOrders - notPrintedOrders)
  const summary: RekapStrukSummary = {
    totalOrders,
    trackedOrders,
    printedOrders,
    latePrintedOrders,
    notPrintedOrders,
    customerSkippedOrders,
    kitchenSkippedOrders,
    bothSkippedOrders,
    printedRate: roundPct(printedOrders, totalOrders),
    notPrintedRate: roundPct(notPrintedOrders, totalOrders),
    notPrintedRateAll: roundPct(notPrintedOrders, totalOrders),
    notPrintedRevenue,
    totalRevenue,
    affectedOutletsCount: outletRecap.filter((o) => o.notPrintedOrders > 0).length,
    totalActiveOutletsCount: outletRecap.length,
    affectedCashiersCount: cashierRecap.filter((c) => c.notPrintedOrders > 0).length,
    totalActiveCashiersCount: cashierRecap.length,
  }

  return {
    summary,
    outletRecap,
    cashierRecap,
    completedOrders,
    availableAreaManagers: Array.from(amSet).sort(),
  }
}

export interface FilterRekapStrukOrdersInput {
  completedOrders: RekapStrukOrderRow[]
  skipKindFilter: SkipKindFilter
  outletFilter: string
  amFilter?: string
  cashierFilter: string
  paymentMethod: string
  searchQuery: string
}

export function filterRekapStrukOrders({
  completedOrders,
  skipKindFilter,
  outletFilter,
  amFilter = 'all',
  cashierFilter,
  paymentMethod,
  searchQuery,
}: FilterRekapStrukOrdersInput) {
  let result = completedOrders.filter((o) =>
    matchesSkipKindFilter(o.receiptMeta, skipKindFilter)
  )

  if (outletFilter && outletFilter !== 'all') {
    result = result.filter((o) => o.outlet_id === outletFilter)
  }

  if (amFilter && amFilter !== 'all') {
    const qAm = amFilter.toLowerCase()
    result = result.filter((o) => (o.amName || '').toLowerCase().includes(qAm))
  }

  if (cashierFilter && cashierFilter !== 'all') {
    result = result.filter((o) => {
      const key = `${o.outlet_id}__${o.cashier_name}`
      return key === cashierFilter || o.cashier_name === cashierFilter
    })
  }

  if (paymentMethod && paymentMethod !== 'all') {
    const targetMethod = paymentMethod.toLowerCase()
    result = result.filter(
      (o) => (o.payment_method || 'unknown').toLowerCase() === targetMethod
    )
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    result = result.filter(
      (o) =>
        o.order_number.toString().includes(q) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.cashier_name && o.cashier_name.toLowerCase().includes(q)) ||
        (o.outletName && o.outletName.toLowerCase().includes(q)) ||
        (o.amName && o.amName.toLowerCase().includes(q)) ||
        o.order_items.some(
          (i) =>
            i.menu_item_name.toLowerCase().includes(q) ||
            (i.package_choices &&
              JSON.stringify(i.package_choices).toLowerCase().includes(q))
        )
    )
  }

  let totalAmount = 0
  let totalItems = 0
  for (let i = 0; i < result.length; i++) {
    totalAmount += Number(result[i].total_amount) || 0
    const items = result[i].order_items || []
    for (let j = 0; j < items.length; j++) {
      totalItems += Number(items[j].quantity) || 0
    }
  }

  return {
    rows: result,
    totalAmount,
    totalItems,
  }
}

export function getSourceLabel(order: Pick<OrderRow, 'channel' | 'sales_source' | 'customer_name' | 'is_endorse'>): string {
  return resolveOrderSource(order.channel, order.sales_source, order.customer_name, order.is_endorse).label
}
