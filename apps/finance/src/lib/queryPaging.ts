/**
 * Paginasi PostgREST yang paralel dan deterministik.
 *
 * PostgREST memotong hasil di 1.000 baris tanpa error apa pun, jadi tabel besar
 * harus diambil per halaman. Dua jebakan yang ditutup helper ini:
 *
 * 1. **Urutan wajib unik.** Tiap halaman adalah query terpisah; tanpa ORDER BY
 *    yang unik, urutan baris di antara nilai kembar tidak dijamin sama antar
 *    query, sehingga sebagian baris terhitung dua kali dan sebagian terlewat.
 *    Pemanggil bertanggung jawab memasang `.order(...)` yang unik.
 * 2. **Loop berurutan membayar RTT × jumlah halaman.** Satu bulan `orders`
 *    (~32.000 baris) butuh 33 halaman; berurutan itu ~8 detik yang hampir
 *    seluruhnya waktu tunggu jaringan. Setelah halaman pertama memberi tahu
 *    jumlah total, sisa halaman bisa diambil bersamaan.
 */
const PAGE_SIZE = 1000
const DEFAULT_MAX_CONCURRENCY = 4

/**
 * Menjalankan tugas asinkron untuk tiap item dengan batas konkurensi agar tidak
 * membanjiri pool koneksi / CPU PostgreSQL sekaligus (mencegah statement_timeout).
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []
  const cap = Math.max(1, Math.min(Math.floor(limit), items.length))
  const results = new Array<R>(items.length)
  let nextIdx = 0

  const runners = Array.from({ length: cap }, async () => {
    while (nextIdx < items.length) {
      const i = nextIdx++
      results[i] = await worker(items[i], i)
    }
  })

  await Promise.all(runners)
  return results
}

export async function fetchAllPagesParallel<T = any>(
  // `withCount` hanya true untuk halaman pertama: COUNT(*) di-hitung ulang tiap
  // request yang membawa `Prefer: count=exact`, dan kita cuma butuh sekali.
  buildPage: (
    from: number,
    to: number,
    withCount: boolean,
  ) => PromiseLike<{ data: T[] | null; error: any; count?: number | null }>,
  pageSize: number = PAGE_SIZE,
  maxConcurrency: number = DEFAULT_MAX_CONCURRENCY,
): Promise<T[]> {
  const first = await buildPage(0, pageSize - 1, true)
  if (first.error) throw first.error
  const firstPage = first.data ?? []
  if (firstPage.length < pageSize) return firstPage

  const total = first.count ?? null
  if (total == null) {
    // Tanpa count kita tak tahu ada berapa halaman — jatuh ke loop berurutan.
    const all = [...firstPage]
    for (let offset = pageSize; ; offset += pageSize) {
      const { data, error } = await buildPage(offset, offset + pageSize - 1, false)
      if (error) throw error
      const page = data ?? []
      all.push(...page)
      if (page.length < pageSize) return all
    }
  }

  const pages = Math.ceil(total / pageSize)
  const offsets = Array.from({ length: Math.max(0, pages - 1) }, (_, i) => (i + 1) * pageSize)
  const rest = await runWithConcurrency(offsets, maxConcurrency, async (offset) => {
    return buildPage(offset, offset + pageSize - 1, false)
  })
  const all = [...firstPage]
  for (const r of rest) {
    if (r.error) throw r.error
    all.push(...(r.data ?? []))
  }
  return all
}
