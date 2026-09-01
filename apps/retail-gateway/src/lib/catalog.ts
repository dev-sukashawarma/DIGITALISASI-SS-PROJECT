import { createServiceClient } from './supabase'

const UMUR_CACHE_MS = 5 * 60 * 1000

export type MenuApp = {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_available: boolean
  category_id: string | null
  sort_order: number | null
}

type Baris = Record<string, unknown>

/**
 * Menurunkan baris mentah menjadi bentuk yang dikonsumsi aplikasi.
 * Kolom khusus app menang atas kolom kasir; kalau kosong, jatuh ke kolom kasir.
 */
export function bersihkanKatalog(rows: unknown[]): MenuApp[] {
  const hasil: MenuApp[] = []

  for (const mentah of rows) {
    const r = mentah as Baris
    if (typeof r.id !== 'string' || typeof r.name !== 'string') continue

    hasil.push({
      id: r.id,
      name: r.name,
      description:
        (r.deskripsi_app as string | null) ?? (r.description as string | null) ?? null,
      price: Number(r.price ?? 0),
      image_url: (r.foto_app as string | null) ?? (r.image_url as string | null) ?? null,
      is_available: r.is_available !== false,
      category_id: (r.category_id as string | null) ?? null,
      sort_order: (r.sort_order as number | null) ?? null,
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
      'id, name, description, deskripsi_app, price, image_url, foto_app, is_available, category_id, sort_order'
    )
    .eq('outlet_id', outletId)
    .eq('tampil_di_app', true)
    .order('sort_order', { ascending: true })

  if (error) {
    // Cache basi lebih baik daripada layar kosong.
    if (tersimpan) return tersimpan.data
    throw new Error(`Gagal mengambil katalog: ${error.message}`)
  }

  const bersih = bersihkanKatalog(data ?? [])
  cache.set(outletId, { pada: Date.now(), data: bersih })
  return bersih
}
