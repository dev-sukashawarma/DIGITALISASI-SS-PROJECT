// @ts-nocheck
/* ── Rekap per kategori/channel (khusus finance) ──
 *
 * Dipakai PDF "Semua Channel" Rangkuman Penjualan dan EOM Closing (tab Kasir).
 * admin-dashboard menghapus fungsi ini dari lib/posReport/compute.ts (2026-10-09,
 * ekspornya diganti lib/posReport/ekspor); finance tetap memakainya, jadi
 * dipindah ke sini agar compute.ts tetap identik dengan admin (compute.parity.test).
 */

import { cleanItemName } from '@/lib/order-item-name'
import { resolveOrderSource } from '@/lib/order-source'
import {
  computeOrderDeduction,
  computeOrderGross,
  computeItemShares,
  buildGofoodSettlementPromoMap,
} from '@/lib/posReportKpi'
import { tanggalWib } from '@/lib/hpp/riwayatHpp'
import { filterOrdersByChannels, getItemHpp, type OrderRow } from '@/lib/posReport/compute'

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
  penerapHpp: { untuk(tgl: string): any },
  isSSOnlineSelected: boolean,
  settlements: any[] = []
) {
  // 1. Dapatkan valid orders yang sinkron dengan filter channel aktif
  const validOrders = filterOrdersByChannels(orders, selectedChannels)
    .filter(o => o.status === 'completed' || o.status === 'settled')

  const gofoodSettlementPromoMap = buildGofoodSettlementPromoMap(validOrders, settlements)
  const kpiOpts = {
    ssOnlineMode: isSSOnlineSelected,
    getGofoodSettlementPromo: (order: any) => gofoodSettlementPromoMap.get(order.id ?? order),
  }

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

    const orderGross = computeOrderGross(o, kpiOpts)
    const orderTotalDeductions = computeOrderDeduction(o, kpiOpts)
    const itemShares = computeItemShares(o.order_items || [])
    const pHpp = penerapHpp.untuk(tanggalWib(o.created_at))

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

        const menuItem = pHpp.terapkan(oi.menu_items) || (oi.menu_item_id ? pHpp.byId.get(oi.menu_item_id) : null) || pHpp.byName.get(cleanItemName(oi.menu_item_name))
        const hppPerUnit = getItemHpp(menuItem, outletType, oi.menu_item_name, pHpp.byName, o.channel || o.sales_source, oi.menu_item_id, pHpp.byId)
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
