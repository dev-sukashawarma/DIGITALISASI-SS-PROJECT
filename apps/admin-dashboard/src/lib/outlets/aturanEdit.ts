/**
 * Perubahan status/jenis outlet yang TIDAK boleh lewat form edit biasa.
 * Persiapan hanya keluar lewat Go-Live atau Batalkan pembukaan (keduanya
 * memeriksa checklist dan mencatat riwayat), dan jenis outlet terkunci
 * setelah Go-Live karena mengubahnya menggeser laporan & markup HPP mitra.
 * Mengembalikan pesan penolakan, atau null bila boleh.
 */
export function cekPerubahanOutlet(
  lama: { status: string | null; type: string | null },
  baru: { status: string; type: string },
): string | null {
  const statusLama = lama.status ?? 'active'
  if (statusLama === 'pending' && baru.status === 'active') {
    return 'Outlet berstatus Persiapan hanya bisa diaktifkan lewat tombol Go-Live di menu Pembukaan Outlet.'
  }
  if (statusLama === 'pending' && baru.status === 'inactive') {
    return 'Untuk menghentikan outlet berstatus Persiapan, pakai Batalkan pembukaan di menu Pembukaan Outlet.'
  }
  if (statusLama !== 'pending' && baru.status === 'pending') {
    return 'Outlet yang sudah pernah aktif tidak bisa dikembalikan ke status Persiapan.'
  }
  if (statusLama !== 'pending' && (lama.type ?? '') !== baru.type) {
    return 'Jenis outlet terkunci setelah Go-Live.'
  }
  return null
}
