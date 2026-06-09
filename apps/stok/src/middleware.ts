import { createClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

const protectedRoutes = ['/stok']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for login & auth routes
  if (pathname === '/login' || pathname === '/') {
    return NextResponse.next()
  }

  // Check if route is protected
  const isProtected = protectedRoutes.some(route => pathname.startsWith(route))
  if (!isProtected) return NextResponse.next()

  // For protected routes, check auth (this is approximate — full check happens in AuthContext)
  // Middleware can't fully verify session, so we just redirect obvious non-auth paths
  const authCookie = request.cookies.get('sb-access-token')

  if (!authCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
