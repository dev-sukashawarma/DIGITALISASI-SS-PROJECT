import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose'
import type { JWTVerifyGetKey } from 'jose'

/**
 * Verifikasi access token Supabase secara LOKAL, tanpa panggilan jaringan ke
 * Auth server per request.
 *
 * Project ini menandatangani token user dengan kunci asimetris ES256 (lihat
 * `alg`/`kid` di header token). Kunci publiknya diambil dari JWKS project
 * (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`) lewat `createRemoteJWKSet`
 * milik `jose`, yang di-cache di level modul — satu fetch per ~10 menit per
 * instance, bukan per request. Token HS256 lama tetap didukung bila
 * `SUPABASE_JWT_SECRET` di-set. Jalan di Edge runtime (middleware) maupun Node.
 *
 * Dulu verifikasi hanya menerima HS256, sehingga SEMUA token ES256 ditolak dan
 * tiap request middleware jatuh ke `getUser()` (GET /auth/v1/user).
 */

const DEFAULT_SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co'
const AUDIENCE = 'authenticated'
const ASYMMETRIC_ALGS = ['ES256', 'RS256']

function supabaseBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, '')
}

/** Nilai klaim `iss` yang diharapkan pada access token project ini. */
export function supabaseJwtIssuer(): string {
  return `${supabaseBaseUrl()}/auth/v1`
}

let remoteJwks: { url: string; getKey: JWTVerifyGetKey } | null = null

function getRemoteJwks(): JWTVerifyGetKey {
  const url = `${supabaseJwtIssuer()}/.well-known/jwks.json`
  if (!remoteJwks || remoteJwks.url !== url) {
    remoteJwks = {
      url,
      getKey: createRemoteJWKSet(new URL(url), {
        timeoutDuration: 3_000,
        cooldownDuration: 30_000,
        cacheMaxAge: 10 * 60_000,
      }),
    }
  }
  return remoteJwks.getKey
}

export type TokenVerification =
  /** Tanda tangan & klaim (exp, iss, aud) sah. */
  | { status: 'valid'; sub: string }
  /** Ditolak: tanda tangan salah, kedaluwarsa, klaim salah, atau bukan JWT. */
  | { status: 'invalid' }
  /** Tidak bisa diverifikasi lokal (JWKS tak terjangkau, kid belum dikenal, HS256 tanpa secret). */
  | { status: 'unverifiable' }

/**
 * Kode error `jose` yang berarti token memang TIDAK sah. Error lain (timeout /
 * gagal fetch / respons JWKS rusak / kid tak ditemukan) berarti verifikasi
 * lokal tidak mungkin dilakukan — bukan bukti token palsu.
 */
const INVALID_TOKEN_CODES = new Set([
  'ERR_JWT_EXPIRED',
  'ERR_JWT_CLAIM_VALIDATION_FAILED',
  'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  'ERR_JWS_INVALID',
  'ERR_JWT_INVALID',
  'ERR_JOSE_ALG_NOT_ALLOWED',
])

export async function verifySupabaseAccessToken(
  token: string,
  options: { jwtSecret?: string; jwks?: JWTVerifyGetKey; issuer?: string } = {}
): Promise<TokenVerification> {
  let alg: string | undefined
  try {
    alg = decodeProtectedHeader(token).alg
  } catch {
    return { status: 'invalid' }
  }

  const claims = { issuer: options.issuer ?? supabaseJwtIssuer(), audience: AUDIENCE }

  try {
    let sub: unknown
    if (alg === 'HS256') {
      if (!options.jwtSecret) return { status: 'unverifiable' }
      const { payload } = await jwtVerify(token, new TextEncoder().encode(options.jwtSecret), {
        ...claims,
        algorithms: ['HS256'],
      })
      sub = payload.sub
    } else if (alg && ASYMMETRIC_ALGS.includes(alg)) {
      const { payload } = await jwtVerify(token, options.jwks ?? getRemoteJwks(), {
        ...claims,
        algorithms: ASYMMETRIC_ALGS,
      })
      sub = payload.sub
    } else {
      // alg `none`, kosong, atau algoritma lain → tolak (anti alg-confusion).
      return { status: 'invalid' }
    }
    return typeof sub === 'string' && sub.length > 0 ? { status: 'valid', sub } : { status: 'invalid' }
  } catch (err) {
    const code = (err as { code?: unknown } | null)?.code
    if (typeof code === 'string' && INVALID_TOKEN_CODES.has(code)) return { status: 'invalid' }
    return { status: 'unverifiable' }
  }
}

/** Bentuk minimal client Supabase yang dibutuhkan `resolveUserId`. */
export type SessionAuthClient = {
  auth: {
    getSession(): Promise<{ data: { session: { access_token: string } | null } }>
    getUser(): Promise<{ data: { user: { id: string } | null } }>
  }
}

let lastFallbackWarnAt = 0

/**
 * Resolusi userId di middleware. Dipakai bersama oleh middleware `@suka/auth`,
 * portal, dan pos-kasir.
 *
 * 1. `getSession()` membaca sesi dari cookie. Bila access token sudah/hampir
 *    kedaluwarsa, @supabase/ssr me-refresh-nya di sini (POST /token) dan
 *    menulis cookie baru lewat `setAll` — perilaku refresh tidak berubah.
 * 2. Token diverifikasi lokal (JWKS / HS256). Token tidak sah → null
 *    (redirect ke portal), TANPA panggilan jaringan.
 * 3. Hanya bila verifikasi lokal mustahil (JWKS tak terjangkau, dsb.) baru
 *    jatuh ke `getUser()` (GET /auth/v1/user).
 */
export async function resolveUserId(
  supabase: SessionAuthClient,
  jwtSecret: string | undefined
): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return null

  const result = await verifySupabaseAccessToken(token, { jwtSecret })
  if (result.status === 'valid') return result.sub
  if (result.status === 'invalid') return null

  const now = Date.now()
  if (now - lastFallbackWarnAt > 60_000) {
    lastFallbackWarnAt = now
    console.warn('[auth] verifikasi JWT lokal tidak tersedia — fallback ke getUser() (network)')
  }
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * userId dari sesi cookie untuk Server Action / Route Handler / RSC — pengganti
 * `supabase.auth.getUser()` yang memanggil GET /auth/v1/user tiap kali.
 * Pemeriksaannya sama dengan middleware (`resolveUserId` + SUPABASE_JWT_SECRET).
 * Hanya untuk client SSR berbasis cookie, BUKAN token Bearer / service-role.
 */
export async function getVerifiedUserId(supabase: SessionAuthClient): Promise<string | null> {
  return resolveUserId(supabase, process.env.SUPABASE_JWT_SECRET)
}
