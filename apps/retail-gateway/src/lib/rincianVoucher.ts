import { hitungTotal, type ItemPesanan, type RincianHarga } from './pricing'
import { CATATAN_GRATIS } from './voucher'
import type { NilaiVoucher } from './voucherDb'

export type BlokVoucher = {
  id: string | null; nama: string | null; status: 'berlaku' | 'belum' | 'tidak_ada'
  alasan?: string; potongan: number; item_gratis: ItemPesanan[]
}

/**
 * Menyusun item akhir + rincian harga. Item bercatatan "Gratis voucher" dari
 * klien SELALU dibuang -- hanya server yang boleh menambahkan item gratis.
 */
export function rincianDenganVoucher(items: ItemPesanan[], nv: NilaiVoucher) {
  const belanja = items.filter((it) => it.note !== CATATAN_GRATIS)
  if (!nv.ada) return { itemsAkhir: belanja, rincian: hitungTotal(belanja, 0), blok: null as BlokVoucher | null }

  const dasar = { id: nv.voucher?.id ?? null, nama: nv.voucher?.nama ?? null }
  if (!nv.hasil.berlaku) {
    return {
      itemsAkhir: belanja,
      rincian: hitungTotal(belanja, 0),
      blok: { ...dasar, status: nv.voucher ? 'belum' : 'tidak_ada', alasan: nv.hasil.alasan, potongan: 0, item_gratis: [] } as BlokVoucher,
    }
  }
  const itemsAkhir = [...belanja, ...nv.hasil.itemGratis]
  const subtotal = itemsAkhir.reduce((s, it) => s + it.unit_price * it.quantity, 0)
  const rincian: RincianHarga = { subtotal, discountAmount: nv.hasil.potongan, total: subtotal - nv.hasil.potongan }
  return {
    itemsAkhir, rincian,
    blok: { ...dasar, status: 'berlaku', potongan: nv.hasil.potongan, item_gratis: nv.hasil.itemGratis } as BlokVoucher,
  }
}
