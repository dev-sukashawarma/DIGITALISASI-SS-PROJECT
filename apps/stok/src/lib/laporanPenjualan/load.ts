// Hanya untuk kode server (Server Component / Server Action).
import { unstable_cache } from 'next/cache'
import { summarizeDay, type DaySummary, type RawOrder } from './aggregate'

/* ── Pemuat ringkasan harian Laporan Penjualan, dengan cache ─────────────────
 *
 * - Hari lampau: ringkasan per tanggal di-cache 1 jam (tag per tanggal, bisa
 *   dibuang lewat tombol "Refresh" — lihat actions/laporanPenjualan.ts).
 * - Hari ini: selalu segar, dengan memo 20 detik agar beberapa pembuka halaman
 *   yang bersamaan berbagi satu pengambilan.
 * Ringkasan satu hari hanya puluhan KB, bukan ±1 MB order mentah.
 */

export const laporanDayTag = (date: string) => `laporan-penjualan-day:${date}`

const ORDER_SELECT = 'id, status, payment_method, channel, sales_source, total_amount, discount_amount, promo_subsidy, created_at, outlet_id, order_items(id, menu_item_name, quantity, subtotal)'
const PAGE = 1000
const CONCURRENCY = 6
const PAST_DAY_TTL_S = 3600
const TODAY_MEMO_TTL_MS = 20_000

export function jakartaDate(instant: Date | string | number = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(instant))
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

async function fetchDayOrders(supabase: any, date: string): Promise<RawOrder[]> {
  const fromIso = new Date(`${date}T00:00:00.000+07:00`).toISOString()
  const toIso = new Date(`${date}T23:59:59.999+07:00`).toISOString()
  const all: RawOrder[] = []
  for (let offset = 0; ; offset += PAGE) {
    // Urutan unik (created_at, id) → paginasi stabil & urutan kemunculan sama dengan versi lama.
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    const page = (data ?? []) as RawOrder[]
    all.push(...page)
    if (page.length < PAGE) return all
  }
}

const todayMemo = new Map<string, { at: number; promise: Promise<DaySummary> }>()

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }))
  return out
}

/** Ringkasan harian untuk rentang tanggal WIB [from, to], urut tanggal. */
export async function loadDaySummaries(supabase: any, from: string, to: string): Promise<{ days: DaySummary[]; fetchedAt: string }> {
  const today = jakartaDate()
  const dates = eachDate(from, to > today ? today : to)

  const getDay = (date: string): Promise<DaySummary> => {
    if (date === today) {
      const hit = todayMemo.get(date)
      if (hit && Date.now() - hit.at < TODAY_MEMO_TTL_MS) return hit.promise
      todayMemo.clear() // buang memo hari sebelumnya setelah lewat tengah malam
      const promise = fetchDayOrders(supabase, date).then(summarizeDay)
      todayMemo.set(date, { at: Date.now(), promise })
      promise.catch(() => { if (todayMemo.get(date)?.promise === promise) todayMemo.delete(date) })
      return promise
    }
    return unstable_cache(
      async () => summarizeDay(await fetchDayOrders(supabase, date)),
      ['laporan-penjualan-day-v1', date],
      { revalidate: PAST_DAY_TTL_S, tags: ['laporan-penjualan', laporanDayTag(date)] }
    )()
  }

  const days = await mapLimit(dates, CONCURRENCY, getDay)
  return { days, fetchedAt: new Date().toISOString() }
}

export function clearLaporanTodayMemo() {
  todayMemo.clear()
}

/** Tanggal order paling awal (WIB) — batas bawah filter "Semua waktu". */
let earliest: { at: number; value: Promise<string | null> } | null = null
export function getEarliestOrderDate(supabase: any): Promise<string | null> {
  if (earliest && Date.now() - earliest.at < 3_600_000) return earliest.value
  const value = (async () => {
    const { data, error } = await supabase.from('orders').select('created_at').order('created_at', { ascending: true }).limit(1)
    if (error) throw error
    return data?.[0]?.created_at ? jakartaDate(data[0].created_at) : null
  })()
  earliest = { at: Date.now(), value }
  value.catch(() => { if (earliest?.value === value) earliest = null })
  return value
}
