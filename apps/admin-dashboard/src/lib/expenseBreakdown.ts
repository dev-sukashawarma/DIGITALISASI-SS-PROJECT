/**
 * Penggabungan kerugian waste ke daftar kategori biaya — UNTUK TAMPILAN SAJA.
 *
 * Waste TIDAK boleh ditulis sebagai baris `expenses`: rumus laba
 * (`computeProfit`) menerima biaya dan waste sebagai argumen terpisah, jadi
 * waste yang ikut masuk `expenses` akan terpotong dua kali dari laba bersih.
 * Angkanya juga berasal dari laporan waste yang di-approve SPV, bukan input
 * manual — menyalinnya ke tabel yang bisa diketik akan memutus jejak
 * persetujuannya. Gabungan di sini murni agar pembaca melihat satu gambaran
 * biaya yang utuh.
 */

export interface CategorySlice {
  name: string
  value: number
  color: string
  categoryKey: string
}

/** Sengaja diawali garis bawah ganda: bukan kategori `expenses` yang sah. */
export const WASTE_SLICE_KEY = '__waste__'
export const WASTE_SLICE_LABEL = 'Kerugian Waste (otomatis)'
export const WASTE_SLICE_COLOR = '#be123c'

export function withWasteSlice(
  byCategory: CategorySlice[],
  totalWaste: number,
  include: boolean,
): CategorySlice[] {
  if (!include || totalWaste <= 0) return byCategory
  return [
    ...byCategory,
    {
      name: WASTE_SLICE_LABEL,
      value: totalWaste,
      color: WASTE_SLICE_COLOR,
      categoryKey: WASTE_SLICE_KEY,
    },
  ].sort((a, b) => b.value - a.value)
}
