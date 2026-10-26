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
import {
  computeNetRevenueVoidAware,
  computeOrderDeduction,
  computeOrderGross,
  computeItemShares,
  computeOrderPlatformSubsidy,
  buildFoodAppsSettlementPromoMap,
  buildGofoodSettlementPromoMap,
  isFoodAppOrder,
  isGoFoodOrder,
  isTikTokGoOrder,
} from '@/lib/posReportKpi'
import { buatPenerapRiwayat, tanggalWib } from '@/lib/hpp/riwayatHpp'
import { adalahKanalSsOnline } from '@/lib/hpp/kanalSsOnline'
import { matchesReceiptFilter, type ReceiptFilter } from './receiptReprint'

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
  customer_receipt_print_count?: number | null
  kitchen_receipt_print_count?: number | null
  customer_receipt_skipped?: boolean | null
  kitchen_receipt_skipped?: boolean | null
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

const itemHppMemo = new WeakMap<object, Map<string, number>>()

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
  if (!itemObj && fallbackName && menuItemByNameMap) {
    const cleanKey = cleanItemName(fallbackName)
    const rawLower = cleanKey.trim().toLowerCase()
    const candidates = [
      cleanKey,
      rawLower,
      rawLower.replace(/^(suka\s+shawarma|suka)\s+/i, '').trim(),
      rawLower.replace(/\s*\((1x|2x|3x|4x)\)\s*$/i, '').trim(),
      rawLower.replace(/^(suka\s+shawarma|suka)\s+/i, '').replace(/\s*\((1x|2x|3x|4x)\)\s*$/i, '').trim(),
      rawLower.replace(/\s*-\s*(large|barbar)\s*$/i, '').trim(),
      rawLower.replace(/^(suka\s+shawarma|suka)\s+/i, '').replace(/\s*-\s*(large|barbar)\s*$/i, '').trim(),
      rawLower.replace(/\s+shawarma\s*$/i, '').trim(),
      rawLower.replace(/^(suka\s+shawarma|suka)\s+/i, '').replace(/\s+shawarma\s*$/i, '').trim(),
    ]
    for (const key of candidates) {
      if (menuItemByNameMap.has(key)) {
        itemObj = menuItemByNameMap.get(key)
        break
      }
    }
  }
  if (!itemObj) return 0

  const normCh = channel ? channel.toLowerCase() : null
  const isMitra = outletType === 'mitra'
  const memoKey = `${isMitra ? 1 : 0}|${normCh || ''}|${itemObj.hpp_override ?? ''}`
  let objMap = itemHppMemo.get(itemObj)
  if (objMap) {
    const hit = objMap.get(memoKey)
    if (hit !== undefined) return hit
  }

  let baseHpp = 0
  let channelHppVal: number | null = null

  if (itemObj.channel_hpp && typeof itemObj.channel_hpp === 'object' && normCh) {
    // Hanya marketplace (Shopee toko, TikTok Shop). ShopeeFood & TikTok GO
    // memakai hpp_override — lihat lib/hpp/kanalSsOnline.ts.
    if (adalahKanalSsOnline(normCh)) {
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
      // Komponen dihitung TANPA markup mitra; markup 1,1 dipasang sekali di
      // bawah pada total paket. Dulu komponen sudah ×1,1 lalu totalnya ×1,1
      // lagi → paket mitra kena 1,21.
      const compHpp = pkg.component ? getItemHpp(pkg.component, undefined, undefined, undefined, channel) : 0
      const qty = pkg.quantity || 1
      return sum + (compHpp * qty)
    }, 0)
  }

  // Jika itemObj menghasilkan baseHpp 0 (mis. menu lama dengan hpp null & channel_hpp {}), coba fallbackName
  if (baseHpp === 0 && fallbackName && menuItemByNameMap) {
    const rawClean = cleanItemName(fallbackName)
    const rawLower = rawClean.trim().toLowerCase()
    const candidates = [
      rawClean,
      rawLower,
      rawLower.replace(/^(suka\s+shawarma|suka)\s+/i, '').trim(),
      rawLower.replace(/\s*\((1x|2x|3x|4x)\)\s*$/i, '').trim(),
      rawLower.replace(/^(suka\s+shawarma|suka)\s+/i, '').replace(/\s*\((1x|2x|3x|4x)\)\s*$/i, '').trim(),
      rawLower.replace(/\s*-\s*(large|barbar)\s*$/i, '').trim(),
      rawLower.replace(/^(suka\s+shawarma|suka)\s+/i, '').replace(/\s*-\s*(large|barbar)\s*$/i, '').trim(),
      rawLower.replace(/\s+shawarma\s*$/i, '').trim(),
      rawLower.replace(/^(suka\s+shawarma|suka)\s+/i, '').replace(/\s+shawarma\s*$/i, '').trim(),
    ]
    for (const key of candidates) {
      if (menuItemByNameMap.has(key)) {
        const candObj = menuItemByNameMap.get(key)
        const candHpp = getItemHpp(candObj, undefined, undefined, undefined, channel)
        if (candHpp > 0) {
          baseHpp = candHpp
          break
        }
      }
    }
  }
  const finalHpp = isMitra && baseHpp > 0 ? Math.round(baseHpp * 1.10) : baseHpp
  if (!objMap) {
    objMap = new Map<string, number>()
    itemHppMemo.set(itemObj, objMap)
  }
  objMap.set(memoKey, finalHpp)
  return finalHpp
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

