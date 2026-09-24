import { jakartaDayKey } from './jakarta-day'

/**
 * Cache hasil gerbang middleware (profil staff) di cookie httpOnly yang
 * DITANDATANGANI HMAC-SHA256 (Web Crypto — jalan di Edge maupun Node).
 *
 * Tujuannya menghindari query `outlet_staff` + `attendance` di SETIAP request
 * (navigasi, prefetch, server action). Hasil dianggap segar selama
 * `GATE_FRESH_SEC`; setelah itu middleware query ulang dan menulis cookie baru.
 *
 * Keamanan:
 * - Isi cookie tidak pernah dipercaya tanpa tanda tangan sah.
 * - Terikat ke `sub` token yang SUDAH diverifikasi (ganti akun → cache ditolak)
 *   dan ke nama app (cookie host-only per subdomain, tapi di localhost port
 *   berbeda berbagi cookie).
 * - Terikat ke hari kalender Jakarta: override outlet BKO dari absen berlaku
 *   per hari, jadi cache kemarin tidak dianggap segar hari ini.
 * - Tanpa secret server → caching dimatikan (perilaku lama: query tiap request).
 */

export const GATE_COOKIE = '_suka_gate'

/** Lama hasil gerbang dianggap segar (detik). */
export const GATE_FRESH_SEC = 180

/**
 * Umur maksimum entri basi (tapi bertanda tangan sah) yang masih boleh dipakai
 * untuk request PREFETCH saja. Navigasi/server action tetap butuh entri segar.
 */
export const GATE_PREFETCH_STALE_SEC = 10 * 60

/**
 * Umur cookie di browser (detik). Lebih panjang dari masa segar karena entri
 * basi masih dipakai untuk prefetch (lihat di atas) dan sebagai fallback saat
 * DB error di pos-kasir (pengganti cookie `_suka_staff_cache` tanpa tanda tangan).
 */
export const GATE_COOKIE_MAX_AGE_SEC = 12 * 60 * 60

const SIGNING_CONTEXT = 'suka-gate-v1.'

export type GateEntry<T> = {
  v: 1
  app: string
  sub: string
  day: string
  iat: number
  exp: number
  data: T
}

/**
 * Secret penandatangan. Pakai `SUKA_GATE_SECRET` (disarankan, khusus fitur
 * ini); bila belum di-set, pakai `SUPABASE_SERVICE_ROLE_KEY` yang sudah ada di
 * server (domain-separated lewat prefix pesan). null → caching dimatikan.
 */
export function getGateSecret(): string | null {
  return process.env.SUKA_GATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null
}

/** Opsi cookie gerbang: httpOnly, host-only, sameSite=lax. */
export function gateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: GATE_COOKIE_MAX_AGE_SEC,
  }
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
  const bin = atob(b64 + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

let cachedKey: { secret: string; key: Promise<CryptoKey> } | null = null

function getHmacKey(secret: string): Promise<CryptoKey> {
  if (!cachedKey || cachedKey.secret !== secret) {
    const key = crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret) as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    )
    // Jangan cache promise yang gagal.
    key.catch(() => {
      if (cachedKey?.key === key) cachedKey = null
    })
    cachedKey = { secret, key }
  }
  return cachedKey.key
}

function signingInput(payloadB64: string): BufferSource {
  return new TextEncoder().encode(SIGNING_CONTEXT + payloadB64) as BufferSource
}

/** Buat nilai cookie bertanda tangan untuk `data` milik `sub` di `app`. */
export async function signGateCookie<T>(
  app: string,
  sub: string,
  data: T,
  secret: string,
  now: Date = new Date()
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000)
  const entry: GateEntry<T> = {
    v: 1,
    app,
    sub,
    day: jakartaDayKey(now),
    iat,
    exp: iat + GATE_FRESH_SEC,
    data,
  }
  const payloadB64 = bytesToB64url(new TextEncoder().encode(JSON.stringify(entry)))
  const sig = await crypto.subtle.sign('HMAC', await getHmacKey(secret), signingInput(payloadB64))
  return `${payloadB64}.${bytesToB64url(new Uint8Array(sig))}`
}

/**
 * Baca & verifikasi cookie gerbang. null bila kosong, tanda tangan salah,
 * rusak, milik app/sub lain, atau lebih tua dari umur cookie.
 * `fresh` = masih dalam masa segar DAN hari Jakarta yang sama.
 * `ageSec` = umur entri sejak ditandatangani.
 */
export async function readGateCookie<T>(
  value: string | undefined | null,
  expected: { app: string; sub: string; secret: string; now?: Date }
): Promise<{ data: T; fresh: boolean; ageSec: number } | null> {
  if (!value) return null
  try {
    const parts = value.split('.')
    if (parts.length !== 2) return null
    const [payloadB64, sigB64] = parts

    const valid = await crypto.subtle.verify(
      'HMAC',
      await getHmacKey(expected.secret),
      b64urlToBytes(sigB64) as BufferSource,
      signingInput(payloadB64)
    )
    if (!valid) return null

    const entry = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64))) as GateEntry<T>
    if (
      !entry ||
      entry.v !== 1 ||
      entry.app !== expected.app ||
      entry.sub !== expected.sub ||
      typeof entry.iat !== 'number' ||
      typeof entry.exp !== 'number' ||
      typeof entry.day !== 'string' ||
      entry.data === null ||
      typeof entry.data !== 'object'
    ) {
      return null
    }

    const now = expected.now ?? new Date()
    const nowSec = Math.floor(now.getTime() / 1000)
    if (entry.iat > nowSec + 60 || nowSec - entry.iat > GATE_COOKIE_MAX_AGE_SEC) return null

    const fresh = nowSec < entry.exp && entry.day === jakartaDayKey(now)
    return { data: entry.data, fresh, ageSec: Math.max(0, nowSec - entry.iat) }
  } catch {
    return null
  }
}

/**
 * Request prefetch (router Next.js atau `<link rel=prefetch>` browser).
 * Prerender (speculation rules) TIDAK dihitung: halamannya bisa langsung
 * ditampilkan ke user, jadi harus lewat gerbang penuh.
 */
export function isPrefetchRequest(headers: Headers): boolean {
  if (headers.get('next-router-prefetch')) return true
  const purpose = (headers.get('sec-purpose') || headers.get('purpose') || '').toLowerCase()
  return purpose.includes('prefetch') && !purpose.includes('prerender')
}

/**
 * Entri gerbang boleh dipakai tanpa query DB: segar, atau (khusus prefetch)
 * basi tapi belum lewat `GATE_PREFETCH_STALE_SEC`.
 */
export function isGateEntryUsable(
  entry: { fresh: boolean; ageSec: number } | null,
  isPrefetch: boolean
): boolean {
  if (!entry) return false
  return entry.fresh || (isPrefetch && entry.ageSec <= GATE_PREFETCH_STALE_SEC)
}
