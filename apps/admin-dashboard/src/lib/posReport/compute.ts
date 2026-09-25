// @ts-nocheck
/* ── Rumus Rangkuman Penjualan (/dashboard/reports/pos) ──────────────────────
 *
 * Dipindahkan APA ADANYA dari ReportsView.tsx (2026-09-25) supaya bisa
 * dijalankan di server: browser tidak lagi mengunduh seluruh order mentah
 * (±24 MB untuk "Bulan ini") hanya untuk menjumlahkannya sendiri.
 *
 * Satu sumber rumus untuk layar, tabel, rekap item, dan ekspor PDF/CSV.
 * Jangan menyalin rumus ini ke SQL atau ke komponen lain — ubah di sini.
 * File ini murni (tanpa React/Next/Supabase) sehingga bisa dipakai di server
 * maupun browser (extractOrderPackages dipakai saat merender baris tabel).
 */

import { cleanItemName } from '@/lib/order-item-name'
import { resolveOrderSource } from '@/lib/order-source'
import { computeNetRevenueVoidAware, computeOrderDeduction, computeOrderGross, computeItemShares } from '@/lib/posReportKpi'

export interface ShiftRow {
  id: string
  outlet_id: string
  start_time: string
  end_time: string | null
  status: string
  starting_cash: number
  expected_ending_cash: number
  actual_ending_cash: number
  variance: number
  expected_ending_petty_cash: number
  actual_ending_petty_cash: number
  petty_cash_variance: number
}

export interface OrderRow {
  id: string
  order_number: number
  status: string
  payment_method: string | null
  total_amount: number
  created_at: string
  outlet_id: string
  channel: string | null
  sales_source: string | null
  customer_name?: string | null
  cashier_name?: string | null
  external_order_id?: string | null
  is_endorse?: boolean | null
  order_items: {
    id: string
    menu_item_id?: string | null
    menu_item_name: string
    quantity: number
    unit_price: number
    subtotal: number
    is_promo_reward?: boolean
    promo_id?: string | null
    promo_name?: string | null
    promo_buy_quantity?: number | null
    promo_get_quantity?: number | null
    original_unit_price?: number | null
    package_choices?: Record<string, string> | string | null
    menu_items?: {
      hpp_override?: number | null
      is_package?: boolean
      package_items?: {
        quantity?: number
        component?: {
          hpp_override?: number | null
        } | null
      }[] | null
    } | null
  }[]
}

export function getItemHpp(
  menuItem: any,
  outletType?: string,
  fallbackName?: string,
  menuItemByNameMap?: Map<string, any>,
  channel?: string | null,
  menuItemId?: string | null,
  menuItemByIdMap?: Map<string, any>
): number {
  let itemObj = menuItem
  if (!itemObj && menuItemId && menuItemByIdMap?.has(menuItemId)) {
    itemObj = menuItemByIdMap.get(menuItemId)
  }
  if ((!itemObj || (!itemObj.hpp_override && !itemObj.channel_hpp && !itemObj.is_package)) && fallbackName && menuItemByNameMap) {
    const cleanKey = cleanItemName(fallbackName)
    if (menuItemByNameMap.has(cleanKey)) {
      itemObj = menuItemByNameMap.get(cleanKey)
    }
  }
  if (!itemObj) return 0

  let baseHpp = 0
  const normCh = channel ? channel.toLowerCase() : null
  let channelHppVal: number | null = null

  if (itemObj.channel_hpp && typeof itemObj.channel_hpp === 'object' && normCh) {
    if (
      normCh === 'ss-online' ||
      normCh === 'ss_online' ||
      normCh.includes('tiktok') ||
      normCh.includes('shopee') ||
      normCh === 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5' ||
      normCh === 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584'
    ) {
      channelHppVal = itemObj.channel_hpp.ss_online ?? itemObj.channel_hpp.tiktok_shop ?? itemObj.channel_hpp.shopee_shop ?? itemObj.channel_hpp[normCh] ?? null
    } else {
      channelHppVal = itemObj.channel_hpp[normCh] ?? null
    }
  }

  if (channelHppVal !== null && channelHppVal !== undefined && Number(channelHppVal) > 0) {
    baseHpp = Number(channelHppVal)
  } else if (itemObj.hpp_override !== null && itemObj.hpp_override !== undefined && Number(itemObj.hpp_override) > 0) {
    baseHpp = Number(itemObj.hpp_override)
  } else if (itemObj.is_package && Array.isArray(itemObj.package_items)) {
    baseHpp = itemObj.package_items.reduce((sum: number, pkg: any) => {
      const compHpp = pkg.component ? getItemHpp(pkg.component, outletType, undefined, undefined, channel) : (pkg.component?.hpp_override || 0)
      const qty = pkg.quantity || 1
      return sum + (compHpp * qty)
    }, 0)
  }
  if (outletType === 'mitra' && baseHpp > 0) {
    return Math.round(baseHpp * 1.10)
  }
  return baseHpp
}

