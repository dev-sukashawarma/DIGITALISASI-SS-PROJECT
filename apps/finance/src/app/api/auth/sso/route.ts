import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@suka/auth'

type HandoffBody = {
  tokenHash?: unknown
  token_hash?: unknown
  accessToken?: unknown
  refreshToken?: unknown
  access_token?: unknown
  refresh_token?: unknown
}

function isReasonableSecret(value: unknown, minLen = 20): value is string {
  return typeof value === 'string' && value.trim().length >= minLen && value.trim().length <= 4096
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true
  if (
    origin === 'android-app://com.sukashawarma.superapp' ||
    origin === 'android-app://com.sukashawarma.pos'
  ) {
    return true
  }
  try {
    const originUrl = new URL(origin)
    const host = originUrl.hostname.toLowerCase()
    if (host === 'sukashawarma.com' || host.endsWith('.sukashawarma.com')) return true
    if (host === 'localhost' || host === '127.0.0.1') return true
    if (host.startsWith('192.168.') || host.startsWith('10.')) return true
    return false
  } catch {
    return false
  }
}

/**
 * Menukar `token_hash` (magiclink OTP sekali pakai dari SUKA SuperApp / POS) atau
 * pasangan `access_token` + `refresh_token` menjadi cookie sesi SSR `.sukashawarma.com`.
 */
export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request.headers.get('origin'))) {
    return NextResponse.json({ ok: false, error: 'Origin tidak diizinkan' }, { status: 403 })
  }

  let body: HandoffBody
  try {
    body = (await request.json()) as HandoffBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Payload sesi tidak valid' }, { status: 400 })
  }

  const rawTokenHash = body.tokenHash ?? body.token_hash
  const rawAccess = body.accessToken ?? body.access_token
  const rawRefresh = body.refreshToken ?? body.refresh_token

  const tokenHash = isReasonableSecret(rawTokenHash, 16) ? rawTokenHash.trim() : ''
  const accessToken = isReasonableSecret(rawAccess, 20) ? rawAccess.trim() : ''
  const refreshToken = isReasonableSecret(rawRefresh, 12) ? rawRefresh.trim() : ''

  if (!tokenHash && (!accessToken || !refreshToken)) {
    return NextResponse.json({ ok: false, error: 'Token sesi tidak lengkap' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (cookies) => {
      for (const { name, value, options } of cookies) {
        if (!value || (typeof options?.maxAge === 'number' && options.maxAge <= 0)) continue
        response.cookies.set(name, value, options as Partial<ResponseCookie>)
      }
    },
  })

  if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: tokenHash,
    })
    if (error || !data.session || !data.user) {
      return NextResponse.json(
        { ok: false, error: error?.message || 'Token SSO sudah kedaluwarsa atau tidak berlaku' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }
  } else {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error || !data.session || !data.user) {
      return NextResponse.json(
        { ok: false, error: error?.message || 'Token sesi ditolak' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }
  }

  response.headers.set('Cache-Control', 'no-store')
  return response
}
