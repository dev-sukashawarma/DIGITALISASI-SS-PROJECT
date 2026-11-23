/* ── Laporan Penjualan (/stok/laporan-penjualan): ringkasan per hari ──────────
 *
 * Dulu halaman ini menarik SELURUH order mentah + item rentang filter dari
 * Supabase di SETIAP buka halaman / ganti filter (30 hari ≈ 30 ribu order,
 * ±30 query berurutan), tanpa cache apa pun.
 *
 * Semua angka di halaman ini aditif, jadi yang di-cache per hari adalah
 * ringkasan harian — bukan order mentah — dengan dimensi secukupnya agar
 * filter channel & outlet bisa diterapkan saat menjumlahkan:
 *   - `groups` : per (outlet, kanal, jam WIB) → order selesai, omzet, potongan, porsi
 *   - `items`  : per (outlet, kanal, nama menu) → qty, omzet, jumlah baris
 *   - `cancel` : per (outlet, kanal) → order batal
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
  /** pos | online | app | gofood | … — dipakai membedakan pesanan website dari kasir. */
  sales_source?: string | null
  total_amount: number | string | null
  discount_amount: number | string | null
  promo_subsidy: number | string | null
  created_at: string
  outlet_id: string | null
  order_items?: {
    menu_item_id?: string | null
    menu_item_name: string | null
    quantity: number | string | null
    subtotal: number | string | null
    package_choices?: Record<string, string> | null
  }[] | null
}

/** Kunci kanal laporan — hasil `kanalOrder(channel, sales_source)`. */
export type KanalKey = 'offline' | 'website' | 'gofood' | 'grabfood' | 'shopeefood' | 'tiktok' | 'endorse' | 'lainnya'

// `c` = kunci kanal (KanalKey), BUKAN lagi channel mentah (sejak v2).
export type DayGroup = { o: string | null; c: KanalKey; h: number; n: number; rev: number; ded: number; porsi: number; f: number }
export type DayItem = { o: string | null; c: KanalKey; name: string; qty: number; rev: number; cnt: number; f: number; fromPackage?: string | null }
export type DayCancel = { o: string | null; c: KanalKey; n: number }
export type DaySummary = { v: 2; groups: DayGroup[]; items: DayItem[]; cancel: DayCancel[] }

/**
 * Kanal sebuah order (keputusan owner):
 * - Offline / Kasir : channel kosong/'pos'/'offline' (selain pesanan website) + PreOrder WA.
 * - Website         : channel kosong & sales_source 'online', atau channel 'website'/'direct_web'.
 * - Endorse         : channel 'endorse' — bukan transaksi, hanya porsinya yang dihitung.
 * - Food apps       : menurut channel (gofood/grab/shopee/tiktok), apa pun sales_source-nya.
 */
export function kanalOrder(channel: string | null | undefined, salesSource: string | null | undefined): KanalKey {
  const ch = (channel || '').trim().toLowerCase()
  const src = (salesSource || '').trim().toLowerCase()
  if (!ch) return src === 'online' ? 'website' : 'offline'
  if (ch === 'offline' || ch === 'pos' || ch === 'preorder_wa') return 'offline'
  if (ch === 'website' || ch === 'direct_web') return 'website'
  if (ch === 'endorse') return 'endorse'
  if (ch.includes('gofood')) return 'gofood'
  if (ch.includes('grab')) return 'grabfood'
  if (ch.includes('shopee')) return 'shopeefood'
  if (ch.includes('tiktok')) return 'tiktok'
  return 'lainnya'
}

export function cleanMenuName(raw: string | null | undefined): string {
  let name = (raw || 'Item Tanpa Nama').trim()
  if (name.includes('|')) name = name.split('|')[0].trim()
  name = name.replace(/\s*\([^)]*Paket:[^)]*\)/i, '').trim()
  return name
}

export const KNOWN_DRINK_NAMES_BY_ID: Record<string, string> = {
  'c543b78e-3341-44e0-b3ef-53349e71e3d3': 'Orange Juice',
  '08a57f8f-f212-4205-a3eb-fb88066ae1b8': 'Ice Tea',
  'c8427af3-0a41-48dd-9a08-6b93cd913ec6': 'Aqua',
}

/**
 * Ekstraksi pilihan minuman (Suka Drink) dari menu paket.
 * Mendukung pembacaan dari:
 * 1. `order_items.package_choices` (JSON mapping UUID: { [slot_id]: menu_item_id })
 * 2. Fallback note di `menu_item_name` jika package_choices kosong/belum ada (mis. "(Paket: Orange Juice)")
 */
