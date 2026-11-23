/**
 * Pratinjau perubahan batas minimum (threshold) di dashboard SPV sebelum data
 * server terbarui. Threshold berskala SATUAN BESAR, jadi pembandingnya wajib
 * `current_qty_besar` (sama dengan `monitoring_view_spv`) — `current_qty` adalah
 * saldo mentah yang sering tersimpan dalam gram/satuan kecil.
 *
 * Catatan: view juga menandai 'below' bila proyeksi porsi resep habis dalam
 * beberapa hari; pratinjau ini hanya memakai aturan batas, dan dibuang begitu
 * data server membawa threshold baru (lihat `buangOverrideTersimpan`).
 */

export type StatusStok = 'below' | 'warning' | 'ok'

export function statusDariThreshold(qtyBesar: number, threshold: number): StatusStok {
  if (qtyBesar < threshold / 2) return 'below'
  if (qtyBesar < threshold) return 'warning'
  return 'ok'
}

type ItemThreshold = { outlet_id: string; bahan_baku_id: string; threshold: number }

export const kunciOverride = (outletId: string, bahanBakuId: string) => `${outletId}-${bahanBakuId}`

export function terapkanOverrideThreshold<
  T extends ItemThreshold & { current_qty_besar: number; status: StatusStok | string }
>(items: T[], overrides: Record<string, number>): T[] {
  return items.map((item) => {
    const nilai = overrides[kunciOverride(item.outlet_id, item.bahan_baku_id)]
    if (nilai === undefined) return item
    return { ...item, threshold: nilai, status: statusDariThreshold(Number(item.current_qty_besar) || 0, nilai) }
  })
}

/** Buang override yang sudah tercermin di data server (threshold sama). */
export function buangOverrideTersimpan(
  overrides: Record<string, number>,
  items: ItemThreshold[]
): Record<string, number> {
  const keys = Object.keys(overrides)
  if (keys.length === 0) return overrides
  const serverByKey = new Map(items.map((it) => [kunciOverride(it.outlet_id, it.bahan_baku_id), Number(it.threshold)]))
  let berubah = false
  const next: Record<string, number> = {}
  for (const k of keys) {
    if (serverByKey.get(k) === overrides[k]) {
      berubah = true
      continue
    }
    next[k] = overrides[k]
  }
  return berubah ? next : overrides
}
