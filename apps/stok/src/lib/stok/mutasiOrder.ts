/**
 * Mutasi ledger yang lahir dari order POS: potongan BOM (`pemakaian`) dan
 * pembaliknya saat order dibatalkan (`adjustment` positif ber-`ref_order_id`).
 *
 * Keduanya harus dihitung NETO per bahan. Kalau tidak, order batal tercatat dua
 * kali: potongannya tetap masuk "Pemakaian" dan pembaliknya masuk "Masuk" seolah
 * barang datang. Stok sistem tetap benar (keduanya saling meniadakan), tapi kedua
 * angka itu sama-sama menggelembung.
 */
export function isMutasiOrder(row: { tipe: string; ref_order_id?: string | null }): boolean {
  return !!row.ref_order_id && (row.tipe === 'pemakaian' || row.tipe === 'adjustment')
}

/**
 * Membagi jumlah bertanda mutasi order sebuah bahan dalam periode.
 * - Negatif → pemakaian bersih.
 * - Positif → pembalik order batal yang potongannya terjadi SEBELUM periode;
 *   bukan barang masuk, jadi dicatat sebagai mutasi lain (koreksi).
 * Selalu berlaku: -pakai + pembalikSebelumPeriode === netQty.
 */
export function bagiMutasiOrder(netQty: number): { pakai: number; pembalikSebelumPeriode: number } {
  return {
    pakai: netQty < 0 ? -netQty : 0,
    pembalikSebelumPeriode: netQty > 0 ? netQty : 0,
  }
}

/**
 * "Pemakaian POS" satu bahan dalam satu periode ledger — aturan yang sama
 * dengan kolom Pemakaian POS di Jurnal Rekonsiliasi (jurnalMutasi.ts):
 * mutasi order dinetokan lalu dibagi lewat bagiMutasiOrder, pemakaian tanpa
 * order dijumlah apa adanya, tipe lain diabaikan.
 */
export function pemakaianPosPeriode(
  rows: { tipe: string; qty: number | string | null; ref_order_id?: string | null }[]
): number {
  let orderNet = 0
  let pakaiLain = 0
  for (const row of rows) {
    const qty = Number(row.qty || 0)
    if (isMutasiOrder(row)) orderNet += qty
    else if (row.tipe === 'pemakaian') pakaiLain += Math.abs(qty)
  }
  return pakaiLain + bagiMutasiOrder(orderNet).pakai
}
