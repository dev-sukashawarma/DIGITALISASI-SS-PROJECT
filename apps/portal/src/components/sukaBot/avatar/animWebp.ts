const cache = new Map<string, Promise<Blob>>()

/**
 * WebP beranimasi diambil sekali, lalu tiap pemutaran memakai URL blob baru: browser berbagi
 * timeline animasi antar <img> ber-URL sama, sehingga klip sekali-putar tak akan mulai dari awal.
 */
export function ambilBlob(url: string): Promise<Blob> {
  let p = cache.get(url)
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.blob()
    })
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return p
}
