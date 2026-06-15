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

  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Already logged in → skip login page
  if (session && pathname === '/') {
    return NextResponse.redirect(new URL('/launcher', request.url))
  }

  // Not logged in → force to login
  if (!session && pathname !== '/') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
