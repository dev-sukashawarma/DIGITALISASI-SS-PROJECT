/* ── Laporan Penjualan (/stok/laporan-penjualan): ringkasan per hari ──────────
 *
 * Dulu halaman ini menarik SELURUH order mentah + item rentang filter dari
 * Supabase di SETIAP buka halaman / ganti filter (30 hari ≈ 30 ribu order,
 * ±30 query berurutan), tanpa cache apa pun.
 *
 * Semua angka di halaman ini aditif, jadi yang di-cache per hari adalah
 * ringkasan harian — bukan order mentah — dengan dimensi secukupnya agar
 * filter channel & outlet bisa diterapkan saat menjumlahkan:
 *   - `groups` : per (outlet, channel mentah, jam WIB) → order selesai, omzet, potongan, porsi
 *   - `items`  : per (outlet, channel mentah, nama menu) → qty, omzet, jumlah baris
 *   - `cancel` : per (outlet, channel mentah) → order batal
 * Setiap entri mencatat `f` (urutan kemunculan pertama di hari itu) supaya
 * urutan seri (tie) di daftar menu & outlet sama persis dengan versi lama,
 * yang mengikuti urutan kemunculan order (created_at, id).
 *
 * `buildAnalytics` mereproduksi logika page.tsx lama baris per baris.
 */

export type RawOrder = {
  id: string
  status: string
  channel: string | null
  total_amount: number | string | null
  discount_amount: number | string | null
  promo_subsidy: number | string | null
  created_at: string
  outlet_id: string | null
  order_items?: { menu_item_name: string | null; quantity: number | string | null; subtotal: number | string | null }[] | null
}

export type DayGroup = { o: string | null; c: string | null; h: number; n: number; rev: number; ded: number; porsi: number; f: number }
export type DayItem = { o: string | null; c: string | null; name: string; qty: number; rev: number; cnt: number; f: number }
export type DayCancel = { o: string | null; c: string | null; n: number }
export type DaySummary = { v: 1; groups: DayGroup[]; items: DayItem[]; cancel: DayCancel[] }

export function cleanMenuName(raw: string | null | undefined): string {
  let name = (raw || 'Item Tanpa Nama').trim()
  if (name.includes('|')) name = name.split('|')[0].trim()
  return name
}

/** Ringkas order satu hari. `orders` WAJIB urut created_at, id (seperti query lama). */
export function summarizeDay(orders: RawOrder[]): DaySummary {
  const groups = new Map<string, DayGroup>()
  const items = new Map<string, DayItem>()
  const cancel = new Map<string, DayCancel>()
  let seq = 0

  for (const o of orders) {
    const oid = o.outlet_id ?? null
    const ch = o.channel ?? null
    if (o.status === 'cancelled') {
      const k = JSON.stringify([oid, ch])
      const e = cancel.get(k) ?? { o: oid, c: ch, n: 0 }
      e.n += 1
      cancel.set(k, e)
      continue
    }
    if (o.status !== 'completed') continue

    const order = seq++
    const hour = (new Date(o.created_at).getUTCHours() + 7) % 24
    const gk = JSON.stringify([oid, ch, hour])
    const g = groups.get(gk) ?? { o: oid, c: ch, h: hour, n: 0, rev: 0, ded: 0, porsi: 0, f: order }
    g.n += 1
    g.rev += Number(o.total_amount) || 0
    g.ded += (Number(o.discount_amount) || 0) + (Number(o.promo_subsidy) || 0)
    groups.set(gk, g)

    if (Array.isArray(o.order_items)) {
      for (const oi of o.order_items) {
        const name = cleanMenuName(oi.menu_item_name)
        const qty = Number(oi.quantity) || 0
        const ik = JSON.stringify([oid, ch, name])
        const it = items.get(ik) ?? { o: oid, c: ch, name, qty: 0, rev: 0, cnt: 0, f: order }
        it.qty += qty
        it.rev += Number(oi.subtotal) || 0
        it.cnt += 1
        items.set(ik, it)
        g.porsi += qty
      }
    }
  }

  return { v: 1, groups: [...groups.values()], items: [...items.values()], cancel: [...cancel.values()] }
}

// ── Filter channel: aturan PERSIS query lama (eq/in PostgREST = cocok tepat) ──
const FOOD_APPS = ['gofood', 'grabfood', 'shopeefood', 'tiktokgo', 'tiktok', 'tiktok_go']
const TIKTOK = ['tiktokgo', 'tiktok', 'tiktok_go']

export function channelMatches(filter: string, raw: string | null): boolean {
  if (filter === 'all') return true
  if (filter === 'offline') return raw === null
  if (filter === 'food_apps') return raw !== null && FOOD_APPS.includes(raw)
  if (filter === 'tiktokgo' || filter === 'tiktok') return raw !== null && TIKTOK.includes(raw)
  return raw === filter
}

export function channelKey(raw: string | null): string {
  const rawCh = (raw || '').toLowerCase()
  if (!rawCh || rawCh === 'offline' || rawCh === 'pos') return 'offline'
  if (rawCh.includes('gofood')) return 'gofood'
  if (rawCh.includes('grab')) return 'grabfood'
  if (rawCh.includes('shopee')) return 'shopeefood'
  if (rawCh.includes('tiktok')) return 'tiktok'
  return 'lainnya'
}

export type OutletInfo = { name: string; cleanName: string; category: 'mitra' | 'internal' }

