export type TingkatSatuan = {
  satuan: string
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  faktor_tampilan: number | null
}

export type PilihanSatuanBeli = { label: string; isi: number }

const kanon = (s: string | null | undefined) => {
  const x = (s ?? '').trim().toLowerCase()
  return x === 'bks' ? 'bungkus' : x
}
const positif = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0

/**
 * Satuan beli yang dikenali sebuah bahan beserta isi satuan kecilnya.
 * Cermin hitung_faktor_po() (besar/tengah/kecil) + aturan kg→gram = 1000
 * di simpan_harga_vendor. Label lain harus disimpan dengan paksa.
 */
export function pilihanSatuanBeli(b: TingkatSatuan): PilihanSatuanBeli[] {
  const hasil: PilihanSatuanBeli[] = []
  const punyaKecil = kanon(b.satuan_kecil) !== ''
  if (!punyaKecil) hasil.push({ label: b.satuan, isi: 1 })
  else if (positif(b.faktor_tampilan)) hasil.push({ label: b.satuan, isi: b.faktor_tampilan })
  if (b.satuan_tengah && positif(b.faktor_tengah) && positif(b.faktor_tampilan)) {
    hasil.push({ label: b.satuan_tengah, isi: b.faktor_tampilan / b.faktor_tengah })
  }
  if (punyaKecil) hasil.push({ label: b.satuan_kecil as string, isi: 1 })
  if (kanon(b.satuan_kecil) === 'gram' && !hasil.some((p) => kanon(p.label) === 'kg')) {
    hasil.push({ label: 'kg', isi: 1000 })
  }
  const terlihat = new Set<string>()
  return hasil.filter((p) => {
    const k = kanon(p.label)
    if (terlihat.has(k)) return false
    terlihat.add(k)
    return true
  })
}

/** Harga per satuan beli → per satuan besar master (rumus turunan harga master di DB). */
export function hargaPerSatuanBesar(harga: number, isi: number, faktorTampilan: number | null): number | null {
  if (!positif(harga) || !positif(isi)) return null
  return (harga / isi) * (positif(faktorTampilan) ? faktorTampilan : 1)
}