export function extractPackageDrinks(oi: {
  menu_item_name: string | null
  package_choices?: Record<string, string> | null
}): string[] {
  const drinks: string[] = []

  // 1. Dari package_choices
  if (oi.package_choices && typeof oi.package_choices === 'object') {
    for (const val of Object.values(oi.package_choices)) {
      if (typeof val === 'string' && KNOWN_DRINK_NAMES_BY_ID[val]) {
        drinks.push(KNOWN_DRINK_NAMES_BY_ID[val])
      }
    }
  }

  // 2. Fallback jika package_choices tidak ada / kosong
  if (drinks.length === 0 && oi.menu_item_name) {
    const raw = oi.menu_item_name
    const match = /(?:Paket:\s*|\(Paket:\s*)([^)\|]+)/i.exec(raw)
    if (match) {
      const parts = match[1].replace(/\)/g, '').split(',')
      for (const p of parts) {
        const s = p.toLowerCase().trim()
        if (s.includes('orange')) {
          drinks.push('Orange Juice')
        } else if (s.includes('tea') || s.includes('teh')) {
          drinks.push('Ice Tea')
        } else if (s.includes('aqua')) {
          drinks.push('Aqua')
        }
      }
    }
  }

  return drinks
}

/* ── Minuman komponen paket ─────────────────────────────────────────────────
 *
 * Paket = 1 porsi makanan (baris order_items-nya sendiri) + porsi minuman
 * komponennya. Komponen dibaca dari `menu_packages` (slot per paket):
 *   - slot tetap   : satu opsi (mis. "AYAM BESAR + AQUA" → Aqua)
 *   - slot pilihan : menu_item_id ATAU or_menu_item_id (mis. Ice Tea / Orange Juice);
 *     pilihan diambil dari `package_choices` (nilai = id menu) atau catatan
 *     "(Paket: …)" di nama item. Bila tak tercatat, porsinya tetap dihitung
 *     dengan nama `MINUMAN_TAK_TERCATAT` — jenisnya tidak ditebak.
 * Hanya slot yang SEMUA opsinya minuman (kategori ber-"drink"/"minum") yang
 * dihitung; slot makanan tidak menambah porsi (paket tetap 1 porsi makanan).
 */
export type PaketMinumanSlot = { qty: number; opsi: { id: string; name: string }[] }
export type PaketMinumanMap = Record<string, PaketMinumanSlot[]>

export const MINUMAN_TAK_TERCATAT = 'Minuman paket (pilihan tak tercatat)'

export const KATEGORI_MINUMAN = /drink|minum/i

type SlotPaketDb = { package_id: string; menu_item_id: string | null; or_menu_item_id: string | null; quantity: number | string | null }
type MenuDb = { id: string; name: string | null; categories?: { name: string | null } | { name: string | null }[] | null }

/** Susun peta paket → slot minuman dari baris `menu_packages` + `menu_items` (dengan kategori). */
export function susunPaketMinuman(slots: SlotPaketDb[], menus: MenuDb[]): PaketMinumanMap {
  const menuById = new Map(menus.map((m) => [m.id, m]))
  const isMinuman = (id: string) => {
    const m = menuById.get(id)
    const kat = Array.isArray(m?.categories) ? m?.categories[0] : m?.categories
    return !!m && KATEGORI_MINUMAN.test(kat?.name || '')
  }
  const out: PaketMinumanMap = {}
  for (const s of slots) {
    const ids = [s.menu_item_id, s.or_menu_item_id].filter((x): x is string => !!x)
    if (ids.length === 0 || !ids.every(isMinuman)) continue
    const qty = Number(s.quantity) || 1
    const opsi = ids.map((id) => ({ id, name: (menuById.get(id)?.name || '').trim() }))
    ;(out[s.package_id] ??= []).push({ qty, opsi })
  }
  return out
}

/** Nama minuman dari catatan "(Paket: …)" di nama item, dengan ejaan baku lama. */
export function minumanDariCatatan(raw: string | null): string[] {
  if (!raw) return []
  const match = /(?:Paket:\s*|\(Paket:\s*)([^)\|]+)/i.exec(raw)
  if (!match) return []
  return match[1].replace(/\)/g, '').split(',').map((p) => {
    const s = p.toLowerCase().trim()
    if (s.includes('orange')) return 'Orange Juice'
    if (s.includes('tea') || s.includes('teh')) return 'Ice Tea'
    if (s.includes('aqua')) return 'Aqua'
    return p.trim()
  }).filter(Boolean)
}

/**
 * Minuman yang ikut disiapkan untuk SATU unit paket (qty per unit).
 * Item yang paketnya tak dikenal di `menu_packages` jatuh ke perilaku lama
 * (`extractPackageDrinks`, 1 per minuman yang tercatat).
 */
