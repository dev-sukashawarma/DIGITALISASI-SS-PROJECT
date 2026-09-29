/**
 * Ambil SEMUA baris sebuah kueri Supabase dengan paginasi `.range()`.
 *
 * `.limit(5000)` / `.limit(30000)` TIDAK menembus batas 1.000 baris PostgREST
 * (max-rows) -- hasilnya diam-diam terpotong di 1.000. Helper ini memuat per
 * halaman 1.000 sampai habis.
 *
 * `buat` dipanggil ULANG untuk tiap halaman (builder Supabase adalah thenable
 * yang mengeksekusi ulang setiap kali di-await, jadi tak boleh dipakai ulang).
 * Pemanggil WAJIB memberi urutan unik di dalam `buat` (mis. `.order('id')`)
 * supaya halaman tidak saling tumpang tindih / terlewat.
 *
 * Bentuk hasil sama dengan kueri biasa: `{ data, error }`.
 */
const UKURAN_HALAMAN = 1000

type Halaman<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

export async function ambilSemua<T>(
  buat: (dari: number, sampai: number) => Halaman<T>,
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const semua: T[] = []
  for (let dari = 0; ; dari += UKURAN_HALAMAN) {
    const { data, error } = await buat(dari, dari + UKURAN_HALAMAN - 1)
    if (error) return { data: null, error }
    const baris = data ?? []
    semua.push(...baris)
    if (baris.length < UKURAN_HALAMAN) break
  }
  return { data: semua, error: null }
}
