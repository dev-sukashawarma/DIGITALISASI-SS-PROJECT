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
  // Outlet internal/mitra: aktif↔nonaktif hanya lewat wizard penutupan (dijaga
  // juga di DB oleh trg_zz_outlets_jaga_penutupan).
  const dijaga = lama.type === 'internal' || lama.type === 'mitra'
  if (dijaga && statusLama === 'active' && baru.status === 'inactive') {
    return 'Untuk menonaktifkan outlet, pakai tombol Tutup Outlet (mencatat tanggal & alasan tutup).'
  }
  if (dijaga && statusLama === 'inactive' && baru.status === 'active') {
    return 'Outlet yang sudah ditutup hanya bisa diaktifkan lewat Buka kembali di papan Penutupan.'
  }
  return null
}

/**
 * Menghapus (soft delete) outlet internal/mitra yang masih aktif ditolak:
 * outlet harus ditutup dulu lewat Tutup Outlet supaya tanggal & alasan tutup
 * tercatat dan pembersihannya muncul di papan Penutupan.
 */
export function cekHapusOutlet(o: { status: string | null; type: string | null }): string | null {
  const dijaga = o.type === 'internal' || o.type === 'mitra'
  if (dijaga && (o.status ?? 'active') === 'active') {
    return 'Outlet masih aktif. Tutup dulu lewat tombol Tutup Outlet sebelum menghapus.'
  }
  return null
}

/**
 * Menayangkan outlet internal/mitra yang sudah ditutup di aplikasi pelanggan
 * ditolak (DB juga menahannya: trg_zz_outlets_jaga_penutupan). Mematikan selalu boleh.
 */
export function cekTayangAplikasi(
  o: { status: string | null; type: string | null },
  nyalakan: boolean,
): string | null {
  const dijaga = o.type === 'internal' || o.type === 'mitra'
  if (nyalakan && dijaga && o.status === 'inactive') {
    return 'Outlet ini sudah ditutup, jadi tidak bisa ditayangkan di aplikasi. Buka kembali dulu lewat papan Penutupan.'
  }
  return null
}
