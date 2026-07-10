import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, resolveUserId } from '@suka/auth'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookies) => {
      cookies.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      )
    },
  })

  // Identitas via JWT lokal (tanpa network); fallback getUser() bila secret kosong (dev).
  const userId = await resolveUserId(supabase, process.env.SUPABASE_JWT_SECRET)

  const { pathname } = request.nextUrl

  const getRedirect = (url: string | URL) => {
    const redirectResponse = NextResponse.redirect(new URL(url, request.url))
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set({ ...cookie })
    })
    return redirectResponse
  }

  // Already logged in → check staff status and redirect to launcher
  if (userId && pathname === '/') {
    const { data: staff } = await supabase
      .from('outlet_staff')
      .select('status')
      .eq('id', userId)
      .maybeSingle()

    // Allow access only if staff is active
    if (staff && staff.status === 'active') {
      return getRedirect('/launcher')
    }
    // Inactive/on_leave: fall through to render the login page. The status gate
    // (with user-facing message) is enforced in the login handler & launcher RSC.
  }

  // Not logged in → force to login
  if (!userId && pathname !== '/') {
    return getRedirect('/')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|manifest.webmanifest|sw.js|workbox-|icons/|.*\\.(?:js|css|map)$).*)'],
}
