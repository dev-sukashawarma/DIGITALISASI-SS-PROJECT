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
 */

const DEFAULT_SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co'
const AUDIENCE = 'authenticated'
const ASYMMETRIC_ALGS = ['ES256', 'RS256']

/** Masa berlaku cache singleflight hasil refresh token yang sama (ms). */
const REFRESH_GRACE_TTL_MS = 30_000
const MAX_REFRESH_CACHE_ENTRIES = 256

export type RawCookieItem = { name: string; value: string }
export type CapturedCookieItem = { name: string; value: string; options?: Record<string, unknown> }

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
      return { status: 'invalid' }
    }
    return typeof sub === 'string' && sub.length > 0 ? { status: 'valid', sub } : { status: 'invalid' }
  } catch (err) {
    const code = (err as { code?: unknown } | null)?.code
    if (typeof code === 'string' && INVALID_TOKEN_CODES.has(code)) return { status: 'invalid' }
    return { status: 'unverifiable' }
  }
}

function decodeBase64UrlUtf8(b64url: string): string | null {
  try {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
    const bin = atob(b64 + pad)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/**
 * Membaca pasangan `access_token` & `refresh_token` langsung dari daftar cookie
 * `@supabase/ssr` (`sb-<ref>-auth-token` maupun pecahan `.0`, `.1`, dst.) tanpa
 * memicu `supabase.auth.getSession()`.
 *
 * Ini mencegah `@supabase/auth-js` merotasi `refresh_token` secara prematur pada
 * request paralel (prefetch, RSC, Server Action) selama `access_token` masih sah.
 */
export function extractSessionTokensFromCookies(
  cookies: ReadonlyArray<RawCookieItem> | undefined | null
): { accessToken: string | null; refreshToken: string | null } {
  if (!cookies || cookies.length === 0) {
    return { accessToken: null, refreshToken: null }
  }

  // Kelompokkan berdasarkan nama dasar cookie auth Supabase
  const baseNames = new Set<string>()
  for (const c of cookies) {
    const match = /^(sb-[a-z0-9_-]+-auth-token)(?:\.\d+)?$/i.exec(c.name)
    if (match) baseNames.add(match[1])
  }

  for (const base of baseNames) {
    const exact = cookies.find((c) => c.name === base && c.value)
    let rawCombined = exact?.value ?? ''

    if (!rawCombined) {
      const chunks: Array<{ idx: number; value: string }> = []
      for (const c of cookies) {
        if (!c.name.startsWith(`${base}.`)) continue
        const suffix = c.name.slice(base.length + 1)
        if (!/^\d+$/.test(suffix)) continue
        chunks.push({ idx: Number(suffix), value: c.value })
      }
      if (chunks.length > 0) {
        chunks.sort((a, b) => a.idx - b.idx)
        // Pastikan indeks berurutan 0..N-1
        if (chunks.every((ch, idx) => ch.idx === idx)) {
          rawCombined = chunks.map((ch) => ch.value).join('')
        }
      }
    }

    if (!rawCombined) continue

    let jsonStr: string | null = null
    if (rawCombined.startsWith('base64-')) {
      jsonStr = decodeBase64UrlUtf8(rawCombined.slice('base64-'.length))
    } else {
      try {
        jsonStr = decodeURIComponent(rawCombined)
      } catch {
        jsonStr = rawCombined
      }
    }

    if (!jsonStr) continue

    try {
      const parsed = JSON.parse(jsonStr) as
        | { access_token?: unknown; refresh_token?: unknown }
        | unknown[]
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const accessToken =
          typeof parsed.access_token === 'string' && parsed.access_token.length > 0
            ? parsed.access_token
            : null
        const refreshToken =
          typeof parsed.refresh_token === 'string' && parsed.refresh_token.length > 0
            ? parsed.refresh_token
            : null
        if (accessToken || refreshToken) {
          return { accessToken, refreshToken }
        }
      }
    } catch {
      // Lanjut ke kandidat berikutnya jika ada
    }
  }

  return { accessToken: null, refreshToken: null }
}

type RefreshGraceEntry = {
  userId: string
  cookies: CapturedCookieItem[]
  expiresAt: number
}

const inFlightRefreshes = new Map<string, Promise<RefreshGraceEntry | null>>()
const refreshGraceCache = new Map<string, RefreshGraceEntry>()

async function hashRefreshKey(refreshToken: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`suka-rt-singleflight:${refreshToken}`)
  )
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

function pruneGraceCache(now: number) {
  for (const [k, v] of refreshGraceCache) {
    if (v.expiresAt <= now) refreshGraceCache.delete(k)
  }
  while (refreshGraceCache.size > MAX_REFRESH_CACHE_ENTRIES) {
    const oldest = refreshGraceCache.keys().next().value
    if (!oldest) break
    refreshGraceCache.delete(oldest)
  }
}

/** Hanya untuk pengujian unit agar state cache bersih antar test. */
export function resetRefreshSingleflightCacheForTests() {
  inFlightRefreshes.clear()
  refreshGraceCache.clear()
}

/** Bentuk minimal client Supabase yang dibutuhkan `resolveUserId`. */
export type SessionAuthClient = {
  auth: {
    getSession(): Promise<{ data: { session: { access_token: string } | null } }>
    getUser(): Promise<{ data: { user: { id: string } | null } }>
  }
}

