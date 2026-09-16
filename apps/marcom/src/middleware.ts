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

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser()
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|workbox-|icons/|.*\\.(?:js|css|map|png|jpg|jpeg|svg|ico)$).*)'],
}

