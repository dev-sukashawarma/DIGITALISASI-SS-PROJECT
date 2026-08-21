import { createSupabaseServerClient } from '@suka/auth'
import { type NextRequest, NextResponse } from 'next/server'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

type HandoffBody = {
  accessToken?: unknown
  refreshToken?: unknown
}

const MAX_TOKEN_LENGTH = 8_192

function isToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 20 && value.length <= MAX_TOKEN_LENGTH
}

/**
 * Menukar token sesi native menjadi cookie SSR Stok tanpa melibatkan auth client
 * browser. Endpoint hanya menerima fetch same-origin dari halaman /auth/sso.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')

  if (origin) {
    try {
      const originUrl = new URL(origin)
      const allowedDomains = ['sukashawarma.com', 'localhost']
      const isAllowed = allowedDomains.some(domain => 
        originUrl.hostname === domain || originUrl.hostname.endsWith('.' + domain)
      )
      
      if (!isAllowed) {
        return NextResponse.json({ ok: false, error: 'Origin tidak diizinkan' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ ok: false, error: 'Origin tidak valid' }, { status: 403 })
    }
  }

  let body: HandoffBody
  try {
    body = (await request.json()) as HandoffBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Payload sesi tidak valid' }, { status: 400 })
  }

  if (!isToken(body.accessToken) || !isToken(body.refreshToken)) {
    return NextResponse.json({ ok: false, error: 'Token sesi tidak lengkap' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (cookies) => {
      for (const { name, value, options } of cookies) {
        response.cookies.set(name, value, options as Partial<ResponseCookie>)
      }
    },
  })

  const { data, error } = await supabase.auth.setSession({
    access_token: body.accessToken,
    refresh_token: body.refreshToken,
  })

  if (error || !data.session || !data.user) {
    return NextResponse.json({ ok: false, error: error?.message || 'Token sesi ditolak' }, { status: 401 })
  }

  response.headers.set('cache-control', 'no-store')
  return response
}
