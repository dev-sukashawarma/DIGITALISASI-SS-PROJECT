// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { SignJWT } from 'jose'
import { supabaseJwtIssuer } from '@suka/auth'
import { GET, POST } from './route'

const SECRET = 'sso-route-test-secret-minimum-32-characters!!'

let mockVerifyOtpSession: { access_token: string; refresh_token: string } | null = null
let mockSetCookiesBatch: Array<{ name: string; value: string; options?: Record<string, unknown> }> = []

vi.mock('@suka/auth', async () => {
  const actual = await vi.importActual<typeof import('@suka/auth')>('@suka/auth')
  return {
    ...actual,
    createSupabaseServerClient: vi.fn((adapter: { setAll: (c: any[]) => void }) => ({
      auth: {
        verifyOtp: vi.fn(async () => {
          if (!mockVerifyOtpSession) {
            return { data: { session: null, user: null }, error: { message: 'invalid otp' } }
          }
          adapter.setAll(mockSetCookiesBatch)
          return {
            data: { session: mockVerifyOtpSession, user: { id: 'staff-fin-1' } },
            error: null,
          }
        }),
        setSession: vi.fn(async ({ access_token, refresh_token }: any) => {
          adapter.setAll(mockSetCookiesBatch)
          return {
            data: { session: { access_token, refresh_token }, user: { id: 'staff-fin-1' } },
            error: null,
          }
        }),
        refreshSession: vi.fn(async () => ({
          data: { session: null, user: null },
          error: { message: 'refresh_token_not_found' },
        })),
      },
    })),
  }
})

async function signJwt(expOffsetSec: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject('staff-fin-1')
    .setIssuer(supabaseJwtIssuer())
    .setAudience('authenticated')
    .setIssuedAt(now)
    .setExpirationTime(now + expOffsetSec)
    .sign(new TextEncoder().encode(SECRET))
}

function b64Cookie(accessToken: string, refreshToken: string): string {
  const b64 = btoa(JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `base64-${b64}`
}

describe('/api/auth/sso route', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_JWT_SECRET', SECRET)
    vi.stubEnv('NEXT_PUBLIC_COOKIE_DOMAIN', '.sukashawarma.com')
    mockVerifyOtpSession = null
    mockSetCookiesBatch = []
  })

  it('POST verifyOtp menulis chunk .0/.1 baru sekaligus menghapus cookie utuh lama & _suka_gate', async () => {
    const freshJwt = await signJwt(3600)
    mockVerifyOtpSession = { access_token: freshJwt, refresh_token: 'rt-magiclink-1' }
    mockSetCookiesBatch = [
      {
        name: 'sb-khpkoreaaucvyqfhynfq-auth-token',
        value: '',
        options: { path: '/', domain: '.sukashawarma.com', maxAge: 0 },
      },
      {
        name: 'sb-khpkoreaaucvyqfhynfq-auth-token.0',
        value: 'chunk-0',
        options: { path: '/', domain: '.sukashawarma.com', maxAge: 31536000 },
      },
      {
        name: 'sb-khpkoreaaucvyqfhynfq-auth-token.1',
        value: 'chunk-1',
        options: { path: '/', domain: '.sukashawarma.com', maxAge: 31536000 },
      },
    ]

    const req = new NextRequest('https://finance.sukashawarma.com/api/auth/sso', {
      method: 'POST',
      headers: {
        origin: 'https://finance.sukashawarma.com',
        'content-type': 'application/json',
        cookie: 'sb-khpkoreaaucvyqfhynfq-auth-token=dead-old-cookie; _suka_gate=old-gate',
      },
      body: JSON.stringify({ token_hash: 'valid-magiclink-token-hash-123456' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('sb-khpkoreaaucvyqfhynfq-auth-token=; Path=/; Max-Age=0; Domain=.sukashawarma.com')
    expect(setCookie).toContain('sb-khpkoreaaucvyqfhynfq-auth-token=; Path=/; Max-Age=0; SameSite=Lax')
    expect(setCookie).toContain('sb-khpkoreaaucvyqfhynfq-auth-token.0=chunk-0')
    expect(setCookie).toContain('sb-khpkoreaaucvyqfhynfq-auth-token.1=chunk-1')
  })

  it('GET memulihkan sesi chunked yang sah meskipun tertutup cookie utuh kedaluwarsa', async () => {
    const expiredJwt = await signJwt(-300)
    const validJwt = await signJwt(1800)
    const staleRaw = b64Cookie(expiredJwt, 'rt-dead')
    const validRaw = b64Cookie(validJwt, 'rt-valid-123456')
    const mid = Math.floor(validRaw.length / 2)

    mockSetCookiesBatch = [
      {
        name: 'sb-khpkoreaaucvyqfhynfq-auth-token.0',
        value: validRaw.slice(0, mid),
        options: { path: '/', domain: '.sukashawarma.com', maxAge: 31536000 },
      },
      {
        name: 'sb-khpkoreaaucvyqfhynfq-auth-token.1',
        value: validRaw.slice(mid),
        options: { path: '/', domain: '.sukashawarma.com', maxAge: 31536000 },
      },
    ]

    const req = new NextRequest('https://finance.sukashawarma.com/api/auth/sso', {
      method: 'GET',
      headers: {
        cookie: [
          `sb-khpkoreaaucvyqfhynfq-auth-token=${staleRaw}`,
          `sb-khpkoreaaucvyqfhynfq-auth-token.0=${validRaw.slice(0, mid)}`,
          `sb-khpkoreaaucvyqfhynfq-auth-token.1=${validRaw.slice(mid)}`,
        ].join('; '),
      },
    })

    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      ok: true,
      authenticated: true,
      access_token: validJwt,
      refresh_token: 'rt-valid-123456',
    })
  })
})
