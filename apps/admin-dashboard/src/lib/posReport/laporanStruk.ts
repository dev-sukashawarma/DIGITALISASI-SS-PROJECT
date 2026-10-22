// @ts-nocheck
/* ── Inti Laporan Audit Cetak Struk (tanpa 'use server') ──
 *
 * Memanfaatkan infrastruktur cache harian `loadPosReportOrders` dan memo
 * `getPrepared` dari Rangkuman Penjualan sehingga tidak membebani database
 * dengan query duplikat, ditambah pemetaan Area Manager (AM) per outlet.
 */

import { isDateStr, jakartaDate } from '@/lib/ownerDashboardCache'
import { loadPosReportOrders, getEarliestSalesDate, selectReportOrders } from '@/lib/posReport/load'
import { getPrepared, PREPARED_TTL_WITH_TODAY_MS, PREPARED_TTL_PAST_ONLY_MS } from '@/lib/posReport/prepared'
import { computeAvailablePaymentMethods } from '@/lib/posReport/compute'
import {
  computeAvailableRekapStrukChannels,
  computeRekapStrukBase,
  filterRekapStrukOrders,
  toSkipKindFilter,
  type SkipKindFilter,
} from '@/lib/posReport/rekapStruk'
import type { CakupanLaporan } from '@/lib/posReport/laporan'

export type RekapStrukRequest = {
  from: string
  to: string
  outlets: string[]
  channels: string[]
  amFilter?: string
  skipKindFilter?: SkipKindFilter | string
  outletDrilldown?: string
  cashierDrilldown?: string
  paymentMethod?: string
  search?: string
  page?: number
  pageSize?: number
  isPawoonVisible?: boolean
}

const OUTLETS_MEMO_TTL_MS = 60_000
const outletsMemo = new Map<string, { at: number; promise: Promise<any[]> }>()

function getCachedOutletsWithAm(supabase: any, scopeKey: string): Promise<any[]> {
  const hit = outletsMemo.get(scopeKey)
  if (hit && Date.now() - hit.at < OUTLETS_MEMO_TTL_MS) return hit.promise
  const promise = (async () => {
    const [outletsRes, staffOutletsRes, directAmRes] = await Promise.all([
      supabase.from('outlets').select('id, name, type').order('name'),
      supabase
        .from('staff_outlets')
        .select('outlet_id, outlet_staff!inner(id, name, role, status, is_active)')
        .in('outlet_staff.role', ['area_manager', 'regional_manager']),
      supabase
        .from('outlet_staff')
        .select('id, name, role, outlet_id, status, is_active')
        .in('role', ['area_manager', 'regional_manager'])
        .eq('status', 'active'),
    ])

    if (outletsRes.error) throw new Error(`rekapStruk.outlets: ${outletsRes.error.message}`)

    const amMap = new Map<string, Set<string>>()
    const addAm = (outletId: string | null | undefined, name: string | null | undefined) => {
      if (!outletId || !name) return
      const clean = String(name).trim()
      if (!clean) return
      let set = amMap.get(outletId)
      if (!set) {
        set = new Set<string>()
        amMap.set(outletId, set)
      }
      set.add(clean)
    }

    for (const row of staffOutletsRes.data ?? []) {
      const st = row.outlet_staff as any
      if (!st) continue
      if (st.status && st.status !== 'active') continue
      if (st.is_active === false) continue
      addAm(row.outlet_id, st.name)
    }

    for (const st of directAmRes.data ?? []) {
      if (st.is_active === false) continue
      addAm(st.outlet_id, st.name)
    }

    return (outletsRes.data ?? []).map((o: any) => ({
      ...o,
      amName: amMap.has(o.id) ? Array.from(amMap.get(o.id)!).join(', ') : '-',
    }))
  })()
  outletsMemo.set(scopeKey, { at: Date.now(), promise })
  promise.catch(() => {
    if (outletsMemo.get(scopeKey)?.promise === promise) outletsMemo.delete(scopeKey)
  })
  return promise
}

function sanitizeRekapStrukRequest(req: RekapStrukRequest) {
  if (!req || !isDateStr(req.from) || !isDateStr(req.to) || req.from > req.to) {
    throw new Error('Rentang tanggal tidak valid')
  }
  const rawOutlets =
    Array.isArray(req.outlets) && req.outlets.length > 0
      ? req.outlets.map(String).filter((id) => id !== 'ss-online')
      : ['all']
  const outlets = rawOutlets.length > 0 ? rawOutlets : ['all']
  const channels =
    Array.isArray(req.channels) && req.channels.length > 0
      ? req.channels.map(String)
      : ['all']

  return {
    from: req.from,
    to: req.to,
    outlets,
    channels,
    amFilter: typeof req.amFilter === 'string' && req.amFilter ? req.amFilter : 'all',
    skipKindFilter: toSkipKindFilter(req.skipKindFilter),
    outletDrilldown: typeof req.outletDrilldown === 'string' && req.outletDrilldown ? req.outletDrilldown : 'all',
    cashierDrilldown: typeof req.cashierDrilldown === 'string' && req.cashierDrilldown ? req.cashierDrilldown : 'all',
    paymentMethod: typeof req.paymentMethod === 'string' && req.paymentMethod ? req.paymentMethod : 'all',
    search: typeof req.search === 'string' ? req.search.slice(0, 100) : '',
    page: Math.max(1, Math.floor(Number(req.page) || 1)),
    pageSize: Math.min(100, Math.max(1, Math.floor(Number(req.pageSize) || 15))),
    isPawoonVisible: Boolean(req.isPawoonVisible),
  }
}

