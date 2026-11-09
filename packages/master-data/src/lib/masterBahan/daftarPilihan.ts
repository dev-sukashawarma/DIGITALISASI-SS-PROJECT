/**
 * Daftar resmi untuk isian master bahan yang dulu diketik bebas (satuan, kategori).
 * Isian bebas melahirkan ejaan kembar ("kg"/"Kg", "Ml", "minuman" vs "FOOD & BEVERAGE");
 * layar kini memilih dari daftar ini supaya data seragam di semua app.
 */
import { KELOMPOK_KATEGORI } from './tampilan'

/**
 * Satuan baku — mencakup semua satuan yang dipakai bahan aktif (diukur 24 Sep 2026).
 * Kemasan/wadah ditulis kapital, takaran (gram, ml, cm) huruf kecil; perbandingan di app
 * & DB (`_kanon_satuan`) memang tak peka huruf, jadi ini hanya soal tampilan seragam.
 * Menambah satuan baru = menambah baris di sini.
 */
export const SATUAN_BAKU: readonly string[] = [
  'Dus', 'Pack', 'Box', 'Bal', 'Ikat', 'Blok', 'Kompan', 'Galon', 'Tabung', 'Roll',
  'Bungkus', 'Sachet', 'Lembar', 'Pcs', 'Unit', 'Kg', 'Liter', 'gram', 'ml', 'cm',
]

/** Nilai kategori resmi (sama dengan tipe `Kategori` app stok), urut 5 kelompok besar. */
export const KATEGORI_RESMI: readonly string[] = KELOMPOK_KATEGORI.flatMap((g) => g.resmi)

export type Opsi = { nilai: string; label: string }

/**
 * Opsi dropdown dari `daftar`, dengan nilai tersimpan `sekarang` tetap terpilih:
 * - beda huruf saja ("kg" vs "Kg") → dipetakan ke opsi yang sama, tapi nilainya
 *   dipertahankan persis agar membuka form tidak terhitung sebagai perubahan;
 * - di luar daftar → ditambahkan di akhir bertanda "(lama)".
 */
export function opsiPilihan(daftar: readonly string[], sekarang: string): Opsi[] {
  const kini = sekarang.trim()
  const kunci = kini.toLowerCase()
  let cocok = false
  const opsi = daftar.map((d) => {
    if (kini && d.toLowerCase() === kunci) {
      cocok = true
      return { nilai: sekarang, label: d }
    }
    return { nilai: d, label: d }
  })
  if (kini && !cocok) opsi.push({ nilai: sekarang, label: `${kini} (lama)` })
  return opsi
}
