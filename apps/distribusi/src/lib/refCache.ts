// Cache reference data (jarang berubah) di memory per-tab supaya tidak refetch
// tiap komponen mount. Tanpa react-query (belum terpasang di distribusi).
// - TTL: data dianggap segar selama < ttlMs.
// - inflight: dedup pemanggilan berbarengan (banyak komponen mount sekaligus).

type Entry<T> = { data: T; ts: number }

const store = new Map<string, Entry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

const DEFAULT_TTL = 5 * 60 * 1000 // 5 menit

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL
): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined
  if (hit && Date.now() - hit.ts < ttlMs) return hit.data

  const existing = inflight.get(key) as Promise<T> | undefined
  if (existing) return existing

  const p = fetcher()
    .then((data) => {
      store.set(key, { data, ts: Date.now() })
      inflight.delete(key)
      return data
    })
    .catch((err) => {
      inflight.delete(key)
      throw err
    })

  inflight.set(key, p)
  return p
}

/** Buang cache (mis. setelah mutasi reference data). */
export function invalidateRefCache(key: string): void {
  store.delete(key)
}
