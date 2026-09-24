import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined

function getPortalUrl(request: NextRequest): string {
  const host = request.headers.get('host') || request.nextUrl.host || ''
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1')
  if (isLocal) {
    return 'http://localhost:3010'
  }
  return process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
}

const expectedIssuer = `${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')}/auth/v1`

/**
 * Identitas tanpa panggilan jaringan per request.
 * - `getSession()` membaca sesi dari cookie dan me-refresh token yang
 *   sudah/hampir kedaluwarsa (cookie baru ditulis lewat `setAll`).
 * - `getClaims(token)` memverifikasi JWT ES256 secara lokal terhadap JWKS
 *   project (di-cache global ±10 menit oleh auth-js), lalu iss/aud dicek.
 * - Token tidak sah/kedaluwarsa → null. Hanya bila verifikasi lokal mustahil
 *   (JWKS tak terjangkau, dsb.) baru jatuh ke `getUser()` (GET /auth/v1/user).
 * marcom adalah app pnpm mandiri (di luar workspace yarn), jadi tidak memakai
 * `resolveUserId` dari `@suka/auth`; logikanya disamakan.
 */
async function resolveUserId(
  supabase: ReturnType<typeof createServerClient>
): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null

  try {
    const { data, error } = await supabase.auth.getClaims(session.access_token)
    if (data?.claims) {
      const { sub, iss, aud } = data.claims
      const audOk = Array.isArray(aud) ? aud.includes('authenticated') : aud === 'authenticated'
      return typeof sub === 'string' && sub && iss === expectedIssuer && audOk ? sub : null
    }
    if (error && (error.name === 'AuthInvalidJwtError' || (error as { code?: string }).code === 'invalid_jwt')) {
      return null
    }
  } catch {
    // Verifikasi lokal gagal secara teknis → fallback network di bawah.
  }

  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Bypass cron dan background sync API
  if (pathname.startsWith('/api/cron')) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: cookieDomain,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 31536000,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, {
              ...options,
              domain: cookieDomain,
            })
          })
        },
      },
    }
  )

  const user = await resolveUserId(supabase)
  const portalUrl = getPortalUrl(request)

  const getRedirect = (url: string | URL) => {
    const redirectResponse = NextResponse.redirect(new URL(url, request.url))
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set({ ...cookie })
    })
    return redirectResponse
  }

  // Jika mengunjungi /login: jika sudah login ke dashboard, jika belum lempar ke portal
  if (pathname === '/login') {
    if (user) {
      return getRedirect('/dashboard')
    }
    return getRedirect(portalUrl)
  }

  // Root path / : jika ada user ke /dashboard, jika belum ada ke portal
  if (pathname === '/') {
    if (user) {
      return getRedirect('/dashboard')
    }
    return getRedirect(portalUrl)
  }

  // Proteksi semua rute dashboard untuk pengguna yang belum login
  if (pathname.startsWith('/dashboard') && !user) {
    return getRedirect(portalUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|workbox-|icons/|.*\\.(?:js|css|map|png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|otf)$).*)'],
}

