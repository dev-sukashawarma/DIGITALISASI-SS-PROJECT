/** Kategori yang tetap dihitung OPEX selama masa RAB (bawaan = aturan Karawaci). */
export const KATEGORI_KECUALI_RAB_BAWAAN = [
  'gas',
  'pln',
  'pdam',
  'internet',
  'wifi',
  'utilitas',
  'utilities',
  'sewa',
  'sewa_outlet',
] as const

/** Bawaan mitra baru (13 dari 14 mitra per 2026-11-13). */
export const BAWAAN_MITRA = { persentaseBagiHasil: 100, managementFee: 3 } as const

/** Go-Live boleh ditekan dengan tanggal maksimal sekian hari dari hari ini. */
export const TOLERANSI_TANGGAL_GO_LIVE_HARI = 7

export function hariIniWib(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}
