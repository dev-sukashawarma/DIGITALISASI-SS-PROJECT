import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose'
import type { JWTVerifyGetKey } from 'jose'
import {
  verifySupabaseAccessToken,
  resolveUserId,
  getVerifiedUserId,
  supabaseJwtIssuer,
  extractSessionTokensFromCookies,
  resetRefreshSingleflightCacheForTests,
  safeTrustedReturnUrl,
} from './jwt'

const SECRET = 'super-secret-jwt-key-for-tests-only'
const KID = 'test-kid-1'
const ISSUER = supabaseJwtIssuer()

let privateKey: CryptoKey
let otherPrivateKey: CryptoKey
let jwks: JWTVerifyGetKey

beforeAll(async () => {
  const pair = await generateKeyPair('ES256', { extractable: true })
  privateKey = pair.privateKey
  otherPrivateKey = (await generateKeyPair('ES256')).privateKey
  const publicJwk = await exportJWK(pair.publicKey)
  jwks = createLocalJWKSet({ keys: [{ ...publicJwk, kid: KID, alg: 'ES256', use: 'sig' }] })
})

type TokenOpts = {
  sub?: string
  expOffsetSec?: number
  iss?: string
  aud?: string
  kid?: string
  key?: CryptoKey
}

async function makeEs256Token(opts: TokenOpts = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: opts.kid ?? KID, typ: 'JWT' })
    .setSubject(opts.sub ?? 'user-123')
    .setIssuer(opts.iss ?? ISSUER)
    .setAudience(opts.aud ?? 'authenticated')
    .setIssuedAt(now)
    .setExpirationTime(now + (opts.expOffsetSec ?? 3600))
    .sign(opts.key ?? privateKey)
}

async function makeHs256Token(opts: TokenOpts & { secret?: string } = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(opts.sub ?? 'user-123')
    .setIssuer(opts.iss ?? ISSUER)
    .setAudience(opts.aud ?? 'authenticated')
    .setIssuedAt(now)
    .setExpirationTime(now + (opts.expOffsetSec ?? 3600))
    .sign(new TextEncoder().encode(opts.secret ?? SECRET))
}

function b64urlJson(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('verifySupabaseAccessToken — ES256 (JWKS)', () => {
  it('valid untuk token ES256 yang sah', async () => {
    const token = await makeEs256Token()
    expect(await verifySupabaseAccessToken(token, { jwks })).toEqual({ status: 'valid', sub: 'user-123' })
  })

  it('invalid untuk token kedaluwarsa (tanpa fallback network)', async () => {
    const token = await makeEs256Token({ expOffsetSec: -10 })
    expect(await verifySupabaseAccessToken(token, { jwks })).toEqual({ status: 'invalid' })
  })

  it('invalid untuk issuer lain', async () => {
    const token = await makeEs256Token({ iss: 'https://evil.supabase.co/auth/v1' })
    expect(await verifySupabaseAccessToken(token, { jwks })).toEqual({ status: 'invalid' })
  })

  it('invalid untuk audience selain authenticated', async () => {
    const token = await makeEs256Token({ aud: 'anon' })
    expect(await verifySupabaseAccessToken(token, { jwks })).toEqual({ status: 'invalid' })
  })

  it('invalid untuk tanda tangan kunci lain dengan kid yang sama', async () => {
    const token = await makeEs256Token({ key: otherPrivateKey })
    expect(await verifySupabaseAccessToken(token, { jwks })).toEqual({ status: 'invalid' })
  })

  it('unverifiable bila kid tidak ada di JWKS', async () => {
    const token = await makeEs256Token({ kid: 'kid-tak-dikenal' })
    expect(await verifySupabaseAccessToken(token, { jwks })).toEqual({ status: 'unverifiable' })
  })

  it('unverifiable bila JWKS tak terjangkau (error jaringan)', async () => {
    const token = await makeEs256Token()
    const brokenJwks: JWTVerifyGetKey = async () => {
      throw new TypeError('fetch failed')
    }
    expect(await verifySupabaseAccessToken(token, { jwks: brokenJwks })).toEqual({ status: 'unverifiable' })
  })
})

describe('verifySupabaseAccessToken — HS256 & sampah', () => {
  it('valid untuk HS256 bila secret di-set', async () => {
    const token = await makeHs256Token()
    expect(await verifySupabaseAccessToken(token, { jwtSecret: SECRET })).toEqual({ status: 'valid', sub: 'user-123' })
  })

  it('invalid untuk HS256 dengan secret salah', async () => {
    const token = await makeHs256Token({ secret: 'secret-yang-salah-sekali' })
    expect(await verifySupabaseAccessToken(token, { jwtSecret: SECRET })).toEqual({ status: 'invalid' })
  })

  it('unverifiable untuk HS256 tanpa secret', async () => {
    const token = await makeHs256Token()
    expect(await verifySupabaseAccessToken(token, {})).toEqual({ status: 'unverifiable' })
  })

  it('invalid untuk string sampah', async () => {
    expect(await verifySupabaseAccessToken('bukan.jwt', { jwks })).toEqual({ status: 'invalid' })
  })

  it('invalid untuk alg none (anti alg-confusion)', async () => {
    const token = `${b64urlJson({ alg: 'none', typ: 'JWT' })}.${b64urlJson({ sub: 'user-123' })}.`
    expect(await verifySupabaseAccessToken(token, { jwks, jwtSecret: SECRET })).toEqual({ status: 'invalid' })
  })
})

function mockSupabase(session: { access_token: string } | null, userId: string | null = null) {
  const getUser = vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } })
  const getSession = vi.fn().mockResolvedValue({ data: { session } })
  return { client: { auth: { getSession, getUser } }, getUser, getSession }
}