/** HPP per tanggal order: nilai HPP ditimpa nilai yang berlaku pada tanggal order. */
export function buildPenerapHpp(menuItems: any[], riwayatHpp: any[]) {
  return buatPenerapRiwayat(menuItems, riwayatHpp, cleanItemName)
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
  if (target === 'pos_kasir') return src === 'pos_kasir' || src === 'endors'
  if (target === 'online' || target === 'website') return src === 'online'
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
  penerapHpp: { untuk(tgl: string): any }
  settlements: any[]
  isSSOnlineSelected: boolean
  outlets: { id: string; type?: string | null }[]
}

// ─── Derived Analytics ───
export function computeAnalytics({
  orders, shifts, selectedChannels, menuItemByNameMap, menuItemByIdMap, penerapHpp, settlements, isSSOnlineSelected, outlets,
}: AnalyticsInput) {
  const filteredOrders = filterOrdersByChannels(orders, selectedChannels)

  const completed: OrderRow[] = []
  let cancelled = 0
  for (let i = 0; i < filteredOrders.length; i++) {
    const o = filteredOrders[i]
    if (o.status === 'completed' || o.status === 'settled') {
      completed.push(o)
    } else if (o.status === 'cancelled') {
      cancelled++
    }
  }
  const totalOrders = completed.length
  const successRate = filteredOrders.length > 0 ? Math.round((completed.length / filteredOrders.length) * 100) : 0

  // Hitung total selisih laci (variance) dari tutup shift
  let totalCashVariance = 0
  for (let i = 0; i < shifts.length; i++) {
    totalCashVariance += shifts[i].variance || 0
  }

  const outletTypeMap = new Map<string, string>()
  for (let i = 0; i < outlets.length; i++) {
    outletTypeMap.set(outlets[i].id, outlets[i].type || 'outlet')
  }

  // Bangun pemetaan settlement Food Apps (GoFood, GrabFood, ShopeeFood)
  // File rekonsiliasi platform settlement adalah Single Source of Truth
  const foodAppsSettlementPromoMap = buildFoodAppsSettlementPromoMap(completed, settlements)
  const kpiOpts = {
    ssOnlineMode: isSSOnlineSelected,
    getSettlementPromo: (order: any) => foodAppsSettlementPromoMap.get(order.id ?? order),
    getGofoodSettlementPromo: (order: any) => foodAppsSettlementPromoMap.get(order.id ?? order),
    gofoodSettlementMap: foodAppsSettlementPromoMap,
  }

  let buyOneGetOneTransactions = 0
  let buyOneGetOneGiftUnits = 0
  let totalHPP = 0
  const paymentBreakdown: Record<string, { count: number; revenue: number }> = {}
  const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {}
  const itemPdfMap: Record<string, { name: string; channel: string; qty: number; revenue: number }> = {}
  let mainFoodQty = 0
  let addOnsQty = 0
  let totalDeductions = 0
  let totalPlatformSubsidy = 0
  let grossRevenue = 0
  let estimatedCommission = 0

  for (let i = 0; i < completed.length; i++) {
    const o = completed[i]
    const target = o as any

    // 1. Terapkan alokasi settlement ke tiap order di completedOrders agar tabel transaksi & turunan langsung membacanya
    if (isFoodAppOrder(o)) {
      const allocated = foodAppsSettlementPromoMap.get(o.id ?? target)
      if (allocated !== undefined) {
        target.settlement_promo_merchant = allocated
        const kasirPromo = Number(target.promo_subsidy) || 0
        // Hanya GoFood yang punya subsidi platform; ShopeeFood/GrabFood = diskon toko murni
        target.platform_subsidy = isGoFoodOrder(o) ? Math.max(0, kasirPromo - allocated) : 0
      }
    } else if (isTikTokGoOrder(o)) {
      target.settlement_promo_merchant = 0
      const kasirPromo = Number(target.promo_subsidy) || 0
      target.platform_subsidy = kasirPromo
    }

    // 2. Payment method breakdown
    const method = o.payment_method || 'unknown'
    let pb = paymentBreakdown[method]
    if (!pb) {
      pb = { count: 0, revenue: 0 }
      paymentBreakdown[method] = pb
    }
    pb.count++
    pb.revenue += o.total_amount

    // 3. ACUAN TUNGGAL Omzet Kotor, Potongan, Subsidi Platform & Estimasi Komisi (dihitung sekali per order)
    const orderDeduction = computeOrderDeduction(o, kpiOpts)
    const orderGross = computeOrderGross(o, kpiOpts)
    totalDeductions += orderDeduction
    grossRevenue += orderGross
    if (target.outlet_id !== 'ss-online') {
      totalPlatformSubsidy += computeOrderPlatformSubsidy(o, kpiOpts)
    }

    if (!isSSOnlineSelected && o.outlet_id !== 'ss-online') {
      const ch = (o.channel || '').toLowerCase()
      const src = (o.sales_source || '').toLowerCase()
      if (isGoFoodOrder(o)) estimatedCommission += Math.round(orderGross * 0.20)
      else if (ch.includes('grab') || src.includes('grab')) estimatedCommission += Math.round(orderGross * 0.20)
      else if (ch.includes('shopee') || src.includes('shopee')) estimatedCommission += Math.round(orderGross * 0.20)
      else if (isTikTokGoOrder(o)) estimatedCommission += Math.round(orderGross * 0.092)
    }

    // 4. Rincian item (BOGO, HPP, Best Sellers, PDF Best Sellers, Kategori) dalam satu iterasi
    const items = o.order_items || []
    if (items.length > 0) {
      const outletType = outletTypeMap.get(o.outlet_id)
      const orderChannel = o.channel || o.sales_source
      const pHpp = penerapHpp.untuk(tanggalWib(o.created_at))
      const channelName = resolveOrderSource(o.channel, o.sales_source, o.customer_name, o.is_endorse).label
      const pdfShares = computeItemShares(items)
      let hasBogo = false
      let orderHpp = 0

      for (let idx = 0; idx < items.length; idx++) {
        const oi = items[idx]
        if (oi.is_promo_reward) {
          hasBogo = true
          buyOneGetOneGiftUnits += Number(oi.quantity || 0)
        }

        const key = cleanItemName(oi.menu_item_name)
        const menuItem = pHpp.terapkan(oi.menu_items) || (oi.menu_item_id ? pHpp.byId.get(oi.menu_item_id) : null) || pHpp.byName.get(key)
        const hpp = getItemHpp(menuItem, outletType, oi.menu_item_name, pHpp.byName, orderChannel, oi.menu_item_id, pHpp.byId)
        orderHpp += hpp * oi.quantity

        let im = itemMap[key]
        if (!im) {
          im = { name: key, qty: 0, revenue: 0 }
          itemMap[key] = im
        }
        im.qty += oi.quantity
        im.revenue += oi.subtotal

        const pdfKey = `${key}__${channelName}`
        let ipm = itemPdfMap[pdfKey]
        if (!ipm) {
          ipm = { name: key, channel: channelName, qty: 0, revenue: 0 }
          itemPdfMap[pdfKey] = ipm
        }
        ipm.qty += oi.quantity
        ipm.revenue += pdfShares[idx] * orderGross

        if (oi.menu_item_name.includes('|PARENT|') || oi.menu_item_name.toLowerCase().includes('extra')) {
          addOnsQty += oi.quantity
        } else {
          mainFoodQty += oi.quantity
        }
      }

      if (hasBogo) buyOneGetOneTransactions++
      totalHPP += orderHpp
    }
  }

  const bestSellers = Object.values(itemMap).sort((a, b) => b.qty - a.qty)
  const bestSellersPdf = Object.values(itemPdfMap).sort((a, b) => b.qty - a.qty)
  const categoryData = [
    { name: 'Menu Utama', value: mainFoodQty, color: '#f59e0b' },
    { name: 'Ekstra / Topping', value: addOnsQty, color: '#10b981' }
  ].filter(d => d.value > 0)

  const netRevenue = grossRevenue - totalDeductions
  const grossProfit = Math.max(0, grossRevenue - (totalHPP + totalDeductions))

  let totalSettlement = 0
  let totalSettlementGross = 0
  let settlementRate = 0
  let settlementGrossRate = 0
  let totalRealAdmin = 0
  let settlementDateRange = ''
  let settlementLastUpdate = ''
  let hasSettlementData = false

  // Kartu settlement mencocokkan platform settlement yang diunggah
  const SS_ONLINE_PLATFORMS = new Set(['tiktok_shop', 'shopee_shop'])
  let relevantSettlements: any[] = []
  if (isSSOnlineSelected) {
    relevantSettlements = settlements.filter(s => {
      const plat = (s.platform || '').toLowerCase()
      if (!SS_ONLINE_PLATFORMS.has(plat)) return false
      if (selectedChannels.includes('all')) return true
      return selectedChannels.some(ch => ch.toLowerCase() === plat)
    })
  } else {
    // Outlet fisik: kecualikan marketplace SS Online, sertakan seluruh platform foodapps
    relevantSettlements = settlements.filter(s => {
      const plat = (s.platform || '').toLowerCase()
      if (SS_ONLINE_PLATFORMS.has(plat)) return false
      if (selectedChannels.includes('all')) return true
      return selectedChannels.some(ch => {
        const c = ch.toLowerCase()
        if (c === 'all') return true
        if ((c === 'food_apps' || c === 'foodapps' || c === 'food_app') && isFoodApp(plat)) return true
        if ((c === 'gofood' || c === 'gojek') && plat === 'gofood') return true
        if ((c === 'grabfood' || c === 'grab') && plat === 'grabfood') return true
        if ((c === 'shopeefood' || c === 'shopee') && plat === 'shopeefood') return true
        if ((c === 'tiktokgo' || c === 'tiktok') && (plat === 'tiktokgo' || plat === 'tiktok')) return true
        return c === plat
      })
    })
  }

  if (relevantSettlements.length > 0) {
    hasSettlementData = true
    for (let i = 0; i < relevantSettlements.length; i++) {
      const s = relevantSettlements[i]
      const kotor = Number(s.omzet_kotor) || 0
      const promo = Number(s.promo_merchant) || 0
      const comm = Number(s.commission) || 0
      totalSettlement += kotor - promo - comm
      totalSettlementGross += kotor
      totalRealAdmin += comm
    }
    settlementRate = grossRevenue > 0 ? Number(((totalSettlement / grossRevenue) * 100).toFixed(1)) : 0
    settlementGrossRate = grossRevenue > 0 ? Number(((totalSettlementGross / grossRevenue) * 100).toFixed(1)) : 0

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

    const importedDates = relevantSettlements
      .map(s => s.imported_at || s.created_at)
      .filter(Boolean)
      .sort()
    if (importedDates.length > 0) {
      const latestIso = importedDates[importedDates.length - 1]
      try {
        const dt = new Date(latestIso)
        settlementLastUpdate = new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(dt) + ' WIB'
      } catch {
        settlementLastUpdate = ''
      }
    }
    if (!settlementLastUpdate && dates.length > 0) {
      const maxDate = dates[dates.length - 1]
      const [y, m, day] = maxDate.split('-')
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
      settlementLastUpdate = `${day} ${months[parseInt(m) - 1]} ${y}`
    }
  }

  const totalCommission = totalRealAdmin
  const totalAdminFee = totalDeductions + totalCommission
  const isCommissionEstimated = totalRealAdmin === 0 && estimatedCommission > 0
  const netDisbursement = Math.max(0, grossRevenue - totalAdminFee)
  const realGrossProfit = Math.max(0, netDisbursement - totalHPP)

  return {
    completedOrders: completed,
    paymentBreakdown,
    bestSellers,
    bestSellersPdf,
    categoryData,
    totalOrders,
    buyOneGetOneTransactions,
    buyOneGetOneGiftUnits,
    successRate,
    cancelledCount: cancelled,
    grossRevenue,
    totalDeductions,
    totalPlatformSubsidy,
    netRevenue,
    totalHPP,
    grossProfit,
    totalAdminFee,
    totalCommission,
    estimatedCommission,
    isCommissionEstimated,
    netDisbursement,
    realGrossProfit,
    totalSettlement,
    totalSettlementGross,
    settlementRate,
    settlementGrossRate,
    totalRealAdmin,
    settlementDateRange,
    settlementLastUpdate,
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
export function filterTableData(
  completedOrders: OrderRow[],
  selectedPaymentMethod: string,
  searchQuery: string,
  receiptFilter: ReceiptFilter = 'all'
) {
  let result = completedOrders
  if (receiptFilter !== 'all') {
    result = result.filter(o => matchesReceiptFilter(o, receiptFilter))
  }
  if (selectedPaymentMethod !== 'all') {
    const targetMethod = selectedPaymentMethod.toLowerCase()
    result = result.filter(o => (o.payment_method || 'unknown').toLowerCase() === targetMethod)
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
export function computeTableFooter(filteredTableData: OrderRow[], settlements: any[] = []) {
  const foodAppsSettlementPromoMap = buildFoodAppsSettlementPromoMap(filteredTableData, settlements)
  const kpiOpts = {
    getSettlementPromo: (order: any) => foodAppsSettlementPromoMap.get(order.id ?? order),
    getGofoodSettlementPromo: (order: any) => foodAppsSettlementPromoMap.get(order.id ?? order),
    gofoodSettlementMap: foodAppsSettlementPromoMap,
  }
  let totalGross = 0
  let totalNet = 0
  let totalOfflineDiscount = 0
  let totalAppSubsidy = 0
  let totalMerchantDeductions = 0
  let totalPlatformSubsidy = 0
  let totalItems = 0

  for (let i = 0; i < filteredTableData.length; i++) {
    const curr = filteredTableData[i]
    totalGross += computeOrderGross(curr, kpiOpts)
    totalNet += Number(curr.total_amount)
    totalOfflineDiscount += Number((curr as any).discount_amount) || 0
    totalAppSubsidy += Number((curr as any).promo_subsidy) || 0
    totalMerchantDeductions += computeOrderDeduction(curr, kpiOpts)
    totalPlatformSubsidy += computeOrderPlatformSubsidy(curr, kpiOpts)
    const items = curr.order_items
    for (let j = 0; j < items.length; j++) {
      totalItems += items[j].quantity
    }
  }
  const totalEcommerceDiscount = Math.max(0, totalGross - totalNet)
  return { totalGross, totalNet, totalOfflineDiscount, totalAppSubsidy, totalMerchantDeductions, totalPlatformSubsidy, totalEcommerceDiscount, totalItems }
}

// Item Breakdown (Rekap)
export function computeItemBreakdown(
  filteredTableData: OrderRow[],
  outlets: { id: string; type?: string | null }[],
  penerapHpp: { untuk(tgl: string): any }
) {
  const map = new Map<string, { name: string; groupLabel: string; qty: number; grossRevenue: number; netRevenue: number; hppPerUnit: number; totalHpp: number }>()
  const outletTypeMap = new Map<string, string>()
  for (let i = 0; i < outlets.length; i++) {
    outletTypeMap.set(outlets[i].id, outlets[i].type || 'outlet')
  }

  for (let i = 0; i < filteredTableData.length; i++) {
    const order = filteredTableData[i]
    const items = order.order_items
    if (!items || items.length === 0) continue

    const outletType = outletTypeMap.get(order.outlet_id)
    const orderChannel = order.channel || order.sales_source

    // Hitung subtotal kotor dari seluruh item di pesanan ini
    let orderSubtotal = 0
    for (let j = 0; j < items.length; j++) {
      orderSubtotal += items[j].subtotal || 0
    }

    // Jika ada diskon/pajak di tingkat pesanan, distribusikan secara proporsional ke tiap item
    const ratio = orderSubtotal > 0 ? (order.total_amount / orderSubtotal) : 1
    const pHpp = penerapHpp.untuk(tanggalWib(order.created_at))

    const srcKey = resolveOrderSource(order.channel, order.sales_source, order.customer_name, order.is_endorse).key
    let groupLabel = 'OFFLINE'
    if (order.outlet_id === 'ss-online' || srcKey.includes('tiktok_shop') || srcKey.includes('shopee_shop')) {
      groupLabel = 'SS ONLINE'
    } else if (srcKey === 'shopeefood' || srcKey === 'grabfood' || srcKey === 'gofood') {
      groupLabel = 'FOOD APPS'
    } else if (srcKey === 'tiktokgo' || srcKey === 'tiktok' || srcKey === 'tiktok_go') {
      groupLabel = 'TIKTOK'
    } else if (srcKey === 'online') {
      groupLabel = 'WEB ONLINE'
    }

    for (let j = 0; j < items.length; j++) {
      const item = items[j]
      const cleanName = cleanItemName(item.menu_item_name)
      const key = `${cleanName}-${groupLabel}`
      const menuItem = pHpp.terapkan(item.menu_items) || (item.menu_item_id ? pHpp.byId.get(item.menu_item_id) : null) || pHpp.byName.get(cleanName)
      const hppPerUnit = getItemHpp(menuItem, outletType, item.menu_item_name, pHpp.byName, orderChannel, item.menu_item_id, pHpp.byId)

      let existing = map.get(key)
      if (!existing) {
        existing = {
          name: cleanName,
          groupLabel,
          qty: 0,
          grossRevenue: 0,
          netRevenue: 0,
          hppPerUnit,
          totalHpp: 0
        }
        map.set(key, existing)
      }

      existing.qty += item.quantity
      existing.grossRevenue += item.subtotal
      existing.netRevenue += (item.subtotal * ratio)
      existing.totalHpp += (hppPerUnit * item.quantity)
      existing.hppPerUnit = existing.qty > 0 ? Math.round(existing.totalHpp / existing.qty) : hppPerUnit
    }
  }

  return Array.from(map.values()).sort((a, b) => b.qty - a.qty)
}
