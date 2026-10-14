// @ts-nocheck
/* ── Pengambilan data Rangkuman Penjualan dari Supabase, dengan cache per hari ──
 *
 * Dulu browser menarik seluruh order mentah rentang filter langsung dari
 * Supabase (±24 MB untuk "Bulan ini") dan menariknya ULANG setiap ada order
 * baru di outlet mana pun. Sekarang server yang mengambil, per hari:
 *  - hari lampau: di-cache per tanggal (1 jam, tag per tanggal), dipakai
 *    bersama seluruh pengguna dengan cakupan outlet yang sama;
 *  - hari ini: selalu segar, dengan memo 10 detik agar beberapa tab/pengguna
 *    yang me-refresh bersamaan berbagi satu pengambilan.
 * Filter outlet diterapkan di memori, sehingga cache satu hari berlaku untuk
 * pilihan outlet apa pun.
 */

import { unstable_cache } from 'next/cache'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'
import {
  DAY_FETCH_CONCURRENCY,
  eachDateInclusive,
  jakartaRangeIso,
  codeFingerprint,
  mapWithConcurrency,
  splitRangeByToday,
} from '@/lib/ownerDashboardCache'
import { encodeDay, decodeDay, DAY_CODEC_VERSION } from './dayCodec'
import { isTestOutlet } from '@/lib/outletFilters'
import { dayGeneration } from '@/lib/server/dayGenerations'

export const posReportDayTag = (date: string) => `pos-report-day:${date}`

const PAGE_SIZE = 1000
// Sama dengan jeda minimum refresh realtime (20 dtk): berapa pun tab yang
// terbuka, data hari ini diambil dari database paling banyak 3x per menit.
const TODAY_MEMO_TTL_MS = 20_000
// Hari lampau hampir tak pernah berubah; kalau berubah, cache tanggal itu
// dibuang lewat tag (realtime order lampau, tombol Segarkan Data, impor SS
// Online). HPP tidak ikut disimpan — dihitung saat laporan diminta — jadi
// perubahan HPP tidak menunggu cache ini kedaluwarsa.
const PAST_DAY_TTL_S = 86_400
const todayMemo = new Map<string, { at: number; promise: Promise<any> }>()
const MAX_DECODED_PAST_ORDERS = 300_000
let decodedPastOrdersTotal = 0
const decodedPastDayMemo = new Map<string, { pos: any[]; ecommerce: any[]; fetchedAt: string; count: number }>()

const orderTsMemo = new WeakMap<object, number>()
function getOrderTs(o: any): number {
  let ts = orderTsMemo.get(o)
  if (ts === undefined) {
    ts = Date.parse(o.created_at)
    if (isNaN(ts)) ts = 0
    orderTsMemo.set(o, ts)
  }
  return ts
}

export function clearPosReportTodayMemo() {
  todayMemo.clear()
  decodedPastDayMemo.clear()
  decodedPastOrdersTotal = 0
}

const ORDER_SELECT = 'id, order_number, status, payment_method, total_amount, discount_amount, promo_subsidy, created_at, outlet_id, channel, sales_source, customer_name, cashier_name, external_order_id, is_endorse, order_items(id, menu_item_id, menu_item_name, quantity, unit_price, subtotal, is_promo_reward, promo_id, promo_name, promo_buy_quantity, promo_get_quantity, original_unit_price, package_choices)'
const ECOMMERCE_SELECT = 'id, order_id, channel_id, total_amount, order_date, raw_data, ecommerce_sale_items(id, menu_id, quantity, price, subtotal, menu_items:menu_id(id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp))))'

async function fetchAllPages(buildQuery: () => any, label: string) {
  const all: any[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`${label}: ${error.message}`)
    const page = data ?? []
    all.push(...page)
    if (page.length < PAGE_SIZE) return all
  }
}

