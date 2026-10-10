/* ── Data ekspor PDF & Excel Rangkuman Penjualan ─────────────────────────────
 *
 * Murni (tanpa React/Next/Supabase), dijalankan di server dari data yang sudah
 * dimuat untuk kartu KPI (lib/posReport/laporan). Rumusnya SAMA dengan
 * computeAnalytics di compute.ts, hanya dipecah per outlet × channel × menu:
 *   Gross Revenue = porsi item × computeOrderGross(order)
 *   Potongan      = porsi item × computeOrderDeduction(order)
 *   COGS          = HPP per tanggal order × qty (getItemHpp)
 *   Gross Profit  = Gross Revenue − COGS − Potongan
 * Jumlah seluruh baris = angka kartu di layar (dijaga ekspor.test.ts).
 */

import { cleanItemName } from '@/lib/order-item-name'
import { resolveOrderSource } from '@/lib/order-source'
import { getChannel } from '@/lib/channels'
import {
  buildFoodAppsSettlementPromoMap,
  computeItemShares,
  computeOrderDeduction,
  computeOrderGross,
  computeOrderPlatformSubsidy,
} from '@/lib/posReportKpi'
import { tanggalWib } from '@/lib/hpp/riwayatHpp'
import { filterOrdersByChannels, getItemHpp, type OrderRow } from '@/lib/posReport/compute'

export type GrupChannel = 'Offline' | 'Food Apps' | 'TikTok Go' | 'Website' | 'Aplikasi' | 'SS Online' | 'Lainnya'

export interface Angka {
  trx: number
  qty: number
  gross: number
  potongan: number
  cogs: number
  gp: number
}

export interface EksporOutlet extends Angka {
  id: string
  nama: string
  tipe: string
  batal: number
  subsidi: number
}

export interface EksporChannel extends Angka {
  nama: string
  grup: GrupChannel
  warna: string
}

export interface EksporOutletChannel extends Angka {
  outletId: string
  outlet: string
  channel: string
  grup: GrupChannel
}

export interface EksporItem extends Omit<Angka, 'trx'> {
  outletId: string
  outlet: string
  tipe: string
  channel: string
  grup: GrupChannel
  menu: string
}

export interface EksporHarian extends Angka {
  tanggal: string
}

export interface EksporMenu extends Omit<Angka, 'trx'> {
  menu: string
  outletCount: number
}

export interface EksporPembayaran {
  metode: string
  trx: number
  nominal: number
}

export interface PosExportReport {
  periode: { from: string; to: string }
  total: Angka & { batal: number; subsidi: number; outletCount: number }
  outlets: EksporOutlet[]
  channels: EksporChannel[]
  outletChannels: EksporOutletChannel[]
  items: EksporItem[]
  harian: EksporHarian[]
  menu: EksporMenu[]
  pembayaran: EksporPembayaran[]
}

export const SS_ONLINE_ID = 'ss-online'
const TANPA_RINCIAN = '(Pesanan tanpa rincian item)'
const FOOD_APP_KEYS = new Set(['gofood', 'grabfood', 'shopeefood', 'generic_food_app', 'food_apps'])

const WARNA_FOOD_APP: Record<string, [string, string]> = {
  gofood: ['GoFood', '#00AA13'],
  grabfood: ['GrabFood', '#00B14F'],
  shopeefood: ['ShopeeFood', '#EE4D2D'],
}

/**
 * Nama & grup channel untuk ekspor. Aturan Pawoon/TikTok/Food Apps sama dengan
 * rekap kategori lama, tapi Food Apps kini dipecah per platform.
 */
