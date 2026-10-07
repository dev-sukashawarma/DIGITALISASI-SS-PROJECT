import { isIP } from 'node:net'

export function normalisasiIp(ip: string): string {
  const t = ip.trim()
  return t.toLowerCase().startsWith('::ffff:') && isIP(t.slice(7)) === 4 ? t.slice(7) : t
}

/**
 * IP yang dilihat reverse proxy (Traefik/Coolify). x-real-ip di-set proxy; bila tak ada,
 * pakai hop TERAKHIR x-forwarded-for (yang ditambahkan proxy) — hop pertama bisa dipalsukan klien.
 */
export function ipKlien(h: { get(n: string): string | null }): string | null {
  const real = h.get('x-real-ip')?.trim()
  if (real) return normalisasiIp(real)
  const xff = h.get('x-forwarded-for')
  if (!xff) return null
  const hop = xff.split(',').map((s) => s.trim()).filter(Boolean)
  return hop.length ? normalisasiIp(hop[hop.length - 1]) : null
}

export function ipValid(ip: string): boolean {
  return isIP(ip) !== 0
}

/** Fail-closed: daftar kosong atau IP tak dikenal = tolak. */
export function ipDiizinkan(ip: string | null, daftar: string[]): boolean {
  return !!ip && daftar.includes(ip)
}
