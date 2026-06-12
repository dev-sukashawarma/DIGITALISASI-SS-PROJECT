import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

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

  // Proteksi Route Admin
  if (path.startsWith('/admin')) {
    if (!user || role !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Proteksi Route Kasir
  if (path.startsWith('/kasir')) {
    if (!user || role !== 'kasir') {
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
    supabaseResponse.headers.set('x-outlet-id', outlet_id)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/kasir/:path*', '/login'],
}
