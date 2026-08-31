// Perhitungan HPP resep (standard cost) untuk kartu COGS.
// Subtotal dihitung dari istilah pembelian kartu: harga_beli per kemasan / isi kemasan.
// Contoh: AYAM Rp47.800 / 1000 gram, dipakai 100 gram -> Rp4.780.

export type HppBahan = {
  hargaBeliDisplay: number // harga beli per kemasan (mis. 47800 per 1000 gram)
  kemasanQty: number // isi kemasan (mis. 1000)
  kemasanSatuan: string // satuan kemasan (mis. 'gram')
}

export type HppItemInput = {
  bahan_baku_id: string
  qty_per_porsi: number
  satuan: string
}

export type HppLine = {
  bahan_baku_id: string
  qty_per_porsi: number
  satuan: string
  hargaBeliDisplay: number
  kemasanQty: number
  kemasanSatuan: string
  subtotal: number
  hasPrice: boolean
}

export type HppResult = {
  lines: HppLine[]
  materialTotal: number
  buffer: number
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
  buffer: number = 0,
): HppResult {
  let anyMissingPrice = false
  const lines: HppLine[] = items.map((it) => {
    const bb = bahanById[it.bahan_baku_id]
    const harga = bb?.hargaBeliDisplay ?? 0
    const kemasanQty = bb?.kemasanQty ?? 0
    const hasPrice = harga > 0 && kemasanQty > 0
    if (!hasPrice) anyMissingPrice = true
    const subtotal = hasPrice ? Math.round((harga / kemasanQty) * (it.qty_per_porsi || 0)) : 0
    return {
      bahan_baku_id: it.bahan_baku_id,
      qty_per_porsi: it.qty_per_porsi,
      satuan: it.satuan,
      hargaBeliDisplay: harga,
      kemasanQty,
      kemasanSatuan: bb?.kemasanSatuan ?? '',
      subtotal,
      hasPrice,
    }
  })

  const materialTotal = lines.reduce((s, l) => s + l.subtotal, 0)
  const safeBuffer = Math.max(0, buffer || 0)
  const totalHpp = materialTotal + safeBuffer
  const marginRp = hargaJual - totalHpp
  const marginPct = hargaJual > 0 ? (marginRp / hargaJual) * 100 : null
  const foodcostPct = hargaJual > 0 ? (totalHpp / hargaJual) * 100 : null

  return {
    lines,
    materialTotal,
    buffer: safeBuffer,
    totalHpp,
    marginRp,
    marginPct,
    foodcostPct,
    anyMissingPrice,
  }
}

