// @ts-nocheck
'use server'

import { cookies } from 'next/headers'
import { unstable_cache, revalidateTag } from 'next/cache'
import { db } from '@/lib/supabase/server'
import { createSupabaseServerClient } from '@suka/auth'
import type { PeriodFilterValue, SalesSource, SalesSummaryRow, Outlet } from '@/lib/types'
import type { SalesHourlyRow } from '@/hooks/useSalesHourly'
import type { PettyCashTransaction, DailyPettyCashSummary } from '@/components/owner/PettyCashReportView'
import type { AttendanceRecordExt } from '@/components/owner/AttendanceReportView'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

function cleanItemName(name: string) {
  if (!name) return ''
  return name.trim()
}

/** Ringkasan hadiah B1G1 untuk kartu Ringkasan Bisnis.
 * Reward disimpan sebagai order_item tersendiri agar jumlah porsi yang keluar
 * tetap akurat, sedangkan omzet tetap hanya berasal dari baris berbayar.
 */
export async function getBuyOneGetOneSummary(filter: PeriodFilterValue) {
  if (filter.outletId === 'ss-online' || (filter.source !== 'all' && filter.source.toLowerCase() !== 'pos')) {
    return { transactions: 0, giftUnits: 0 }
  }

  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })
  const fromStart = new Date(`${filter.from}T00:00:00.000+07:00`).toISOString()
  const toEnd = new Date(`${filter.to}T23:59:59.999+07:00`).toISOString()
  const orders: any[] = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    let query = supabase
      .from('orders')
      .select('id, order_items!inner(quantity, is_promo_reward)')
      .neq('outlet_id', TEST_OUTLET_ID)
      .eq('status', 'completed')
      .eq('order_items.is_promo_reward', true)
      .gte('created_at', fromStart)
      .lte('created_at', toEnd)
      .range(offset, offset + pageSize - 1)

    if (filter.outletId !== 'all') query = query.eq('outlet_id', filter.outletId)
    const { data, error } = await query
    if (error) throw new Error(`getBuyOneGetOneSummary: ${error.message}`)
    const page = data ?? []
    orders.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }

  return {
    transactions: new Set(orders.map((order: any) => order.id)).size,
    giftUnits: orders.reduce(
      (sum: number, order: any) => sum + (order.order_items || []).reduce(
        (itemSum: number, item: any) => itemSum + Number(item.quantity || 0),
        0
      ),
      0
    )
  }
}

