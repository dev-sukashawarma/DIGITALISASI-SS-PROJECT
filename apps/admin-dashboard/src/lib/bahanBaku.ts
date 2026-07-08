export interface BahanBakuHargaRow {
  harga_beli: number
  harga_updated_at: string | null
}

/** Bentuk mentah dari Supabase: embed bisa object, array, atau null. */
export interface BahanBakuRaw {
  id: string
  nama: string
  satuan: string
  satuan_kecil: string | null
  faktor_konversi: number | null
  kategori: string
  bahan_baku_harga: BahanBakuHargaRow | BahanBakuHargaRow[] | null
}

export interface BahanBakuWithHarga {
  id: string
  nama: string
  satuan: string
  satuan_kecil: string | null
  faktor_konversi: number | null
  kategori: string
  harga: BahanBakuHargaRow | null
}

export function normalizeBahanBaku(raw: BahanBakuRaw): BahanBakuWithHarga {
  const embed = raw.bahan_baku_harga
  const harga = Array.isArray(embed) ? (embed[0] ?? null) : (embed ?? null)
  return { id: raw.id, nama: raw.nama, satuan: raw.satuan, satuan_kecil: raw.satuan_kecil, faktor_konversi: raw.faktor_konversi, kategori: raw.kategori, harga }
}

export function filterBahanBaku(rows: BahanBakuWithHarga[], search: string): BahanBakuWithHarga[] {
  const q = search.trim().toLowerCase()
  if (q === '') return rows
  return rows.filter((r) => r.nama.toLowerCase().includes(q))
}

/** Ubah input teks harga jadi angka >= 0, atau null bila tak valid/kosong. */
export function parsePriceInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : null
}
