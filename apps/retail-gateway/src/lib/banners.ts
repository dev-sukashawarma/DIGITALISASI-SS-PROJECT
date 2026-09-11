/**
 * Pemetaan baris `app_banners` menjadi bentuk yang dikonsumsi aplikasi.
 *
 * Baris yang tidak utuh DIBUANG, bukan dikirim setengah jadi. Banner adalah
 * permukaan promosi paling menonjol di Beranda; baris rusak yang lolos akan
 * tampil sebagai kartu kosong yang bisa diketuk, dan itu lebih buruk
 * daripada tidak ada banner sama sekali.
 */

const AKSI_SAH = ['tidak_ada', 'menu', 'menu_item'] as const
export type AksiBanner = (typeof AKSI_SAH)[number]

export type BannerApp = {
  id: string
  badge: string | null
  judul: string
  subjudul: string | null
  teks_tombol: string | null
  gambar_url: string | null
  aksi: AksiBanner
  target_menu_item_id: string | null
  urutan: number
}

/** Teks kosong dari formulir berarti "tidak diisi", bukan string kosong. */
function teks(nilai: unknown): string | null {
  if (typeof nilai !== 'string') return null
  const rapi = nilai.trim()
  return rapi === '' ? null : rapi
}

export function petakanBanner(baris: unknown): BannerApp | null {
  if (typeof baris !== 'object' || baris === null) return null
  const r = baris as Record<string, unknown>

  const id = teks(r.id)
  const judul = teks(r.judul)
  if (!id || !judul) return null

  const aksi = teks(r.aksi) ?? 'tidak_ada'
  if (!(AKSI_SAH as readonly string[]).includes(aksi)) return null

  const target = teks(r.target_menu_item_id)
  // Cerminan CHECK di basis data. Diperiksa lagi di sini karena baris bisa
  // lahir sebelum constraint itu ada, atau lewat jalur lain.
  if (aksi === 'menu_item' && !target) return null
  if (aksi !== 'menu_item' && target) return null

  return {
    id,
    badge: teks(r.badge),
    judul,
    subjudul: teks(r.subjudul),
    teks_tombol: teks(r.teks_tombol),
    gambar_url: teks(r.gambar_url),
    aksi: aksi as AksiBanner,
    target_menu_item_id: target,
    urutan: typeof r.urutan === 'number' ? r.urutan : 0,
  }
}

/**
 * Popup pemenang saat lebih dari satu aktif: `urutan` terkecil.
 *
 * Deterministik dengan sengaja -- admin tidak perlu diingatkan aturan
 * "cuma boleh satu" yang tak ditegakkan apa pun.
 */
export function pilihPopup(baris: BannerApp[]): BannerApp | null {
  if (baris.length === 0) return null
  return baris.reduce((menang, kini) => (kini.urutan < menang.urutan ? kini : menang))
}
