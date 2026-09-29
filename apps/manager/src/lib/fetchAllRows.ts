// Ambil SEMUA baris sebuah query PostgREST, halaman demi halaman.
//
// Kenapa perlu: PostgREST memotong hasil di 1.000 baris TANPA galat. Hook yang
// menjumlahkan omzet/biaya dari hasil terpotong akan menampilkan angka yang
// percaya diri tapi salah (dan baris mana yang lolos pun tak deterministik).
//
// Aturan pemakaian:
// - `build` WAJIB mengembalikan query BARU tiap dipanggil, dan query itu WAJIB
//   memakai ORDER BY yang UNIK (gabungan kolom yang membentuk grain baris) —
//   tanpa itu halaman bisa tumpang-tindih / ada baris terlewat.
// - Builder Supabase adalah thenable yang mengeksekusi ulang tiap `.then`,
//   jadi jangan pernah me-`.range()`/`.then` builder yang sama dua kali; itu
//   sebabnya parameternya pabrik (fungsi), bukan builder jadi.
export const PAGE_SIZE = 1000

type PageResult = PromiseLike<{ data: unknown; error: { message: string } | null }>
type RangeableQuery = { range: (from: number, to: number) => PageResult }

export async function fetchAllRows<T>(
  build: () => RangeableQuery,
): Promise<{ data: T[]; error: string | null }> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1)
    if (error) return { data: all, error: error.message }
    const page = (data ?? []) as T[]
    all.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return { data: all, error: null }
}
