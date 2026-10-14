// @ts-nocheck
/* ── Inti Rangkuman Penjualan (tanpa 'use server') ──
 *
 * HANYA dipanggil kode server. Pemanggil WAJIB menyerahkan cakupan yang sudah
 * diverifikasi: sesi cookie lewat app/actions/posReport.ts, atau kunci Hermes
 * lewat lib/hermes/server. JANGAN diekspor ulang dari berkas 'use server' —
 * setiap ekspor di sana adalah endpoint POST publik (dijaga posReport.pintu.test.ts).
 */

import { ambilRiwayatHpp } from '@/lib/hpp/riwayatHpp'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'
import { eachDateInclusive, isDateStr, jakartaDate, jakartaRangeIso } from '@/lib/ownerDashboardCache'
import { loadPosReportOrders, getEarliestSalesDate, posReportDayTag, clearPosReportTodayMemo, selectReportOrders } from '@/lib/posReport/load'
import { getPrepared, clearPrepared, PREPARED_TTL_WITH_TODAY_MS, PREPARED_TTL_PAST_ONLY_MS } from '@/lib/posReport/prepared'
import { fetchAllPages } from '@/lib/fetchAllPages'
import {
  buildMenuMaps,
  buildPenerapHpp,
  computeAnalytics,
  computeAvailableChannels,
  computeAvailablePaymentMethods,
  computeItemBreakdown,
  computeTableFooter,
  filterTableData,
} from '@/lib/posReport/compute'
import { computeExportReport } from '@/lib/posReport/ekspor'

/** Cakupan outlet pemanggil. 'all' = akses penuh (owner/admin/... atau kunci Hermes). */
export type CakupanLaporan = { supabase: any; scopeKey: string; allowedOutletIds: 'all' | string[] }

export type PosReportRequest = {
  from: string
  to: string
  outlets: string[]
  channels: string[]
  paymentMethod: string
  search: string
  page: number
  pageSize: number
  isPawoonVisible: boolean
}

const SHIFT_SELECT = 'id, outlet_id, start_time, end_time, status, starting_cash, expected_ending_cash, actual_ending_cash, variance, expected_ending_petty_cash, actual_ending_petty_cash, petty_cash_variance'
const MENU_SELECT = 'id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp))'
const SETTLEMENT_SELECT = 'id, outlet_id, platform, tanggal, omzet_kotor, promo_merchant, commission'

// Master menu (±90 baris) dipakai setiap interaksi (ketik cari, ganti halaman);
// memo singkat agar tidak ditarik ulang tiap kali. 60 detik = perubahan HPP
// tetap terlihat dalam semenit. Peta nama/ID dan penerapHpp ikut di-memo agar
// cache per-tanggal `penerapHpp.untuk(tgl)` bertahan lintas permintaan.
const MENU_MEMO_TTL_MS = 60_000
type MenuMemoEntry = {
  menuItems: any[]
  riwayat: any[]
  outlets: any[]
  menuItemByNameMap: Map<string, any>
  menuItemByIdMap: Map<string, any>
  penerapHpp: ReturnType<typeof buildPenerapHpp>
}
const menuMemo = new Map<string, { at: number; promise: Promise<MenuMemoEntry> }>()
function getMenuItems(supabase: any, scopeKey: string): Promise<MenuMemoEntry> {
  const hit = menuMemo.get(scopeKey)
  if (hit && Date.now() - hit.at < MENU_MEMO_TTL_MS) return hit.promise
  const promise = (async () => {
    const [{ data, error }, riwayat, outletsRes] = await Promise.all([
      supabase.from('menu_items').select(MENU_SELECT),
      ambilRiwayatHpp(supabase),
      supabase.from('outlets').select('id, type, name'),
    ])
    if (error) throw new Error(`posReport.menu_items: ${error.message}`)
    if (outletsRes?.error) throw new Error(`posReport.outlets: ${outletsRes.error.message}`)
    const menuItems = data ?? []
    const outlets = outletsRes?.data ?? []
    const { menuItemByNameMap, menuItemByIdMap } = buildMenuMaps(menuItems)
    const penerapHpp = buildPenerapHpp(menuItems, riwayat)
    return { menuItems, riwayat, outlets, menuItemByNameMap, menuItemByIdMap, penerapHpp }
  })()
  menuMemo.set(scopeKey, { at: Date.now(), promise })
  promise.catch(() => { if (menuMemo.get(scopeKey)?.promise === promise) menuMemo.delete(scopeKey) })
  return promise
}

