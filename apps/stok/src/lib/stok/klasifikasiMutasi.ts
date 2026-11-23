import { isMutasiOrder } from './mutasiOrder'

/**
 * Klasifikasi satu baris `ledger_stok` untuk kolom Jurnal & Rekonsiliasi.
 *
 * Satu-satunya sumber aturan "tipe X masuk kolom mana". Tipe nyata per
 * CHECK `ledger_stok_tipe_check` (23 Nov 2026): terima_kiriman, pemakaian,
 * waste, adjustment, opname_selisih, transfer_keluar, transfer_masuk,
 * rejected_kiriman, pembelian_supplier, retur_ke_pusat, terima_retur_outlet,
 * retur_ke_vendor.
 *
 * Tipe yang tidak dikenali jatuh ke `lain` (bertanda) -- bukan diabaikan --
 * supaya stok sistem tetap mengikuti ledger. Dulu `retur_ke_pusat` &
 * `retur_ke_vendor` tidak masuk cabang mana pun (yang dikenal malah
 * `retur_supplier`, tipe yang tidak ada) sehingga stok sistem tidak berkurang
 * dan selisih tampak minus palsu.
 */
export type KelasMutasi =
  | 'order' // potongan BOM / pembalik order -> dihitung neto per order (mutasiOrder)
  | 'pakai' // pemakaian tanpa order
  | 'waste_manual' // waste tanpa laporan; waste ber-laporan dihitung dari stok_waste_reports
  | 'tolak_vendor' // penolakan terima drop-ship: mengurangi kolom Masuk
  | 'masuk' // barang masuk riil
  | 'lain' // mutasi lain bertanda (transfer, retur, penyesuaian internal, tipe baru)
  | 'abaikan'

export interface BarisKlasifikasi {
  tipe?: string
  qty?: number | string | null
  catatan?: string | null
  ref_order_id?: string | null
  ref_waste_id?: string | null
  ref_opname_id?: string | null
  ref_terima_vendor_id?: string | null
}

const INTERNAL_ADJUSTMENT_NOTE_RE =
  /(^penyesuaian stok:|koreksi|kesalahan input|salah input|belum opname|opname|matang|mateng|baru masak|reorder|\btest\b)/i

/**
 * Membedakan adjustment inbound riil (mis. Inbound manual purchasing) dari
 * penyesuaian internal dapur/opname (mis. ayam matang, salah input, koreksi opname,
 * atau pembalik laporan waste/order).
 */
export function isInboundAdjustment(row: BarisKlasifikasi): boolean {
  if (row.tipe !== 'adjustment' || Number(row.qty || 0) <= 0) return false
  if (row.ref_order_id || row.ref_waste_id || row.ref_opname_id) return false
  if (INTERNAL_ADJUSTMENT_NOTE_RE.test(String(row.catatan || '').trim())) return false
  return true
}

/** Tipe barang masuk untuk lapisan FIFO vendor sebelum periode. */
export const INFLOW_TIPE = ['terima_kiriman', 'pembelian_supplier', 'transfer_masuk', 'adjustment', 'terima_retur_outlet']

/**
 * @param isAll konsolidasi Semua Outlet: transfer antar cabang saling meniadakan,
 *              jadi `transfer_masuk` bukan barang masuk baru.
 */
export function klasifikasiMutasi(row: BarisKlasifikasi, isAll: boolean): KelasMutasi {
  const tipe = row.tipe || ''
  if (tipe === 'opname_selisih') return 'abaikan'
  if (isMutasiOrder({ tipe, ref_order_id: row.ref_order_id })) return 'order'
  if (tipe === 'pemakaian') return 'pakai'
  if (tipe === 'waste') return row.ref_waste_id ? 'abaikan' : 'waste_manual'
  // Koreksi / pembatalan laporan waste sudah tercermin pada status stok_waste_reports
  if (tipe === 'adjustment' && row.ref_waste_id) return 'abaikan'
  if (tipe === 'rejected_kiriman' && row.ref_terima_vendor_id) return 'tolak_vendor'
  if (
    tipe === 'terima_kiriman' ||
    tipe === 'pembelian_supplier' ||
    (!isAll && tipe === 'transfer_masuk') ||
    isInboundAdjustment(row)
  ) {
    return 'masuk'
  }
  return 'lain'
}