export function buildAnalytics(
  days: DaySummary[],
  opts: { channelFilter: string; outletFilter: string; validOutletIdSet: Set<string>; outletInfoMap: Map<string, OutletInfo> }
) {
  const { channelFilter, outletFilter, validOutletIdSet, outletInfoMap } = opts
  const passQuery = (o: string | null, c: string | null) =>
    channelMatches(channelFilter, c) && (outletFilter === 'all' || o === outletFilter)
  // Order selesai: tambahan syarat outlet valid bila filter outlet = semua.
  const passCompleted = (o: string | null) => !(outletFilter === 'all' && o && !validOutletIdSet.has(o))

  // Urutan kemunculan global = (hari, urutan di hari itu) — sama dengan urutan order lama.
  const groups: (DayGroup & { d: number })[] = []
  const items: (DayItem & { d: number })[] = []
  let canceledCount = 0
  days.forEach((day, d) => {
    for (const g of day.groups) if (passQuery(g.o, g.c) && passCompleted(g.o)) groups.push({ ...g, d })
    for (const it of day.items) if (passQuery(it.o, it.c) && passCompleted(it.o)) items.push({ ...it, d })
    for (const c of day.cancel) if (passQuery(c.o, c.c)) canceledCount += c.n
  })
  const byFirstSeen = (a: { d: number; f: number }, b: { d: number; f: number }) => a.d - b.d || a.f - b.f
  groups.sort(byFirstSeen)
  items.sort(byFirstSeen)

  let netRevenue = 0
  let totalDeductions = 0
  let totalOrders = 0
  const hourlyCounts = Array(24).fill(0)
  const hourlyRevenue = Array(24).fill(0)
  const hourlyPorsi = Array(24).fill(0)
  const channelStats: Record<string, { label: string; count: number; revenue: number; porsi: number }> = {
    offline: { label: 'Offline / Kasir', count: 0, revenue: 0, porsi: 0 },
    gofood: { label: 'GoFood', count: 0, revenue: 0, porsi: 0 },
    grabfood: { label: 'GrabFood', count: 0, revenue: 0, porsi: 0 },
    shopeefood: { label: 'ShopeeFood', count: 0, revenue: 0, porsi: 0 },
    tiktok: { label: 'TikTok Shop', count: 0, revenue: 0, porsi: 0 },
    lainnya: { label: 'Lainnya', count: 0, revenue: 0, porsi: 0 },
  }
  const outletStatsMap: Record<string, {
    outletId: string; outletName: string; category: 'mitra' | 'internal'
    totalRevenue: number; totalOrders: number; itemsSold: number; items: Record<string, number>
  }> = {}
  const outletFirstSeen = new Map<string, { d: number; f: number }>()

  const ensureOutlet = (oid: string | null) => {
    const outletId = oid || 'unknown'
    if (!outletStatsMap[outletId]) {
      const info = outletInfoMap.get(outletId)
      outletStatsMap[outletId] = {
        outletId,
        outletName: info?.cleanName || (outletId === 'unknown' ? 'Tanpa Outlet' : outletId.substring(0, 8)),
        category: info?.category || 'internal',
        totalRevenue: 0,
        totalOrders: 0,
        itemsSold: 0,
        items: {},
      }
    }
    return outletStatsMap[outletId]
  }

  for (const g of groups) {
    netRevenue += g.rev
    totalDeductions += g.ded
    totalOrders += g.n
    const outletId = g.o || 'unknown'
    const prev = outletFirstSeen.get(outletId)
    if (!prev || byFirstSeen(g, prev) < 0) outletFirstSeen.set(outletId, { d: g.d, f: g.f })
    const os = ensureOutlet(g.o)
    os.totalRevenue += g.rev
    os.totalOrders += g.n
    const ck = channelKey(g.c)
    channelStats[ck].count += g.n
    channelStats[ck].revenue += g.rev
    channelStats[ck].porsi += g.porsi
    hourlyCounts[g.h] += g.n
    hourlyRevenue[g.h] += g.rev
    hourlyPorsi[g.h] += g.porsi
  }

  const itemMap: Record<string, { name: string; qty: number; revenue: number; orderCount: number }> = {}
  for (const it of items) {
    if (!itemMap[it.name]) itemMap[it.name] = { name: it.name, qty: 0, revenue: 0, orderCount: 0 }
    itemMap[it.name].qty += it.qty
    itemMap[it.name].revenue += it.rev
    itemMap[it.name].orderCount += it.cnt
    const os = ensureOutlet(it.o)
    os.itemsSold += it.qty
    os.items[it.name] = (os.items[it.name] || 0) + it.qty
  }

  const totalRevenue = netRevenue + totalDeductions
  const avgOrderValue = totalOrders > 0 ? Math.round(netRevenue / totalOrders) : 0
  const bestSellers = Object.values(itemMap).sort((a, b) => b.qty - a.qty)
  const totalItemsSold = bestSellers.reduce((sum, item) => sum + item.qty, 0)

  let maxHourlyCount = 0
  let peakHour: number | null = null
  for (let i = 0; i < 24; i++) {
    if (hourlyCounts[i] > maxHourlyCount) {
      maxHourlyCount = hourlyCounts[i]
      peakHour = i
    }
  }

  // Urutan seri outlet = urutan kemunculan order pertamanya (seperti versi lama).
  const outletOrder = Object.keys(outletStatsMap).sort((a, b) => {
    const x = outletFirstSeen.get(a) ?? { d: Infinity, f: Infinity }
    const y = outletFirstSeen.get(b) ?? { d: Infinity, f: Infinity }
    return x.d - y.d || x.f - y.f
  })
  const outletVolumeList = outletOrder.map((k) => outletStatsMap[k]).sort((a, b) => b.itemsSold - a.itemsSold)

  return {
    totalRevenue,
    netRevenue,
    totalDeductions,
    totalOrders,
    totalItemsSold,
    avgOrderValue,
    canceledCount,
    peakHour,
    hourly: hourlyCounts,
    hourlyRevenue,
    hourlyPorsi,
    channelStats,
    bestSellers,
    outletVolumeList,
  }
}
