// @ts-nocheck
/* ── Ekspor Excel/CSV Rangkuman Penjualan khusus finance ──────────────────────
 *
 * Rincian per Tanggal + Outlet + Channel + Item. Dulu dihitung di browser dari
 * seluruh order mentah; kini di server dari data yang sama dengan kartu KPI
 * (lib/posReport/laporan), sehingga Grand Total ekspor = Gross Revenue di layar.
 *
 * Rumus revenue/potongan per order SAMA dengan computeCategoryReport (PDF/CSV
 * admin): gross & potongan order dibagi proporsional ke item, termasuk promo
 * GoFood yang diambil dari settlement GoBiz bila tersedia.
 */

import { cleanItemName } from '@/lib/order-item-name'
import { resolveOrderSource } from '@/lib/order-source'
import { tanggalWib } from '@/lib/hpp/riwayatHpp'
import {
  computeOrderDeduction,
  computeOrderGross,
  computeItemShares,
  buildGofoodSettlementPromoMap,
} from '@/lib/posReportKpi'
import { filterOrdersByChannels, getItemHpp, type OrderRow } from '@/lib/posReport/compute'

export interface SalesExportRow {
  date: string
  outletName: string
  channelName: string
  itemName: string
  unitPrice: number
  hppSatuan: number
  qty: number
  hppTotal: number
  revenue: number
  adminPlatform: number
  grossProfit: number
  marginGpPct: number
}

/** Nama kategori/channel ekspor — sama dengan pengelompokan PDF Kategori. */
export function kategoriEkspor(o: OrderRow): string {
  const srcInfo = resolveOrderSource(o.channel, o.sales_source, o.customer_name, o.is_endorse)
  const srcKey = srcInfo.key.toLowerCase()
  const isTikTok = ['tiktok', 'tiktokgo'].includes(srcKey)
  const isFoodAppSrc = ['gofood', 'grabfood', 'shopeefood', 'generic_food_app', 'food_apps'].includes(srcKey)
  const isPawoon = o.customer_name === 'Pawoon Import' || srcKey === 'pos_pawoon' || srcKey === 'pos'

  if (isPawoon) {
    const items = o.order_items || []
    const hasFA = items.some(item => item.menu_item_name.includes('FA') || item.menu_item_name.includes('FOOD APPS'))
    const hasTikTok = items.some(item => item.menu_item_name.toLowerCase().includes('tiktok'))
    if (isTikTok || hasTikTok) return 'POS Pawoon (TikTok)'
    if (hasFA || isFoodAppSrc) return 'POS Pawoon (Food Apps)'
    return 'POS Pawoon (Offline/Kasir)'
  }
  if (srcKey === 'pos_kasir') return 'POS KASIR (Internal)'
  if (isTikTok) return 'TikTok Go'
  if (isFoodAppSrc) return 'Food Apps (GoFood/Grab/Shopee/dll)'
  if (srcKey === 'online') return 'Website Online'
  if (srcKey === 'tiktok_shop' || srcKey.includes('tiktokshop')) return 'TikTok Shop (Online)'
  if (srcKey === 'shopee_shop' || srcKey.includes('shopeeseller')) return 'Shopee Shop (Online)'
  return srcInfo.label
}

// Salinan cleanOutletName (components/OutletCombobox) — berkas itu 'use client',
// jadi tidak bisa dipanggil dari kode server.
function namaOutletRingkas(name: string) {
  const upper = (name || '').toUpperCase().replace(/^🛒\s*/, '').trim()
  return upper.replace(/^SUKA\s+SHAWARMA\s+/i, '').replace(/^MITRA\s+SUKA\s+/i, 'MITRA ')
}

const jakartaDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' })