/** Satu baris ecommerce_sales → bentuk OrderRow (dipindah apa adanya dari ReportsView). */
function mapEcommerceSale(saleRecord: any) {
  const raw = saleRecord.raw_data || {}
  const totalPotongan = Math.abs(Number(raw.total_potongan || raw.admin_fee || raw.discount_amount) || 0)
  // `ecommerce_sales.total_amount` bernilai KOTOR; dipetakan ke NET agar
  // konsisten dengan Untung Rugi & Ringkasan Bisnis (fee tampil lewat discount_amount).
  const omzetNet = Math.max(0, (Number(saleRecord.total_amount) || 0) - totalPotongan)
  return {
    id: saleRecord.id,
    order_number: 0,
    status: 'completed',
    payment_method: saleRecord.channel_id,
    total_amount: omzetNet,
    discount_amount: totalPotongan,
    promo_subsidy: 0,
    created_at: saleRecord.order_date,
    outlet_id: 'ss-online',
    channel: saleRecord.channel_id,
    sales_source: 'Online',
    customer_name: 'SS Online Customer',
    cashier_name: null,
    external_order_id: saleRecord.order_id,
    raw_data: raw,
    order_items: (saleRecord.ecommerce_sale_items || []).map((item: any) => ({
      id: item.id,
      menu_item_id: item.menu_id,
      menu_item_name: item.menu_items?.name || 'Unknown Item',
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.subtotal,
      package_choices: null,
      menu_items: item.menu_items,
    })),
  }
}

/** Order POS + penjualan SS Online untuk satu rentang (biasanya satu hari). */
export async function fetchRangeRaw(supabase: any, fromIso: string, toIso: string) {
  const [pos, ecommerce] = await Promise.all([
    fetchAllPages(
      () => supabase
        .from('orders')
        .select(ORDER_SELECT)
        .neq('outlet_id', TEST_OUTLET_ID)
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        // `id` unik → paginasi deterministik antar-halaman.
        .order('id', { ascending: false }),
      'posReport.orders'
    ),
    fetchAllPages(
      () => supabase
        .from('ecommerce_sales')
        .select(ECOMMERCE_SELECT)
        .gte('order_date', fromIso)
        .lte('order_date', toIso)
        .order('id', { ascending: false }),
      'posReport.ecommerce'
    ),
  ])
  return { pos, ecommerce: ecommerce.map(mapEcommerceSale) }
}

// Cache hari disimpan permanen (tahan redeploy). Kunci ikut sidik jari kode
// yang menentukan bentuk isinya, jadi perubahan select/pemetaan otomatis
// membuat cache lama tak terpakai. Lihat codeFingerprint.
const DAY_CACHE_FINGERPRINT = codeFingerprint(ORDER_SELECT, ECOMMERCE_SELECT, DAY_CODEC_VERSION, mapEcommerceSale, fetchRangeRaw)

export function encodeRange(raw: { pos: any[]; ecommerce: any[] }) {
  return { pos: encodeDay(raw.pos), ecommerce: encodeDay(raw.ecommerce), fetchedAt: new Date().toISOString() }
}

const PAST_FETCH_CONCURRENCY = Math.max(DAY_FETCH_CONCURRENCY, 12)

/**
 * Semua order (POS + SS Online) di rentang tanggal WIB [from, to], diambil
 * per hari lewat cache. Belum difilter outlet.
 */
