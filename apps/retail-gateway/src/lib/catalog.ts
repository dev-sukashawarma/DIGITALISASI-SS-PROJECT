import { createServiceClient } from './supabase'

const UMUR_CACHE_MS = 5 * 60 * 1000

/** Batas seberapa basi cache boleh disajikan saat database tak terjangkau. */
const UMUR_BASI_MAKS_MS = 30 * 60 * 1000

export type MenuApp = {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_available: boolean
  category_id: string | null
  sort_order: number | null
  // Nama kategori ikut dikirim supaya aplikasi tidak perlu memanggil endpoint
  // kedua hanya untuk menerjemahkan UUID jadi judul yang bisa dibaca manusia.
  category_name: string | null
  category_sort_order: number | null
}

type Baris = Record<string, unknown>

/**
 * Membaca hasil embed PostgREST `categories(name, sort_order)`.
 *
 * PostgREST mengembalikan objek untuk relasi many-to-one, tapi mengembalikan
 * ARRAY ketika ia tidak bisa memastikan kardinalitasnya. Kategori yang hilang
 * tidak boleh menjatuhkan seluruh katalog, jadi kedua bentuk diterima dan
 * apa pun selain itu berakhir sebagai null.
 */
function bacaKategori(mentah: unknown): { nama: string | null; urut: number | null } {
  const obj = Array.isArray(mentah) ? mentah[0] : mentah
  if (typeof obj !== 'object' || obj === null) return { nama: null, urut: null }
  const c = obj as Baris
  return {
    nama: typeof c.name === 'string' ? c.name : null,
    urut: typeof c.sort_order === 'number' ? c.sort_order : null,
  }
}

/**
 * Menurunkan baris mentah menjadi bentuk yang dikonsumsi aplikasi.
 * Kolom khusus app menang atas kolom kasir; kalau kosong, jatuh ke kolom kasir.
 */
export function bersihkanKatalog(rows: unknown[]): MenuApp[] {
  const hasil: MenuApp[] = []

  for (const mentah of rows) {
    const r = mentah as Baris
    if (typeof r.id !== 'string' || typeof r.name !== 'string') continue

    // Harga tak sah = item tidak boleh muncul sama sekali. `Number('abc')`
    // menghasilkan NaN, dan JSON.stringify mengubah NaN jadi null diam-diam --
    // harga hilang tanpa satu pun error tercatat.
    const harga = Number(r.price)
    if (!Number.isFinite(harga) || harga < 0) continue

    const kategori = bacaKategori(r.categories)

    hasil.push({
      id: r.id,
      name: r.name,
      description:
        (r.deskripsi_app as string | null) ?? (r.description as string | null) ?? null,
      price: harga,
      image_url: (r.foto_app as string | null) ?? (r.image_url as string | null) ?? null,
      // Gagal-tertutup. Ketersediaan yang tidak diketahui diperlakukan sebagai
      // habis: menyembunyikan item yang sebenarnya ada masih bisa diperbaiki
      // admin, sedangkan menjual item yang habis sudah terlanjur diterima
      // uangnya. Fungsi ini juga dipakai validasi checkout, jadi kelonggaran
      // di sini merambat sampai ke titik pembayaran.
      is_available: r.is_available === true,
      category_id: (r.category_id as string | null) ?? null,
      sort_order: (r.sort_order as number | null) ?? null,
      category_name: kategori.nama,
      category_sort_order: kategori.urut,
    })
  }

  return hasil
}

const cache = new Map<string, { pada: number; data: MenuApp[] }>()

export function kosongkanCacheKatalog(): void {
  cache.clear()
}

/**
 * Ambil katalog menu untuk satu outlet, dengan cache 5 menit per outlet.
 *
 * `paksaSegar` melewati cache HANYA untuk outlet yang diminta -- bukan
 * `kosongkanCacheKatalog()` (yang membuang cache semua outlet sekaligus).
 * Rencana awal memakai kosongkanCacheKatalog() sebelum ambil data segar,
 * tapi itu berarti satu checkout di outlet mana pun mematikan cache semua
 * outlet lain -- persis beban baca yang arsitektur cache ini dibangun untuk
 * dicegah.
 */
export async function ambilKatalog(
  outletId: string,
  paksaSegar = false
): Promise<MenuApp[]> {
  const tersimpan = cache.get(outletId)
  if (!paksaSegar && tersimpan && Date.now() - tersimpan.pada < UMUR_CACHE_MS) {
    return tersimpan.data
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('menu_items')
    .select(
      'id, name, description, deskripsi_app, price, image_url, foto_app, is_available, category_id, sort_order, categories(name, sort_order)'
    )
    .eq('outlet_id', outletId)
    .eq('tampil_di_app', true)
    .order('sort_order', { ascending: true })

  if (error) {
    // Cache basi lebih baik daripada layar kosong -- TAPI ada batasnya.
    // Kalau database tak terjangkau berjam-jam, menyajikan harga dan
    // ketersediaan seusia itu lebih berbahaya daripada gagal terang-terangan,
    // karena data yang sama dipakai di titik pembayaran.
    if (tersimpan && Date.now() - tersimpan.pada < UMUR_BASI_MAKS_MS) {
      return tersimpan.data
    }
    throw new Error(`Gagal mengambil katalog: ${error.message}`)
  }

  const bersih = bersihkanKatalog(data ?? [])
  cache.set(outletId, { pada: Date.now(), data: bersih })
  return bersih
}
