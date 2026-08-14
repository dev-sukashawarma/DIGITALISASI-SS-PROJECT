export type SuggestionRow = {
  bahan_baku_id: string
  nama: string
  satuan: string
  stok: number
  threshold: number
  days_left: number | null
  permintaan_pending: number
  sudah_dipesan: number
  bahan_baku?: {
    kategori?: string
    satuan_tengah?: string | null
    faktor_tengah?: number | null
    satuan_kecil?: string | null
    faktor_tampilan?: number | null
  } | null
}

export type Tingkat = 'mendesak' | 'menipis' | 'aman'
export type SuggestionComputed = SuggestionRow & { qty_saran: number; tingkat: Tingkat; kategori: string }

const RANK: Record<Tingkat, number> = { mendesak: 0, menipis: 1, aman: 2 }

export function computeSuggestion(row: SuggestionRow, hariKedepan = 7): SuggestionComputed {
  const lajuPerHari = row.days_left && row.days_left > 0 ? row.stok / row.days_left : 0
  const kebutuhanPeriode = lajuPerHari * hariKedepan
  const raw = (row.threshold + row.permintaan_pending + kebutuhanPeriode) - row.stok - row.sudah_dipesan
  const qty_saran = Math.max(0, Math.round(raw))

  let tingkat: Tingkat
  if (row.stok < row.threshold || (row.days_left != null && row.days_left <= 3)) {
    tingkat = 'mendesak'
  } else if (row.days_left != null && row.days_left <= 7) {
    tingkat = 'menipis'
  } else {
    tingkat = 'aman'
  }
  
  const kategori = row.bahan_baku?.kategori || 'Tanpa Kategori'
  
  return { ...row, qty_saran, tingkat, kategori }
}

export function sortSuggestions(rows: SuggestionComputed[]): SuggestionComputed[] {
  return [...rows].sort((a, b) => RANK[a.tingkat] - RANK[b.tingkat])
}
