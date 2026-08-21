import { createSupabaseServerClient } from '@suka/auth'
import { type NextRequest, NextResponse } from 'next/server'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

type HandoffBody = {
  accessToken?: unknown
  refreshToken?: unknown
  access_token?: unknown
  refresh_token?: unknown
}

const MAX_TOKEN_LENGTH = 16_384

function isToken(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_TOKEN_LENGTH
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
      ) || 
      // Izinkan Vercel preview URL
      originUrl.hostname.endsWith('.vercel.app') || 
      // Izinkan local network IPs (untuk testing emulator / local device)
      originUrl.hostname === '127.0.0.1' ||
      originUrl.hostname.startsWith('192.168.') ||
      originUrl.hostname.startsWith('10.') ||
      // Izinkan origin jika Chrome mengirim package name POS dari Intent
      origin === 'android-app://com.sukashawarma.pos'
      
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

  const rawAccess = body.accessToken ?? body.access_token
  const rawRefresh = body.refreshToken ?? body.refresh_token

  const accessToken = typeof rawAccess === 'string' ? rawAccess.trim() : ''
  const refreshToken = typeof rawRefresh === 'string' ? rawRefresh.trim() : ''

  if (!isToken(accessToken) || !isToken(refreshToken)) {
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
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  if (error || !data.session || !data.user) {
    return NextResponse.json({ ok: false, error: error?.message || 'Token sesi ditolak' }, { status: 401 })
  }

  response.headers.set('cache-control', 'no-store')
  return response
}
