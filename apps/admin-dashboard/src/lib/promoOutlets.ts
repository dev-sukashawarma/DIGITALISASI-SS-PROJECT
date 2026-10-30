/**
 * Pemetaan antara "promo logis" yang dilihat admin dan baris `outlet_promos`.
 *
 * Satu promo logis tetap disimpan sebagai satu baris PER OUTLET seperti sejak
 * awal — trigger Buy X Get Y, pool kuota, dan channel realtime per-outlet
 * semuanya bergantung pada bentuk itu. Yang berubah adalah definisi promo
 * logis: dulu satu per (scope, menu), sekarang satu per (scope, menu,
 * KONFIGURASI). Jadi outlet A bisa punya diskon 10% semua menu sementara
 * outlet B Beli 1 Gratis 1 semua menu — di DB keduanya baris `global` biasa,
 * di layar admin tampil sebagai dua promo berbeda dengan daftar outlet
 * masing-masing. Satu outlet hanya boleh ada di satu promo per (scope, menu),
 * karena kasir membaca tepat satu baris untuk kunci itu.
 *
 * Kolom `is_assigned`: outlet yang tidak dipilih admin barisnya tetap ada
 * (riwayat pemakaian & tautan ke order lama tidak hilang) tapi ditandai tidak
 * terpilih sekaligus dimatikan. Baris lama dari sebelum fitur ini tidak punya
 * nilai `is_assigned` yang eksplisit, jadi `null`/`undefined` selalu dibaca
 * sebagai TERPILIH agar promo yang sudah berjalan tidak tiba-tiba hilang.
 */

export type PromoScope = 'global' | 'item'

export type PromoOutletRow = {
  id?: string
  outlet_id?: string | null
  scope: PromoScope
  menu_item_id?: string | null
  is_assigned?: boolean | null
  quota_pool_id?: string | null
  current_usage?: number | null
}

export type PromoOutletSelection = {
  scope: PromoScope
  menu_item_id?: string | null
  outlet_ids?: string[] | null
}

/** Identitas kunci baris per outlet: (scope, menu). Satu outlet = satu baris per kunci. */
export function promoOutletKey(promo: { scope: PromoScope; menu_item_id?: string | null }): string {
  return `${promo.scope}_${promo.menu_item_id || 'null'}`
}

export function isRowAssigned(row: { is_assigned?: boolean | null }): boolean {
  return row.is_assigned !== false
}

/**
 * Kolom yang menentukan "ini promo yang sama". Dua baris dengan nilai kolom
 * ini identik adalah satu promo logis di dua outlet; kalau berbeda, itu dua
 * promo. `reward_menu_item_id` SENGAJA tidak ikut: server menukarnya per
 * outlet ke menu bernama sama milik outlet itu (lihat resolveRewardMenuForOutlet),
 * jadi nilainya memang wajar berbeda antar outlet untuk promo yang sama.
 * `quota_pool_id` juga tidak ikut — ia turunan, bukan konfigurasi.
 */
export const PROMO_CONFIG_FIELDS = [
  'is_active',
  'discount_type',
  'discount_value',
  'promo_name',
  'min_purchase',
  'usage_limit',
  'quota_scope',
  'start_date',
  'end_date',
  'daily_start_time',
  'daily_end_time',
  'daily_schedule',
  'apply_to_food_apps',
  'buy_quantity',
  'get_quantity',
  'excluded_menu_item_ids',
] as const

const normalizeConfigValue = (field: string, value: unknown): unknown => {
  // Kolom daftar: tidak ada / null / [] semuanya berarti "kosong".
  if (field === 'daily_schedule') return Array.isArray(value) ? value : []
  if (field === 'excluded_menu_item_ids') return Array.isArray(value) ? [...value].map(String).sort() : []
  if (value === undefined || value === '') return null
  if (field === 'promo_name') return String(value ?? '').trim() || null
  if (field === 'discount_value' || field === 'min_purchase' || field === 'usage_limit' || field === 'buy_quantity' || field === 'get_quantity') {
    return value === null ? null : Number(value)
  }
  if (field === 'start_date' || field === 'end_date') {
    // Timestamp dari PostgREST dan dari form bisa beda format penulisan untuk
    // instant yang sama; disamakan ke epoch agar tidak terpecah palsu.
    const t = value === null ? NaN : new Date(String(value)).getTime()
    return Number.isNaN(t) ? value : t
  }
  return value
}

/** Sidik jari konfigurasi; baris dengan sidik jari sama = satu promo logis. */
export function promoConfigSignature(row: Record<string, unknown>): string {
  return JSON.stringify(PROMO_CONFIG_FIELDS.map(field => normalizeConfigValue(field, row[field])))
}

/**
 * Outlet yang benar-benar dituju sebuah promo.
 *
 * Field yang tidak diisi sama sekali berarti semua outlet aktif — itu perilaku
 * lama halaman promo (selalu diterapkan ke seluruh cabang), jadi payload lama
 * yang belum mengenal `outlet_ids` tetap bekerja seperti sebelumnya. Sebaliknya
 * daftar kosong yang dikirim EKSPLISIT berarti admin memang belum memilih outlet
 * apa pun, bukan semua outlet; itu dilaporkan sebagai kosong supaya bisa ditolak
 * saat promo hendak diaktifkan. Outlet yang sudah tidak aktif dibuang, dan
 * urutannya mengikuti daftar outlet aktif supaya hasilnya stabil.
 */