async function fetchEcommerceOwnerData(
  supabase: any,
  fromStart: Date,
  toEnd: Date,
  sourceFilter: SalesSource = 'all'
) {
  if (sourceFilter === 'pos' || sourceFilter === 'endors') {
    return {
      kpiRows: [],
      hourlyRows: [],
      menuRows: [],
      totalCogs: 0,
      totalOpex: 0,
    }
  }

  const fromIso = fromStart.toISOString()
  const toIso = toEnd.toISOString()
  const ecommerceSalesList: any[] = []
  let offset = 0
  const PAGE_SIZE = 1000

  // `order_date` disimpan sebagai tengah malam tiap hari, jadi 1.377 baris hanya
  // punya ~30 timestamp unik (sampai 75 baris kembar dalam satu hari). Mengurut
  // hanya dengan kolom itu membuat paginasi tidak deterministik: tiap halaman
  // adalah query terpisah, dan urutan di dalam kelompok kembar bisa berbeda
  // antar-query, sehingga sebagian baris terhitung dua kali dan sebagian
  // terlewat. `id` unik dipakai sebagai pemecah seri.
  //
  // Query juga dibangun ulang tiap halaman — builder Supabase bersifat mutable,
  // memakai ulang satu instance untuk beberapa `.range()` rapuh.
  const buildEcommerceQuery = () => supabase
    .from('ecommerce_sales')
    .select('id, channel_id, order_id, order_date, total_amount, raw_data, ecommerce_sale_items(id, quantity, price, subtotal, menu_id, menu_items:menu_id(name, hpp_override, channel_hpp))')
    .gte('order_date', fromIso)
    .lte('order_date', toIso)
    .order('order_date', { ascending: true })
    .order('id', { ascending: true })

  while (true) {
    const { data: page, error } = await buildEcommerceQuery().range(offset, offset + PAGE_SIZE - 1)
    if (error) {
      console.error('fetchEcommerceOwnerData error:', error)
      break
    }
    if (!page || page.length === 0) break
    ecommerceSalesList.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  const kpiMap = new Map<string, SalesSummaryRow & { total_deductions?: number }>()
  const hourMap = new Map<number, SalesHourlyRow>()
  for (let i = 0; i < 24; i++) {
    hourMap.set(i, { sales_hour: i, omzet: 0, jumlah_order_completed: 0 })
  }
  const menuMap = new Map<string, { name: string; qty: number; revenue: number }>()
  let totalCogs = 0

  for (const saleRecord of ecommerceSalesList) {
    const raw = saleRecord.raw_data || {}
    const totalPotongan = Math.abs(Number(raw.total_potongan || raw.admin_fee || raw.discount_amount) || 0)
    const omzetKotor = Number(saleRecord.total_amount) || 0
    const omzetNet = Math.max(0, omzetKotor - totalPotongan)

    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(saleRecord.order_date))
    const hourStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).format(new Date(saleRecord.order_date))
    const hour = parseInt(hourStr, 10) || 0

    const chNorm = (saleRecord.channel_id || '').toLowerCase()
    let salesSource: SalesSource = 'online'
    if (chNorm.includes('tiktok') || chNorm === 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5') {
      salesSource = 'tiktok_shop' as SalesSource
    } else if (chNorm.includes('shopee') || chNorm === 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584') {
      salesSource = 'shopee_shop' as SalesSource
    }

    if (sourceFilter !== 'all') {
      const sf = sourceFilter.toLowerCase()
      if (sf === 'pos') continue
      if (sf.includes('tiktok') && salesSource !== 'tiktok_shop') continue
      if (sf.includes('shopee') && salesSource !== 'shopee_shop') continue
    }

    const kpiKey = `ss-online|${salesSource}|${dateStr}`
    const existingKpi = kpiMap.get(kpiKey) || {
      outlet_id: 'ss-online',
      outlet_name: 'SS ONLINE',
      sales_source: salesSource,
      sales_date: dateStr,
      omzet: 0,
      jumlah_order_completed: 0,
      jumlah_order_all: 0,
      total_deductions: 0
    }
    existingKpi.omzet += omzetNet
    existingKpi.jumlah_order_completed += 1
    existingKpi.jumlah_order_all += 1
    existingKpi.total_deductions = (existingKpi.total_deductions || 0) + totalPotongan
    kpiMap.set(kpiKey, existingKpi)

    const curHour = hourMap.get(hour) || { sales_hour: hour, omzet: 0, jumlah_order_completed: 0 }
    curHour.omzet += omzetNet
    curHour.jumlah_order_completed += 1
    hourMap.set(hour, curHour)

    let orderQty = 0
    for (const item of (saleRecord.ecommerce_sale_items || [])) {
      const menuName = item.menu_items?.name || 'Unknown Menu'
      const cleanName = cleanItemName(menuName) || menuName
      const qty = Number(item.quantity) || 0
      orderQty += qty
      const revenue = Number(item.subtotal) || (Number(item.price) * qty) || 0

      const curMenu = menuMap.get(cleanName) || { name: cleanName, qty: 0, revenue: 0 }
      curMenu.qty += qty
      curMenu.revenue += revenue
      menuMap.set(cleanName, curMenu)

      const mi = item.menu_items
      let itemHpp = 0
      if (mi) {
        let channelHppVal: number | null = null
        if (mi.channel_hpp && typeof mi.channel_hpp === 'object') {
          channelHppVal = mi.channel_hpp.ss_online ?? mi.channel_hpp.tiktok_shop ?? mi.channel_hpp.shopee_shop ?? mi.channel_hpp[chNorm] ?? null
        }
        if (channelHppVal !== null && channelHppVal !== undefined && Number(channelHppVal) > 0) {
          itemHpp = Number(channelHppVal)
        } else if (mi.hpp_override !== null && mi.hpp_override !== undefined && Number(mi.hpp_override) > 0) {
          itemHpp = Number(mi.hpp_override)
        } else if (mi.is_package && Array.isArray(mi.package_items)) {
          itemHpp = mi.package_items.reduce((sum: number, pkg: any) => {
            const compHpp = Number(pkg.component?.hpp_override || 0)
            const pQty = Number(pkg.quantity || 1)
            return sum + compHpp * pQty
          }, 0)
        }
      }
      totalCogs += qty * itemHpp
    }
    existingKpi.total_qty = (existingKpi.total_qty || 0) + orderQty
  }

  return {
    kpiRows: Array.from(kpiMap.values()),
    hourlyRows: Array.from(hourMap.values()).sort((a, b) => a.sales_hour - b.sales_hour),
    menuRows: Array.from(menuMap.values()),
    totalCogs,
    totalOpex: 0,
  }
}

export async function getOwnerDashboardData(filter: PeriodFilterValue, outlets: Outlet[]) {
  return getOwnerDashboardDataFast(filter, outlets)
}

export async function revalidateOwnerDashboardCache() {
  revalidateTag('owner-dashboard')
}

const FULL_ACCESS_ROLES = ['admin', 'admin_hr', 'owner', 'spv', 'regional_manager', 'kitchen', 'admin_finance', 'purchasing']

