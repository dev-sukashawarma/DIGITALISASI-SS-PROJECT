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

  const { data: { user } } = await supabase.auth.getUser()

  let role = null
  let outlet_id = null

  if (user) {
    const { data: profile } = await supabase
      .from('outlet_staff')
      .select('role, outlet_id')
      .eq('id', user.id)
      .single()

    if (profile) {
      role = profile.role
      outlet_id = profile.outlet_id
    }
  }

  const path = request.nextUrl.pathname

  // Proteksi Route Admin
  if (path.startsWith('/admin')) {
    if (!user || role !== 'admin' || !hasAppAccess(role, 'pos-kasir')) {
      return NextResponse.redirect(new URL(PORTAL_URL, request.url))
    }
  }

  // Proteksi Route Kasir
  if (path.startsWith('/kasir')) {
    if (!user || role !== 'kasir' || !hasAppAccess(role, 'pos-kasir')) {
      return NextResponse.redirect(new URL(PORTAL_URL, request.url))
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
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // Sudah login tapi bukan device kiosk (admin diizinkan untuk preview).
    // Kasir yang nyasar ke sini dikembalikan ke dashboard-nya.
    if (role !== 'kiosk' && role !== 'admin') {
      return NextResponse.redirect(new URL(role === 'kasir' ? '/kasir' : '/login', request.url))
    }
    // Kiosk harus memiliki valid session (role kiosk dengan outlet_id valid)
    if (role === 'kiosk' && !outlet_id) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Redirect halaman login jika sudah auth
  if (path === '/login' && user && role) {
    if (role === 'admin') return NextResponse.redirect(new URL('/admin', request.url))
    if (role === 'kasir') return NextResponse.redirect(new URL('/kasir', request.url))
    if (role === 'kiosk') return NextResponse.redirect(new URL('/', request.url))
  }

  // Inject session data untuk digunakan di App (khususnya untuk Kiosk)
  // Ini membantu Kiosk UI tahu dia ada di outlet mana
  if (role === 'kiosk' && outlet_id) {
    response.headers.set('x-outlet-id', outlet_id)
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
