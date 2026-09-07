// apps/admin-dashboard/src/lib/wasteMetrics.ts
// Fungsi murni tambahan untuk dashboard waste. Yang sudah ada di
// wasteBreakdown.ts (aggregateByOutlet/Reason/Date) dipakai ulang, tidak
// diduplikasi di sini.

/** Satu baris hasil get_waste_summary_v2. */
export interface WasteSummaryRow {
  outlet_id: string
  outlet_name: string
  bahan_baku_id: string
  bahan_nama: string
  reason: string
  tanggal: string // 'YYYY-MM-DD'
  qty: number
  qty_kecil: number
  satuan_kecil: string
  hpp_kecil: number
  nilai: number
  jumlah_insiden: number
}

export interface BahanSpreadAgg {
  id: string
  name: string
  nilai: number
  qty_kecil: number
  satuan_kecil: string
  /** Berapa outlet berbeda melaporkan bahan ini. 1 = masalah lokal, banyak = sistemik. */
  outletCount: number
}

/**
 * Perubahan persen terhadap periode sebelumnya.
 * previous <= 0 -> null (dirender "N/A"), bukan Infinity.
 */
export function computeDeltaPct(current: number, previous: number): number | null {
  if (!(previous > 0)) return null
  return ((current - previous) / previous) * 100
}

/**
 * Waste sebagai persen omzet — pembanding adil antar-outlet berbeda ukuran.
 * omzet <= 0 -> null (dirender "N/A"), bukan Infinity.
 */
export function computeWastePctOmzet(nilai: number, omzet: number): number | null {
  if (!(omzet > 0)) return null
  return (nilai / omzet) * 100
}

/**
 * Ranking bahan penyumbang kerugian, plus sebaran outlet. Sebaran memisahkan
 * masalah lokal (1 outlet: penyimpanan/shift) dari sistemik (banyak outlet:
 * porsi resep salah atau batch supplier jelek) — penanganannya beda total.
 */
export function aggregateByBahanWithSpread(rows: WasteSummaryRow[]): BahanSpreadAgg[] {
  const map = new Map<string, BahanSpreadAgg & { outlets: Set<string> }>()
  for (const r of rows) {
    const cur =
      map.get(r.bahan_baku_id) ??
      {
        id: r.bahan_baku_id,
        name: r.bahan_nama,
        nilai: 0,
        qty_kecil: 0,
        satuan_kecil: r.satuan_kecil,
        outletCount: 0,
        outlets: new Set<string>(),
      }
    cur.nilai += r.nilai
    cur.qty_kecil += r.qty_kecil
    cur.outlets.add(r.outlet_id)
    map.set(r.bahan_baku_id, cur)
  }
  return [...map.values()]
    .map(({ outlets, ...rest }) => ({ ...rest, outletCount: outlets.size }))
    .sort((a, b) => b.nilai - a.nilai)
}
