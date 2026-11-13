/** Sama dengan RPC penutupan (minimal 10 karakter setelah trim). */
export const MIN_ALASAN_PENUTUPAN = 10

export function validasiAlasan(alasan: string): string | null {
  return alasan.trim().length < MIN_ALASAN_PENUTUPAN
    ? `Alasan wajib diisi, minimal ${MIN_ALASAN_PENUTUPAN} karakter`
    : null
}

/**
 * Validasi modal Tutup Outlet. Tanggal dalam YYYY-MM-DD (WIB); perbandingan
 * string aman karena formatnya tetap. Database tetap memeriksa ulang.
 */
export function validasiTutup(
  input: { tanggalTerakhir: string; alasan: string; konfirmasiNama: string },
  ctx: { namaOutlet: string; hariIni: string; tanggalDibuat: string },
): string | null {
  if (!input.tanggalTerakhir) return 'Tanggal terakhir jualan wajib diisi'
  if (input.tanggalTerakhir > ctx.hariIni) return 'Tanggal terakhir jualan tidak boleh di masa depan'
  if (input.tanggalTerakhir < ctx.tanggalDibuat) return 'Tanggal terakhir jualan tidak boleh sebelum outlet dibuat'
  const galatAlasan = validasiAlasan(input.alasan)
  if (galatAlasan) return galatAlasan
  if (input.konfirmasiNama.trim().toUpperCase() !== ctx.namaOutlet.trim().toUpperCase()) {
    return 'Ketik nama outlet persis untuk konfirmasi'
  }
  return null
}
