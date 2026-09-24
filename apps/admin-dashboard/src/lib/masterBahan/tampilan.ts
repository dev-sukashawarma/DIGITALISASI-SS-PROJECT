/** Format tampilan murni untuk tabel master bahan baku. */

export type TingkatTampil = {
  satuan: string
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  faktor_tampilan: number | null
}

const positif = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0
const angka = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 4 })

/** "1 Kg = 1.000 Gram", "1 Dus = 48 Roll = 36.480 cm", atau cukup "Pcs". */
export function ringkasSatuan(b: TingkatTampil): string {
  const kecil = b.satuan_kecil?.trim()
  if (!kecil || !positif(b.faktor_tampilan)) return b.satuan
  if (kecil.toLowerCase() === b.satuan.trim().toLowerCase() && b.faktor_tampilan === 1) return b.satuan
  const tengah = b.satuan_tengah?.trim()
  const bagianTengah = tengah && positif(b.faktor_tengah) ? ` = ${angka(b.faktor_tengah)} ${tengah}` : ''
  return `1 ${b.satuan}${bagianTengah} = ${angka(b.faktor_tampilan)} ${kecil}`
}

/** Huruf pertama kapital; sisanya apa adanya ("roll" → "Roll"). */
export function kapital(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** Kategori diketik bebas di data (mis. "minuman" vs "FOOD & BEVERAGE"); seragamkan saat tampil. */
export function labelKategori(k: string | null | undefined): string {
  const t = (k ?? '').trim()
  return t ? t.toUpperCase() : '—'
}