export async function loadPosReportOrders(
  supabase: any,
  scopeKey: string,
  from: string,
  to: string,
  today: string
): Promise<{ pos: any[]; ecommerce: any[]; fetchedAt: string; isCached: boolean }> {
  const { past, includesToday } = splitRangeByToday(from, to, today)
  const pastDates = past ? eachDateInclusive(past.from, past.to) : []

  const fetchDay = async (date: string) => {
    const gen = String(dayGeneration(date))
    const memoKey = `${scopeKey}|${date}|${gen}`
    const memoHit = decodedPastDayMemo.get(memoKey)
    if (memoHit) {
      decodedPastDayMemo.delete(memoKey)
      decodedPastDayMemo.set(memoKey, memoHit)
      return memoHit
    }

    const { fromIso, toIso } = jakartaRangeIso(date, date)
    let encoded: { pos: any; ecommerce: any; fetchedAt: string }
    try {
      encoded = await unstable_cache(
        async () => encodeRange(await fetchRangeRaw(supabase, fromIso, toIso)),
        // dayGeneration: naik tiap cache tanggal ini dibuang, tersimpan di disk →
        // pembuangan tetap berlaku sesudah restart/redeploy.
        ['pos-report-day-v2', DAY_CACHE_FINGERPRINT, scopeKey, date, gen],
        { revalidate: PAST_DAY_TTL_S, tags: ['pos-report', posReportDayTag(date)] }
      )()
    } catch (err: any) {
      if (String(err?.message || '').includes('incrementalCache')) {
        encoded = encodeRange(await fetchRangeRaw(supabase, fromIso, toIso))
      } else {
        throw err
      }
    }

    const decodedPos = decodeDay(encoded.pos).sort((a: any, b: any) => getOrderTs(b) - getOrderTs(a))
    const decodedEcommerce = decodeDay(encoded.ecommerce).sort((a: any, b: any) => getOrderTs(b) - getOrderTs(a))
    const count = decodedPos.length + decodedEcommerce.length
    const entry = {
      pos: decodedPos,
      ecommerce: decodedEcommerce,
      fetchedAt: encoded.fetchedAt,
      count,
    }

    while (decodedPastOrdersTotal + count > MAX_DECODED_PAST_ORDERS && decodedPastDayMemo.size > 0) {
      const oldestKey = decodedPastDayMemo.keys().next().value
      const oldest = decodedPastDayMemo.get(oldestKey)
      decodedPastDayMemo.delete(oldestKey)
      if (oldest) decodedPastOrdersTotal -= oldest.count
    }
    decodedPastDayMemo.set(memoKey, entry)
    decodedPastOrdersTotal += count
    return entry
  }

  const fetchToday = () => {
    const key = `${scopeKey}|${today}`
    const hit = todayMemo.get(key)
    if (hit && Date.now() - hit.at < TODAY_MEMO_TTL_MS) return hit.promise
    const { fromIso, toIso } = jakartaRangeIso(today, today)
    const promise = fetchRangeRaw(supabase, fromIso, toIso).then((raw) => ({
      pos: raw.pos.sort((a: any, b: any) => getOrderTs(b) - getOrderTs(a)),
      ecommerce: raw.ecommerce.sort((a: any, b: any) => getOrderTs(b) - getOrderTs(a)),
      fetchedAt: new Date().toISOString(),
    }))
    todayMemo.set(key, { at: Date.now(), promise })
    promise.catch(() => { if (todayMemo.get(key)?.promise === promise) todayMemo.delete(key) })
    if (todayMemo.size > 100) {
      for (const [k, v] of todayMemo) if (Date.now() - v.at >= TODAY_MEMO_TTL_MS) todayMemo.delete(k)
    }
    return promise
  }

  const [pastParts, todayPart] = await Promise.all([
    mapWithConcurrency(pastDates, PAST_FETCH_CONCURRENCY, fetchDay),
    includesToday ? fetchToday() : Promise.resolve(null),
  ])

  // Gabungkan dari hari terbaru ke terlama supaya pos dan ecommerce langsung
  // berurutan created_at DESC tanpa perlu .sort() ulang ratusan ribu elemen.
  const pos: any[] = []
  const ecommerce: any[] = []
  let newest = ''
  if (todayPart) {
    for (let i = 0; i < todayPart.pos.length; i++) pos.push(todayPart.pos[i])
    for (let i = 0; i < todayPart.ecommerce.length; i++) ecommerce.push(todayPart.ecommerce[i])
    if (todayPart.fetchedAt > newest) newest = todayPart.fetchedAt
  }
  for (let pIdx = pastParts.length - 1; pIdx >= 0; pIdx--) {
    const p = pastParts[pIdx]
    for (let i = 0; i < p.pos.length; i++) pos.push(p.pos[i])
    for (let i = 0; i < p.ecommerce.length; i++) ecommerce.push(p.ecommerce[i])
    if (p.fetchedAt > newest) newest = p.fetchedAt
  }
  return {
    pos,
    ecommerce,
    fetchedAt: todayPart?.fetchedAt || newest || new Date().toISOString(),
    isCached: !includesToday,
  }
}

