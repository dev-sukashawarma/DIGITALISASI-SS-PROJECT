export const DEFAULT_PAGE_SIZE = 50

export interface Paged<T> {
  rows: T[]
  total: number
}

/**
 * Ambil SEMUA baris hasil filter per batch (untuk export CSV), sampai jumlahnya
 * sama dengan `total`. Baris kembar (data bergeser saat export) dibuang via key.
 */
export async function fetchAllPages<T>(
  fetchPage: (limit: number, offset: number) => Promise<Paged<T>>,
  key: (row: T) => string,
  batch = 1000
): Promise<Paged<T>> {
  const first = await fetchPage(batch, 0)
  const byKey = new Map(first.rows.map((r) => [key(r), r]))
  let offset = first.rows.length
  while (offset < first.total) {
    const next = await fetchPage(batch, offset)
    if (next.rows.length === 0) break
    for (const r of next.rows) byKey.set(key(r), r)
    offset += next.rows.length
  }
  return { rows: Array.from(byKey.values()), total: first.total }
}

/**
 * Jalankan query `.in(...)` per potongan id. Daftar uuid yang panjang di URL
 * PostgREST bisa melewati batas panjang URL (HTTP 414) saat jumlah staf tumbuh.
 */
export async function inChunks<T>(ids: string[], run: (chunk: string[]) => Promise<T[]>, size = 50): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += size) {
    out.push(...(await run(ids.slice(i, i + size))))
  }
  return out
}
