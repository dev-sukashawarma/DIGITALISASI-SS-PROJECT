import type { PostgrestError } from '@supabase/supabase-js'

/** Bentuk hasil `select(..., { count: 'exact', head: true })` yang kita pedulikan. */
export type HasilHitung = {
  count: number | null
  error: PostgrestError | null
}

/**
 * Membedakan kueri yang gagal dari nol yang sungguhan.
 *
 * `null` berarti **tidak diketahui**, bukan nol. Bedanya menentukan: kalau
 * kegagalan kueri diterjemahkan jadi 0, layar Outlet akan menuduh SEMUA outlet
 * "nol menu tayang" — satu kueri gagal berubah menjadi alarm sekabupaten.
 * Pemanggil wajib menampilkan "—" dan menahan peringatan saat hasilnya `null`.
 */
export function bacaJumlah(hasil: HasilHitung): number | null {
  if (hasil.error) return null
  if (hasil.count === null || hasil.count === undefined) return null
  return hasil.count
}