const RANGE_AUX_TTL_MS = 20_000
const rangeAuxMemo = new Map<string, { at: number; promise: Promise<{ allShifts: any[]; allSettlements: any[] }> }>()
function getRangeAux(supabase: any, scopeKey: string, from: string, to: string) {
  const key = `${scopeKey}|${from}|${to}`
  const hit = rangeAuxMemo.get(key)
  if (hit && Date.now() - hit.at < RANGE_AUX_TTL_MS) return hit.promise
  const { fromIso, toIso } = jakartaRangeIso(from, to)
  const promise = (async () => {
    const [shiftsRes, allSettlements] = await Promise.all([
      supabase
        .from('shifts')
        .select(SHIFT_SELECT)
        .neq('outlet_id', TEST_OUTLET_ID)
        .eq('status', 'closed')
        .gte('end_time', fromIso)
        .lte('end_time', toIso)
        .order('end_time', { ascending: false }),
      fetchAllPages<any>(() =>
        supabase
          .from('platform_settlements')
          .select(SETTLEMENT_SELECT)
          .gte('tanggal', from)
          .lte('tanggal', to)
          .order('id', { ascending: true })
      ),
    ])
    if (shiftsRes.error) throw new Error(`posReport.shifts: ${shiftsRes.error.message}`)
    return {
      allShifts: shiftsRes.data ?? [],
      allSettlements,
    }
  })()
  if (rangeAuxMemo.size >= 16) {
    const oldestKey = rangeAuxMemo.keys().next().value
    if (oldestKey) rangeAuxMemo.delete(oldestKey)
  }
  rangeAuxMemo.set(key, { at: Date.now(), promise })
  promise.catch(() => { if (rangeAuxMemo.get(key)?.promise === promise) rangeAuxMemo.delete(key) })
  return promise
}

function sanitizeRequest(req: PosReportRequest) {
  if (!req || !isDateStr(req.from) || !isDateStr(req.to) || req.from > req.to) {
    throw new Error('Rentang tanggal tidak valid')
  }
  const outlets = Array.isArray(req.outlets) && req.outlets.length > 0 ? req.outlets.map(String) : ['all']
  const channels = Array.isArray(req.channels) && req.channels.length > 0 ? req.channels.map(String) : ['all']
  return {
    from: req.from,
    to: req.to,
    outlets,
    channels,
    paymentMethod: typeof req.paymentMethod === 'string' ? req.paymentMethod : 'all',
    search: typeof req.search === 'string' ? req.search.slice(0, 100) : '',
    page: Math.max(1, Math.floor(Number(req.page) || 1)),
    pageSize: Math.min(100, Math.max(1, Math.floor(Number(req.pageSize) || 10))),
    isPawoonVisible: !!req.isPawoonVisible,
  }
}

/** Data mentah + master yang dibutuhkan rumus, sudah difilter outlet. */
async function loadReportContext(
  req: ReturnType<typeof sanitizeRequest>,
  scope: CakupanLaporan,
  from: string
) {
  const { supabase, scopeKey } = scope
  const today = jakartaDate(new Date())
  const to = req.to

  const isSSOnlineSelected = req.outlets.length === 1 && req.outlets[0] === 'ss-online'
  const includeAll = req.outlets.includes('all')
  const realOutlets = req.outlets.filter((id) => id !== 'all' && id !== 'ss-online')

  const [ordersRes, menuCtx, auxRes] = await Promise.all([
    from <= to ? loadPosReportOrders(supabase, scopeKey, from, to, today) : Promise.resolve({ pos: [], ecommerce: [], fetchedAt: new Date().toISOString(), isCached: true }),
    getMenuItems(supabase, scopeKey),
    getRangeAux(supabase, scopeKey, req.from, req.to),
  ])

  const outlets = menuCtx.outlets
  const realOutletSet = includeAll ? null : new Set(realOutlets)
  const shifts = includeAll
    ? auxRes.allShifts
    : auxRes.allShifts.filter((s: any) => realOutletSet!.has(s.outlet_id))

  let settlements = auxRes.allSettlements
  if (isSSOnlineSelected) {
    const ssOnlineSet = new Set(outlets.filter((o: any) => o.type === 'marketplace').map((o: any) => o.id))
    settlements = auxRes.allSettlements.filter((s: any) => ssOnlineSet.has(s.outlet_id))
  } else if (!includeAll) {
    settlements = auxRes.allSettlements.filter((s: any) => realOutletSet!.has(s.outlet_id))
  }

  const orders = selectReportOrders(ordersRes.pos, ordersRes.ecommerce, req.outlets)

  return {
    orders,
    shifts,
    settlements,
    outlets,
    menuItemByNameMap: menuCtx.menuItemByNameMap,
    menuItemByIdMap: menuCtx.menuItemByIdMap,
    penerapHpp: menuCtx.penerapHpp,
    isSSOnlineSelected,
    fetchedAt: ordersRes.fetchedAt,
    isCached: ordersRes.isCached,
  }
}

/**
 * Tahap berat (data + kartu KPI), dimemo per (cakupan, rentang, outlet,
 * channel) — lihat lib/posReport/prepared. Hasilnya dipakai ulang oleh setiap
 * interaksi tabel (halaman, cari, metode bayar) yang tidak mengubah kunci itu.
 */
