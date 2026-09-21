export const TIDAK_TERCATAT = 'Vendor tidak tercatat'

export interface FifoLayerIn {
  qty: number
  vendor: string | null
}

export interface FifoWindowRow {
  id: string
  qty: number // bertanda: >0 masuk, <0 keluar
  vendor: string | null // vendor barang masuk (dari surat jalan / PO / drop-ship)
}

/** Barang masuk (qty > 0) membentuk lapisan; keluar mengonsumsi lapisan tertua dulu (FIFO). */
export function attributeFifo(params: {
  openingBalance: number
  priorInflowsNewestFirst: FifoLayerIn[]
  windowRows: FifoWindowRow[] // urut kronologis
}): Map<string, { vendor: string; qty: number }[]> {
  const layers: { vendor: string; qty: number }[] = []

  // Lapisan saldo awal: telusuri mundur kiriman terakhir sebelum periode sampai menutup saldo.
  let remaining = Math.max(params.openingBalance, 0)
  const opening: { vendor: string; qty: number }[] = []
  for (const p of params.priorInflowsNewestFirst) {
    if (remaining <= 0.0001) break
    const take = Math.min(p.qty, remaining)
    opening.unshift({ vendor: p.vendor || TIDAK_TERCATAT, qty: take })
    remaining -= take
  }
  if (remaining > 0.0001) opening.unshift({ vendor: TIDAK_TERCATAT, qty: remaining })
  layers.push(...opening)

  const result = new Map<string, { vendor: string; qty: number }[]>()
  for (const row of params.windowRows) {
    if (row.qty > 0) {
      layers.push({ vendor: row.vendor || TIDAK_TERCATAT, qty: row.qty })
      continue
    }
    let need = Math.abs(row.qty)
    const parts = new Map<string, number>()
    while (need > 0.0001 && layers.length > 0) {
      const head = layers[0]
      const take = Math.min(head.qty, need)
      parts.set(head.vendor, (parts.get(head.vendor) || 0) + take)
      head.qty -= take
      need -= take
      if (head.qty <= 0.0001) layers.shift()
    }
    if (need > 0.0001) parts.set(TIDAK_TERCATAT, (parts.get(TIDAK_TERCATAT) || 0) + need)
    result.set(row.id, Array.from(parts.entries()).map(([vendor, qty]) => ({ vendor, qty })))
  }
  return result
}

export function labelFifo(parts: { vendor: string }[] | undefined): string | null {
  if (!parts || parts.length === 0) return null
  return parts.map((p) => p.vendor).join(' + ')
}