/** Menentukan scope outlet caller berdasarkan sesi login (bukan service-role),
 * supaya auth.uid() terisi di dalam RPC SECURITY DEFINER dan accessible_outlet_ids()
 * ikut memfilter. scopeKey dipakai sebagai bagian kunci cache agar user dengan
 * scope berbeda tidak saling membaca cache satu sama lain.
 */
async function resolveCallerScope() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: staff, error: staffError } = await supabase
    .from('outlet_staff')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (staffError) throw new Error(`resolveCallerScope: ${staffError.message}`)

  if (staff?.role && FULL_ACCESS_ROLES.includes(staff.role)) {
    return { supabase, scopeKey: 'all', allowedOutletIds: 'all' as const }
  }

  const { data: outletIds, error: outletIdsError } = await supabase.rpc('accessible_outlet_ids')
  if (outletIdsError) throw new Error(`resolveCallerScope: ${outletIdsError.message}`)

  const allowedOutletIds: string[] = (outletIds ?? []).map((id: any) => String(id)).sort()
  return { supabase, scopeKey: allowedOutletIds.join(','), allowedOutletIds }
}

/* ── Penggabungan dua potongan periode yang saling lepas (disjoint) ──────
 * Dipakai split-range cache: bagian "hari lampau" (beku, boleh di-cache lama)
 * dijumlahkan dengan bagian "hari ini" (harus selalu segar). Seluruh agregat
 * di sini aditif terhadap rentang tanggal yang tidak beririsan:
 *  - kpi_rows  : kunci (outlet, source, tanggal) — tanggal beda → cukup concat
 *  - hourly    : dijumlahkan per jam
 *  - menu      : dijumlahkan per nama menu
 *  - cogs/opex : jumlah biasa
 *  - bogo_transactions: COUNT(DISTINCT order_id); satu order hanya milik satu
 *    tanggal, jadi jumlah dari dua rentang lepas = distinct count gabungannya.
 */
function sumByKey<T>(rows: T[], key: (r: T) => string | number, fields: string[]) {
  const map = new Map<string | number, any>()
  for (const r of rows) {
    const k = key(r)
    const cur = map.get(k)
    if (!cur) {
      map.set(k, { ...r })
      continue
    }
    for (const f of fields) cur[f] = Number(cur[f] || 0) + Number((r as any)[f] || 0)
  }
  return Array.from(map.values())
}

function mergeSummaryResult(a: any, b: any) {
  if (!a) return b
  if (!b) return a
  return {
    kpi_rows: [...(a.kpi_rows ?? []), ...(b.kpi_rows ?? [])],
    hourly_rows: sumByKey(
      [...(a.hourly_rows ?? []), ...(b.hourly_rows ?? [])],
      (r: any) => r.sales_hour,
      ['omzet', 'order_count']
    ).sort((x: any, y: any) => x.sales_hour - y.sales_hour),
    menu_rows: sumByKey(
      [...(a.menu_rows ?? []), ...(b.menu_rows ?? [])],
      (r: any) => r.menu_name,
      ['qty', 'revenue']
    ),
    total_cogs:        Number(a.total_cogs ?? 0)        + Number(b.total_cogs ?? 0),
    total_opex:        Number(a.total_opex ?? 0)        + Number(b.total_opex ?? 0),
    bogo_transactions: Number(a.bogo_transactions ?? 0) + Number(b.bogo_transactions ?? 0),
    bogo_gift_units:   Number(a.bogo_gift_units ?? 0)   + Number(b.bogo_gift_units ?? 0),
  }
}

function mergeEcommerceData(a: any, b: any) {
  if (!a) return b
  if (!b) return a
  return {
    kpiRows: [...(a.kpiRows ?? []), ...(b.kpiRows ?? [])],
    hourlyRows: sumByKey(
      [...(a.hourlyRows ?? []), ...(b.hourlyRows ?? [])],
      (r: any) => r.sales_hour,
      ['omzet', 'jumlah_order_completed']
    ).sort((x: any, y: any) => x.sales_hour - y.sales_hour),
    menuRows: sumByKey(
      [...(a.menuRows ?? []), ...(b.menuRows ?? [])],
      (r: any) => r.name,
      ['qty', 'revenue']
    ),
    totalCogs: Number(a.totalCogs ?? 0) + Number(b.totalCogs ?? 0),
    totalOpex: Number(a.totalOpex ?? 0) + Number(b.totalOpex ?? 0),
  }
}

function mergeSummaryPayload(histPayload: any, livePayload: any) {
  return {
    result:        mergeSummaryResult(histPayload.result, livePayload.result),
    ecommerceData: mergeEcommerceData(histPayload.ecommerceData, livePayload.ecommerceData),
    // Freshness yang dilaporkan ke UI mengikuti potongan paling baru (hari ini).
    fetchedAt:     livePayload.fetchedAt,
  }
}

