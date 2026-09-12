/**
 * Aturan turunan `bahan_baku.faktor_po` — berapa satuan KECIL dalam 1 satuan PO.
 *
 * Sengaja mengembalikan null (bukan 1) saat tidak ada tingkat yang cocok.
 * getDistribusiFactor() di apps/stok mengembalikan 1 dalam keadaan itu, dan
 * untuk FOIL artinya diam-diam salah 48x. Kesalahan harus terlihat.
 */
export type BahanSatuan = {
  satuan: string | null
  satuan_po: string | null
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  faktor_tampilan: number | null
}

const SINONIM: Record<string, string> = { bks: 'bungkus' }

function canon(s: string | null | undefined): string {
  const n = (s ?? '').trim().toLowerCase()
  const bersih = n === '-' ? '' : n
  return SINONIM[bersih] ?? bersih
}

export function hitungFaktorPo(b: BahanSatuan): number | null {
  const po = canon(b.satuan_po)
  if (!po) return null

  if (po === canon(b.satuan)) {
    // Tanpa satuan kecil, satuan besar ADALAH satuan terkecil.
    if (!canon(b.satuan_kecil)) return 1
    return b.faktor_tampilan && b.faktor_tampilan > 0 ? b.faktor_tampilan : null
  }

  const tengah = canon(b.satuan_tengah)
  if (tengah && po === tengah) {
    if (!b.faktor_tampilan || b.faktor_tampilan <= 0) return null
    if (!b.faktor_tengah || b.faktor_tengah <= 0) return null
    return b.faktor_tampilan / b.faktor_tengah
  }

  const kecil = canon(b.satuan_kecil)
  if (kecil && po === kecil) return 1

  return null
}
