import { SLUG_APLIKASI } from './hargaAplikasi'

export type MenuApp = {
  id: string
  name: string
  price: number
  channel_prices: unknown
  image_url: string | null
  foto_app: string | null
  deskripsi_app: string | null
  tampil_di_app: boolean
  /** Milik POS. `false` = menu tidak bisa dipesan meski tayang (gateway fail-closed). */
  is_available: boolean
  /**
   * `menu_items` tabel campuran: baris ber-`outlet_id` hanya berlaku di outlet itu.
   * Gateway menghormatinya (`outlet_id.is.null,outlet_id.eq.<id>`) dan POS aktif
   * membuat baris berlingkup. Klaim "serentak di N outlet" hanya benar untuk `null`.
   */
  outlet_id: string | null
  categories: { name: string } | { name: string }[] | null
}

/** PostgREST mengembalikan objek untuk many-to-one, tapi array saat kardinalitasnya tak pasti. */
export function namaKategori(mentah: MenuApp['categories']): string {
  const obj = Array.isArray(mentah) ? mentah[0] : mentah
  return obj?.name ?? '—'
}

/**
 * Harga aplikasi untuk ditampilkan; `null` berarti ikut harga kasir.
 *
 * Aturannya harus sama dengan `hargaAplikasi` di
 * `apps/retail-gateway/src/lib/catalog.ts`: nol dan kosong berarti tidak diisi,
 * bukan gratis. Kalau dua sisi berbeda, admin melihat angka yang bukan yang
 * ditagih ke pelanggan.
 */
export function hargaAplikasiTampil(channelPrices: unknown): number | null {
  let obj: unknown = channelPrices
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj) } catch { return null }
  }
  if (typeof obj !== 'object' || obj === null) return null
  const nilai = (obj as Record<string, unknown>)[SLUG_APLIKASI]
  const angka = Number(nilai)
  return Number.isFinite(angka) && angka > 0 ? angka : null
}
