/**
 * Harga & vendor sebuah baris ledger yang berasal dari surat jalan.
 *
 * Surat jalan menyimpan vendor (`vendor_id`) dan harga beku (`harga_snapshot`,
 * per SATUAN BESAR) per baris bahan. Itulah harga sebenarnya barang yang dikirim;
 * harga master hanya harga pembelian terakhir. Satu bahan dalam satu surat jalan
 * bisa dipecah ke beberapa vendor, sedangkan ledger tidak selalu bisa dipasangkan
 * satu-satu ke tiap pecahan -> harga dirata-rata tertimbang qty.
 */

export interface ItemSuratJalan {
  vendor: string | null
  harga_snapshot: number | null
  qty_dikirim: number | null
}

export interface RingkasanSuratJalan {
  vendor: string | null
  /** Harga per satuan besar; null bila surat jalan tak mencatat harga (pakai master). */
  hargaBesar: number | null
}

export function ringkasItemSuratJalan(items: ItemSuratJalan[]): RingkasanSuratJalan {
  const vendors = [...new Set(items.map((i) => i.vendor).filter((v): v is string => !!v))]
  const berharga = items.filter((i) => Number(i.harga_snapshot) > 0)

  let hargaBesar: number | null = null
  if (berharga.length > 0) {
    const totalQty = berharga.reduce((s, i) => s + Math.max(Number(i.qty_dikirim) || 0, 0), 0)
    hargaBesar =
      totalQty > 0
        ? berharga.reduce((s, i) => s + Number(i.harga_snapshot) * Math.max(Number(i.qty_dikirim) || 0, 0), 0) / totalQty
        : berharga.reduce((s, i) => s + Number(i.harga_snapshot), 0) / berharga.length
  }

  return { vendor: vendors.length > 0 ? vendors.join(' + ') : null, hargaBesar }
}

/**
 * Nilai rupiah sebuah baris ledger. `qtyKecil` sudah dalam satuan kecil (bertanda,
 * yang dipakai hanya besarnya). Harga surat jalan (per satuan besar) dibagi
 * `kemasanQty`; tanpa harga surat jalan dipakai harga master per satuan kecil.
 */
export function nilaiBarisRp(
  qtyKecil: number,
  hargaBesarSj: number | null,
  kemasanQty: number,
  hargaMasterKecil: number
): number {
  const perKecil =
    hargaBesarSj !== null && hargaBesarSj > 0
      ? kemasanQty > 0
        ? hargaBesarSj / kemasanQty
        : hargaBesarSj
      : hargaMasterKecil
  return Math.round(Math.abs(qtyKecil) * perKecil)
}
