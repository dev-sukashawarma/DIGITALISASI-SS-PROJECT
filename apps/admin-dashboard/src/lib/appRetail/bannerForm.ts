export type SlotBanner = 'carousel' | 'popup'
export type AksiBanner = 'tidak_ada' | 'menu' | 'menu_item'

export type InputBanner = {
  slot: SlotBanner
  urutan: number
  badge: string
  judul: string
  subjudul: string
  teksTombol: string
  gambarUrl: string
  aksi: AksiBanner
  targetMenuItemId: string | null
}

/**
 * Mencerminkan CHECK `app_banners_target_sesuai_aksi` di basis data.
 *
 * Diperiksa di sini supaya admin melihat pesan yang bisa dibaca manusia,
 * bukan galat constraint Postgres. Basis data tetap yang menegakkan --
 * pemeriksaan ini kenyamanan, bukan penjaga.
 */
export function periksaBanner(input: InputBanner): string | null {
  if (input.judul.trim() === '') return 'Judul wajib diisi.'

  const punyaTarget = (input.targetMenuItemId ?? '').trim() !== ''
  if (input.aksi === 'menu_item' && !punyaTarget) {
    return 'Pilih menu tujuan, atau ubah aksinya.'
  }
  if (input.aksi !== 'menu_item' && punyaTarget) {
    return 'Menu tujuan hanya berlaku untuk aksi "buka menu tertentu".'
  }
  return null
}
