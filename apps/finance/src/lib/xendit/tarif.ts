/* Aturan tarif Xendit untuk pesanan website (spec 2026-11-18-biaya-xendit-rangkuman-penjualan).
 * Dicocokkan dengan file Balance History Okt–Nov 2026: 208 pembayaran sejak 1 Okt = 208 tagihan
 * Processing Fee. Dipakai saat unggah file (biaya yang seharusnya ada) dan untuk estimasi di
 * laporan bila biaya asli belum diketahui. */

/** Processing Fee Rp 4.000 + PPN 11%, per pembayaran sukses. */
export const BIAYA_PROSES = 4440
/** Tanggal bayar (WIB) mulai berlakunya Processing Fee & MDR 0% QRIS < Rp 100 rb. */
export const MULAI_BIAYA_PROSES = '2026-10-01'
const BATAS_MDR_QRIS = 100_000
const BIAYA_VA = 9000 + 990

/** 'YYYY-MM-DD' menurut WIB dari waktu ISO. */
export function tanggalWibDari(iso: string): string {
  return new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 10)
}

export function biayaProses(dibayarAtIso: string): number {
  return tanggalWibDari(dibayarAtIso) >= MULAI_BIAYA_PROSES ? BIAYA_PROSES : 0
}

/** Kosong / 'QRIS' / tak dikenal dianggap QRIS (mayoritas pembayaran website); nama bank = Virtual Account. */
export function jenisChannel(channel: string | null | undefined): 'qris' | 'va' {
  const c = (channel ?? '').trim().toUpperCase()
  if (!c || c.includes('QR')) return 'qris'
  return 'va'
}

/** MDR + PPN yang seharusnya dipotong Xendit untuk satu pembayaran (dibulatkan ke bawah seperti di file). */
export function mdrSeharusnya(nominal: number, channel: string | null | undefined, dibayarAtIso: string): number {
  if (jenisChannel(channel) === 'va') return BIAYA_VA
  const n = Math.round(Number(nominal) || 0)
  if (tanggalWibDari(dibayarAtIso) >= MULAI_BIAYA_PROSES && n < BATAS_MDR_QRIS) return 0
  const fee = Math.floor((n * 63) / 10_000) // 0,63%
  return fee + Math.floor((fee * 11) / 100) // + PPN 11%
}

export function estimasiBiayaXendit(nominal: number, channel: string | null | undefined, dibayarAtIso: string): number {
  return mdrSeharusnya(nominal, channel, dibayarAtIso) + biayaProses(dibayarAtIso)
}