// ─── Helper for extracting packages/combos ───
export function extractOrderPackages(order: OrderRow) {
  const pkgs: { name: string; qty: number; choices?: Record<string, string> }[] = []

  order.order_items.forEach(item => {
    let isPackage = false
    let choicesObj: Record<string, string> = {}

    // Fallback: check if 'package_choices' is set and has keys
    if (item.package_choices) {
      if (typeof item.package_choices === 'object') {
        choicesObj = item.package_choices as Record<string, string>
      } else if (typeof item.package_choices === 'string') {
        try {
          choicesObj = JSON.parse(item.package_choices)
        } catch (e) {
          // ignore
        }
      }
      if (Object.keys(choicesObj).length > 0) isPackage = true
    }

    const nameLower = item.menu_item_name.toLowerCase()
    if (nameLower.includes('paket') || nameLower.includes('combo') || nameLower.includes('bundle')) {
      isPackage = true
    }

    if (isPackage) {
      pkgs.push({
        name: cleanItemName(item.menu_item_name),
        qty: item.quantity,
        choices: choicesObj
      })
    }
  })

  return pkgs
}

export function buildMenuMaps(menuItems: any[]) {
  const byName = new Map<string, any>()
  const byId = new Map<string, any>()
  menuItems.forEach(mi => {
    if (mi.name) byName.set(cleanItemName(mi.name), mi)
    if (mi.id) byId.set(mi.id, mi)
  })
  return { menuItemByNameMap: byName, menuItemByIdMap: byId }
}

const PAWOON_KEYS = new Set(['pos_pawoon_all', 'pos_pawoon', 'pos_fa'])

// ─── Available Channels ───
export function computeAvailableChannels(orders: OrderRow[], isPawoonVisible: boolean) {
  const map = new Map<string, { key: string; label: string }>()

  // Channel standar — Pawoon hanya dimasukkan jika range mencakup Juli 2026 atau sebelumnya
  const defaults = [
    { key: 'pos_kasir', label: 'POS KASIR (Internal)' },
    ...(isPawoonVisible ? [
      { key: 'pos_pawoon_all', label: 'POS PAWOON (Semua)' },
      { key: 'pos_pawoon', label: 'POS PAWOON' },
      { key: 'pos_fa', label: 'FA PAWOON' },
    ] : []),
    { key: 'shopeefood', label: 'ShopeeFood' },
    { key: 'gofood', label: 'GoFood' },
    { key: 'grabfood', label: 'GrabFood' },
    { key: 'tiktokgo', label: 'TikTok Go' },
    { key: 'online', label: 'Website Online' },
  ]
  defaults.forEach(d => map.set(d.key, d))

  orders.forEach(o => {
    const src = resolveOrderSource(o.channel, o.sales_source, o.customer_name, o.is_endorse)
    // Sembunyikan ENDORSE dari dropdown
    if (src.key === 'endors') return
    // Sembunyikan sumber Pawoon dari orders jika tidak relevan untuk range ini
    if (!isPawoonVisible && PAWOON_KEYS.has(src.key)) return
    if (!map.has(src.key)) {
      map.set(src.key, { key: src.key, label: src.label })
    }
  })
  return Array.from(map.values())
}

