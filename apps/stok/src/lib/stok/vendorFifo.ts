export const TIDAK_TERCATAT = 'Vendor tidak tercatat'

export interface FifoLayerIn {
  qty: number
  vendor: string | null
  /** Harga barang masuk per SATUAN KECIL (dari nilai dokumen surat jalan); null = tidak diketahui. */
  harga?: number | null
}

export interface FifoWindowRow {
  id: string
  qty: number // bertanda: >0 masuk, <0 keluar
  vendor: string | null // vendor barang masuk (dari surat jalan / PO / drop-ship)
  harga?: number | null // harga barang masuk per satuan kecil
}

export interface FifoPart {
  vendor: string
  harga: number | null
  qty: number
}

const hargaValid = (h: number | null | undefined): number | null =>
  h !== null && h !== undefined && Number(h) > 0 ? Number(h) : null

/** Barang masuk (qty > 0) membentuk lapisan; keluar mengonsumsi lapisan tertua dulu (FIFO). */
export function attributeFifo(params: {
  openingBalance: number
  priorInflowsNewestFirst: FifoLayerIn[]
  windowRows: FifoWindowRow[] // urut kronologis
}): Map<string, FifoPart[]> {
  const layers: FifoPart[] = []

  // Lapisan saldo awal: telusuri mundur kiriman terakhir sebelum periode sampai menutup saldo.
  let remaining = Math.max(params.openingBalance, 0)
  const opening: FifoPart[] = []
  for (const p of params.priorInflowsNewestFirst) {
    if (remaining <= 0.0001) break
    const take = Math.min(p.qty, remaining)
    opening.unshift({ vendor: p.vendor || TIDAK_TERCATAT, harga: hargaValid(p.harga), qty: take })
    remaining -= take
  }
  if (remaining > 0.0001) opening.unshift({ vendor: TIDAK_TERCATAT, harga: null, qty: remaining })
  layers.push(...opening)

  const result = new Map<string, FifoPart[]>()
  for (const row of params.windowRows) {
    if (row.qty > 0) {
      layers.push({ vendor: row.vendor || TIDAK_TERCATAT, harga: hargaValid(row.harga), qty: row.qty })
      continue
    }
    let need = Math.abs(row.qty)
    // Kunci vendor+harga: vendor sama dengan harga berbeda dinilai terpisah.
    const parts = new Map<string, FifoPart>()
    const tambah = (vendor: string, harga: number | null, qty: number) => {
      const k = `${vendor}|${harga ?? ''}`
      const p = parts.get(k)
      if (p) p.qty += qty
      else parts.set(k, { vendor, harga, qty })
    }
    while (need > 0.0001 && layers.length > 0) {
      const head = layers[0]
      const take = Math.min(head.qty, need)
      tambah(head.vendor, head.harga, take)
      head.qty -= take
      need -= take
      if (head.qty <= 0.0001) layers.shift()
    }
    if (need > 0.0001) tambah(TIDAK_TERCATAT, null, need)
    result.set(row.id, [...parts.values()])
  }
  return result
}

export function labelFifo(parts: { vendor: string }[] | undefined): string | null {
  if (!parts || parts.length === 0) return null
  return [...new Set(parts.map((p) => p.vendor))].join(' + ')
}

/**
 * Nilai rupiah barang keluar menurut lapisan FIFO: tiap bagian dinilai dengan harga
 * kirimannya; bagian tanpa harga (vendor tidak tercatat / tanpa surat jalan) memakai
 * harga master. `qty` dan harga sama-sama per satuan kecil, jadi tidak bergantung
 * pada definisi satuan besar yang bisa berubah.
 */
export function nilaiFifoRp(parts: FifoPart[] | undefined, hargaMasterKecil: number): number {
  if (!parts || parts.length === 0) return 0
  let total = 0
  for (const p of parts) total += p.qty * (p.harga !== null ? p.harga : hargaMasterKecil)
  return Math.round(total)
}

/** Harga rata-rata (per satuan kecil) bagian yang harganya diketahui; null bila tak ada. */
export function hargaRataFifo(parts: FifoPart[] | undefined): number | null {
  const ber = (parts || []).filter((p) => p.harga !== null && p.qty > 0)
  const qty = ber.reduce((s, p) => s + p.qty, 0)
  if (qty <= 0) return null
  return ber.reduce((s, p) => s + (p.harga as number) * p.qty, 0) / qty
}
