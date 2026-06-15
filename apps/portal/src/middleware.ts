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

  // Already logged in → check staff status and redirect to launcher
  if (user && pathname === '/') {
    const { data: staff } = await supabase
      .from('outlet_staff')
      .select('status')
      .eq('id', user.id)
      .single()

    // Allow access only if staff is active
    if (staff && staff.status === 'active') {
      return NextResponse.redirect(new URL('/launcher', request.url))
    }
    // If staff is inactive or on_leave, logout and redirect to login
  }

  // Not logged in → force to login
  if (!user && pathname !== '/') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
