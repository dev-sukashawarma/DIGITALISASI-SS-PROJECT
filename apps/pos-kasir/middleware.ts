import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@suka/auth'

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
      supabaseResponse = NextResponse.next({ request })
      cookiesToSet.forEach(({ name, value, options }) =>
        supabaseResponse.cookies.set(name, value, { ...(options as object), maxAge: 31536000 })
      )
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  let role = null
  let outlet_id = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, outlet_id')
      .eq('id', user.id)
      .single()

    if (profile) {
      role = profile.role
      outlet_id = profile.outlet_id
    }
  }

  const path = request.nextUrl.pathname

  // Unauthenticated: redirect to SSO portal
  if (!user) {
    return NextResponse.redirect(new URL(PORTAL_URL, request.url))
  }

  // Proteksi Route Admin
  if (path.startsWith('/admin')) {
    if (role !== 'admin') {
      return NextResponse.redirect(new URL(PORTAL_URL, request.url))
    }
  }

  // Proteksi Route Kasir
  if (path.startsWith('/kasir')) {
    if (role !== 'kasir') {
      return NextResponse.redirect(new URL(PORTAL_URL, request.url))
    }
  }

  // Redirect halaman login jika sudah auth
  if (path === '/login' && user && role) {
    if (role === 'admin') return NextResponse.redirect(new URL('/admin', request.url))
    if (role === 'kasir') return NextResponse.redirect(new URL('/kasir', request.url))
    if (role === 'kiosk') return NextResponse.redirect(new URL('/', request.url))
  }

  // Inject outlet-id header untuk Kiosk
  if (role === 'kiosk' && outlet_id) {
    supabaseResponse.headers.set('x-outlet-id', outlet_id)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|kiosk|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
