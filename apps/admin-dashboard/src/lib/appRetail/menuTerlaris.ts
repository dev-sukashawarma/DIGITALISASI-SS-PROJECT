/**
 * Kurasi "Menu Terlaris" di Beranda aplikasi pelanggan.
 * Urutan array = urutan tampil; Beranda menampilkan 2 teratas yang tersedia
 * di outlet pelanggan, sisanya cadangan bila yang di atas habis.
 */

/** Cermin CHECK migration 20260926100000 -- ubah keduanya bersamaan. */
export const MAKS_MENU_TERLARIS = 6

export function periksaMenuTerlaris(ids: string[]): string | null {
  if (ids.length > MAKS_MENU_TERLARIS) return `Maksimal ${MAKS_MENU_TERLARIS} menu terlaris.`
  if (new Set(ids).size !== ids.length) return 'Menu yang sama dipilih dua kali.'
  return null
}

/** Tukar posisi `i` dengan tetangganya (arah -1 = naik, 1 = turun). */
export function geserMenu(ids: string[], i: number, arah: -1 | 1): string[] {
  const j = i + arah
  if (i < 0 || i >= ids.length || j < 0 || j >= ids.length) return ids
  const hasil = [...ids]
  ;[hasil[i], hasil[j]] = [hasil[j], hasil[i]]
  return hasil
}

export function tambahMenu(ids: string[], id: string): string[] {
  if (ids.includes(id) || ids.length >= MAKS_MENU_TERLARIS) return ids
  return [...ids, id]
}
