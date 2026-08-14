// @ts-nocheck
import { NextResponse, type NextRequest } from 'next/server'
import { enforceAppAccess } from '@suka/auth'

export function middleware(request: NextRequest) {
  // Rute publik → langsung lolos tanpa cek auth
  if (request.nextUrl.pathname.startsWith('/public/')) {
    return NextResponse.next()
  }

  // Skip enforceAppAccess untuk localhost development
  if (request.nextUrl.hostname === 'localhost') {
    return undefined
  }
  return enforceAppAccess(request, 'admin-dashboard', { rootRewritePath: '/dashboard' })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|public/|manifest.webmanifest|sw.js|workbox-|icons/|.*\\.(?:js|css|map)$).*)'],
}