async function getPreparedReport(rawReq: PosReportRequest, scope: CakupanLaporan) {
  const req = sanitizeRequest(rawReq)
  // Cek login + cakupan outlet tetap dijalankan di SETIAP permintaan —
  // memo tidak boleh jadi jalan pintas melewati otorisasi.
  const { supabase, scopeKey, allowedOutletIds } = scope

  const realOutlets = req.outlets.filter((id) => id !== 'all' && id !== 'ss-online')
  if (allowedOutletIds !== 'all' && realOutlets.some((id) => !allowedOutletIds.includes(id))) {
    throw new Error('Forbidden: outlet not in caller scope')
  }

  // "Semua Waktu" dikirim sebagai 2000-01-01 — mulai dari order pertama saja.
  const earliest = await getEarliestSalesDate(supabase, scopeKey)
  const from = earliest && req.from < earliest ? earliest : req.from
  const today = jakartaDate(new Date())
  const includesToday = from <= today && today <= req.to

  // `today` ikut kunci: lewat tengah malam, rentang yang sama harus dihitung ulang.
  const key = [scopeKey, from, req.to, today, req.outlets.join(','), req.channels.join(','), req.isPawoonVisible ? 1 : 0].join('|')
  const ttl = includesToday ? PREPARED_TTL_WITH_TODAY_MS : PREPARED_TTL_PAST_ONLY_MS

  const prepared = await getPrepared(key, ttl, async () => {
    const ctx = await loadReportContext(req, scope, from)
    const analytics = computeAnalytics({
      orders: ctx.orders,
      shifts: ctx.shifts,
      selectedChannels: req.channels,
      menuItemByNameMap: ctx.menuItemByNameMap,
      menuItemByIdMap: ctx.menuItemByIdMap,
      penerapHpp: ctx.penerapHpp,
      settlements: ctx.settlements,
      isSSOnlineSelected: ctx.isSSOnlineSelected,
      outlets: ctx.outlets,
    })
    return {
      ...ctx,
      from,
      analytics,
      availableChannels: computeAvailableChannels(ctx.orders, req.isPawoonVisible),
      availablePaymentMethods: computeAvailablePaymentMethods(ctx.orders),
      // Hasil turunan per filter tabel (bayar + cari), dipakai ulang saat
      // hanya halaman tabel yang berganti.
      derived: new Map<string, any>(),
      exportReport: null as any,
    }
  })
  return { req, prepared }
}

export async function laporanPosUntukScope(rawReq: PosReportRequest, scope: CakupanLaporan) {
  const { req, prepared } = await getPreparedReport(rawReq, scope)

  const filterKey = JSON.stringify([req.paymentMethod, req.search])
  let derived = prepared.derived.get(filterKey)
  if (!derived) {
    const tableRows = filterTableData(prepared.analytics.completedOrders, req.paymentMethod, req.search)
    derived = {
      tableRows,
      footer: computeTableFooter(tableRows, prepared.settlements),
      itemBreakdown: computeItemBreakdown(tableRows, prepared.outlets, prepared.penerapHpp),
    }
    // Batasi: pencarian yang diketik huruf demi huruf menghasilkan banyak kunci.
    if (prepared.derived.size >= 20) prepared.derived.delete(prepared.derived.keys().next().value)
    prepared.derived.set(filterKey, derived)
  }

  const { tableRows } = derived
  const totalPages = Math.max(1, Math.ceil(tableRows.length / req.pageSize))
  const page = Math.min(req.page, totalPages)
  const pageRows = tableRows.slice((page - 1) * req.pageSize, page * req.pageSize)

  const { completedOrders, ...summary } = prepared.analytics

  return {
    analytics: { ...summary, completedCount: completedOrders.length },
    availableChannels: prepared.availableChannels,
    availablePaymentMethods: prepared.availablePaymentMethods,
    table: {
      rows: pageRows,
      total: tableRows.length,
      page,
      totalPages,
      footer: derived.footer,
    },
    itemBreakdown: derived.itemBreakdown,
    shifts: prepared.shifts,
    orderCount: prepared.orders.length,
    fetchedAt: prepared.fetchedAt,
    isCached: prepared.isCached,
  }
}

/** Data ekspor PDF & Excel (per outlet × channel × menu) — hanya dihitung saat tombol ditekan. */
export async function eksporLaporanPosUntukScope(rawReq: PosReportRequest, scope: CakupanLaporan) {
  const { req, prepared } = await getPreparedReport(rawReq, scope)
  if (!prepared.exportReport) {
    prepared.exportReport = computeExportReport({
      orders: prepared.orders,
      selectedChannels: req.channels,
      outlets: prepared.outlets,
      penerapHpp: prepared.penerapHpp,
      isSSOnlineSelected: prepared.isSSOnlineSelected,
      settlements: prepared.settlements,
      periode: { from: prepared.from, to: req.to },
    })
  }
  return prepared.exportReport
}

export function clearMenuMemo() {
  menuMemo.clear()
  rangeAuxMemo.clear()
}
