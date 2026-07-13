export interface BahanBakuHargaRow {
  harga_beli: number
  harga_updated_at: string | null
}

/** Bentuk mentah dari Supabase: embed bisa object, array, atau null. */
export interface BahanBakuRaw {
  id: string
  nama: string
  image_url: string | null
  image_url_tengah: string | null
  image_url_kecil: string | null
  image_urls: string[] | null
  satuan: string
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  faktor_tampilan: number | null
  kategori: string
  bahan_baku_harga: BahanBakuHargaRow | BahanBakuHargaRow[] | null
}

export interface BahanBakuWithHarga {
  id: string
  nama: string
  image_url: string | null
  image_url_tengah: string | null
  image_url_kecil: string | null
  image_urls: string[] | null
  satuan: string
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  faktor_tampilan: number | null
  kategori: string
  harga: BahanBakuHargaRow | null
}

export function normalizeBahanBaku(raw: BahanBakuRaw): BahanBakuWithHarga {
  const embed = raw.bahan_baku_harga
  const harga = Array.isArray(embed) ? (embed[0] ?? null) : (embed ?? null)
  return { 
    id: raw.id, 
    nama: raw.nama, 
    image_url: raw.image_url,
    image_url_tengah: raw.image_url_tengah,
    image_url_kecil: raw.image_url_kecil,
    image_urls: raw.image_urls,
    satuan: raw.satuan, 
    satuan_tengah: raw.satuan_tengah,
    faktor_tengah: raw.faktor_tengah,
    satuan_kecil: raw.satuan_kecil, 
    faktor_tampilan: raw.faktor_tampilan, 
    kategori: raw.kategori, 
    harga 
  }
}

export type SortOption = 'nama-asc' | 'nama-desc' | 'harga-asc' | 'harga-desc' | 'kategori-asc' | 'kategori-desc'

export function filterAndSortBahanBaku(rows: BahanBakuWithHarga[], search: string, sortBy: SortOption = 'nama-asc'): BahanBakuWithHarga[] {
  const q = search.trim().toLowerCase()
  let result = rows
  
  if (q !== '') {
    result = result.filter((r) => r.nama.toLowerCase().includes(q))
  }
  
  return result.slice().sort((a, b) => {
    switch (sortBy) {
      case 'nama-asc':
        return a.nama.localeCompare(b.nama)
      case 'nama-desc':
        return b.nama.localeCompare(a.nama)
      case 'kategori-asc':
        return a.kategori.localeCompare(b.kategori) || a.nama.localeCompare(b.nama)
      case 'kategori-desc':
        return b.kategori.localeCompare(a.kategori) || a.nama.localeCompare(b.nama)
      case 'harga-asc': {
        const pA = a.harga?.harga_beli ?? Infinity
        const pB = b.harga?.harga_beli ?? Infinity
        return pA - pB
      }
      case 'harga-desc': {
        const pA = a.harga?.harga_beli ?? -1
        const pB = b.harga?.harga_beli ?? -1
        return pB - pA
      }
      default:
        return 0
    }
  })
}

/** Ubah input teks harga jadi angka >= 0, atau null bila tak valid/kosong. */
export function parsePriceInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : null
}
