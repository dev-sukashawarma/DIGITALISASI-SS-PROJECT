/* ── EOM Closing: tab Kasir & Kas Toko ─────────────────────────────────────
 *
 * PRINSIP: modul ini TIDAK punya rumus omzet/potongan/HPP sendiri. Semua angka
 * berasal dari `@/lib/posReport/compute` (salinan identik rumus Rangkuman
 * Penjualan, dijaga compute.parity.test.ts). Di sini order hanya DIKELOMPOKKAN
 * — per channel dan per periode HPP — lalu fungsi yang sama dipanggil untuk
 * tiap kelompok. Karena rumus itu dihitung per order lalu dijumlahkan,
 * jumlah semua kelompok = angka laporan untuk seluruh bulan.
 */

import { computeAnalytics, computeCategoryReport, type OrderRow, type ShiftRow } from '@/lib/posReport/compute'
import { resolveOrderSource } from '@/lib/order-source'
import { tanggalWib } from '@/lib/hpp/riwayatHpp'

type Penerap = { untuk(tgl: string): any }

export const MITRA_SUFFIX = ' · Mitra (HPP x1,1)'
type OutletLite = { id: string; name: string; type?: string | null }

export interface EomItem {
  name: string
  /** Periode A = sebelum tanggal pergantian HPP; B = sejak tanggal itu. */
  qtyA: number
  hppA: number
  qtyB: number
  hppB: number
  revenue: number
  potongan: number
  labaKotor: number
}

export interface EomChannel {
  key: string
  label: string
  revenue: number
  potongan: number
  hppA: number
  hppB: number
  labaKotor: number
  qty: number
  items: EomItem[]
}

/** Channel sebuah order — sama dengan chip filter channel di Rangkuman Penjualan. */
export function channelOf(o: OrderRow): { key: string; label: string } {
  const src = resolveOrderSource(o.channel, o.sales_source, o.customer_name, o.is_endorse)
  return { key: src.key, label: src.label }
}

/** `cutoff` = tanggal (YYYY-MM-DD, WIB) mulai berlakunya HPP baru; null = tanpa pecahan. */
export function splitByCutoff<T extends { created_at: string }>(orders: T[], cutoff: string | null) {
  if (!cutoff) return { a: orders, b: [] as T[] }
  const a: T[] = []
  const b: T[] = []
  for (const o of orders) (tanggalWib(o.created_at) < cutoff ? a : b).push(o)
  return { a, b }
}

function addReport(
  items: Map<string, EomItem>,
  report: ReturnType<typeof computeCategoryReport>,
  period: 'A' | 'B',
  suffix: string,
) {
  for (const cat of report.categories) {
    for (const it of cat.bestSellers) {
      const name = it.name + suffix
      let cur = items.get(name)
      if (!cur) {
        cur = { name, qtyA: 0, hppA: 0, qtyB: 0, hppB: 0, revenue: 0, potongan: 0, labaKotor: 0 }
        items.set(name, cur)
      }
      if (period === 'A') {
        cur.qtyA += it.qty
        cur.hppA += it.hppTotal
      } else {
        cur.qtyB += it.qty
        cur.hppB += it.hppTotal
      }
      cur.revenue += it.revenue
      cur.potongan += it.adminPlatform
      cur.labaKotor += it.grossProfit
    }
  }
}

/**
 * Omzet, potongan, HPP (dipecah dua periode), laba kotor per channel + rincian menu.
 * Parameter pemanggilan computeCategoryReport sama dengan Rangkuman Penjualan
 * "Semua Cabang / Semua Channel" (selectedChannels ['all'], bukan mode SS Online).
 */
export function buildChannelBreakdown(
  orders: OrderRow[],
  outlets: OutletLite[],
  penerapHpp: Penerap,
  cutoff: string | null,
): EomChannel[] {
  const groups = new Map<string, { label: string; orders: OrderRow[] }>()
  for (const o of orders) {
    const ch = channelOf(o)
    let g = groups.get(ch.key)
    if (!g) {
      g = { label: ch.label, orders: [] }
      groups.set(ch.key, g)
    }
    g.orders.push(o)
  }

  // Menu outlet mitra dipisah barisnya: HPP mitra = HPP x 1,1, jadi kalau
  // digabung, HPP/porsi rata-rata bergeser hanya karena porsi penjualan mitra.
  const mitraIds = new Set(outlets.filter((o) => o.type === 'mitra').map((o) => o.id))

  const result: EomChannel[] = []
  for (const [key, g] of groups) {
    const items = new Map<string, EomItem>()
    const parts: [OrderRow[], string][] = [
      [g.orders.filter((o) => !mitraIds.has(o.outlet_id)), ''],
      [g.orders.filter((o) => mitraIds.has(o.outlet_id)), MITRA_SUFFIX],
    ]
    for (const [partOrders, suffix] of parts) {
      if (partOrders.length === 0) continue
      const { a, b } = splitByCutoff(partOrders, cutoff)
      if (a.length > 0) addReport(items, computeCategoryReport(a, ['all'], outlets, penerapHpp, false), 'A', suffix)
      if (b.length > 0) addReport(items, computeCategoryReport(b, ['all'], outlets, penerapHpp, false), 'B', suffix)
    }

    const list = [...items.values()].sort((x, y) => y.revenue - x.revenue)
    if (list.length === 0) continue // channel tanpa order selesai
    const sum = (f: (i: EomItem) => number) => list.reduce((s, i) => s + f(i), 0)
    result.push({
      key,
      label: g.label,
      revenue: sum((i) => i.revenue),
      potongan: sum((i) => i.potongan),
      hppA: sum((i) => i.hppA),
      hppB: sum((i) => i.hppB),
      labaKotor: sum((i) => i.labaKotor),
      qty: sum((i) => i.qtyA + i.qtyB),
      items: list,
    })
  }
  return result.sort((x, y) => y.revenue - x.revenue)
}