// ─── Shared helper (used in analytics AND exports) ───
const isFoodApp = (ch: string) => ['gofood', 'grabfood', 'shopeefood', 'generic_food_app', 'food_apps', 'foodapp', 'foodapps'].includes(ch.toLowerCase())

export function isChannelSelected(target: string, order: any, src: string) {
  if (target === 'food_apps') return isFoodApp(src)
  if (target === 'pos_kasir') return src === 'pos_kasir'
  if (target === 'pos_pawoon_all') return src === 'pos_pawoon' || src === 'pos_fa' || src === 'pos'
  if (target === 'pos_pawoon') {
    if (src !== 'pos_pawoon' && src !== 'pos') return false
    return !order.order_items.some((item: any) => item.menu_item_name.includes('FA'))
  }
  if (target === 'pos_fa') {
    if (src !== 'pos_pawoon' && src !== 'pos') return false
    return order.order_items.some((item: any) => item.menu_item_name.includes('FA'))
  }
  if (target === 'tiktokgo' || target === 'tiktok') return ['tiktokgo', 'tiktok', 'tiktok_go'].includes(src)
  if (target === 'tiktok_shop' || target === 'tiktokshop') {
    return ['tiktok_shop', 'tiktokshop', 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5'].includes(src) || ['tiktok_shop', 'tiktokshop', 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5'].includes((order.channel || '').toLowerCase())
  }
  if (target === 'shopee_shop' || target === 'shopeeseller' || target === 'shopee_seller') {
    return ['shopee_shop', 'shopeeseller', 'shopee_seller', 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584'].includes(src) || ['shopee_shop', 'shopeeseller', 'shopee_seller', 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584'].includes((order.channel || '').toLowerCase())
  }
  return src === target
}

/** Order yang lolos filter channel (belum difilter status). */
export function filterOrdersByChannels(orders: OrderRow[], selectedChannels: string[]) {
  return selectedChannels.includes('all')
    ? orders
    : orders.filter(o => {
        const src = resolveOrderSource(o.channel, o.sales_source, o.customer_name, o.is_endorse).key.toLowerCase()
        return selectedChannels.some(target => isChannelSelected(target.toLowerCase(), o, src))
      })
}

export interface AnalyticsInput {
  orders: OrderRow[]
  shifts: ShiftRow[]
  selectedChannels: string[]
  menuItemByNameMap: Map<string, any>
  menuItemByIdMap: Map<string, any>
  settlements: any[]
  isSSOnlineSelected: boolean
  outlets: { id: string; type?: string | null }[]
}