async function fetchOwnerDashboardSummaryRaw(
  supabase: any,
  fromStartIso: string,
  toEndIso: string,
  outletId: string | null,
  source: SalesSource
) {
  const fromStart = new Date(fromStartIso)
  const toEnd = new Date(toEndIso)

  const isSSOnlineOnly = outletId === 'ss-online'
  const isAll = outletId === 'all' || !outletId

  if (isSSOnlineOnly) {
    const ecommerceDataOnly = await fetchEcommerceOwnerData(supabase, fromStart, toEnd, source)
    return {
      result: null,
      ecommerceData: ecommerceDataOnly,
      fetchedAt: new Date().toISOString(),
    }
  }

  const rpcPromise = supabase.rpc('get_owner_dashboard_summary', {
    p_from:           fromStartIso,
    p_to:             toEndIso,
    p_outlet_id:      outletId && outletId !== 'all' ? outletId : null,
    p_source:         source,
    p_test_outlet_id: TEST_OUTLET_ID,
  })

  const ecommercePromise = isAll ? fetchEcommerceOwnerData(supabase, fromStart, toEnd, source) : Promise.resolve(null)

  const [rpcResponse, ecommerceDataResponse] = await Promise.all([rpcPromise, ecommercePromise])

  if (rpcResponse.error) throw new Error(`get_owner_dashboard_summary: ${rpcResponse.error.message}`)

  return {
    result: rpcResponse.data,
    ecommerceData: ecommerceDataResponse,
    fetchedAt: new Date().toISOString(),
  }
}

