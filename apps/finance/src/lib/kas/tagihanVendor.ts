/**
 * Aturan murni antrean Tagihan Vendor (purchasing mengajukan, finance menyetujui).
 * Batas PO lama mengikuti RPC tandai_po_lunas_tanpa_kas: tanggal_po < 1 Nov 2026.
 */

export const AWAL_KAS_BERSIH = '2026-11-01'

/** PO bertanggal sebelum pencatatan kas bersih: boleh ditandai lunas tanpa transaksi kas. */
export function poSebelumKasBersih(tanggalPo: string | null | undefined): boolean {
  return !!tanggalPo && tanggalPo.slice(0, 10) < AWAL_KAS_BERSIH
}

/** Alasan penolakan dari catatan transaksi ("… · [Ditolak: alasan]"). */
export function alasanDitolak(note: string | null | undefined): string | null {
  const m = /\[Ditolak: ([^\]]*)\]/.exec(note ?? '')
  return m ? m[1].trim() || null : null
}

export type FilterPeriode = 'semua' | 'baru' | 'lama'

export function cocokPeriode(tanggalPo: string, f: FilterPeriode): boolean {
  if (f === 'semua') return true
  return f === 'lama' ? poSebelumKasBersih(tanggalPo) : !poSebelumKasBersih(tanggalPo)
}
