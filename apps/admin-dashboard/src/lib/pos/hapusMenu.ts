/**
 * Aturan kapan sebuah menu POS BOLEH dihapus permanen.
 *
 * Menghapus baris `menu_items` tidak sekadar menghilangkan menu dari kasir.
 * Aturan foreign key di database ikut:
 *   - memutus `order_items.menu_item_id` (SET NULL) -> HPP penjualan lama
 *     terbaca 0 di Ringkasan Bisnis;
 *   - menghapus `menu_hpp_riwayat` (CASCADE) -> riwayat HPP hilang permanen;
 *   - menghapus `menu_packages` (CASCADE) -> menu lenyap dari isi paket lain.
 * Itu yang terjadi pada menu Shawarmie ~16 Sep 2026 (±1.400 porsi kehilangan
 * HPP, 5 paket kehilangan isinya). Menu yang pernah terjual atau masih menjadi
 * isi paket cukup DINONAKTIFKAN: hilang dari kasir & aplikasi, data tetap utuh.
 */

export interface PemakaianMenu {
  /** Jumlah baris `order_items` yang menaut ke menu ini. */
  terjual: number
  /** Jumlah baris `menu_packages` paket LAIN yang memakai menu ini sebagai isi/pilihan. */
  jadiIsiPaket: number
}

/** null = boleh dihapus; string = alasan ditolak (untuk ditampilkan ke pengguna). */
export function alasanTolakHapus(nama: string, p: PemakaianMenu): string | null {
  const alasan: string[] = []
  if (p.terjual > 0) alasan.push(`sudah tercatat di ${p.terjual.toLocaleString('id-ID')} baris penjualan`)
  if (p.jadiIsiPaket > 0) alasan.push(`masih menjadi isi ${p.jadiIsiPaket} paket`)
  if (alasan.length === 0) return null
  return `"${nama}" tidak bisa dihapus karena ${alasan.join(' dan ')}. ` +
    'Menghapusnya akan membuat HPP penjualan lama menjadi 0 dan menghilangkan riwayat HPP-nya. ' +
    'Nonaktifkan saja: menu hilang dari kasir & aplikasi, datanya tetap aman.'
}

export const PESAN_TANPA_IZIN =
  'Menu tidak berubah: akun ini tidak punya izin mengubah menu (hanya role admin). ' +
  'Hubungi admin untuk mengubahnya.'

/** Nama bucket & path file dari URL publik Supabase Storage (`.../object/public/<bucket>/<path>`). */
export function lokasiGambar(url: string | null | undefined): { bucket: string; path: string } | null {
  if (!url) return null
  const m = url.match(/\/object\/public\/([^/]+)\/(.+)$/)
  if (!m) return null
  return { bucket: m[1], path: decodeURIComponent(m[2]) }
}