// ─── Derived Analytics ───
export function computeAnalytics({
  orders, shifts, selectedChannels, menuItemByNameMap, menuItemByIdMap, settlements, isSSOnlineSelected, outlets,
}: AnalyticsInput) {
  const filteredOrders = filterOrdersByChannels(orders, selectedChannels)

  const completed = filteredOrders.filter(o => o.status === 'completed' || o.status === 'settled')
  const totalOrders = completed.length
  const buyOneGetOneOrders = completed.filter(order => order.order_items.some(item => item.is_promo_reward))
  const buyOneGetOneGiftUnits = buyOneGetOneOrders.reduce(
    (sum, order) => sum + order.order_items
      .filter(item => item.is_promo_reward)
      .reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
    0
  )
  // NET methodology (konsisten dengan halaman Laba Kotor, keputusan owner
  // 2026-07-29): lihat computeNetRevenueVoidAware.
  const actualNetRevenue = computeNetRevenueVoidAware(filteredOrders)

  // Hitung total selisih laci (variance) dari tutup shift
  const totalCashVariance = shifts.reduce((s, shift) => s + (shift.variance || 0), 0)

  const outletTypeMap = new Map<string, string>()
  outlets.forEach(o => outletTypeMap.set(o.id, o.type || 'outlet'))

  // Calculate Total HPP using order_items menu_items
  const totalHPP = completed
    .reduce((sum, o) => {
      const outletType = outletTypeMap.get(o.outlet_id)
      const orderChannel = o.channel || o.sales_source
      return sum + o.order_items.reduce((itemSum, item) => {
        const menuItem = item.menu_items || (item.menu_item_id ? menuItemByIdMap.get(item.menu_item_id) : null) || menuItemByNameMap.get(cleanItemName(item.menu_item_name))
        const hpp = getItemHpp(menuItem, outletType, item.menu_item_name, menuItemByNameMap, orderChannel, item.menu_item_id, menuItemByIdMap);
        return itemSum + (hpp * item.quantity);
      }, 0)
    }, 0)

  // Payment method breakdown
  const paymentBreakdown: Record<string, { count: number; revenue: number }> = {}
  completed.forEach(o => {
    const method = o.payment_method || 'unknown'
    if (!paymentBreakdown[method]) paymentBreakdown[method] = { count: 0, revenue: 0 }
    paymentBreakdown[method].count++
    paymentBreakdown[method].revenue += o.total_amount
  })

  // Best sellers & Category Breakdown
  const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {}
  const itemPdfMap: Record<string, { name: string; channel: string; qty: number; revenue: number }> = {}
  let mainFoodQty = 0
  let addOnsQty = 0

  completed.forEach(o => {
    const channelName = resolveOrderSource(o.channel, o.sales_source, o.customer_name, o.is_endorse).label
    // PDF Eksekutif: revenue per item = porsi gross order (acuan sama dengan
    // kartu Gross Revenue), supaya kolom "% Kontribusi Omzet" berjumlah 100%.
    const pdfOrderGross = computeOrderGross(o, { ssOnlineMode: isSSOnlineSelected })
    const pdfShares = computeItemShares(o.order_items || [])

    o.order_items.forEach((oi, idx) => {
      const key = cleanItemName(oi.menu_item_name)
      if (!itemMap[key]) itemMap[key] = { name: key, qty: 0, revenue: 0 }
      itemMap[key].qty += oi.quantity
      itemMap[key].revenue += oi.subtotal

      const pdfKey = `${key}__${channelName}`
      if (!itemPdfMap[pdfKey]) itemPdfMap[pdfKey] = { name: key, channel: channelName, qty: 0, revenue: 0 }
      itemPdfMap[pdfKey].qty += oi.quantity
      itemPdfMap[pdfKey].revenue += pdfShares[idx] * pdfOrderGross

      // Simple logic to detect Category: if parentId exists or "Extra" in name -> Add-on
      if (oi.menu_item_name.includes('|PARENT|') || oi.menu_item_name.toLowerCase().includes('extra')) {
        addOnsQty += oi.quantity
      } else {
        mainFoodQty += oi.quantity
      }
    })
  })

  const bestSellers = Object.values(itemMap).sort((a, b) => b.qty - a.qty)
  const bestSellersPdf = Object.values(itemPdfMap).sort((a, b) => b.qty - a.qty)
  const categoryData = [
    { name: 'Menu Utama', value: mainFoodQty, color: '#f59e0b' },
    { name: 'Ekstra / Topping', value: addOnsQty, color: '#10b981' }
  ].filter(d => d.value > 0)

  // Success vs Failure
  const cancelled = filteredOrders.filter(o => o.status === 'cancelled').length
  const successRate = filteredOrders.length > 0 ? Math.round((completed.length / filteredOrders.length) * 100) : 0

  // ACUAN TUNGGAL Omzet Kotor (lihat migration 20300128000000 &
  // computeOrderDeduction di lib/posReportKpi).
  const totalDeductions = completed.reduce(
    (s, o) => s + computeOrderDeduction(o, { ssOnlineMode: isSSOnlineSelected }),
    0
  )

  // Subsidi platform (Grab/Gojek/Shopee/TikTok) yang diketik kasir di kolom
  // "Promo Apps". BUKAN pendapatan outlet dan BUKAN biaya outlet -- tidak
  // ikut omzet maupun potongan, ditampilkan sebagai kartu informasi.
  // Baris SS Online dikecualikan: jalurnya sendiri, promo_subsidy-nya 0.
  const totalPlatformSubsidy = completed.reduce((s, o) => {
    if ((o as any).outlet_id === 'ss-online') return s
    return s + (Number((o as any).promo_subsidy) || 0)
  }, 0)

  const netRevenue = actualNetRevenue

  // Gross Revenue = total nilai kotor seluruh pesanan sebelum potongan/diskon/subsidi
  const grossRevenue = actualNetRevenue + totalDeductions
  const grossProfit = Math.max(0, grossRevenue - (totalHPP + totalDeductions))

  let totalSettlement = 0
  let totalRealAdmin = 0
  let settlementDateRange = ''
  let hasSettlementData = false

  // Kartu settlement hanya tampil bila ada data settlement yang DIUNGGAH — aturan
  // SAMA untuk TikTok GO dan SS Online (keputusan owner 2026-09-14).
  const SS_ONLINE_PLATFORMS = ['tiktok_shop', 'shopee_shop']
  let relevantSettlements: any[] = []
  if (isSSOnlineSelected) {
    const platforms = selectedChannels.includes('all')
      ? SS_ONLINE_PLATFORMS
      : SS_ONLINE_PLATFORMS.filter(p => selectedChannels.includes(p))
    relevantSettlements = settlements.filter(s => platforms.includes(s.platform))
  } else if (selectedChannels.includes('tiktokgo') || selectedChannels.includes('tiktok')) {
    relevantSettlements = settlements.filter(s => selectedChannels.includes(s.platform) || (s.platform === 'tiktokgo' && selectedChannels.includes('tiktok')) || (s.platform === 'tiktok' && selectedChannels.includes('tiktokgo')))
  }

  if (relevantSettlements.length > 0) {
    hasSettlementData = true
    totalSettlement = relevantSettlements.reduce((sum, s) => {
      return sum + (Number(s.omzet_kotor) || 0) - (Number(s.promo_merchant) || 0) - (Number(s.commission) || 0)
    }, 0)
    totalRealAdmin = relevantSettlements.reduce((sum, s) => sum + (Number(s.commission) || 0), 0)

    const dates = relevantSettlements.map(s => s.tanggal).filter(Boolean).sort()
    if (dates.length > 0) {
      const minDate = dates[0]
      const maxDate = dates[dates.length - 1]

      const formatDateStr = (d: string) => {
        const [y, m, day] = d.split('-')
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
        return `${day} ${months[parseInt(m) - 1]} ${y}`
      }

      settlementDateRange = minDate === maxDate
        ? formatDateStr(minDate)
        : `${formatDateStr(minDate)} - ${formatDateStr(maxDate)}`
    }
  }

  return {
    completedOrders: completed,
    paymentBreakdown,
    bestSellers,
    bestSellersPdf,
    categoryData,
    totalOrders,
    buyOneGetOneTransactions: buyOneGetOneOrders.length,
    buyOneGetOneGiftUnits,
    successRate,
    cancelledCount: cancelled,
    grossRevenue,
    totalDeductions,
    totalPlatformSubsidy,
    netRevenue,
    totalHPP,
    grossProfit,
    totalSettlement,
    totalRealAdmin,
    settlementDateRange,
    hasSettlementData,
    totalCashVariance,
  }
}

