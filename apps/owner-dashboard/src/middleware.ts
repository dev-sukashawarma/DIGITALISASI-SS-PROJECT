import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, getOutletStaff } from '@suka/auth'

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookies) => {
      cookies.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
      )
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL(PORTAL_URL, request.url))
  }

  const { staff } = await getOutletStaff(supabase, user.id)
  if (!staff || !['owner', 'admin'].includes(staff.role)) {
    return NextResponse.redirect(new URL(PORTAL_URL, request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)'],
}