/** Tanggal (WIB) order paling awal — batas bawah filter "Semua Waktu".
 * Tanpa batas ini, "Semua Waktu" (mulai 2000-01-01) akan dipecah jadi ±9.000
 * potongan harian yang hampir semuanya kosong. */
// Per cakupan outlet: tanggal paling awal yang terlihat mitra bisa lebih baru
// dari seluruh perusahaan, jadi hasilnya tidak boleh dipakai bersama.
const earliestMemo = new Map<string, { at: number; value: Promise<string | null> }>()
export function getEarliestSalesDate(supabase: any, scopeKey: string): Promise<string | null> {
  const hit = earliestMemo.get(scopeKey)
  if (hit && Date.now() - hit.at < 3_600_000) return hit.value
  const value = (async () => {
    const [o, e] = await Promise.all([
      supabase.from('orders').select('created_at').order('created_at', { ascending: true }).limit(1),
      supabase.from('ecommerce_sales').select('order_date').order('order_date', { ascending: true }).limit(1),
    ])
    if (o.error) throw new Error(`getEarliestSalesDate: ${o.error.message}`)
    if (e.error) throw new Error(`getEarliestSalesDate: ${e.error.message}`)
    const times = [o.data?.[0]?.created_at, e.data?.[0]?.order_date]
      .filter(Boolean)
      .map((t: string) => new Date(t).getTime())
    if (times.length === 0) return null
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(Math.min(...times)))
  })()
  earliestMemo.set(scopeKey, { at: Date.now(), value })
  value.catch(() => { if (earliestMemo.get(scopeKey)?.value === value) earliestMemo.delete(scopeKey) })
  return value
}

/**
 * Pilihan outlet di filter → daftar order yang ditampilkan (logika sama
 * dengan versi browser sebelumnya): order POS hanya bila "SS Online" tidak
 * dipilih; SS Online ikut bila "Semua Cabang" atau "SS Online" dipilih.
 */
export function selectReportOrders(pos: any[], ecommerce: any[], selectedOutlets: string[]) {
  const includeAll = selectedOutlets.includes('all')
  const includeSSOnline = selectedOutlets.includes('ss-online')
  const isSSOnlineOnly = selectedOutlets.length === 1 && includeSSOnline
  const selectedSet = includeAll ? null : new Set(selectedOutlets)

  const posList: any[] = []
  let posSorted = true
  let prevPosTs = Infinity
  if (!isSSOnlineOnly) {
    for (let i = 0; i < pos.length; i++) {
      const o = pos[i]
      if (!isTestOutlet(o.outlet_id) && (includeAll || selectedSet!.has(o.outlet_id))) {
        const ts = getOrderTs(o)
        if (ts > prevPosTs) posSorted = false
        prevPosTs = ts
        posList.push(o)
      }
    }
  }

  const ecList: any[] = []
  let ecSorted = true
  let prevEcTs = Infinity
  if (includeAll || includeSSOnline) {
    for (let i = 0; i < ecommerce.length; i++) {
      const o = ecommerce[i]
      if (!isTestOutlet(o.outlet_id)) {
        const ts = getOrderTs(o)
        if (ts > prevEcTs) ecSorted = false
        prevEcTs = ts
        ecList.push(o)
      }
    }
  }

  if (ecList.length === 0) {
    return posSorted ? posList : posList.sort((a: any, b: any) => getOrderTs(b) - getOrderTs(a))
  }
  if (posList.length === 0) {
    return ecSorted ? ecList : ecList.sort((a: any, b: any) => getOrderTs(b) - getOrderTs(a))
  }
  if (posSorted && ecSorted) {
    const merged = new Array(posList.length + ecList.length)
    let i = 0
    let j = 0
    let k = 0
    while (i < posList.length && j < ecList.length) {
      if (getOrderTs(posList[i]) >= getOrderTs(ecList[j])) {
        merged[k++] = posList[i++]
      } else {
        merged[k++] = ecList[j++]
      }
    }
    while (i < posList.length) merged[k++] = posList[i++]
    while (j < ecList.length) merged[k++] = ecList[j++]
    return merged
  }

  return posList.concat(ecList).sort((a: any, b: any) => getOrderTs(b) - getOrderTs(a))
}
