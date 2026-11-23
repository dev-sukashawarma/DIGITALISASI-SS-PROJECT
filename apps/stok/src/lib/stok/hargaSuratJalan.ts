/**
 * Harga & vendor sebuah baris ledger yang berasal dari surat jalan.
 *
 * Surat jalan menyimpan vendor (`vendor_id`) dan harga beku (`harga_snapshot`,
 * per SATUAN BESAR yang berlaku SAAT DOKUMEN DIBUAT) per baris bahan, beserta
 * qty dalam satuan yang sama. Definisi satuan besar beberapa bahan berubah
 * sesudahnya (mis. 1 Dus FOIL 5M dulu 36.480 cm, kini 24.000 cm; 1 Pack PAPER
 * WRAP dulu 5.000, kini 500), jadi `harga_snapshot / faktor sekarang` SALAH untuk
 * dokumen lama. Yang selalu benar: nilai dokumen = qty dokumen x harga dokumen
 * (keduanya ditulis bersamaan). Harga per satuan kecil diturunkan dari nilai itu
 * dibagi qty satuan kecil yang benar-benar tercatat di ledger.
 */

export interface ItemSuratJalan {
  vendor: string | null
  harga_snapshot: number | null
  qty_dikirim: number | null
  qty_terima?: number | null
}

export interface RingkasanSuratJalan {
  vendor: string | null
  /** Harga per satuan besar (rata-rata tertimbang); null bila surat jalan tak mencatat harga. */
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

/** Qty dokumen yang diwakili sebuah tipe baris ledger. */
function qtyDokumen(item: ItemSuratJalan, tipe: string): number {
  const kirim = Math.max(Number(item.qty_dikirim) || 0, 0)
  const terima =
    item.qty_terima === null || item.qty_terima === undefined ? kirim : Math.max(Number(item.qty_terima) || 0, 0)
  if (tipe === 'transfer_keluar') return kirim
  if (tipe === 'rejected_kiriman') return Math.max(kirim - terima, 0)
  return terima // terima_kiriman dan baris masuk lain
}

/**
 * Nilai rupiah dokumen surat jalan untuk satu bahan dan satu sisi ledger
 * (keluar = qty dikirim, terima = qty diterima, ditolak = selisihnya).
 * null bila ada bagian ber-qty yang tak punya harga -> pemanggil jatuh ke master.
 */
export function nilaiDokumenSuratJalan(items: ItemSuratJalan[], tipe: string): number | null {
  let total = 0
  let adaQty = false
  for (const it of items) {
    const q = qtyDokumen(it, tipe)
    if (q <= 0) continue
    adaQty = true
    const h = Number(it.harga_snapshot)
    if (!(h > 0)) return null
    total += q * h
  }
  return adaQty ? total : null
}

/** Harga per satuan kecil dari nilai dokumen dibagi qty satuan kecil yang tercatat di ledger. */
export function hargaKecilDariNilai(nilai: number | null, qtyKecil: number): number | null {
  const q = Math.abs(qtyKecil)
  if (nilai === null || !(nilai > 0) || !(q > 0)) return null
  return nilai / q
}

/**
 * Nilai rupiah sebuah baris ledger: harga per satuan kecil (dari dokumen) bila ada,
 * selain itu harga master per satuan kecil.
 */
export function nilaiBarisRp(qtyKecil: number, hargaKecil: number | null, hargaMasterKecil: number): number {
  return Math.round(Math.abs(qtyKecil) * (hargaKecil !== null && hargaKecil > 0 ? hargaKecil : hargaMasterKecil))
}

/**
 * Batas kewajaran harga dokumen terhadap harga master. Surat jalan September 2026
 * (sebelum normalisasi harga 3 & 12 Sep) ada yang harganya tercatat dalam satuan
 * lain, mis. FOIL 5M per roll padahal qty per Dus -> 1,4% harga sebenarnya. Selisih
 * harga vendor yang nyata jarang melewati 3x (terbesar terukur: BAWANG PUTIH BUBUK
 * sachet vs kiloan 2,4x), jadi di luar rentang ini dokumen dianggap salah satuan
 * dan dipakai harga master.
 */
export const BATAS_RASIO_HARGA_WAJAR = 3

export function hargaKecilWajar(hargaKecil: number | null, hargaMasterKecil: number): number | null {
  if (hargaKecil === null || !(hargaKecil > 0)) return null
  if (!(hargaMasterKecil > 0)) return hargaKecil
  const r = hargaKecil / hargaMasterKecil
  return r > BATAS_RASIO_HARGA_WAJAR || r < 1 / BATAS_RASIO_HARGA_WAJAR ? null : hargaKecil
}
