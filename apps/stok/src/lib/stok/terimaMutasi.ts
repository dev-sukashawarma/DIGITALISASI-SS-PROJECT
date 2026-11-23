// Jumlah yang benar-benar diterima saat menerima mutasi antar-outlet.
// Dulu qty_diterima selalu = qty_dikirim, sehingga kondisi "Rusak"/"Hilang"
// tetap menambah stok outlet tujuan sebanyak yang dikirim.

export type KondisiTerima = 'baik' | 'rusak' | 'hilang_qty'

export type HasilQtyDiterima = { ok: true; qty: number } | { ok: false; error: string }

// Tampilan dibulatkan 2 desimal; isian yang selisihnya < 0,005 dianggap = dikirim.
const TOLERANSI_DIST = 0.005

/**
 * @param qtyDikirimBase qty dikirim dalam satuan simpan (basis)
 * @param qtyDikirimDist qty dikirim dalam satuan distribusi (tanpa pembulatan)
 * @param inputDist isian pengguna dalam satuan distribusi (koma atau titik)
 * @param keBase konversi satuan distribusi → basis
 */
export function hitungQtyDiterima(p: {
  kondisi: KondisiTerima
  inputDist: string | undefined
  qtyDikirimBase: number
  qtyDikirimDist: number
  keBase: (dist: number) => number
}): HasilQtyDiterima {
  if (p.kondisi === 'baik') return { ok: true, qty: p.qtyDikirimBase }
  const raw = (p.inputDist ?? '').trim()
  if (raw === '') return { ok: true, qty: p.qtyDikirimBase }

  const n = Number(raw.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: 'Jumlah diterima harus angka 0 atau lebih' }
  }
  if (n > p.qtyDikirimDist + TOLERANSI_DIST) {
    return { ok: false, error: 'Jumlah diterima tidak boleh melebihi jumlah dikirim' }
  }
  if (Math.abs(n - p.qtyDikirimDist) < TOLERANSI_DIST) return { ok: true, qty: p.qtyDikirimBase }

  const base = Math.round(p.keBase(n) * 10000) / 10000
  return { ok: true, qty: Math.min(Math.max(base, 0), p.qtyDikirimBase) }
}