// ─── Available Payment Methods ───
const PAYMENT_LABELS: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', card: 'Kartu', unknown: 'Lainnya' }

export function computeAvailablePaymentMethods(orders: OrderRow[]) {
  const map = new Map<string, string>()
  map.set('cash', 'Tunai (Cash)')
  map.set('qris', 'QRIS')
  map.set('card', 'Kartu (Card)')

  orders.forEach(o => {
    if (o.payment_method) {
      const key = o.payment_method.toLowerCase()
      if (!map.has(key)) {
        const label = PAYMENT_LABELS[key]
        map.set(key, label ? label : key.toUpperCase())
      }
    }
  })
  return Array.from(map.entries()).map(([key, label]) => ({ key, label }))
}

// Table filtering
export function filterTableData(completedOrders: OrderRow[], selectedPaymentMethod: string, searchQuery: string) {
  let result = completedOrders
  if (selectedPaymentMethod !== 'all') {
    result = result.filter(o => (o.payment_method || 'unknown').toLowerCase() === selectedPaymentMethod.toLowerCase())
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    result = result.filter(o =>
      o.order_number.toString().includes(q) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
      o.order_items.some(i =>
        i.menu_item_name.toLowerCase().includes(q) ||
        (i.package_choices && JSON.stringify(i.package_choices).toLowerCase().includes(q))
      )
    )
  }
  return result
}