export function minumanPaket(
  oi: { menu_item_id?: string | null; menu_item_name: string | null; package_choices?: Record<string, string> | null },
  paket?: PaketMinumanMap,
): { name: string; qty: number }[] {
  const slots = oi.menu_item_id && paket ? paket[oi.menu_item_id] : undefined
  if (!slots) return extractPackageDrinks(oi).map((name) => ({ name, qty: 1 }))

  const pilihanId = oi.package_choices && typeof oi.package_choices === 'object'
    ? Object.values(oi.package_choices).filter((v): v is string => typeof v === 'string')
    : []
  const catatan = minumanDariCatatan(oi.menu_item_name)
  const out: { name: string; qty: number }[] = []
  const tambah = (name: string, qty: number) => {
    const ada = out.find((x) => x.name === name)
    if (ada) ada.qty += qty
    else out.push({ name, qty })
  }

  for (const slot of slots) {
    if (slot.opsi.length === 1) {
      tambah(slot.opsi[0].name, slot.qty)
      continue
    }
    // 1) package_choices: id menu yang dipilih
    const idx = pilihanId.findIndex((id) => slot.opsi.some((o) => o.id === id))
    if (idx >= 0) {
      const opsi = slot.opsi.find((o) => o.id === pilihanId[idx])!
      pilihanId.splice(idx, 1)
      tambah(opsi.name, slot.qty)
      continue
    }
    // 2) catatan nama: ambil hingga `qty` nama yang cocok dengan opsi slot ini
    const dipakai: string[] = []
    for (let i = 0; i < catatan.length && dipakai.length < slot.qty; ) {
      const n = catatan[i].toLowerCase()
      const opsi = slot.opsi.find((o) => o.name.toLowerCase() === n || o.name.toLowerCase().includes(n))
      if (opsi) {
        dipakai.push(opsi.name)
        catatan.splice(i, 1)
      } else i++
    }
    if (dipakai.length === 0) {
      tambah(MINUMAN_TAK_TERCATAT, slot.qty)
      continue
    }
    // Satu nama untuk slot ber-qty > 1 = semua unit minuman itu; sisa unit ke nama terakhir.
    dipakai.forEach((name, i) => tambah(name, i === dipakai.length - 1 ? slot.qty - (dipakai.length - 1) : 1))
  }
  return out
}

/**
 * Ringkas order satu hari. `orders` WAJIB urut created_at, id (seperti query lama).
 * `paket` = peta slot minuman paket (lihat `susunPaketMinuman`).
 */
export function summarizeDay(orders: RawOrder[], paket?: PaketMinumanMap): DaySummary {
  const groups = new Map<string, DayGroup>()
  const items = new Map<string, DayItem>()
  const cancel = new Map<string, DayCancel>()
  let seq = 0

  for (const o of orders) {
    const oid = o.outlet_id ?? null
    const ch = kanalOrder(o.channel, o.sales_source)
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
        const ik = JSON.stringify([oid, ch, name, null])
        const it = items.get(ik) ?? { o: oid, c: ch, name, qty: 0, rev: 0, cnt: 0, f: order, fromPackage: null }
        it.qty += qty
        it.rev += Number(oi.subtotal) || 0
        it.cnt += 1
        items.set(ik, it)
        g.porsi += qty

        // Minuman komponen paket (pilihan maupun tetap), qty per unit × qty item.
        for (const drink of minumanPaket(oi, paket)) {
          const dq = qty * drink.qty
          const dk = JSON.stringify([oid, ch, drink.name, name])
          const dit = items.get(dk) ?? { o: oid, c: ch, name: drink.name, qty: 0, rev: 0, cnt: 0, f: order, fromPackage: name }
          dit.qty += dq
          dit.cnt += 1
          items.set(dk, dit)
          g.porsi += dq
        }
      }
    }
  }

  return { v: 2, groups: [...groups.values()], items: [...items.values()], cancel: [...cancel.values()] }
}

// ── Filter channel: dicocokkan ke kunci kanal (lihat kanalOrder) ──
const FOOD_APPS: KanalKey[] = ['gofood', 'grabfood', 'shopeefood', 'tiktok']

export function channelMatches(filter: string, kanal: KanalKey): boolean {
  if (filter === 'all') return true
  if (filter === 'food_apps') return FOOD_APPS.includes(kanal)
  if (filter === 'tiktokgo' || filter === 'tiktok') return kanal === 'tiktok'
  return kanal === filter
}

export type OutletInfo = { name: string; cleanName: string; category: 'mitra' | 'internal' }