export function klasifikasiChannel(o: OrderRow): { channel: string; grup: GrupChannel; warna: string } {
  const src = resolveOrderSource(o.channel, o.sales_source, o.customer_name, o.is_endorse)
  const key = src.key.toLowerCase()
  const isTikTok = key === 'tiktok' || key === 'tiktokgo'
  const isFoodApp = FOOD_APP_KEYS.has(key)
  const isPawoon = o.customer_name === 'Pawoon Import' || key === 'pos_pawoon' || key === 'pos'

  if (isPawoon) {
    const hasFA = o.order_items.some(i => i.menu_item_name.includes('FA') || i.menu_item_name.includes('FOOD APPS'))
    const hasTikTok = o.order_items.some(i => i.menu_item_name.toLowerCase().includes('tiktok'))
    if (isTikTok || hasTikTok) return { channel: 'POS Pawoon (TikTok)', grup: 'TikTok Go', warna: '#374151' }
    if (hasFA || isFoodApp) return { channel: 'POS Pawoon (Food Apps)', grup: 'Food Apps', warna: '#B45309' }
    return { channel: 'POS Pawoon (Kasir)', grup: 'Offline', warna: '#701604' }
  }
  if (key === 'pos_kasir') return { channel: 'POS Kasir', grup: 'Offline', warna: '#4A1713' }
  if (key === 'endors') return { channel: 'Endorse', grup: 'Offline', warna: '#C026D3' }
  if (isTikTok) return { channel: 'TikTok Go', grup: 'TikTok Go', warna: '#111827' }
  if (isFoodApp) {
    const [nama, warna] = WARNA_FOOD_APP[key] ?? ['Food Apps (Lainnya)', '#F59E0B']
    return { channel: nama, grup: 'Food Apps', warna }
  }
  if (key === 'online') return { channel: 'Website Online', grup: 'Website', warna: '#F29744' }
  if (key === 'app') return { channel: 'Aplikasi', grup: 'Aplikasi', warna: '#9A3412' }
  if (key === 'tiktok_shop') return { channel: 'TikTok Shop', grup: 'SS Online', warna: '#0F172A' }
  if (key === 'shopee_shop') return { channel: 'Shopee Shop', grup: 'SS Online', warna: '#F05D23' }
  return { channel: src.label, grup: 'Lainnya', warna: '#6B7280' }
}

const TIPE_LABEL: Record<string, string> = { internal: 'Internal', mitra: 'Mitra', marketplace: 'SS Online' }

export function labelMetodeBayar(metode: string | null | undefined): string {
  const k = (metode || 'unknown').toLowerCase()
  if (k === 'cash') return 'Tunai'
  if (k === 'qris') return 'QRIS'
  if (k === 'card') return 'Kartu'
  if (k === 'unknown') return 'Lainnya'
  const ch = getChannel(k)
  if (ch) return ch.label
  return k.toUpperCase()
}

const kosong = (): Angka => ({ trx: 0, qty: 0, gross: 0, potongan: 0, cogs: 0, gp: 0 })
const r2 = (n: number) => Math.round(n * 100) / 100
function bulatkan<T extends object>(x: T): T {
  const y: any = { ...x }
  for (const k of ['gross', 'potongan', 'cogs', 'gp', 'subsidi', 'nominal']) if (typeof y[k] === 'number') y[k] = r2(y[k])
  return y
}