/** Baris "Total" di kaki tabel transaksi (seluruh hasil filter, bukan satu halaman). */
export function computeTableFooter(filteredTableData: OrderRow[]) {
  const totalGross = filteredTableData.reduce((acc, curr) => {
    const itemSub = curr.order_items.reduce((sum, item) => sum + (Number(item.subtotal) || (Number(item.quantity) * Number(item.unit_price)) || 0), 0);
    return acc + (itemSub > 0 ? itemSub : (Number(curr.total_amount) + (Number((curr as any).discount_amount) || 0)));
  }, 0);
  const totalNet = filteredTableData.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
  const totalOfflineDiscount = filteredTableData.reduce((acc, curr) => acc + (Number((curr as any).discount_amount) || 0), 0);
  const totalAppSubsidy = filteredTableData.reduce((acc, curr) => acc + (Number((curr as any).promo_subsidy) || 0), 0);
  const totalEcommerceDiscount = Math.max(0, totalGross - totalNet);
  const totalItems = filteredTableData.reduce((acc, curr) => {
    return acc + curr.order_items.reduce((sum, item) => sum + item.quantity, 0);
  }, 0);
  return { totalGross, totalNet, totalOfflineDiscount, totalAppSubsidy, totalEcommerceDiscount, totalItems }
}

// Item Breakdown (Rekap)
export function computeItemBreakdown(
  filteredTableData: OrderRow[],
  outlets: { id: string; type?: string | null }[],
  menuItemByNameMap: Map<string, any>,
  menuItemByIdMap: Map<string, any>
) {
  const map = new Map<string, { name: string; groupLabel: string; qty: number; grossRevenue: number; netRevenue: number; hppPerUnit: number; totalHpp: number }>()
  const outletTypeMap = new Map<string, string>()
  outlets.forEach(o => outletTypeMap.set(o.id, o.type || 'outlet'))

  filteredTableData.forEach(order => {
    const outletType = outletTypeMap.get(order.outlet_id)

    // Hitung subtotal kotor dari seluruh item di pesanan ini
    const orderSubtotal = order.order_items.reduce((sum, item) => sum + (item.subtotal || 0), 0)

    // Jika ada diskon/pajak di tingkat pesanan, distribusikan secara proporsional ke tiap item
    const ratio = orderSubtotal > 0 ? (order.total_amount / orderSubtotal) : 1

    order.order_items.forEach(item => {
      const cleanName = cleanItemName(item.menu_item_name)
      const src = resolveOrderSource(order.channel, order.sales_source, order.customer_name, order.is_endorse)

      let groupLabel = 'OFFLINE'
      if (order.outlet_id === 'ss-online' || src.key.includes('tiktok_shop') || src.key.includes('shopee_shop')) {
        groupLabel = 'SS ONLINE'
      } else if (['shopeefood', 'grabfood', 'gofood'].includes(src.key)) {
        groupLabel = 'FOOD APPS'
      } else if (['tiktokgo', 'tiktok', 'tiktok_go'].includes(src.key)) {
        groupLabel = 'TIKTOK'
      } else if (src.key === 'online') {
        groupLabel = 'WEB ONLINE'
      }

      const key = `${cleanName}-${groupLabel}`
      const menuItem = item.menu_items || (item.menu_item_id ? menuItemByIdMap.get(item.menu_item_id) : null) || menuItemByNameMap.get(cleanItemName(item.menu_item_name))
      const hppPerUnit = getItemHpp(menuItem, outletType, item.menu_item_name, menuItemByNameMap, order.channel || order.sales_source, item.menu_item_id, menuItemByIdMap)

      if (!map.has(key)) {
        map.set(key, {
          name: cleanName,
          groupLabel,
          qty: 0,
          grossRevenue: 0,
          netRevenue: 0,
          hppPerUnit,
          totalHpp: 0
        })
      }

      const existing = map.get(key)!
      existing.qty += item.quantity
      existing.grossRevenue += item.subtotal
      existing.netRevenue += (item.subtotal * ratio)
      existing.totalHpp += (hppPerUnit * item.quantity)
      existing.hppPerUnit = existing.qty > 0 ? Math.round(existing.totalHpp / existing.qty) : hppPerUnit
    })
  })

  return Array.from(map.values()).sort((a, b) => b.qty - a.qty)
}

