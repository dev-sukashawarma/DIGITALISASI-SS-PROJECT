export type HppBahan = { harga_beli: number; faktor_konversi: number }

export type HppItemInput = {
  bahan_baku_id: string
  qty_per_porsi: number
  satuan: string
}

export type HppLine = {
  bahan_baku_id: string
  qty_per_porsi: number
  satuan: string
  hargaPerSatuanPakai: number
  subtotal: number
  hasPrice: boolean
}

export type HppResult = {
  lines: HppLine[]
  totalHpp: number
  marginRp: number
  marginPct: number | null
  foodcostPct: number | null
  anyMissingPrice: boolean
}

export function computeResepHpp(
  items: HppItemInput[],
  bahanById: Record<string, HppBahan>,
  hargaJual: number,
): HppResult {
  let anyMissingPrice = false
  const lines: HppLine[] = items.map((it) => {
    const bb = bahanById[it.bahan_baku_id]
    const harga = bb?.harga_beli ?? 0
    const faktor = bb?.faktor_konversi ?? 1
    const hasPrice = harga > 0
    if (!hasPrice) anyMissingPrice = true
    const hargaPerSatuanPakai = hasPrice && faktor > 0 ? harga / faktor : 0
    const subtotal = Math.round(hargaPerSatuanPakai * (it.qty_per_porsi || 0))
    return {
      bahan_baku_id: it.bahan_baku_id,
      qty_per_porsi: it.qty_per_porsi,
      satuan: it.satuan,
      hargaPerSatuanPakai,
      subtotal,
      hasPrice,
    }
  })

  const totalHpp = lines.reduce((s, l) => s + l.subtotal, 0)
  const marginRp = hargaJual - totalHpp
  const marginPct = hargaJual > 0 ? (marginRp / hargaJual) * 100 : null
  const foodcostPct = hargaJual > 0 ? (totalHpp / hargaJual) * 100 : null

  return { lines, totalHpp, marginRp, marginPct, foodcostPct, anyMissingPrice }
}
