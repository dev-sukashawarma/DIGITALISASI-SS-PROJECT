export type NilaiCeklist = 'baik' | 'perhatian' | 'buruk'
const URUTAN_NILAI: Record<NilaiCeklist, number> = { baik: 0, perhatian: 1, buruk: 2 }

/** Nilai terburuk dari sekumpulan penilaian ceklist harian. */
export function terburuk(daftar: (NilaiCeklist | null | undefined)[]): NilaiCeklist | null {
  let hasil: NilaiCeklist | null = null
  for (const n of daftar) if (n && (hasil == null || URUTAN_NILAI[n] > URUTAN_NILAI[hasil])) hasil = n
  return hasil
}
