/**
 * Pemetaan antara "promo logis" yang dilihat admin dan baris `outlet_promos`.
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

/** Identitas promo logis; sengaja sama persis dengan kunci upsert di server action. */
export function promoOutletKey(promo: { scope: PromoScope; menu_item_id?: string | null }): string {
  return `${promo.scope}_${promo.menu_item_id || 'null'}`
}

export function isRowAssigned(row: { is_assigned?: boolean | null }): boolean {
  return row.is_assigned !== false
}

/**
 * Outlet yang benar-benar dituju sebuah promo.
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
  key: string
  /** Baris contoh yang nilainya ditampilkan di form (semua baris satu promo identik). */
  representative: Row
  outletIds: string[]
  currentUsage: number
}

/**
 * Kumpulkan baris per-outlet menjadi promo logis, lengkap dengan daftar outlet
 * yang terpilih. Urutan promo mengikuti kemunculan pertama barisnya.
 */
export function groupPromoRows<Row extends PromoOutletRow>(
  rows: Row[],
  activeOutletIds: string[],
): GroupedPromo<Row>[] {
  const outletRank = new Map(activeOutletIds.map((id, index) => [id, index]))
  const groups = new Map<string, Row[]>()

  for (const row of rows) {
    if (!row.outlet_id || !outletRank.has(row.outlet_id)) continue
    const key = promoOutletKey(row)
    const bucket = groups.get(key)
    if (bucket) bucket.push(row)
    else groups.set(key, [row])
  }

  for (const bucket of groups.values()) {
    bucket.sort(
      (a, b) => (outletRank.get(a.outlet_id || '') ?? 0) - (outletRank.get(b.outlet_id || '') ?? 0),
    )
  }

  const result: GroupedPromo<Row>[] = []
  for (const [key, bucket] of groups) {
    const assigned = bucket.filter(isRowAssigned)
    const representative = assigned[0] || bucket[0]
    const outletIds = activeOutletIds.filter(id =>
      assigned.some(row => row.outlet_id === id),
    )

    const poolId = representative.quota_pool_id || null
    const usageSource = poolId
      ? bucket.filter(row => row.quota_pool_id === poolId)
      : assigned.length > 0
        ? assigned
        : bucket
    const currentUsage = usageSource.reduce(
      (max, row) => Math.max(max, Number(row.current_usage) || 0),
      0,
    )

    result.push({ key, representative, outletIds, currentUsage })
  }

  return result
}