export function resolvePromoOutletIds(
  promo: PromoOutletSelection,
  activeOutletIds: string[],
): string[] {
  const requested = promo.outlet_ids
  if (!Array.isArray(requested)) return [...activeOutletIds]
  const wanted = new Set(requested)
  return activeOutletIds.filter(id => wanted.has(id))
}

export type GroupedPromo<Row extends PromoOutletRow> = {
  /** Kunci baris (scope, menu) — bisa dipakai bersama beberapa grup. */
  key: string
  /** Baris contoh yang nilainya ditampilkan di form (semua baris satu grup identik). */
  representative: Row
  outletIds: string[]
  currentUsage: number
}

/**
 * Kumpulkan baris per-outlet menjadi promo logis, lengkap dengan daftar outlet
 * yang terpilih. Baris terpilih dengan konfigurasi berbeda menjadi grup
 * berbeda. Kunci yang semua barisnya dilepas tetap menghasilkan satu grup
 * (daftar outlet kosong) supaya konfigurasinya tidak hilang dari layar.
 * Urutan grup mengikuti kemunculan pertama barisnya.
 */
export function groupPromoRows<Row extends PromoOutletRow>(
  rows: Row[],
  activeOutletIds: string[],
): GroupedPromo<Row>[] {
  const outletRank = new Map(activeOutletIds.map((id, index) => [id, index]))
  const byKey = new Map<string, Row[]>()

  for (const row of rows) {
    if (!row.outlet_id || !outletRank.has(row.outlet_id)) continue
    const key = promoOutletKey(row)
    const bucket = byKey.get(key)
    if (bucket) bucket.push(row)
    else byKey.set(key, [row])
  }

  // PostgREST tidak menjamin urutan baris. Diurutkan mengikuti daftar outlet
  // aktif supaya baris contoh yang dipakai form selalu sama tiap kali dibuka.
  for (const bucket of byKey.values()) {
    bucket.sort(
      (a, b) => (outletRank.get(a.outlet_id || '') ?? 0) - (outletRank.get(b.outlet_id || '') ?? 0),
    )
  }

  const result: GroupedPromo<Row>[] = []
  for (const [key, bucket] of byKey) {
    const assigned = bucket.filter(isRowAssigned)

    if (assigned.length === 0) {
      // Kalau semua outlet dilepas, nilai form tetap diambil dari baris mana pun
      // supaya konfigurasinya tidak hilang saat admin membuka halaman lagi.
      result.push({ key, representative: bucket[0], outletIds: [], currentUsage: usageOf(bucket, bucket[0], bucket) })
      continue
    }

    const bySignature = new Map<string, Row[]>()
    for (const row of assigned) {
      const sig = promoConfigSignature(row as Record<string, unknown>)
      const group = bySignature.get(sig)
      if (group) group.push(row)
      else bySignature.set(sig, [row])
    }

    for (const group of bySignature.values()) {
      const representative = group[0]
      const outletIds = activeOutletIds.filter(id => group.some(row => row.outlet_id === id))
      result.push({ key, representative, outletIds, currentUsage: usageOf(group, representative, bucket) })
    }
  }

  return result
}

/**
 * Kuota global dibagi bersama lewat pool (termasuk baris yang dilepas tapi
 * masih menunjuk pool itu); kuota per-outlet ditampilkan sebagai pemakaian
 * tertinggi di antara outlet grup.
 */
function usageOf<Row extends PromoOutletRow>(group: Row[], representative: Row, allRowsOfKey: Row[]): number {
  const poolId = representative.quota_pool_id || null
  const source = poolId ? allRowsOfKey.filter(row => row.quota_pool_id === poolId) : group
  return source.reduce((max, row) => Math.max(max, Number(row.current_usage) || 0), 0)
}

export type PromoOverlap = {
  key: string
  outletId: string
  /** Indeks promo (dalam daftar masukan) yang sama-sama mengklaim outlet itu. */
  promoIndexes: number[]
}

/**
 * Cari outlet yang diklaim lebih dari satu promo pada kunci yang sama. Promo
 * yang tidak punya daftar outlet eksplisit dianggap mengklaim semua outlet
 * aktif (perilaku lama), jadi dua promo lama tanpa `outlet_ids` pada kunci
 * yang sama pasti bertabrakan — itu memang tidak bisa disimpan.
 */
export function findPromoOutletOverlaps(
  promos: PromoOutletSelection[],
  activeOutletIds: string[],
): PromoOverlap[] {
  const claims = new Map<string, number[]>()
  promos.forEach((promo, index) => {
    const key = promoOutletKey(promo)
    for (const outletId of resolvePromoOutletIds(promo, activeOutletIds)) {
      const claimKey = `${key}|${outletId}`
      const list = claims.get(claimKey)
      if (list) list.push(index)
      else claims.set(claimKey, [index])
    }
  })

  const overlaps: PromoOverlap[] = []
  for (const [claimKey, promoIndexes] of claims) {
    if (promoIndexes.length < 2) continue
    const sep = claimKey.lastIndexOf('|')
    overlaps.push({ key: claimKey.slice(0, sep), outletId: claimKey.slice(sep + 1), promoIndexes })
  }
  return overlaps
}