// ── Fast version: semua agregasi dikerjakan PostgreSQL via RPC + Smart Cache ────────────
export async function getOwnerDashboardDataFast(
  filter: PeriodFilterValue,
  outlets: Outlet[]
) {
  const { supabase, scopeKey, allowedOutletIds } = await resolveCallerScope()

  const fromStart = new Date(`${filter.from}T00:00:00.000+07:00`)
  const toEnd    = new Date(`${filter.to}T23:59:59.999+07:00`)

  const todayJakarta = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const isPast = filter.to < todayJakarta

  const fromStartIso = fromStart.toISOString()
  const toEndIso = toEnd.toISOString()
  const outletId = filter.outletId !== 'all' ? filter.outletId : null
  const source = filter.source

  if (outletId && outletId !== 'ss-online' && allowedOutletIds !== 'all' && !allowedOutletIds.includes(outletId)) {
    throw new Error('Forbidden: outlet not in caller scope')
  }

  const getCachedOwnerDashboardSummary = unstable_cache(
    async (fromStartIso: string, toEndIso: string, outletId: string | null, source: SalesSource) => {
      return fetchOwnerDashboardSummaryRaw(supabase, fromStartIso, toEndIso, outletId, source)
    },
    ['owner-dashboard-summary-v6', scopeKey],
    {
      revalidate: 3600,
      tags: ['owner-dashboard'],
    }
  )

  // ── Split-range cache ────────────────────────────────────────────────
  // Sebelumnya cache HANYA dipakai saat seluruh rentang sudah lewat
  // (filter.to < hari ini). Akibatnya preset yang paling sering dipakai —
  // "30 hari terakhir", "bulan ini", "hari ini" — selalu berakhir di hari ini
  // sehingga tidak pernah kena cache dan menghitung ulang seluruh rentang.
  //
  // Sekarang rentang yang melewati batas hari dipecah dua: bagian lampau
  // (beku, ikut cache 1 jam yang sama seperti sebelumnya) + bagian hari ini
  // (selalu segar), lalu dijumlahkan. Untuk 30 hari, 29 hari di antaranya
  // dilayani dari cache. TTL sengaja tetap 3600 detik agar jaminan kesegaran
  // tidak berubah dari perilaku yang sudah berjalan.
  const spansToday = !isPast && filter.from < todayJakarta
  let payload: any

  if (isPast) {
    payload = await getCachedOwnerDashboardSummary(fromStartIso, toEndIso, outletId, source)
  } else if (spansToday) {
    const yesterdayJakarta = (() => {
      const d = new Date(`${todayJakarta}T00:00:00.000+07:00`)
      d.setUTCDate(d.getUTCDate() - 1)
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d)
    })()
    const histToIso   = new Date(`${yesterdayJakarta}T23:59:59.999+07:00`).toISOString()
    const liveFromIso = new Date(`${todayJakarta}T00:00:00.000+07:00`).toISOString()

    const [histPayload, livePayload] = await Promise.all([
      getCachedOwnerDashboardSummary(fromStartIso, histToIso, outletId, source),
      fetchOwnerDashboardSummaryRaw(supabase, liveFromIso, toEndIso, outletId, source),
    ])
    payload = mergeSummaryPayload(histPayload, livePayload)
  } else {
    // Rentang seluruhnya hari ini / ke depan — tidak ada bagian beku untuk di-cache.
    payload = await fetchOwnerDashboardSummaryRaw(supabase, fromStartIso, toEndIso, outletId, source)
  }

  const result = payload.result
  const ecommerceData = payload.ecommerceData
  const fetchedAt = payload.fetchedAt || new Date().toISOString()

  if (!result && ecommerceData) {
    return {
      ...ecommerceData,
      totalCogsOpex: ecommerceData.totalCogs + ecommerceData.totalOpex,
      fetchedAt,
      isCached: isPast,
    }
  }

  const nameById = new Map(outlets.map((o) => [o.id, o.name]))

  const posKpiRows: SalesSummaryRow[] = (result?.kpi_rows ?? []).map((r: any) => ({
    outlet_id:              r.outlet_id,
    outlet_name:            nameById.get(r.outlet_id) ?? 'Outlet Tidak Dikenal',
    sales_source:           r.sales_source as SalesSource,
    sales_date:             r.sales_date,
    omzet:                  Number(r.omzet),
    jumlah_order_completed: Number(r.order_count),
    jumlah_order_all:       Number(r.order_count),
    total_deductions:       Number(r.total_deductions),
    total_qty:              Number(r.total_qty || 0),
  }))

  const hourMap = new Map<number, SalesHourlyRow>()
  for (let i = 0; i < 24; i++) {
    hourMap.set(i, { sales_hour: i, omzet: 0, jumlah_order_completed: 0 })
  }
  for (const h of result?.hourly_rows ?? []) {
    hourMap.set(h.sales_hour, {
      sales_hour:             h.sales_hour,
      omzet:                  Number(h.omzet),
      jumlah_order_completed: Number(h.order_count),
    })
  }

  const menuMap = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const r of result?.menu_rows ?? []) {
    const clean = cleanItemName(r.menu_name) || 'Unknown Menu'
    const cur = menuMap.get(clean) || { name: clean, qty: 0, revenue: 0 }
    cur.qty += Number(r.qty || 0)
    cur.revenue += Number(r.revenue || 0)
    menuMap.set(clean, cur)
  }

  let totalCogs = Number(result?.total_cogs ?? 0)
  let totalOpex = Number(result?.total_opex ?? 0)

  let kpiRows = posKpiRows
  if (ecommerceData) {
    kpiRows = [...posKpiRows, ...ecommerceData.kpiRows]
    for (const h of ecommerceData.hourlyRows) {
      const cur = hourMap.get(h.sales_hour) || { sales_hour: h.sales_hour, omzet: 0, jumlah_order_completed: 0 }
      cur.omzet += h.omzet
      cur.jumlah_order_completed += h.jumlah_order_completed
      hourMap.set(h.sales_hour, cur)
    }
    for (const m of ecommerceData.menuRows) {
      const clean = cleanItemName(m.name) || 'Unknown Menu'
      const cur = menuMap.get(clean) || { name: clean, qty: 0, revenue: 0 }
      cur.qty += m.qty
      cur.revenue += m.revenue
      menuMap.set(clean, cur)
    }
    totalCogs += ecommerceData.totalCogs
    totalOpex += ecommerceData.totalOpex
  }

  const hourlyRows = Array.from(hourMap.values()).sort((a, b) => a.sales_hour - b.sales_hour)
  const menuRows = Array.from(menuMap.values())

  return {
    kpiRows,
    hourlyRows,
    menuRows,
    totalCogs,
    totalOpex,
    totalCogsOpex: totalCogs + totalOpex,
    buyOneGetOne: {
      transactions: Number(result?.bogo_transactions ?? 0),
      giftUnits: Number(result?.bogo_gift_units ?? 0)
    },
    fetchedAt,
    isCached: isPast,
  }
}

/* ── Fetch REAL Petty Cash (Expenses + Shifts Starting Cash) ─────────── */

