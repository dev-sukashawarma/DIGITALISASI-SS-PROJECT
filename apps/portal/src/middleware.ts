import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@suka/auth'

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

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const getRedirect = (url: string | URL) => {
    const redirectResponse = NextResponse.redirect(new URL(url, request.url))
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set({ ...cookie })
    })
    return redirectResponse
  }

  // Already logged in → check staff status and redirect to launcher
  if (user && pathname === '/') {
    const { data: staff } = await supabase
      .from('outlet_staff')
      .select('status')
      .eq('id', user.id)
      .maybeSingle()

    // Allow access only if staff is active
    if (staff && staff.status === 'active') {
      return getRedirect('/launcher')
    }
    // Inactive/on_leave: fall through to render the login page. The status gate
    // (with user-facing message) is enforced in the login handler & launcher RSC.
  }

  // Not logged in → force to login
  if (!user && pathname !== '/') {
    return getRedirect('/')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png).*)'],
}
