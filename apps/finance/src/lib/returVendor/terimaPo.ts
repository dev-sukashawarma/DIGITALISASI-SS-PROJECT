import type { AlasanRetur } from './aturan'

/** Barang baik yang masuk stok = datang − ditolak (tak pernah minus). */
export function barangMasukStok(datang: number, ditolak: number): number {
  return Math.max(0, datang - ditolak)
}

/** Pesan galat satu baris form terima PO, atau null bila valid. */
export function validasiBarisTerima(b: { datang: number; ditolak: number; alasanTolak: AlasanRetur | null }): string | null {
  if (b.ditolak > b.datang) return 'Jumlah ditolak melebihi jumlah datang'
  if (b.ditolak > 0 && !b.alasanTolak) return 'Pilih alasan penolakan'
  return null
}

/** Sisa yang belum datang: barang ditolak dianggap tuntas (kirim ulang = PO baru). */
export function sisaBelumTiba(qtyPesan: number, qtyTerima: number, qtyDitolak: number): number {
  return Math.max(0, qtyPesan - qtyTerima - qtyDitolak)
}