export async function getPettyCashData(
  filter: PeriodFilterValue,
  outlets: Outlet[]
): Promise<{
  transactions: PettyCashTransaction[]
  dailySummaries: DailyPettyCashSummary[]
}> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })

  // 1. Fetch Staff & User Mapping for Real Crew Names
  const [{ data: staffList }, { data: userList }] = await Promise.all([
    supabase.from('outlet_staff').select('id, name, role, outlet_id').limit(1000),
    supabase.from('users').select('id, name, username').limit(1000)
  ])

  const staffMap = new Map((staffList || []).map((s) => [s.id, s.name]))
  const userMap = new Map((userList || []).map((u) => [u.id, u.name || u.username]))

  const staffByOutlet = new Map<string, string[]>()
  for (const s of staffList || []) {
    if (s.outlet_id && s.name) {
      const existing = staffByOutlet.get(s.outlet_id) || []
      existing.push(s.name)
      staffByOutlet.set(s.outlet_id, existing)
    }
  }

  // 2. Query REAL table `shifts` for Starting Petty Cash (Modal Diserahkan)
  let shiftQuery = supabase
    .from('shifts')
    .select('*, outlets(name)')
    .neq('outlet_id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
    .order('end_time', { ascending: false })
    .limit(500)

  if (filter.outletId && filter.outletId !== 'all') {
    shiftQuery = shiftQuery.eq('outlet_id', filter.outletId)
  }

  // 3. Query REAL table `petty_cash_expenses` for Kas Keluar
  let expenseQuery = supabase
    .from('petty_cash_expenses')
    .select('*, outlets(name)')
    .neq('outlet_id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (filter.from) {
    expenseQuery = expenseQuery.gte('expense_date', filter.from)
  }
  if (filter.to) {
    expenseQuery = expenseQuery.lte('expense_date', filter.to)
  }
  if (filter.outletId && filter.outletId !== 'all') {
    expenseQuery = expenseQuery.eq('outlet_id', filter.outletId)
  }

  let topupQuery = supabase
    .from('petty_cash_topups')
    .select('*, outlets(name)')
    .neq('outlet_id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
    .in('status', ['forwarded_by_leader', 'approved', 'completed'])
    .order('created_at', { ascending: false })
    .limit(500)

  if (filter.from) {
    topupQuery = topupQuery.gte('created_at', `${filter.from}T00:00:00.000+07:00`)
  }
  if (filter.to) {
    topupQuery = topupQuery.lte('created_at', `${filter.to}T23:59:59.999+07:00`)
  }
  if (filter.outletId && filter.outletId !== 'all') {
    topupQuery = topupQuery.eq('outlet_id', filter.outletId)
  }

  const [{ data: shiftRows }, { data: expenseRows }, { data: topupRows }] = await Promise.all([
    shiftQuery,
    expenseQuery,
    topupQuery,
  ])

  // Map starting cash from shifts as Kas Masuk
  const shiftEntries: PettyCashTransaction[] = (shiftRows || [])
    .filter((s: any) => {
      if (Number(s.starting_petty_cash) <= 0) return false
      const dateStr = s.end_time ? s.end_time.split('T')[0] : s.start_time ? s.start_time.split('T')[0] : ''
      if (filter.from && dateStr < filter.from) return false
      if (filter.to && dateStr > filter.to) return false
      return true
    })
    .map((s: any) => {
      let resolvedStaffName = staffMap.get(s.staff_id) || staffMap.get(s.closed_by) || userMap.get(s.staff_id)
      if (!resolvedStaffName && s.outlet_id) {
        const candidates = staffByOutlet.get(s.outlet_id)
        if (candidates && candidates.length > 0) resolvedStaffName = candidates[0]
      }
      return {
        id: `shift-start-${s.id}`,
        outlet_id: s.outlet_id || '',
        outlet_name: s.outlets?.name || 'Outlet Utama',
        transaction_date: s.start_time || s.created_at,
        type: 'in' as const,
        category: 'Modal Awal Kasir',
        description: 'Modal awal kas kecil diserahkan per shift',
        amount: Number(s.starting_petty_cash) || 0,
        staff_name: resolvedStaffName || 'Kasir Staff',
        receipt_url: null,
      }
    })

  // Map expenses from petty_cash_expenses as Kas Keluar
  const expenseEntries: PettyCashTransaction[] = (expenseRows || []).map((r: any) => {
    let resolvedStaffName = staffMap.get(r.created_by) || userMap.get(r.created_by)
    if (!resolvedStaffName && r.outlet_id) {
      const candidates = staffByOutlet.get(r.outlet_id)
      if (candidates && candidates.length > 0) resolvedStaffName = candidates[0]
    }
    if (!resolvedStaffName) resolvedStaffName = 'Staff Kasir'

    let tDate = r.expense_date || r.created_at
    if (r.expense_date && r.created_at && r.expense_date.length === 10) {
      const timePart = r.created_at.includes('T') ? r.created_at.split('T')[1] : '00:00:00Z'
      tDate = `${r.expense_date}T${timePart}`
    }

    return {
      id: r.id,
      outlet_id: r.outlet_id || outlets[0]?.id || '',
      outlet_name: r.outlets?.name || 'Global Outlet',
      transaction_date: tDate,
      type: 'out',
      category: r.category || 'Operasional',
      description: r.description || 'Pengeluaran petty cash kasir',
      amount: Number(r.amount) || 0,
      staff_name: resolvedStaffName,
      receipt_url: r.receipt_url || null,
    }
  })

  // Map topups from petty_cash_topups as Kas Masuk
  const topupEntries: PettyCashTransaction[] = (topupRows || []).map((r: any) => {
    let resolvedStaffName = staffMap.get(r.created_by) || userMap.get(r.created_by)
    if (!resolvedStaffName && r.outlet_id) {
      const candidates = staffByOutlet.get(r.outlet_id)
      if (candidates && candidates.length > 0) resolvedStaffName = candidates[0]
    }
    if (!resolvedStaffName) resolvedStaffName = 'Finance Staff'

    let tDate = r.completed_at || r.created_at

    return {
      id: r.id,
      outlet_id: r.outlet_id || outlets[0]?.id || '',
      outlet_name: r.outlets?.name || 'Global Outlet',
      transaction_date: tDate,
      type: 'in',
      category: 'Top Up Petty Cash',
      description: r.description || 'Pengisian saldo petty cash',
      amount: Number(r.amount) || 0,
      staff_name: resolvedStaffName,
      receipt_url: r.proof_of_transfer_url || null,
    }
  })

  // Filter topupEntries and expenseEntries to only include those that fall WITHIN a shift
  // Interim transactions are already rolled into the starting_petty_cash of the next shift
  const activeTopupEntries = topupEntries.filter(t => {
    return (shiftRows || []).some((s: any) => {
      if (s.outlet_id !== t.outlet_id) return false
      const sStart = new Date(s.start_time).getTime()
      const sEnd = s.end_time ? new Date(s.end_time).getTime() : Date.now() + 86400000 * 365 // Future if open
      const tTime = new Date(t.transaction_date).getTime()
      return tTime >= sStart && tTime <= sEnd
    })
  })

  const activeExpenseEntries = expenseEntries.filter(e => {
    return (shiftRows || []).some((s: any) => {
      if (s.outlet_id !== e.outlet_id) return false
      const sStart = new Date(s.start_time).getTime()
      const sEnd = s.end_time ? new Date(s.end_time).getTime() : Date.now() + 86400000 * 365
      const eTime = new Date(e.transaction_date).getTime()
      return eTime >= sStart && eTime <= sEnd
    })
  })

  // Combine and sort all transactions by transaction_date DESC
  const allTransactions = [...shiftEntries, ...activeExpenseEntries, ...activeTopupEntries].sort((a, b) =>
    b.transaction_date.localeCompare(a.transaction_date)
  )

  // Compute Daily Summaries
  const dailyMap = new Map<string, DailyPettyCashSummary>()

  for (const t of allTransactions) {
    const dateKey = t.transaction_date.slice(0, 10)
    const existing = dailyMap.get(dateKey) || {
      date: dateKey,
      total_in: 0,
      total_out: 0,
      ending_balance: 0,
      shift_count: 0,
    }

    if (t.type === 'in') {
      existing.total_in += t.amount
      existing.shift_count++
    } else {
      existing.total_out += t.amount
    }
    existing.ending_balance = existing.total_in - existing.total_out
    dailyMap.set(dateKey, existing)
  }

  const dailySummaries = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date))

  return {
    transactions: allTransactions,
    dailySummaries,
  }
}