/**
 * Rekap per kategori/channel untuk ekspor "PDF Semua Channel" dan
 * "CSV Semua Channel". Dua blok ekspor di ReportsView dulu identik kecuali
 * CSV menambah kolom adminPlatform & grossProfit; di sini digabung jadi satu —
 * PDF cukup mengabaikan dua kolom tambahan itu.
 */
export function computeCategoryReport(
  orders: OrderRow[],
  selectedChannels: string[],
  outlets: { id: string; type?: string | null }[],
  menuItemByNameMap: Map<string, any>,
  menuItemByIdMap: Map<string, any>,
  isSSOnlineSelected: boolean
) {
  // 1. Dapatkan valid orders yang sinkron dengan filter channel aktif
  const validOrders = filterOrdersByChannels(orders, selectedChannels)
    .filter(o => o.status === 'completed' || o.status === 'settled')

  // 2. Kelompokkan per channel
  const outletTypeMap = new Map<string, string>()
  outlets.forEach(o => outletTypeMap.set(o.id, o.type || 'outlet'))

  const categoryMap: Record<string, {
    categoryName: string,
    grossRevenue: number,
    itemMap: Record<string, { name: string; qty: number; revenue: number; hppTotal: number; adminPlatform: number; grossProfit: number; unitPrice: number }>
  }> = {}

  // "Total Revenue" per item bersumber dari rumus gross yang sama dengan kartu
  // KPI di layar (computeOrderGross), dibagi proporsional ke item.
  validOrders.forEach(o => {
    const srcInfo = resolveOrderSource(o.channel, o.sales_source, o.customer_name, o.is_endorse)
    const srcKey = srcInfo.key.toLowerCase()
    const isTikTok = ['tiktok', 'tiktokgo'].includes(srcKey)
    const isFoodAppSrc = ['gofood', 'grabfood', 'shopeefood', 'generic_food_app', 'food_apps'].includes(srcKey)

    let categoryName = srcInfo.label
    const isPawoon = o.customer_name === 'Pawoon Import' || srcKey === 'pos_pawoon' || srcKey === 'pos'

    if (isPawoon) {
      const hasFA = o.order_items.some(item => item.menu_item_name.includes('FA') || item.menu_item_name.includes('FOOD APPS'))
      const hasTikTok = o.order_items.some(item => item.menu_item_name.toLowerCase().includes('tiktok'))

      if (isTikTok || hasTikTok) {
        categoryName = 'POS Pawoon (TikTok)'
      } else if (hasFA || isFoodAppSrc) {
        categoryName = 'POS Pawoon (Food Apps)'
      } else {
        categoryName = 'POS Pawoon (Offline/Kasir)'
      }
    } else if (srcKey === 'pos_kasir') {
      categoryName = 'POS KASIR (Internal)'
    } else if (isTikTok) {
      categoryName = 'TikTok Go'
    } else if (isFoodAppSrc) {
      categoryName = 'Food Apps (GoFood/Grab/Shopee/dll)'
    } else if (srcKey === 'online') {
      categoryName = 'Website Online'
    } else if (srcKey === 'tiktok_shop' || srcKey.includes('tiktokshop')) {
      categoryName = 'TikTok Shop (Online)'
    } else if (srcKey === 'shopee_shop' || srcKey.includes('shopeeseller')) {
      categoryName = 'Shopee Shop (Online)'
    }

    const outletType = outletTypeMap.get(o.outlet_id)

    if (!categoryMap[categoryName]) {
      categoryMap[categoryName] = { categoryName, grossRevenue: 0, itemMap: {} }
    }

    const catData = categoryMap[categoryName]

    const orderGross = computeOrderGross(o, { ssOnlineMode: isSSOnlineSelected })
    const orderTotalDeductions = computeOrderDeduction(o, { ssOnlineMode: isSSOnlineSelected })
    const itemShares = computeItemShares(o.order_items || [])

    if (o.order_items && o.order_items.length > 0) {
      o.order_items.forEach((oi, idx) => {
        const key = cleanItemName(oi.menu_item_name)
        if (!catData.itemMap[key]) {
          catData.itemMap[key] = {
            name: key,
            qty: 0,
            revenue: 0,
            hppTotal: 0,
            adminPlatform: 0,
            grossProfit: 0,
            unitPrice: oi.unit_price || (oi.subtotal / oi.quantity) || 0
          }
        }

        const menuItem = oi.menu_items || (oi.menu_item_id ? menuItemByIdMap.get(oi.menu_item_id) : null) || menuItemByNameMap.get(cleanItemName(oi.menu_item_name))
        const hppPerUnit = getItemHpp(menuItem, outletType, oi.menu_item_name, menuItemByNameMap, o.channel || o.sales_source, oi.menu_item_id, menuItemByIdMap)
        const itemHpp = hppPerUnit * oi.quantity
        const itemWeight = itemShares[idx]
        const itemRevenue = itemWeight * orderGross
        const itemDeduction = itemWeight * orderTotalDeductions
        const itemGrossProfit = itemRevenue - itemHpp - itemDeduction

        catData.itemMap[key].qty += oi.quantity
        catData.itemMap[key].revenue += itemRevenue
        catData.itemMap[key].hppTotal += itemHpp
        catData.itemMap[key].adminPlatform += itemDeduction
        catData.itemMap[key].grossProfit += itemGrossProfit

        catData.grossRevenue += itemRevenue
      })
    } else if (orderGross > 0) {
      const key = `Order #${o.order_number} (${o.customer_name || 'Pelanggan'})`
      if (!catData.itemMap[key]) {
        catData.itemMap[key] = {
          name: key,
          qty: 0,
          revenue: 0,
          hppTotal: 0,
          adminPlatform: 0,
          grossProfit: 0,
          unitPrice: orderGross
        }
      }
      const itemDeduction = orderTotalDeductions
      const itemGrossProfit = orderGross - itemDeduction

      catData.itemMap[key].qty += 1
      catData.itemMap[key].revenue += orderGross
      catData.itemMap[key].adminPlatform += itemDeduction
      catData.itemMap[key].grossProfit += itemGrossProfit

      catData.grossRevenue += orderGross
    }
  })

  // 3. Ubah ke array dan sort
  const categories = Object.values(categoryMap).map(cat => ({
    categoryName: cat.categoryName,
    grossRevenue: cat.grossRevenue,
    totalQty: Object.values(cat.itemMap).reduce((acc, item) => acc + item.qty, 0),
    totalHpp: Object.values(cat.itemMap).reduce((acc, item) => acc + item.hppTotal, 0),
    bestSellers: Object.values(cat.itemMap).sort((a, b) => b.qty - a.qty)
  }))

  // Sort kategori: POS Kasir di atas, sisanya berdasarkan revenue
  categories.sort((a, b) => {
    const aIsKasir = a.categoryName.toLowerCase().includes('kasir')
    const bIsKasir = b.categoryName.toLowerCase().includes('kasir')
    if (aIsKasir && !bIsKasir) return -1
    if (!aIsKasir && bIsKasir) return 1
    return b.grossRevenue - a.grossRevenue
  })

  return { categories, validOrderCount: validOrders.length }
}
