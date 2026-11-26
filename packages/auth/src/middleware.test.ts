import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { SignJWT } from 'jose'
import { enforceAppAccess } from './middleware'
import { resetRefreshSingleflightCacheForTests, supabaseJwtIssuer } from './jwt'

const SECRET = 'middleware-test-secret-key-minimum-32-chars'

let mockSetAllCookies: Array<{ name: string; value: string; options?: Record<string, unknown> }> = []
let mockSessionToken: string | null = null
let getSessionMock = vi.fn()

vi.mock('./supabase-server', () => ({
  createSupabaseServerClient: vi.fn((adapter: { setAll: (c: any[]) => void }) => ({
    auth: {
      getSession: async () => {
        getSessionMock()
        if (mockSetAllCookies.length > 0) {
          adapter.setAll(mockSetAllCookies)
        }
        return {
          data: {
            session: mockSessionToken ? { access_token: mockSessionToken } : null,
          },
        }
      },
      getUser: async () => ({ data: { user: null } }),
    },
  })),
}))

vi.mock('./staff', () => ({
  getOutletStaff: vi.fn(async () => ({
    staff: {
      id: 'staff-fin-1',
      outlet_id: null,
      name: 'Admin Finance',
      role: 'admin_finance',
      status: 'active',
      ref_photo_url: null,
      username: 'finance1',
      allow_manual_button: false,
      outlets: null,
    },
    error: null,
  })),
}))

async function signTestJwt(expOffsetSec: number, sub = 'staff-fin-1'): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(sub)
    .setIssuer(supabaseJwtIssuer())
    .setAudience('authenticated')
    .setIssuedAt(now)
    .setExpirationTime(now + expOffsetSec)
    .sign(new TextEncoder().encode(SECRET))
}

function encodeCookieVal(accessToken: string, refreshToken: string): string {
  const b64 = btoa(JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `base64-${b64}`
}

describe('enforceAppAccess anti-bounce-to-login', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_JWT_SECRET', SECRET)
    vi.stubEnv('NEXT_PUBLIC_PORTAL_URL', 'https://app.sukashawarma.com')
    mockSetAllCookies = []
    mockSessionToken = null
    getSessionMock = vi.fn()
    resetRefreshSingleflightCacheForTests()
  })

  it('request prefetch dengan token kedaluwarsa mengembalikan 401 no-store TANPA redirect 307 ke login dan TANPA memanggil GoTrue', async () => {
    const expired = await signTestJwt(-120)
    const cookieVal = encodeCookieVal(expired, 'rt-prefetch-1')
    const req = new NextRequest('https://finance.sukashawarma.com/approval', {
      headers: {
        host: 'finance.sukashawarma.com',
        'next-router-prefetch': '1',
        cookie: `sb-khpkoreaaucvyqfhynfq-auth-token=${cookieVal}`,
      },
    })

    const res = await enforceAppAccess(req, 'finance')
    expect(res.status).toBe(401)
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(getSessionMock).not.toHaveBeenCalled()
  })

  it('kegagalan refresh (refresh_token_not_found) TIDAK PERNAH menyalin Set-Cookie Max-Age=0 ke browser dan menyertakan ?next=', async () => {
    const expired = await signTestJwt(-120)
    const cookieVal = encodeCookieVal(expired, 'rt-stale-lost-race')
    // Simulasi perilaku @supabase/ssr saat refresh_token_not_found: memanggil setAll dengan value="" dan maxAge=0
    mockSetAllCookies = [
      {
        name: 'sb-khpkoreaaucvyqfhynfq-auth-token',
        value: '',
        options: { path: '/', domain: '.sukashawarma.com', maxAge: 0 },
      },
    ]
    mockSessionToken = null

    const req = new NextRequest('https://finance.sukashawarma.com/approval', {
      headers: {
        host: 'finance.sukashawarma.com',
        'x-forwarded-proto': 'https',
        cookie: `sb-khpkoreaaucvyqfhynfq-auth-token=${cookieVal}`,
      },
    })

    const res = await enforceAppAccess(req, 'finance')
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'https://app.sukashawarma.com/?next=https%3A%2F%2Ffinance.sukashawarma.com%2Fapproval'
    )
    // Cookie sesi baru di browser TIDAK BOLEH ditimpa Max-Age=0!
    expect(res.headers.get('set-cookie') ?? '').not.toContain('Max-Age=0')
  })

  it('navigasi normal ke /approval dengan JWT sah langsung lolos tanpa menyentuh getSession()', async () => {
    const valid = await signTestJwt(1800)
    const cookieVal = encodeCookieVal(valid, 'rt-fresh-1')
    const req = new NextRequest('https://finance.sukashawarma.com/approval', {
      headers: {
        host: 'finance.sukashawarma.com',
        cookie: `sb-khpkoreaaucvyqfhynfq-auth-token=${cookieVal}`,
      },
    })

    const res = await enforceAppAccess(req, 'finance')
    expect(res.status).toBe(200)
    expect(getSessionMock).not.toHaveBeenCalled()
  })

  it('saat sesi baru ter-refresh menjadi chunked (.0 + .1), instruksi penghapusan cookie utuh lama (maxAge=0) TETAP diterapkan agar tidak menutupi chunk baru', async () => {
    const expired = await signTestJwt(-120)
    const fresh = await signTestJwt(3600)
    const oldUnchunked = encodeCookieVal(expired, 'rt-old-unchunked')
    const freshEncoded = encodeCookieVal(fresh, 'rt-new-chunked')
    const mid = Math.floor(freshEncoded.length / 2)

    mockSetAllCookies = [
      {
        name: 'sb-khpkoreaaucvyqfhynfq-auth-token',
        value: '',
        options: { path: '/', domain: '.sukashawarma.com', maxAge: 0 },
      },
      {
        name: 'sb-khpkoreaaucvyqfhynfq-auth-token.0',
        value: freshEncoded.slice(0, mid),
        options: { path: '/', domain: '.sukashawarma.com', maxAge: 31536000 },
      },
      {
        name: 'sb-khpkoreaaucvyqfhynfq-auth-token.1',
        value: freshEncoded.slice(mid),
        options: { path: '/', domain: '.sukashawarma.com', maxAge: 31536000 },
      },
    ]
    mockSessionToken = fresh

    const req = new NextRequest('https://finance.sukashawarma.com/approval', {
      headers: {
        host: 'finance.sukashawarma.com',
        cookie: `sb-khpkoreaaucvyqfhynfq-auth-token=${oldUnchunked}`,
      },
    })

    const res = await enforceAppAccess(req, 'finance')
    expect(res.status).toBe(200)
    const setCookieHeader = res.headers.get('set-cookie') ?? ''
    expect(setCookieHeader).toContain('sb-khpkoreaaucvyqfhynfq-auth-token=; Path=/; Max-Age=0')
    expect(setCookieHeader).toContain('sb-khpkoreaaucvyqfhynfq-auth-token.0=')
    expect(setCookieHeader).toContain('sb-khpkoreaaucvyqfhynfq-auth-token.1=')
  })
})
