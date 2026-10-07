import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

// Format kunci: hms_<prefix 8 hex>_<rahasia 32 base64url>. Prefix dipakai mencari baris
// di hermes_api_key; yang disimpan hanya SHA-256 dari kunci utuh.
const POLA_KUNCI = /^hms_([0-9a-f]{8})_([A-Za-z0-9_-]{32})$/

export function hashKunci(kunci: string): string {
  return createHash('sha256').update(kunci, 'utf8').digest('hex')
}

/** Kunci asli hanya dikembalikan di sini — simpan `prefix` + `hash`, tampilkan `kunci` sekali. */
export function buatKunciBaru(): { kunci: string; prefix: string; hash: string } {
  const prefix = randomBytes(4).toString('hex')
  const rahasia = randomBytes(24).toString('base64url') // 32 karakter
  const kunci = `hms_${prefix}_${rahasia}`
  return { kunci, prefix, hash: hashKunci(kunci) }
}

export function uraiBearer(header: string | null): { kunci: string; prefix: string } | null {
  if (!header) return null
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim())
  if (!m) return null
  const k = POLA_KUNCI.exec(m[1])
  return k ? { kunci: m[1], prefix: k[1] } : null
}

/** Perbandingan hash hex yang timing-safe. */
export function hashCocok(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/.test(a) || !/^[0-9a-f]+$/.test(b)) return false
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y)
}