export function computeExportReport(params: {
  orders: OrderRow[]
  selectedChannels: string[]
  outlets: { id: string; type?: string | null; name?: string | null }[]
  penerapHpp: { untuk(tgl: string): any }
  isSSOnlineSelected: boolean
  settlements?: any[]
  periode: { from: string; to: string }
}): PosExportReport {
  const { orders, selectedChannels, outlets, penerapHpp, isSSOnlineSelected, settlements = [], periode } = params

  const byChannel = filterOrdersByChannels(orders, selectedChannels)
  const valid = byChannel.filter(o => o.status === 'completed' || o.status === 'settled')

  const foodAppsSettlementPromoMap = buildFoodAppsSettlementPromoMap(valid, settlements)
  const kpiOpts = {
    ssOnlineMode: isSSOnlineSelected,
    getSettlementPromo: (order: any) => foodAppsSettlementPromoMap.get(order.id ?? order),
    getGofoodSettlementPromo: (order: any) => foodAppsSettlementPromoMap.get(order.id ?? order),
    gofoodSettlementMap: foodAppsSettlementPromoMap,
  }

  const outletMeta = new Map<string, { nama: string; type: string }>()
  outlets.forEach(o => outletMeta.set(o.id, { nama: o.name || 'Outlet tanpa nama', type: o.type || 'outlet' }))
  const infoOutlet = (id: string) => {
    if (id === SS_ONLINE_ID) return { nama: 'SS Online (Marketplace)', type: 'marketplace' }
    return outletMeta.get(id) ?? { nama: 'Outlet tidak dikenal', type: '' }
  }
  const tipeLabel = (type: string) => TIPE_LABEL[type] ?? (type ? type.charAt(0).toUpperCase() + type.slice(1) : '-')

  const outletAgg = new Map<string, EksporOutlet>()
  const channelAgg = new Map<string, EksporChannel>()
  const outletChannelAgg = new Map<string, EksporOutletChannel>()
  const itemAgg = new Map<string, EksporItem>()
  const harianAgg = new Map<string, EksporHarian>()
  const menuAgg = new Map<string, EksporMenu & { outlets: Set<string> }>()
  const bayarAgg = new Map<string, EksporPembayaran>()

  const ambilOutlet = (id: string) => {
    let a = outletAgg.get(id)
    if (!a) {
      const info = infoOutlet(id)
      a = { id, nama: info.nama, tipe: tipeLabel(info.type), batal: 0, subsidi: 0, ...kosong() }
      outletAgg.set(id, a)
    }
    return a
  }

  const tambah = (t: Angka | Omit<Angka, 'trx'>, qty: number, gross: number, potongan: number, cogs: number) => {
    t.qty += qty
    t.gross += gross
    t.potongan += potongan
    t.cogs += cogs
    t.gp += gross - cogs - potongan
  }

  const total = { ...kosong(), batal: 0, subsidi: 0, outletCount: 0 }

  for (const o of valid) {
    const outlet = ambilOutlet(o.outlet_id)
    const ch = klasifikasiChannel(o)
    const tgl = tanggalWib(o.created_at)
    const pHpp = penerapHpp.untuk(tgl)
    const outletType = infoOutlet(o.outlet_id).type
    const orderChannel = o.channel || o.sales_source

    const orderGross = computeOrderGross(o as any, kpiOpts)
    const orderPotongan = computeOrderDeduction(o as any, kpiOpts)
    const subsidi = o.outlet_id === SS_ONLINE_ID ? 0 : computeOrderPlatformSubsidy(o as any, kpiOpts)

    let channelRow = channelAgg.get(ch.channel)
    if (!channelRow) {
      channelRow = { nama: ch.channel, grup: ch.grup, warna: ch.warna, ...kosong() }
      channelAgg.set(ch.channel, channelRow)
    }
    const ocKey = `${o.outlet_id}|${ch.channel}`
    let ocRow = outletChannelAgg.get(ocKey)
    if (!ocRow) {
      ocRow = { outletId: o.outlet_id, outlet: outlet.nama, channel: ch.channel, grup: ch.grup, ...kosong() }
      outletChannelAgg.set(ocKey, ocRow)
    }
    let hRow = harianAgg.get(tgl)
    if (!hRow) {
      hRow = { tanggal: tgl, ...kosong() }
      harianAgg.set(tgl, hRow)
    }
    const barisOrder = [total, outlet, channelRow, ocRow, hRow]
    for (const t of barisOrder) t.trx += 1
    total.subsidi += subsidi
    outlet.subsidi += subsidi

    const metode = labelMetodeBayar(o.payment_method)
    const bayar = bayarAgg.get(metode) ?? { metode, trx: 0, nominal: 0 }
    bayar.trx += 1
    bayar.nominal += Number(o.total_amount) || 0
    bayarAgg.set(metode, bayar)

    const items = o.order_items || []
    const shares = computeItemShares(items as any)

    const catatItem = (menu: string, qty: number, gross: number, potongan: number, cogs: number) => {
      const iKey = `${o.outlet_id}|${ch.channel}|${menu}`
      let iRow = itemAgg.get(iKey)
      if (!iRow) {
        iRow = { outletId: o.outlet_id, outlet: outlet.nama, tipe: outlet.tipe, channel: ch.channel, grup: ch.grup, menu, qty: 0, gross: 0, potongan: 0, cogs: 0, gp: 0 }
        itemAgg.set(iKey, iRow)
      }
      let mRow = menuAgg.get(menu)
      if (!mRow) {
        mRow = { menu, outletCount: 0, outlets: new Set(), qty: 0, gross: 0, potongan: 0, cogs: 0, gp: 0 }
        menuAgg.set(menu, mRow)
      }
      mRow.outlets.add(o.outlet_id)
      for (const t of [...barisOrder, iRow, mRow]) tambah(t, qty, gross, potongan, cogs)
    }

    if (items.length > 0) {
      items.forEach((oi, idx) => {
        const menuItem = pHpp.terapkan(oi.menu_items) || (oi.menu_item_id ? pHpp.byId.get(oi.menu_item_id) : null) || pHpp.byName.get(cleanItemName(oi.menu_item_name))
        const hpp = getItemHpp(menuItem, outletType, oi.menu_item_name, pHpp.byName, orderChannel, oi.menu_item_id, pHpp.byId)
        const qty = Number(oi.quantity) || 0
        catatItem(cleanItemName(oi.menu_item_name), qty, shares[idx] * orderGross, shares[idx] * orderPotongan, hpp * qty)
      })
    } else if (orderGross > 0 || orderPotongan > 0) {
      catatItem(TANPA_RINCIAN, 0, orderGross, orderPotongan, 0)
    }
  }

  for (const o of byChannel) {
    if (o.status !== 'cancelled') continue
    ambilOutlet(o.outlet_id).batal += 1
    total.batal += 1
  }

  const outletList = [...outletAgg.values()].sort((a, b) => b.gross - a.gross || a.nama.localeCompare(b.nama))
  const urutanOutlet = new Map(outletList.map((o, i) => [o.id, i]))
  const urutOutlet = (a: string, b: string) => (urutanOutlet.get(a) ?? 0) - (urutanOutlet.get(b) ?? 0)

  const outletChannels = [...outletChannelAgg.values()].sort((a, b) => urutOutlet(a.outletId, b.outletId) || b.gross - a.gross)
  const urutanOc = new Map(outletChannels.map((r, i) => [`${r.outletId}|${r.channel}`, i]))
  const items = [...itemAgg.values()].sort((a, b) =>
    (urutanOc.get(`${a.outletId}|${a.channel}`) ?? 0) - (urutanOc.get(`${b.outletId}|${b.channel}`) ?? 0) ||
    b.qty - a.qty || b.gross - a.gross || a.menu.localeCompare(b.menu)
  )

  total.outletCount = outletList.length

  return {
    periode,
    total: bulatkan(total),
    outlets: outletList.map(bulatkan),
    channels: [...channelAgg.values()].sort((a, b) => b.gross - a.gross).map(bulatkan),
    outletChannels: outletChannels.map(bulatkan),
    items: items.map(bulatkan),
    harian: [...harianAgg.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal)).map(bulatkan),
    menu: [...menuAgg.values()]
      .map(({ outlets: s, ...m }) => bulatkan({ ...m, outletCount: s.size }))
      .sort((a, b) => b.qty - a.qty || b.gross - a.gross),
    pembayaran: [...bayarAgg.values()].sort((a, b) => b.nominal - a.nominal).map(bulatkan),
  }
}