async function getPreparedRekapStruk(rawReq: RekapStrukRequest, scope: CakupanLaporan) {
  const req = sanitizeRekapStrukRequest(rawReq)
  const { supabase, scopeKey, allowedOutletIds } = scope

  const realOutlets = req.outlets.filter((id) => id !== 'all' && id !== 'ss-online')
  if (allowedOutletIds !== 'all' && realOutlets.some((id) => !allowedOutletIds.includes(id))) {
    throw new Error('Forbidden: outlet not in caller scope')
  }

  const earliest = await getEarliestSalesDate(supabase, scopeKey)
  const from = earliest && req.from < earliest ? earliest : req.from
  const today = jakartaDate(new Date())
  const includesToday = from <= today && today <= req.to

  const key = [
    'rekap-struk-v3',
    scopeKey,
    from,
    req.to,
    today,
    req.outlets.join(','),
    req.channels.join(','),
    req.isPawoonVisible ? 1 : 0,
  ].join('|')
  const ttl = includesToday ? PREPARED_TTL_WITH_TODAY_MS : PREPARED_TTL_PAST_ONLY_MS

  const prepared = await getPrepared(key, ttl, async () => {
    const [ordersRes, outlets] = await Promise.all([
      from <= req.to
        ? loadPosReportOrders(supabase, scopeKey, from, req.to, today)
        : Promise.resolve({
            pos: [],
            ecommerce: [],
            fetchedAt: new Date().toISOString(),
            isCached: true,
          }),
      getCachedOutletsWithAm(supabase, scopeKey),
    ])

    const selectedOrders = selectReportOrders(ordersRes.pos, [], req.outlets)
    const base = computeRekapStrukBase({
      orders: selectedOrders,
      outlets,
      selectedChannels: req.channels,
    })

    return {
      ...base,
      from,
      availableChannels: computeAvailableRekapStrukChannels(req.isPawoonVisible),
      availablePaymentMethods: computeAvailablePaymentMethods(selectedOrders),
      fetchedAt: ordersRes.fetchedAt,
      isCached: ordersRes.isCached,
      derived: new Map<string, any>(),
    }
  })

  return { req, prepared }
}

export async function laporanRekapStrukUntukScope(
  rawReq: RekapStrukRequest,
  scope: CakupanLaporan
) {
  const { req, prepared } = await getPreparedRekapStruk(rawReq, scope)

  const filterKey = JSON.stringify([
    req.skipKindFilter,
    req.outletDrilldown,
    req.amFilter,
    req.cashierDrilldown,
    req.paymentMethod,
    req.search,
  ])

  let derived = prepared.derived.get(filterKey)
  if (!derived) {
    derived = filterRekapStrukOrders({
      completedOrders: prepared.completedOrders,
      skipKindFilter: req.skipKindFilter,
      outletFilter: req.outletDrilldown,
      amFilter: req.amFilter,
      cashierFilter: req.cashierDrilldown,
      paymentMethod: req.paymentMethod,
      searchQuery: req.search,
    })
    if (prepared.derived.size >= 25) {
      prepared.derived.delete(prepared.derived.keys().next().value)
    }
    prepared.derived.set(filterKey, derived)
  }

  const totalRows = derived.rows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / req.pageSize))
  const page = Math.min(req.page, totalPages)
  const pageRows = derived.rows.slice((page - 1) * req.pageSize, page * req.pageSize)

  return {
    summary: prepared.summary,
    outletRecap: prepared.outletRecap,
    cashierRecap: prepared.cashierRecap,
    availableAreaManagers: prepared.availableAreaManagers,
    availableChannels: prepared.availableChannels,
    availablePaymentMethods: prepared.availablePaymentMethods,
    table: {
      rows: pageRows,
      total: totalRows,
      page,
      totalPages,
      totalAmount: derived.totalAmount,
      totalItems: derived.totalItems,
    },
    fetchedAt: prepared.fetchedAt,
    isCached: prepared.isCached,
  }
}

/** Data lengkap untuk ekspor PDF sesuai filter aktif (tanpa pemotongan halaman). */
export async function eksporRekapStrukUntukScope(
  rawReq: RekapStrukRequest,
  scope: CakupanLaporan
) {
  const { req, prepared } = await getPreparedRekapStruk(rawReq, scope)
  const derived = filterRekapStrukOrders({
    completedOrders: prepared.completedOrders,
    skipKindFilter: req.skipKindFilter,
    outletFilter: req.outletDrilldown,
    amFilter: req.amFilter,
    cashierFilter: req.cashierDrilldown,
    paymentMethod: req.paymentMethod,
    searchQuery: req.search,
  })

  return {
    periode: { from: prepared.from, to: req.to },
    summary: prepared.summary,
    cashierRecap: prepared.cashierRecap,
    orders: derived.rows,
    totalOrderAmount: derived.totalAmount,
    totalOrderItems: derived.totalItems,
  }
}