/** Penanda untuk dicek finance (bukan koreksi — angka tidak diubah). */
export function itemFlags(it: EomItem, hasCutoff: boolean): string[] {
  const flags: string[] = []
  const qty = it.qtyA + it.qtyB
  if (qty > 0 && it.hppA + it.hppB === 0) flags.push('HPP kosong')
  if (hasCutoff && it.qtyA > 0 && it.qtyB > 0) {
    const unitA = it.hppA / it.qtyA
    const unitB = it.hppB / it.qtyB
    if (unitA > 0 && Math.abs(unitA - unitB) < 0.5) flags.push('HPP tidak berubah')
  }
  return flags
}

export interface CashOutletRow {
  outletId: string
  outletName: string
  outletType: string
  omzetTunai: number
  shiftCount: number
  /** Shift belum ditutup yang dimulai sebelum hari ini (perlu ditindaklanjuti). */
  shiftBelumTutup: number
  /** Shift hari ini yang masih berjalan — wajar, bukan masalah. */
  shiftBerjalan: number
  shiftExpected: number
  shiftFisik: number
  selisihKasir: number
  setoranDiterima: number
  setoranCount: number
}

/** Shift yang belum ditutup tapi dimulai hari ini = masih berjalan. */
export function isRunningShift(s: { status: string; start_time: string }, today: string) {
  return s.status !== 'closed' && tanggalWib(s.start_time) >= today
}

export interface DepositLite {
  outlet_id: string | null
  amount: number
}

/**
 * Omzet tunai (kartu metode pembayaran Rangkuman Penjualan, per outlet) vs
 * uang fisik tutup shift vs setoran yang dicatat kantor.
 */
export function buildCashRows(
  orders: OrderRow[],
  shifts: ShiftRow[],
  deposits: DepositLite[],
  outlets: OutletLite[],
  analyticsCtx: Omit<Parameters<typeof computeAnalytics>[0], 'orders' | 'shifts' | 'selectedChannels'>,
  /** Tanggal hari ini (YYYY-MM-DD, WIB). */
  today: string,
): CashOutletRow[] {
  const ordersBy = new Map<string, OrderRow[]>()
  for (const o of orders) {
    const list = ordersBy.get(o.outlet_id) ?? []
    list.push(o)
    ordersBy.set(o.outlet_id, list)
  }

  const rows: CashOutletRow[] = []
  for (const outlet of outlets) {
    const outletOrders = ordersBy.get(outlet.id) ?? []
    const outletShifts = shifts.filter((s) => s.outlet_id === outlet.id)
    const outletDeposits = deposits.filter((d) => d.outlet_id === outlet.id)
    if (outletOrders.length === 0 && outletShifts.length === 0 && outletDeposits.length === 0) continue

    const analytics = computeAnalytics({
      ...analyticsCtx,
      orders: outletOrders,
      shifts: outletShifts,
      selectedChannels: ['all'],
    })
    const closed = outletShifts.filter((s) => s.status === 'closed')
    const open = outletShifts.filter((s) => s.status !== 'closed')
    const berjalan = open.filter((s) => isRunningShift(s, today)).length
    rows.push({
      outletId: outlet.id,
      outletName: outlet.name,
      outletType: outlet.type ?? 'outlet',
      omzetTunai: analytics.paymentBreakdown.cash?.revenue ?? 0,
      shiftCount: outletShifts.length,
      shiftBelumTutup: open.length - berjalan,
      shiftBerjalan: berjalan,
      shiftExpected: closed.reduce((s, x) => s + (Number(x.expected_ending_cash) || 0), 0),
      shiftFisik: closed.reduce((s, x) => s + (Number(x.actual_ending_cash) || 0), 0),
      selisihKasir: closed.reduce((s, x) => s + (Number(x.variance) || 0), 0),
      setoranDiterima: outletDeposits.reduce((s, d) => s + (Number(d.amount) || 0), 0),
      setoranCount: outletDeposits.length,
    })
  }
  return rows.sort((x, y) => y.omzetTunai - x.omzetTunai)
}