export type ResolveUserOptions = {
  cookies?: ReadonlyArray<RawCookieItem>
  isPrefetch?: boolean
  jwks?: JWTVerifyGetKey
  getCapturedCookies?: () => CapturedCookieItem[]
  replayCookies?: (cookies: CapturedCookieItem[]) => void
}

let lastFallbackWarnAt = 0

async function resolveFromSupabaseSession(
  supabase: SessionAuthClient,
  jwtSecret: string | undefined,
  jwks?: JWTVerifyGetKey
): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return null

  const result = await verifySupabaseAccessToken(token, { jwtSecret, jwks })
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
 * Resolusi userId di middleware / Server Action / RSC.
 *
 * Urutan anti-race-condition:
 * 1. Bila `options.cookies` diberikan, periksa JWT `access_token` secara lokal
 *    LEBIH DULU sebelum menyentuh `supabase.auth.getSession()`. Selama token
 *    belum kedaluwarsa, GoTrue sama sekali tidak dipanggil (menghindari rotasi
 *    prematur saat margin 90 detik `@supabase/auth-js`).
 * 2. Bila request adalah prefetch (`options.isPrefetch`), JANGAN PERNAH me-refresh
 *    token ke GoTrue — kembalikan null agar rotasi hanya dilakukan oleh navigasi utama.
 * 3. Bila `access_token` sudah kedaluwarsa namun `refresh_token` ada, jalankan
 *    refresh melalui singleflight + grace cache 30 detik berbasis hash `refresh_token`,
 *    sehingga 5–10 request paralel yang membawa cookie lama tidak saling membatalkan
 *    (`refresh_token_not_found`).
 */
export async function resolveUserId(
  supabase: SessionAuthClient,
  jwtSecret: string | undefined,
  options?: ResolveUserOptions
): Promise<string | null> {
  if (options?.cookies) {
    const { accessToken, refreshToken } = extractSessionTokensFromCookies(options.cookies)

    if (accessToken) {
      const fastCheck = await verifySupabaseAccessToken(accessToken, {
        jwtSecret,
        jwks: options.jwks,
      })
      if (fastCheck.status === 'valid') {
        return fastCheck.sub
      }
    }

    if (options.isPrefetch) {
      return null
    }

    if (refreshToken) {
      const key = await hashRefreshKey(refreshToken)
      const now = Date.now()
      pruneGraceCache(now)

      const cached = refreshGraceCache.get(key)
      if (cached && cached.expiresAt > now) {
        options.replayCookies?.(cached.cookies)
        return cached.userId
      }

      const existing = inFlightRefreshes.get(key)
      if (existing) {
        const shared = await existing
        if (shared) {
          options.replayCookies?.(shared.cookies)
          return shared.userId
        }
        return null
      }

      const task = (async (): Promise<RefreshGraceEntry | null> => {
        try {
          const userId = await resolveFromSupabaseSession(supabase, jwtSecret, options.jwks)
          if (!userId) return null
          const entry: RefreshGraceEntry = {
            userId,
            cookies: [...(options.getCapturedCookies?.() ?? [])],
            expiresAt: Date.now() + REFRESH_GRACE_TTL_MS,
          }
          refreshGraceCache.set(key, entry)
          return entry
        } finally {
          inFlightRefreshes.delete(key)
        }
      })()

      inFlightRefreshes.set(key, task)
      const outcome = await task
      return outcome?.userId ?? null
    }

    // Tidak ada access_token maupun refresh_token di daftar cookie
    return null
  }

  if (options?.isPrefetch) return null
  return resolveFromSupabaseSession(supabase, jwtSecret, options?.jwks)
}

/**
 * userId dari sesi cookie untuk Server Action / Route Handler / RSC.
 * Bila `cookies` disertakan, otomatis memakai verifikasi cookie-first + singleflight.
 */
export async function getVerifiedUserId(
  supabase: SessionAuthClient,
  cookies?: ReadonlyArray<RawCookieItem>
): Promise<string | null> {
  return resolveUserId(supabase, process.env.SUPABASE_JWT_SECRET, cookies ? { cookies } : undefined)
}

/**
 * Validasi parameter `?next=` lintas-subdomain SUKA agar aman dari open-redirect.
 * Hanya mengizinkan `https://*.sukashawarma.com/...` (serta `http://localhost:*` saat lokal).
 */
export function safeTrustedReturnUrl(
  rawNext: string | null | undefined,
  allowLocalhost = false
): string | null {
  if (!rawNext) return null
  const trimmed = rawNext.trim()
  if (!trimmed || trimmed.length > 1024) return null
  if (trimmed.includes('\\') || /[\u0000-\u001f\u007f]/.test(trimmed)) return null

  try {
    const parsed = new URL(trimmed)
    if (parsed.username || parsed.password) return null
    const host = parsed.hostname.toLowerCase()

    if (
      parsed.protocol === 'https:' &&
      (parsed.port === '' || parsed.port === '443') &&
      (host === 'sukashawarma.com' || host.endsWith('.sukashawarma.com'))
    ) {
      // Hindari redirect memutar ke halaman login portal itu sendiri
      if (host === 'app.sukashawarma.com' && (parsed.pathname === '/' || parsed.pathname === '')) {
        return null
      }
      return parsed.toString()
    }

    if (
      allowLocalhost &&
      parsed.protocol === 'http:' &&
      (host === 'localhost' || host === '127.0.0.1')
    ) {
      return parsed.toString()
    }

    return null
  } catch {
    return null
  }
}
