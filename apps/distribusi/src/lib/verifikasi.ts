export type IsianPenerimaan = {
  qty_terima: number | ''
  kondisi: 'baik' | 'tidak_sesuai'
  catatan: string
  foto_path: string | null
}

/** Presisi yang sama dengan native; pembulatan bilangan bulat bukan nilai transaksi. */
export function qtyDistribusi(qty: number, factor: number): number {
  return Math.round(qty * factor * 1e6) / 1e6
}

export function qtyDasar(qty: number, dikirim: number, factor: number): number {
  if (!Number.isFinite(qty) || !Number.isFinite(factor) || factor <= 0) {
    throw new Error('Jumlah atau faktor satuan tidak valid')
  }
  return Math.abs(qty - qtyDistribusi(dikirim, factor)) < 1e-6 ? dikirim : qty / factor
}

export function galatVerifikasi(
  v: IsianPenerimaan | undefined,
  dikirim: number,
  wajibFoto = true,
): string | null {
  if (!v || v.qty_terima === '' || !Number.isFinite(v.qty_terima) || !Number.isFinite(dikirim)) {
    return 'Isi jumlah fisik yang diterima terlebih dahulu'
  }
  if (v.qty_terima < 0) return 'Jumlah terima tidak boleh kurang dari 0'
  if (v.qty_terima - dikirim > 1e-6) return 'Jumlah terima tidak boleh melebihi jumlah dikirim'
  if (v.kondisi !== 'baik' && v.kondisi !== 'tidak_sesuai') return 'Pilih kondisi barang'
  if (v.qty_terima === 0 && v.kondisi === 'baik') return 'Jumlah nol harus dilaporkan sebagai tidak sesuai'
  if (v.kondisi === 'tidak_sesuai' && !v.catatan.trim()) return 'Isi catatan alasan item tidak sesuai'
  if (wajibFoto && !v.foto_path?.trim()) return 'Foto bukti wajib diambil sebelum lanjut'
  return null
}
