// Filter "channel" pesanan yang konsisten antara halaman Histori & Laporan.
//
// Sumber pesanan tersebar di DUA kolom (lihat lib/order-source.ts):
//   - `channel`      -> tag per-order dari input manual (gofood, grabfood, ..., website)
//   - `sales_source` -> kolom kanonik ('pos' | 'online' | gofood | grabfood | shopeefood | tiktok)
//
// Pesanan dari website online masuk lewat trigger `force_online_sales_source`
// (migration 20260701100000) yang HANYA mengisi `sales_source = 'online'` dan
// membiarkan `channel` NULL. Filter yang cuma melihat `channel` karena itu
// tidak pernah menemukannya — dan malah ikut terhitung sebagai "offline".
//
// Helper di bawah selalu mencocokkan KEDUA kolom.

/** Semua id yang mungkin muncul untuk tiap filter, di kolom mana pun. */
const FILTER_IDS: Record<string, string[]> = {
  gofood: ['gofood'],
  grabfood: ['grabfood'],
  shopeefood: ['shopeefood'],
  tiktokgo: ['tiktokgo', 'tiktok', 'tiktok_go'],
  tiktok: ['tiktokgo', 'tiktok', 'tiktok_go'],
  website: ['website', 'online'],
  online: ['website', 'online'],
}

export const FOOD_APP_IDS = ['gofood', 'grabfood', 'shopeefood', 'tiktokgo', 'tiktok', 'tiktok_go']

/** Id-id yang dianggap "online" (website / self-order), bukan food apps. */
export const ONLINE_IDS = FILTER_IDS.website

function idsFor(filter: string): string[] {
  return FILTER_IDS[filter] ?? [filter]
}

/**
 * Terapkan filter channel ke query PostgREST (`orders`).
 * `filter === 'all'` mengembalikan query apa adanya.
 */
export function applyChannelFilter<T extends {
  is: (col: string, val: null) => T
  not: (col: string, op: string, val: any) => T
  or: (expr: string) => T
}>(query: T, filter: string): T {
  if (!filter || filter === 'all') return query

  // Offline / POS walk-in: tanpa tag channel DAN bukan pesanan online.
  if (filter === 'offline') {
    return query.is('channel', null).not('sales_source', 'in', `(${ONLINE_IDS.join(',')})`)
  }

  const ids = filter === 'food_apps' ? FOOD_APP_IDS : idsFor(filter)
  const list = `(${ids.join(',')})`
  return query.or(`channel.in.${list},sales_source.in.${list}`)
}

/** Versi murni untuk data yang sudah di tangan (cache IndexedDB / order lokal). */
export function matchesChannelFilter(
  order: { channel?: string | null; sales_source?: string | null },
  filter: string,
): boolean {
  if (!filter || filter === 'all') return true

  const channel = order.channel ?? null
  const salesSource = order.sales_source ?? null

  if (filter === 'offline') {
    return !channel && !ONLINE_IDS.includes(salesSource ?? '')
  }

  const ids = filter === 'food_apps' ? FOOD_APP_IDS : idsFor(filter)
  return ids.includes(channel ?? '') || ids.includes(salesSource ?? '')
}

/** Order ini dari food app (GoFood/GrabFood/ShopeeFood/TikTok)? Cek `channel` DAN `sales_source`. */
export function isFoodAppOrder(order: { channel?: string | null; sales_source?: string | null }): boolean {
  const channel = (order.channel ?? '').toLowerCase()
  const salesSource = (order.sales_source ?? '').toLowerCase()
  return FOOD_APP_IDS.includes(channel) || FOOD_APP_IDS.includes(salesSource)
}

/**
 * Omzet satu order = `total_amount`, apa adanya. JANGAN menambahkan
 * `discount_amount` / `promo_subsidy` ke sini — itu bug yang sudah dua kali terjadi.
 *
 * Alasannya, di SEMUA jalur pembuatan order (checkout, walk-in, manual) `total_amount`
 * sudah menjadi angka final yang benar untuk masing-masing kasus:
 *
 * - Promo offline (dine-in/walk-in/website): diskon dibakar ke `unit_price`, jadi
 *   `total_amount` = harga SETELAH diskon. Diskon harus MENGURANGI omzet, maka cukup
 *   pakai total_amount. `discount_amount` cuma catatan berapa yang sudah dipotong —
 *   menambahkannya balik justru bikin promo menaikkan omzet.
 * - Food apps (GoFood/GrabFood/ShopeeFood/TikTok): `total_amount` = harga menu ASLI;
 *   subsidi promo app sengaja tidak dipotong (lihat app/api/orders/manual/route.ts,
 *   `finalTotal = isFoodApp ? total : ...`). `promo_subsidy` murni info "Potongan App"
 *   dan ditampilkan terpisah, bukan bagian dari omzet.
 *
 * Helper ini sengaja dibuat agar semua permukaan (histori, laporan, dashboard kasir,
 * analitik admin) memakai satu definisi yang sama.
 */
export function getOrderGrossAmount(order: { total_amount?: number | null }): number {
  return Number(order.total_amount) || 0
}
