/* Status Xendit per pesanan website di Histori Transaksi (spec 2026-11-18-validasi-xendit).
 * Murni label: tidak mengubah angka omzet/KPI/ekspor. */

export { isPesananWebsite } from '@/lib/penjualan/xendit/website'

export type StatusXendit = 'terverifikasi' | 'belum' | 'selisih' | 'dobel'
export type XenditFilter = 'all' | 'terverifikasi' | 'belum' | 'selisih' | 'hanya_xendit'

export type PembayaranRingkas = {
  xenditId: string
  refQris: string | null
  nominal: number
  dibayarAt: string
  caraCocok: string | null
  externalOrderId: string | null
  outletId: string | null
  namaPelanggan: string | null
  ringkasanItem: string | null
  bukanPenjualan: boolean
}

const FILTER: XenditFilter[] = ['all', 'terverifikasi', 'belum', 'selisih', 'hanya_xendit']

export function toXenditFilter(v: unknown): XenditFilter {
  return FILTER.includes(v as XenditFilter) ? (v as XenditFilter) : 'all'
}

export function statusXendit(o: { total_amount: number }, bayar: PembayaranRingkas[]): StatusXendit {
  if (bayar.length === 0) return 'belum'
  if (bayar.length > 1) return 'dobel'
  return Math.round(Number(bayar[0].nominal)) === Math.round(Number(o.total_amount)) ? 'terverifikasi' : 'selisih'
}

/** Filter "Selisih" mencakup "Dobel". "Hanya di Xendit" tidak cocok dengan baris pesanan mana pun. */
export function cocokFilterXendit(status: StatusXendit, f: XenditFilter): boolean {
  if (f === 'all') return true
  if (f === 'selisih') return status === 'selisih' || status === 'dobel'
  return status === f
}

/**
 * Pembayaran (penjualan) yang tidak tertaut ke pesanan POS selesai.
 * 'batal' = tertaut ke pesanan POS yang dibatalkan; 'hanya_xendit' = tanpa pesanan / pesanan tak dikenal.
 */
export function pembayaranTanpaPesananSelesai(
  bayar: PembayaranRingkas[],
  externalIdSelesai: Set<string>,
  externalIdBatal: Set<string>,
): { jenis: 'hanya_xendit' | 'batal'; bayar: PembayaranRingkas }[] {
  const out: { jenis: 'hanya_xendit' | 'batal'; bayar: PembayaranRingkas }[] = []
  for (const b of bayar) {
    if (b.bukanPenjualan) continue
    if (b.externalOrderId && externalIdSelesai.has(b.externalOrderId)) continue
    out.push({ jenis: b.externalOrderId && externalIdBatal.has(b.externalOrderId) ? 'batal' : 'hanya_xendit', bayar: b })
  }
  return out
}
