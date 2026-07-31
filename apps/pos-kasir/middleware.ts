import { createSupabaseServerClient, hasAppAccess, resolveUserId } from '@suka/auth'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const isLocal = request.nextUrl.hostname === 'localhost' || request.nextUrl.hostname === '127.0.0.1' || process.env.NODE_ENV === 'development'
  const PORTAL_URL = isLocal ? 'http://localhost:3010' : (process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com')

  const response = NextResponse.next()

  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookies) => {
      cookies.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
      )
    },
  })

  const getRedirect = (url: string | URL) => {
    const redirectResponse = NextResponse.redirect(new URL(url, request.url))
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set({ ...cookie })
    })
    return redirectResponse
  }

  const userId = await resolveUserId(supabase, process.env.SUPABASE_JWT_SECRET)

  let role = null
  let outlet_id = null
  let status = null

  if (userId) {
    const { data: profile, error } = await supabase
      .from('outlet_staff')
      .select('role, outlet_id, status')
      .eq('id', userId)
      .maybeSingle()

    if (profile) {
      role = profile.role
      outlet_id = profile.outlet_id
      status = profile.status
      // Cache profile to cookie for offline resilience
      response.cookies.set('_suka_staff_cache', JSON.stringify(profile), { maxAge: 60 * 60 * 24 * 7 })
    } else if (error) {
      // Network/DB error when offline. Try to use cached profile.
      const cached = request.cookies.get('_suka_staff_cache')?.value
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          role = parsed.role
          outlet_id = parsed.outlet_id
          status = parsed.status
        } catch {}
      }
      
      // If we still don't have a role, fallback to redirect
      if (!role) {
        return getRedirect(PORTAL_URL)
      }
    } else {
      // No staff profile found → redirect to portal
      return getRedirect(PORTAL_URL)
    }
  }

  const path = request.nextUrl.pathname

  // Proteksi Route Admin
  if (path.startsWith('/admin')) {
    if (!userId || role !== 'admin' || !hasAppAccess(role, 'pos-kasir') || status !== 'active') {
      return getRedirect(PORTAL_URL)
    }
  }

  // Proteksi Route Kasir
  if (path.startsWith('/kasir')) {
    if (!userId || !['leader', 'crew', 'regional_manager'].includes(role as string) || !hasAppAccess(role as any, 'pos-kasir') || status !== 'active') {
      return getRedirect(PORTAL_URL)
    }
  }

  // Proteksi Route Pelanggan (Self-Order Kiosk)
  // Device self-order HARUS sudah di-login kan kasir via QR (role 'kiosk').
  // Halaman pesan pelanggan ('/', menu, checkout, dst) tidak boleh dibuka
  // kalau device belum punya sesi kiosk aktif.
  const PUBLIC_PATHS = ['/kiosk/qr-login', '/panduan', '/cancellations/approve', '/~offline']
  const isPublicPath = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'))
  const isApiPath = path.startsWith('/api')
  const isDashboardPath = path.startsWith('/admin') || path.startsWith('/kasir')

  if (!isPublicPath && !isApiPath && !isDashboardPath) {
    // Belum login sama sekali → device belum di-aktifkan kasir
    if (!userId) {
      return getRedirect(PORTAL_URL)
    }
    // Status check: inactive/on_leave cannot use kiosk
    if (status !== 'active') {
      return getRedirect(PORTAL_URL)
    }
    // Sudah login tapi bukan device kiosk.
    // Admin dan Kasir yang nyasar ke sini dikembalikan ke dashboard-nya.
    if (role !== 'kiosk') {
      if (role === 'admin') return getRedirect('/admin')
      if (role === 'leader' || role === 'crew' || role === 'regional_manager') return getRedirect('/kasir')
      return getRedirect(PORTAL_URL)
    }
    // Kiosk harus memiliki valid session (role kiosk dengan outlet_id valid)
    if (role === 'kiosk' && !outlet_id) {
      return getRedirect(PORTAL_URL)
    }
  }

  // Inject session data untuk digunakan di App (khususnya untuk Kiosk)
  // Ini membantu Kiosk UI tahu dia ada di outlet mana
  if (role === 'kiosk' && outlet_id) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-outlet-id', outlet_id)
    
    // Create new response with updated request headers for server components
    const finalResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
    
    // Copy cookies to final response
    response.cookies.getAll().forEach((cookie) => {
      finalResponse.cookies.set({ ...cookie })
    })
    
    return finalResponse
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - manifest.webmanifest
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|js|css|map|sw\\.js|workbox-|icons/)$).*)',
  ],
}
