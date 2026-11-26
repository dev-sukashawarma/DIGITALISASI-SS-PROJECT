import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'
import { NextResponse, type NextRequest } from 'next/server'
import {
  createSupabaseServerClient,
  decodeJwtExpSeconds,
  extractAllSessionTokensFromCookies,
  GATE_COOKIE,
  hasActiveSessionCookieWrite,
  verifySupabaseAccessToken,
  type CapturedCookieItem,
} from '@suka/auth'

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
 * Menulis batch cookie sesi baru secara bersih:
 * 1. Bila `cookieDomain` aktif (mis. `.sukashawarma.com`), bersihkan bayangan cookie host-only
 *    (`Path=/; Max-Age=0` tanpa `Domain`) untuk semua nama cookie auth yang ada maupun yang ditulis,
 *    agar browser tidak pernah menyimpan dua cookie bernama sama.
 * 2. Hapus pecahan/chunk lama (`sb-...-auth-token`, `.0`..`.5`, serta `_suka_gate`) yang TIDAK
 *    termasuk ke dalam set cookie aktif yang baru ditulis!
 */
function writeCleanSessionCookies(
  request: NextRequest,
  response: NextResponse,
  writtenCookies: CapturedCookieItem[]
) {
  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined
  const securePart = process.env.NODE_ENV === 'production' ? '; Secure' : ''

  const activeNames = new Set(
    writtenCookies
      .filter((c) => Boolean(c.value) && !(typeof c.options?.maxAge === 'number' && c.options.maxAge <= 0))
      .map((c) => c.name)
  )

  const baseNames = new Set<string>()
  for (const c of [...request.cookies.getAll(), ...writtenCookies]) {
    const match = /^(sb-[a-z0-9_-]+-auth-token)(?:\.\d+)?$/i.exec(c.name)
    if (match) baseNames.add(match[1])
  }

  const candidateCleanupNames = new Set<string>([GATE_COOKIE])
  for (const c of request.cookies.getAll()) {
    if (c.name.startsWith('sb-') || c.name === GATE_COOKIE) {
      candidateCleanupNames.add(c.name)
    }
  }
  for (const base of baseNames) {
    candidateCleanupNames.add(base)
    for (let i = 0; i <= 5; i++) {
      candidateCleanupNames.add(`${base}.${i}`)
    }
  }

  // 1. Hapus nama chunk/cookie yang tidak dipakai oleh sesi baru melalui response.cookies.set terlebih dulu
  for (const name of candidateCleanupNames) {
    if (activeNames.has(name)) continue
    if (!cookieDomain) {
      response.cookies.set(name, '', { path: '/', maxAge: 0, sameSite: 'lax' })
    } else {
      response.cookies.set(name, '', {
        path: '/',
        domain: cookieDomain,
        maxAge: 0,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
    }
  }

  // 2. Tulis seluruh cookie aktif sesi baru
  for (const { name, value, options } of writtenCookies) {
    if (!activeNames.has(name)) continue
    response.cookies.set(name, value, options as Partial<ResponseCookie>)
  }

  // 3. PENTING: panggil headers.append('Set-Cookie', ...) PALING AKHIR setelah seluruh response.cookies.set(),
  // karena ResponseCookies milik Next.js menulis ulang header Set-Cookie setiap kali cookies.set() dipanggil!
  if (cookieDomain) {
    for (const name of candidateCleanupNames) {
      response.headers.append(
        'Set-Cookie',
        `${name}=; Path=/; Max-Age=0; SameSite=Lax${securePart}`
      )
    }
  }
}

function clearDeadAuthCookiesOnResponse(request: NextRequest, response: NextResponse) {
  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined
  const securePart = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  const names = new Set<string>([GATE_COOKIE])
  for (const { name } of request.cookies.getAll()) {
    if (name.startsWith('sb-') || name === GATE_COOKIE) names.add(name)
  }
  for (const name of names) {
    response.headers.append('Set-Cookie', `${name}=; Path=/; Max-Age=0; SameSite=Lax${securePart}`)
    if (cookieDomain) {
      response.headers.append(
        'Set-Cookie',
        `${name}=; Path=/; Domain=${cookieDomain}; Max-Age=0; SameSite=Lax${securePart}`
      )
    }
  }
}

/**
 * Pemulihan sesi browser (`AuthProvider` self-heal):
 * Dipanggil ketika halaman SSR sudah lolos middleware, tetapi `supabase.auth.getSession()`
 * di browser gagal membaca cookie (mis. akibat chunk lama / duplikat host-only).
 * Mengembalikan pasangan `access_token` + `refresh_token` yang sah & segar atau membersihkan
 * cookie mati bila sesi memang sudah tidak berlaku.
 */
export async function GET(request: NextRequest) {
  const incoming = request.cookies.getAll()
  const candidates = extractAllSessionTokensFromCookies(incoming)
  const nowSec = Math.floor(Date.now() / 1000)

  // 1. Cari kandidat yang access_token-nya masih sah dan belum masuk ambang 90 detik GoTrue
  for (const candidate of candidates) {
    if (!candidate.accessToken || !candidate.refreshToken) continue
    const exp = decodeJwtExpSeconds(candidate.accessToken)
    if (exp !== null && exp - nowSec > 95) {
      const check = await verifySupabaseAccessToken(candidate.accessToken, {
        jwtSecret: process.env.SUPABASE_JWT_SECRET,
      })
      if (check.status === 'valid') {
        const written: CapturedCookieItem[] = []
        const supabase = createSupabaseServerClient({
          getAll: () => [],
          setAll: (cookies) => {
            if (!hasActiveSessionCookieWrite(cookies)) return
            written.length = 0
            cookies.forEach((c) => written.push(c))
          },
        })
        await supabase.auth.setSession({
          access_token: candidate.accessToken,
          refresh_token: candidate.refreshToken,
        }).catch(() => null)

        const response = NextResponse.json(
          {
            ok: true,
            authenticated: true,
            access_token: candidate.accessToken,
            refresh_token: candidate.refreshToken,
          },
          { headers: { 'Cache-Control': 'no-store' } }
        )
        if (written.length > 0) {
          writeCleanSessionCookies(request, response, written)
        }
        return response
      }
    }
  }

  // 2. Bila sudah dekat/lewat kedaluwarsa, coba segarkan lewat refresh_token kandidat
  for (const candidate of candidates) {
    if (!candidate.refreshToken) continue
    const written: CapturedCookieItem[] = []
    const supabase = createSupabaseServerClient({
      getAll: () => [],
      setAll: (cookies) => {
        if (!hasActiveSessionCookieWrite(cookies)) return
        written.length = 0
        cookies.forEach((c) => written.push(c))
      },
    })

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: candidate.refreshToken,
    })
    if (!error && data.session?.access_token && data.session?.refresh_token) {
      const response = NextResponse.json(
        {
          ok: true,
          authenticated: true,
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
      if (written.length > 0) {
        writeCleanSessionCookies(request, response, written)
      }
      return response
    }
  }

  // 3. Semua kandidat gagal -> bersihkan cookie mati agar tidak terjadi zombie state lagi
  const unauthed = NextResponse.json(
    { ok: true, authenticated: false },
    { headers: { 'Cache-Control': 'no-store' } }
  )
  clearDeadAuthCookiesOnResponse(request, unauthed)
  return unauthed
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

  const writtenCookies: CapturedCookieItem[] = []
  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (cookies) => {
      if (!hasActiveSessionCookieWrite(cookies)) return
      writtenCookies.length = 0
      for (const c of cookies) {
        writtenCookies.push(c)
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

  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  writeCleanSessionCookies(request, response, writtenCookies)
  return response
}