describe('resolveUserId', () => {
  it('memakai verifikasi lokal tanpa memanggil getUser()', async () => {
    const token = await makeHs256Token({ sub: 'user-fast-path' })
    const { client, getUser } = mockSupabase({ access_token: token })
    expect(await resolveUserId(client, SECRET)).toBe('user-fast-path')
    expect(getUser).not.toHaveBeenCalled()
  })

  it('token kedaluwarsa → null, TANPA getUser()', async () => {
    const token = await makeHs256Token({ expOffsetSec: -10 })
    const { client, getUser } = mockSupabase({ access_token: token }, 'tidak-boleh-dipakai')
    expect(await resolveUserId(client, SECRET)).toBeNull()
    expect(getUser).not.toHaveBeenCalled()
  })

  it('tanpa sesi → null, TANPA getUser()', async () => {
    const { client, getUser } = mockSupabase(null)
    expect(await resolveUserId(client, SECRET)).toBeNull()
    expect(getUser).not.toHaveBeenCalled()
  })

  it('fallback getUser() hanya bila verifikasi lokal mustahil', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const token = await makeHs256Token()
    const { client, getUser } = mockSupabase({ access_token: token }, 'network-user-id')
    expect(await resolveUserId(client, undefined)).toBe('network-user-id')
    expect(getUser).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})

describe('getVerifiedUserId', () => {
  it('memakai SUPABASE_JWT_SECRET dari env, tanpa getUser()', async () => {
    vi.stubEnv('SUPABASE_JWT_SECRET', SECRET)
    const token = await makeHs256Token({ sub: 'user-dari-env' })
    const { client, getUser } = mockSupabase({ access_token: token })
    expect(await getVerifiedUserId(client)).toBe('user-dari-env')
    expect(getUser).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('token tidak sah → null, TANPA getUser()', async () => {
    vi.stubEnv('SUPABASE_JWT_SECRET', SECRET)
    const token = await makeHs256Token({ secret: 'secret-yang-salah-sekali' })
    const { client, getUser } = mockSupabase({ access_token: token }, 'tidak-boleh-dipakai')
    expect(await getVerifiedUserId(client)).toBeNull()
    expect(getUser).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('tanpa sesi → null', async () => {
    const { client, getUser } = mockSupabase(null)
    expect(await getVerifiedUserId(client)).toBeNull()
    expect(getUser).not.toHaveBeenCalled()
  })
})

describe('Cookie-First + Singleflight Anti-Race (resolveUserId)', () => {
  beforeEach(() => {
    resetRefreshSingleflightCacheForTests()
  })

  it('membaca cookie utuh maupun chunked base64url @supabase/ssr tanpa memanggil getSession()', async () => {
    const validJwt = await makeHs256Token({ sub: 'staff-finance-1' })
    const rawPayload = `base64-${b64urlJson({ access_token: validJwt, refresh_token: 'rt-valid-1' })}`
    const mid = Math.floor(rawPayload.length / 2)
    const chunkedCookies = [
      { name: 'sb-khpkoreaaucvyqfhynfq-auth-token.0', value: rawPayload.slice(0, mid) },
      { name: 'sb-khpkoreaaucvyqfhynfq-auth-token.1', value: rawPayload.slice(mid) },
    ]

    const extracted = extractSessionTokensFromCookies(chunkedCookies)
    expect(extracted.accessToken).toBe(validJwt)
    expect(extracted.refreshToken).toBe('rt-valid-1')

    const { client, getSession, getUser } = mockSupabase(null)
    const sub = await resolveUserId(client, SECRET, { cookies: chunkedCookies })
    expect(sub).toBe('staff-finance-1')
    expect(getSession).not.toHaveBeenCalled()
    expect(getUser).not.toHaveBeenCalled()
  })

  it('prefetch dengan token kedaluwarsa TIDAK PERNAH memanggil getSession() (cegah refresh race)', async () => {
    const expiredJwt = await makeHs256Token({ sub: 'staff-finance-1', expOffsetSec: -60 })
    const cookies = [
      {
        name: 'sb-khpkoreaaucvyqfhynfq-auth-token',
        value: `base64-${b64urlJson({ access_token: expiredJwt, refresh_token: 'rt-old-prefetch' })}`,
      },
    ]

    const freshJwt = await makeHs256Token({ sub: 'staff-finance-1', expOffsetSec: 3600 })
    const { client, getSession } = mockSupabase({ access_token: freshJwt })

    const sub = await resolveUserId(client, SECRET, { cookies, isPrefetch: true })
    expect(sub).toBeNull()
    expect(getSession).not.toHaveBeenCalled()
  })

  it('8 request paralel dengan refresh_token kedaluwarsa yang sama di-singleflight menjadi 1 kali refresh', async () => {
    const expiredJwt = await makeHs256Token({ sub: 'staff-finance-1', expOffsetSec: -120 })
    const freshJwt = await makeHs256Token({ sub: 'staff-finance-1', expOffsetSec: 3600 })
    const cookies = [
      {
        name: 'sb-khpkoreaaucvyqfhynfq-auth-token',
        value: `base64-${b64urlJson({ access_token: expiredJwt, refresh_token: 'rt-shared-parallel' })}`,
      },
    ]

    let goTrueCalls = 0
    const sharedClient = {
      auth: {
        getSession: vi.fn(async () => {
          goTrueCalls += 1
          await new Promise((r) => setTimeout(r, 25))
          // Simulasi GoTrue: hanya pemanggilan pertama yang berhasil, sisanya refresh_token_not_found!
          if (goTrueCalls > 1) {
            return { data: { session: null } }
          }
          return { data: { session: { access_token: freshJwt } } }
        }),
        getUser: vi.fn(async () => ({ data: { user: null } })),
      },
    }

    const replayedCounts: number[] = []
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, idx) =>
        resolveUserId(sharedClient, SECRET, {
          cookies,
          getCapturedCookies: () =>
            idx === 0 ? [{ name: 'sb-khpkoreaaucvyqfhynfq-auth-token', value: 'new-cookie-val' }] : [],
          replayCookies: (cs) => replayedCounts.push(cs.length),
        })
      )
    )

    expect(goTrueCalls).toBe(1)
    expect(results).toEqual(Array(8).fill('staff-finance-1'))
    // 7 request pengikut + panggilan berikutnya dalam masa grace mendapat replay cookie baru
    expect(replayedCounts.every((c) => c === 1)).toBe(true)

    // Panggilan susulan 100ms kemudian dengan cookie lama (mis. Server Action in-flight) tetap lolos dari grace cache!
    const followUp = await resolveUserId(sharedClient, SECRET, { cookies })
    expect(followUp).toBe('staff-finance-1')
    expect(goTrueCalls).toBe(1)
  })
})

describe('safeTrustedReturnUrl', () => {
  it('menerima subdomain sukashawarma.com HTTPS dan menolak domain asing / loop login', () => {
    expect(safeTrustedReturnUrl('https://finance.sukashawarma.com/approval')).toBe(
      'https://finance.sukashawarma.com/approval'
    )
    expect(safeTrustedReturnUrl('https://app.sukashawarma.com/')).toBeNull()
    expect(safeTrustedReturnUrl('https://evil.com/approval')).toBeNull()
    expect(safeTrustedReturnUrl('http://finance.sukashawarma.com/approval')).toBeNull()
    expect(safeTrustedReturnUrl('http://localhost:3020/approval', true)).toBe(
      'http://localhost:3020/approval'
    )
  })
})
