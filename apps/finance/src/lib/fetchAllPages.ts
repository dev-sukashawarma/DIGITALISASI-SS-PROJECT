/**
 * Paginasi wajib untuk query PostgREST.
 *
 * PostgREST memotong hasil di 1.000 baris **tanpa error apa pun** — respons
 * tetap HTTP 200 dan `error` tetap null. `.limit(5000)` pun tidak menembusnya;
 * batas ini ditegakkan di sisi server (terverifikasi pada instance ini:
 * `limit=5000` mengembalikan tepat 1.000 baris).
 *
 * Akibatnya query yang menarik lebih dari 1.000 baris akan diam-diam
 * mengembalikan sebagian data, dan setiap penjumlahan di atasnya menghasilkan
 * angka yang terlalu kecil. Halaman Untung Rugi sempat melaporkan rugi
 * Rp 519 juta padahal sebenarnya untung, karena omzet terpotong ~50%
 * sementara biaya terhitung penuh.
 *
 * ⚠️ Pemanggil WAJIB menyertakan urutan yang deterministik (`.order(...)` pada
 * kolom yang unik atau kombinasi kolom yang unik). Tanpa urutan yang stabil,
 * paginasi bisa melewatkan atau menggandakan baris antar-halaman — dan itu
 * kesalahan yang jauh lebih sulit terdeteksi daripada pemotongan biasa.
 */
export const POSTGREST_MAX_ROWS = 1000

/**
 * Menarik SELURUH baris hasil query, halaman demi halaman.
 *
 * @param build Fungsi yang membangun ulang query dari nol setiap halaman.
 *   Harus mengembalikan query builder Supabase yang BELUM dipanggil `.range()`,
 *   dan sudah memuat `.order()` yang deterministik.
 *
 * @example
 * const rows = await fetchAllPages(() =>
 *   supabase.from('orders')
 *     .select('id, total_amount')
 *     .gte('created_at', from)
 *     .order('id', { ascending: true })   // ← urutan stabil, wajib
 * )
 */
export async function fetchAllPages<T = any>(
  build: () => any,
  pageSize: number = POSTGREST_MAX_ROWS
): Promise<T[]> {
  const all: T[] = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await build().range(offset, offset + pageSize - 1)
    if (error) throw error
    const page = (data ?? []) as T[]
    all.push(...page)
    if (page.length < pageSize) break
  }
  return all
}