export function computeSalesExportRows(
  orders: OrderRow[],
  selectedChannels: string[],
  outlets: { id: string; type?: string | null; name?: string | null }[],
  penerapHpp: { untuk(tgl: string): any },
  isSSOnlineSelected: boolean,
  settlements: any[] = []
): SalesExportRow[] {
  const validOrders = filterOrdersByChannels(orders, selectedChannels)
    .filter(o => o.status === 'completed' || o.status === 'settled')

  const gofoodSettlementPromoMap = buildGofoodSettlementPromoMap(validOrders, settlements)
  const kpiOpts = {
    ssOnlineMode: isSSOnlineSelected,
    getGofoodSettlementPromo: (order: any) => gofoodSettlementPromoMap.get(order.id ?? order),
  }

  const outletTypeMap = new Map<string, string>()
  const outletNameMap = new Map<string, string>()
  outlets.forEach(o => {
    outletTypeMap.set(o.id, o.type || 'outlet')
    if (o.name) outletNameMap.set(o.id, namaOutletRingkas(o.name))
  })
  outletNameMap.set('ss-online', 'SS Online')

  const agg = new Map<string, SalesExportRow>()
  const ambil = (key: string, init: () => SalesExportRow) => {
    let row = agg.get(key)
    if (!row) { row = init(); agg.set(key, row) }
    return row
  }

  for (const o of validOrders) {
    // Tanggal lokal WIB — created_at tersimpan UTC, jadi slice(0,10) akan
    // menggeser order 00:00–06:59 WIB ke tanggal sebelumnya.
    const orderDate = o.created_at ? jakartaDateFmt.format(new Date(o.created_at)) : '-'
    const outletName = outletNameMap.get(o.outlet_id) || '-'
    const channelName = kategoriEkspor(o)
    const outletType = outletTypeMap.get(o.outlet_id)
    const orderGross = computeOrderGross(o, kpiOpts)
    const orderDeduction = computeOrderDeduction(o, kpiOpts)
    const items = o.order_items || []

    if (items.length > 0) {
      const shares = computeItemShares(items)
      const pHpp = penerapHpp.untuk(tanggalWib(o.created_at))
      items.forEach((oi, idx) => {
        const itemName = cleanItemName(oi.menu_item_name)
        const menuItem = pHpp.terapkan(oi.menu_items) || (oi.menu_item_id ? pHpp.byId.get(oi.menu_item_id) : null) || pHpp.byName.get(itemName)
        const hppPerUnit = getItemHpp(menuItem, outletType, oi.menu_item_name, pHpp.byName, o.channel || o.sales_source, oi.menu_item_id, pHpp.byId)
        const itemHpp = hppPerUnit * oi.quantity
        const itemRevenue = shares[idx] * orderGross
        const itemDeduction = shares[idx] * orderDeduction

        const row = ambil(`${orderDate}__${o.outlet_id}__${channelName}__${itemName}`, () => ({
          date: orderDate, outletName, channelName, itemName,
          unitPrice: oi.unit_price || (oi.subtotal / oi.quantity) || 0,
          hppSatuan: hppPerUnit,
          qty: 0, hppTotal: 0, revenue: 0, adminPlatform: 0, grossProfit: 0, marginGpPct: 0,
        }))
        row.qty += oi.quantity
        row.revenue += itemRevenue
        row.hppTotal += itemHpp
        row.adminPlatform += itemDeduction
        row.grossProfit += itemRevenue - itemHpp - itemDeduction
      })
    } else if (orderGross > 0) {
      const itemName = `Order #${o.order_number} (${o.customer_name || 'Pelanggan'})`
      const row = ambil(`${orderDate}__${o.outlet_id}__${channelName}__${itemName}`, () => ({
        date: orderDate, outletName, channelName, itemName,
        unitPrice: orderGross, hppSatuan: 0,
        qty: 0, hppTotal: 0, revenue: 0, adminPlatform: 0, grossProfit: 0, marginGpPct: 0,
      }))
      row.qty += 1
      row.revenue += orderGross
      row.adminPlatform += orderDeduction
      row.grossProfit += orderGross - orderDeduction
    }
  }

  const rows = Array.from(agg.values()).map(r => ({
    ...r,
    unitPrice: r.qty > 0 ? r.revenue / r.qty : r.unitPrice,
    hppSatuan: r.qty > 0 ? r.hppTotal / r.qty : r.hppSatuan,
    marginGpPct: r.revenue > 0 ? (r.grossProfit / r.revenue) * 100 : 0,
  }))

  // Urut: Tanggal (naik), Channel, lalu Revenue (turun)
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.channelName.localeCompare(b.channelName) || b.revenue - a.revenue)
  return rows
}