/* ── Fetch REAL Attendance Rekap & Stealth Photos from `attendance` ──── */

export async function getAttendanceReportData(
  filter: PeriodFilterValue,
  outlets: Outlet[]
): Promise<AttendanceRecordExt[]> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      } catch {
        // Ignored, might be called from a Server Component.
      }
    }
  })

  // 1. Fetch Staff & Outlets for Mapping
  const [{ data: staffList }, { data: outletsList }] = await Promise.all([
    supabase.from('outlet_staff').select('id, name, role').limit(1000),
    supabase.from('outlets').select('id, name').limit(500)
  ])

  const staffMap = new Map((staffList || []).map((s) => [s.id, s]))
  const outletMap = new Map((outletsList || []).map((o) => [o.id, o.name]))

  // We will batch-sign the stealth photo URLs below to prevent server timeout
  // 2. Query REAL table `attendance` (singular) where all stealth camera photos are recorded
  let query = supabase
    .from('attendance')
    .select('*')
    .neq('outlet_id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
    .order('ts_server', { ascending: false })
    .limit(1000)

  if (filter.from) {
    query = query.gte('ts_server', `${filter.from}T00:00:00.000+07:00`)
  }
  if (filter.to) {
    query = query.lte('ts_server', `${filter.to}T23:59:59.999+07:00`)
  }
  if (filter.outletId && filter.outletId !== 'all') {
    query = query.eq('outlet_id', filter.outletId)
  }

  const { data: attRows, error } = await query

  if (error || !attRows) {
    console.error('Error querying table attendance from DB:', error?.message)
    return []
  }

  // Group attendance entries by `${outlet_staff_id}|${outlet_id}|${date}`
  const grouped = new Map<string, {
    id: string
    staff_id: string
    staff_name: string
    staff_role: string
    outlet_id: string
    outlet_name: string
    date: string
    clock_in: string | null
    clock_out: string | null
    raw_photo_in: string | null
    raw_photo_out: string | null
    gps_lat_in: number | null
    gps_lng_in: number | null
    gps_lat_out: number | null
    gps_lng_out: number | null
    status: string
    late_minutes: number
    out_status: string | null
    out_minutes: number | null
    notes: string | null
  }>()

  for (const r of attRows) {
    const dateStr = r.ts_server
      ? new Date(r.ts_server).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      : ''
    const key = `${r.outlet_staff_id}|${r.outlet_id}|${dateStr}`
    const st = staffMap.get(r.outlet_staff_id)
    const outletName = outletMap.get(r.outlet_id)

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: r.id,
        staff_id: r.outlet_staff_id || '',
        staff_name: st?.name || 'Kasir Staff',
        staff_role: (st?.role || 'CREW').toUpperCase(),
        outlet_id: r.outlet_id || '',
        outlet_name: outletName || 'Outlet Utama',
        date: dateStr,
        clock_in: null,
        clock_out: null,
        raw_photo_in: null,
        raw_photo_out: null,
        gps_lat_in: null,
        gps_lng_in: null,
        gps_lat_out: null,
        gps_lng_out: null,
        status: 'hadir',
        late_minutes: 0,
        out_status: null,
        out_minutes: null,
        notes: null,
      })
    }

    const item = grouped.get(key)!
    if (r.type === 'in') {
      item.clock_in = new Date(r.ts_server).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
      item.raw_photo_in = r.selfie_url || null
      if (r.gps_lat) item.gps_lat_in = Number(r.gps_lat)
      if (r.gps_lng) item.gps_lng_in = Number(r.gps_lng)
      if (r.status === 'telat_toleransi') {
        item.status = 'telat_toleransi'
        item.late_minutes = r.telat_menit || 0
      } else if (r.status === 'telat' || r.status === 'terlambat') {
        item.status = 'terlambat'
        item.late_minutes = r.telat_menit || 0
      }
    } else if (r.type === 'out') {
      item.clock_out = new Date(r.ts_server).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
      item.raw_photo_out = r.selfie_url || null
      if (r.gps_lat) item.gps_lat_out = Number(r.gps_lat)
      if (r.gps_lng) item.gps_lng_out = Number(r.gps_lng)
      item.out_status = r.status || 'tepat'
      item.out_minutes = r.telat_menit || 0
    }
  }

  // Gather all unique photo paths
  const pathsToSign = new Set<string>()
  for (const item of grouped.values()) {
    if (item.raw_photo_in && !item.raw_photo_in.startsWith('http')) pathsToSign.add(item.raw_photo_in)
    if (item.raw_photo_out && !item.raw_photo_out.startsWith('http')) pathsToSign.add(item.raw_photo_out)
  }

  // Batch sign the URLs in chunks of 100 to avoid overloading the API
  const pathArray = Array.from(pathsToSign)
  const signedUrlsMap = new Map<string, string>()
  const chunkSize = 100
  
  for (let i = 0; i < pathArray.length; i += chunkSize) {
    const chunk = pathArray.slice(i, i + chunkSize)
    const { data: signedUrls } = await supabase.storage.from('selfies').createSignedUrls(chunk, 3600)
    if (signedUrls) {
      for (const su of signedUrls) {
        if (su.signedUrl) signedUrlsMap.set(su.path, su.signedUrl)
      }
    }
  }

  // Convert grouped items to AttendanceRecordExt with Signed Stealth Photo URLs & Out Status
  const result: AttendanceRecordExt[] = Array.from(grouped.values()).map((item) => {
    let signedIn = item.raw_photo_in
    if (signedIn && !signedIn.startsWith('http')) {
      signedIn = signedUrlsMap.get(signedIn) || null
    }

    let signedOut = item.raw_photo_out
    if (signedOut && !signedOut.startsWith('http')) {
      signedOut = signedUrlsMap.get(signedOut) || null
    }

    return {
      id: item.id,
      staff_id: item.staff_id,
      staff_name: item.staff_name,
      staff_role: item.staff_role,
      outlet_id: item.outlet_id,
      outlet_name: item.outlet_name,
      date: item.date,
      clock_in: item.clock_in,
      clock_out: item.clock_out,
      status: item.status,
      late_minutes: item.late_minutes,
      out_status: item.out_status,
      out_minutes: item.out_minutes,
      notes: item.notes,
      stealth_photo_in_url: signedIn,
      stealth_photo_out_url: signedOut,
      gps_lat_in: item.gps_lat_in,
      gps_lng_in: item.gps_lng_in,
      gps_lat_out: item.gps_lat_out,
      gps_lng_out: item.gps_lng_out,
    }
  })

  return result.sort((a, b) => b.date.localeCompare(a.date))
}