export function buildAnalytics(
  days: DaySummary[],
  opts: { channelFilter: string; outletFilter: string; validOutletIdSet: Set<string>; outletInfoMap: Map<string, OutletInfo> }
) {
  const { channelFilter, outletFilter, validOutletIdSet, outletInfoMap } = opts
  const passQuery = (o: string | null, c: KanalKey) =>
    channelMatches(channelFilter, c) && (outletFilter === 'all' || o === outletFilter)
  // Filter outlet = semua: hanya outlet valid (internal/mitra yang dihitung).
  // Order tanpa outlet ikut dibuang. Berlaku SAMA untuk order selesai dan batal.
  const passCompleted = (o: string | null) => outletFilter !== 'all' || (o !== null && validOutletIdSet.has(o))

  // Urutan kemunculan global = (hari, urutan di hari itu) — sama dengan urutan order lama.
  const groups: (DayGroup & { d: number })[] = []
  const items: (DayItem & { d: number })[] = []
  let canceledCount = 0
  days.forEach((day, d) => {
    for (const g of day.groups) if (passQuery(g.o, g.c) && passCompleted(g.o)) groups.push({ ...g, d })
    for (const it of day.items) if (passQuery(it.o, it.c) && passCompleted(it.o)) items.push({ ...it, d })
    // Endorse bukan transaksi → batalnya pun tidak dihitung.
    for (const c of day.cancel) if (c.c !== 'endorse' && passQuery(c.o, c.c) && passCompleted(c.o)) canceledCount += c.n
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
  // `pesananTakDihitung`: order selesai yang tidak dihitung sebagai transaksi (endorse).
  type StatKanal = { label: string; count: number; revenue: number; porsi: number; pesananTakDihitung?: number }
  const channelStats: Record<KanalKey, StatKanal> = {
    offline: { label: 'Offline / Kasir', count: 0, revenue: 0, porsi: 0 },
    website: { label: 'Website', count: 0, revenue: 0, porsi: 0 },
    gofood: { label: 'GoFood', count: 0, revenue: 0, porsi: 0 },
    grabfood: { label: 'GrabFood', count: 0, revenue: 0, porsi: 0 },
    shopeefood: { label: 'ShopeeFood', count: 0, revenue: 0, porsi: 0 },
    // Data kanal ini = tiktokgo/tiktok_go (food app), bukan TikTok Shop (marketplace).
    tiktok: { label: 'TikTok GO', count: 0, revenue: 0, porsi: 0 },
    endorse: { label: 'Endorse', count: 0, revenue: 0, porsi: 0, pesananTakDihitung: 0 },
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
    // Endorse: porsi (bahan keluar) dihitung, tapi bukan transaksi → tidak masuk
    // jumlah order, rata-rata/order, grafik jumlah order per jam, maupun order outlet.
    const n = g.c === 'endorse' ? 0 : g.n
    netRevenue += g.rev
    totalDeductions += g.ded
    totalOrders += n
    const outletId = g.o || 'unknown'
    const prev = outletFirstSeen.get(outletId)
    if (!prev || byFirstSeen(g, prev) < 0) outletFirstSeen.set(outletId, { d: g.d, f: g.f })
    const os = ensureOutlet(g.o)
    os.totalRevenue += g.rev
    os.totalOrders += n
    const st = channelStats[g.c] ?? channelStats.lainnya
    st.count += n
    st.revenue += g.rev
    st.porsi += g.porsi
    if (g.c === 'endorse') st.pesananTakDihitung = (st.pesananTakDihitung ?? 0) + g.n
    hourlyCounts[g.h] += n
    hourlyRevenue[g.h] += g.rev
    hourlyPorsi[g.h] += g.porsi
  }

  const itemMap: Record<string, { name: string; qty: number; revenue: number; orderCount: number; fromPackage?: string | null }> = {}
  for (const it of items) {
    const itemKey = it.fromPackage ? `${it.name}__pkg__${it.fromPackage}` : it.name
    if (!itemMap[itemKey]) {
      itemMap[itemKey] = {
        name: it.name,
        qty: 0,
        revenue: 0,
        orderCount: 0,
        fromPackage: it.fromPackage || null,
      }
    }
    itemMap[itemKey].qty += it.qty
    itemMap[itemKey].revenue += it.rev
    itemMap[itemKey].orderCount += it.cnt
    const os = ensureOutlet(it.o)
    os.itemsSold += it.qty
    const outletItemKey = it.fromPackage ? `${it.name} (Dari ${it.fromPackage})` : it.name
    os.items[outletItemKey] = (os.items[outletItemKey] || 0) + it.qty
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
