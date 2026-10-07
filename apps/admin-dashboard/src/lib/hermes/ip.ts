import { BlockList, isIP } from 'node:net'

export function normalisasiIp(ip: string): string {
  const t = ip.trim()
  return t.toLowerCase().startsWith('::ffff:') && isIP(t.slice(7)) === 4 ? t.slice(7) : t
}

// Rentang IP resmi Cloudflare (https://www.cloudflare.com/ips-v4 & ips-v6, diambil 2026-10-07).
// admin.sukashawarma.com di-proxy Cloudflare: IP yang dilihat Traefik = edge Cloudflare yang
// berganti-ganti, IP pemanggil asli ada di cf-connecting-ip. Perbarui bila Cloudflare menambah rentang.
const CLOUDFLARE_V4 = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
]
const CLOUDFLARE_V6 = ['2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32']

const EDGE_CLOUDFLARE = new BlockList()
for (const r of CLOUDFLARE_V4) { const [a, p] = r.split('/'); EDGE_CLOUDFLARE.addSubnet(a, Number(p), 'ipv4') }
for (const r of CLOUDFLARE_V6) { const [a, p] = r.split('/'); EDGE_CLOUDFLARE.addSubnet(a, Number(p), 'ipv6') }

export function dariCloudflare(ip: string): boolean {
  const v = isIP(ip)
  return v !== 0 && EDGE_CLOUDFLARE.check(ip, v === 4 ? 'ipv4' : 'ipv6')
}

/** IP yang dilihat reverse proxy (Traefik/Coolify): x-real-ip, atau hop TERAKHIR x-forwarded-for. */
function ipPengirim(h: { get(n: string): string | null }): string | null {
  const real = h.get('x-real-ip')?.trim()
  if (real) return normalisasiIp(real)
  const xff = h.get('x-forwarded-for')
  if (!xff) return null
  const hop = xff.split(',').map((s) => s.trim()).filter(Boolean)
  return hop.length ? normalisasiIp(hop[hop.length - 1]) : null
}

/**
 * IP pemanggil asli. Bila pengirim = edge Cloudflare, pakai cf-connecting-ip (di-set Cloudflare).
 * cf-connecting-ip HANYA dipercaya bila pengirimnya Cloudflare — orang yang menembak origin
 * langsung bisa mengisi header itu sesukanya.
 */
export function ipKlien(h: { get(n: string): string | null }): string | null {
  const pengirim = ipPengirim(h)
  if (pengirim && dariCloudflare(pengirim)) {
    const cf = h.get('cf-connecting-ip')?.trim()
    if (cf) {
      const asli = normalisasiIp(cf)
      if (ipValid(asli)) return asli
    }
  }
  return pengirim
}

export function ipValid(ip: string): boolean {
  return isIP(ip) !== 0
}

/** Fail-closed: daftar kosong atau IP tak dikenal = tolak. */
export function ipDiizinkan(ip: string | null, daftar: string[]): boolean {
  return !!ip && daftar.includes(ip)
}
