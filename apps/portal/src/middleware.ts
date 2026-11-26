import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, resolveUserId, safeTrustedReturnUrl } from '@suka/auth'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookies) => {
      cookies.forEach(({ name, value, options }) => {
        if (!value || (typeof options?.maxAge === 'number' && options.maxAge <= 0)) return
        response.cookies.set(name, value, options)
      })
    },
  })

  // Identitas via Cookie-First JWT lokal + singleflight refresh
  const userId = await resolveUserId(supabase, process.env.SUPABASE_JWT_SECRET, {
    cookies: request.cookies.getAll(),
  })

  const { pathname } = request.nextUrl
  const host = request.headers.get('host') || request.nextUrl.host || ''
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1')

  const getRedirect = (url: string | URL) => {
    const redirectResponse = NextResponse.redirect(new URL(url, request.url))
    response.cookies.getAll().forEach((cookie) => {
      if (!cookie.value || cookie.maxAge === 0) return
      redirectResponse.cookies.set({ ...cookie })
    })
    return redirectResponse
  }

  // Rute publik & endpoint autentikasi portal → langsung lolos tanpa redirect
  if (pathname.startsWith('/public/') || pathname.startsWith('/api/auth/')) {
    return response
  }

  // Already logged in → check staff status and redirect to ?next= (jika sah) atau /launcher
  if (userId && pathname === '/') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined
      for (const { name } of request.cookies.getAll()) {
        if (!name.startsWith('sb-') && name !== '_suka_gate') continue
        response.headers.append('Set-Cookie', `${name}=; Max-Age=0; Path=/`)
        if (domain) response.headers.append('Set-Cookie', `${name}=; Max-Age=0; Path=/; Domain=${domain}`)
      }
      return response
    }

    const { data: staff } = await supabase
      .from('outlet_staff')
      .select('status')
      .eq('id', userId)
      .maybeSingle()

    if (staff && staff.status === 'active') {
      const safeNext = safeTrustedReturnUrl(request.nextUrl.searchParams.get('next'), isLocal)
      return getRedirect(safeNext || '/launcher')
    }
  }

  // Not logged in → force to login
  if (!userId && pathname !== '/') {
    return getRedirect('/')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|manifest.webmanifest|sw.js|workbox-|icons/|.*\\.(?:js|css|map|png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|otf|webm)$).*)'],
}
