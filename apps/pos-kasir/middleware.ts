import { createSupabaseServerClient, hasAppAccess } from '@suka/auth'
import { NextResponse, type NextRequest } from 'next/server'

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com'

export async function middleware(request: NextRequest) {
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

  const { data: { user } } = await supabase.auth.getUser()

  let role = null
  let outlet_id = null
  let status = null

  if (user) {
    const { data: profile } = await supabase
      .from('outlet_staff')
      .select('role, outlet_id, status')
      .eq('id', user.id)
      .maybeSingle()

    if (profile) {
      role = profile.role
      outlet_id = profile.outlet_id
      status = profile.status
    } else {
      // No staff profile found → redirect to portal
      return getRedirect(PORTAL_URL)
    }
  }

  const path = request.nextUrl.pathname

  // Proteksi Route Admin
  if (path.startsWith('/admin')) {
    if (!user || role !== 'admin' || !hasAppAccess(role, 'pos-kasir') || status !== 'active') {
      return getRedirect(PORTAL_URL)
    }
  }

  // Proteksi Route Kasir
  if (path.startsWith('/kasir')) {
    if (!user || !['kasir', 'leader'].includes(role as string) || !hasAppAccess(role as any, 'pos-kasir') || status !== 'active') {
      return getRedirect(PORTAL_URL)
    }
  }

  // Proteksi Route Pelanggan (Self-Order Kiosk)
  // Device self-order HARUS sudah di-login kan kasir via QR (role 'kiosk').
  // Halaman pesan pelanggan ('/', menu, checkout, dst) tidak boleh dibuka
  // kalau device belum punya sesi kiosk aktif.
  const PUBLIC_PATHS = ['/login', '/kiosk/qr-login', '/panduan']
  const isPublicPath = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'))
  const isApiPath = path.startsWith('/api')
  const isDashboardPath = path.startsWith('/admin') || path.startsWith('/kasir')

  if (!isPublicPath && !isApiPath && !isDashboardPath) {
    // Belum login sama sekali → device belum di-aktifkan kasir
    if (!user) {
      return getRedirect('/login')
    }
    // Status check: inactive/on_leave cannot use kiosk
    if (status !== 'active') {
      return getRedirect('/login')
    }
    // Sudah login tapi bukan device kiosk.
    // Admin dan Kasir yang nyasar ke sini dikembalikan ke dashboard-nya.
    if (role !== 'kiosk') {
      if (role === 'admin') return getRedirect('/admin')
      if (role === 'kasir' || role === 'leader') return getRedirect('/kasir')
      return getRedirect('/login')
    }
    // Kiosk harus memiliki valid session (role kiosk dengan outlet_id valid)
    if (role === 'kiosk' && !outlet_id) {
      return getRedirect('/login')
    }
  }

  // Redirect halaman login jika sudah auth
  if (path === '/login' && user && role) {
    if (role === 'admin') return getRedirect('/admin')
    if (role === 'kasir' || role === 'leader') return getRedirect('/kasir')
    if (role === 'kiosk') return getRedirect('/')
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
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
