// Penyesuaian & transfer keluar manual di Gudang Pusat untuk bahan multi-vendor.
// Penjaga sebenarnya ada di DB (catat_penyesuaian_gudang_vendor +
// trg_cek_penyesuaian_gudang_bervendor, migration 20260914100000); ini untuk UI.
import { validasiAlokasi, type Alokasi, type SaldoVendor } from './alokasiVendor'

export const GUDANG_PUSAT_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'

export type ArahPenyesuaian = 'masuk' | 'keluar'

export type ItemRpcPenyesuaian = {
  bahan_baku_id: string
  vendor_id: string
  tipe: 'adjustment' | 'transfer_keluar'
  qty_besar: number
  catatan: string
}

/** Satu vendor terpilih selalu menanggung seluruh jumlah yang diketik. */
export function alokasiEfektif(qty: number, alokasi: Alokasi[]): Alokasi[] {
  return alokasi.length === 1 ? [{ vendor_id: alokasi[0].vendor_id, qty }] : alokasi
}

/** Pengurangan dibatasi sisa vendor; penambahan boleh ke vendor mana pun. */
export function validasiPenyesuaianVendor(
  qty: number,
  arah: ArahPenyesuaian,
  alokasi: Alokasi[],
  vendors: SaldoVendor[],
): string | null {
  const acuan = arah === 'keluar' ? vendors : vendors.map((v) => ({ ...v, aktif: false }))
  return validasiAlokasi(qty, alokasi, acuan)
}

export function itemRpcPenyesuaian(
  bahanBakuId: string,
  tipe: 'adjustment' | 'transfer_keluar',
  arah: ArahPenyesuaian,
  alokasi: Alokasi[],
  catatan: string,
): ItemRpcPenyesuaian[] {
  return alokasi.map((a) => ({
    bahan_baku_id: bahanBakuId,
    vendor_id: a.vendor_id,
    tipe,
    qty_besar: tipe === 'adjustment' && arah === 'keluar' ? -a.qty : a.qty,
    catatan,
  }))
}
