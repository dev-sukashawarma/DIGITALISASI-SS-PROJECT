import { NextResponse, type NextRequest } from 'next/server'
import { enforceAppAccess } from '@suka/auth'

export function middleware(request: NextRequest) {
  // Rute publik -> langsung lolos
  if (request.nextUrl.pathname.startsWith('/public/')) {
    return NextResponse.next()
  }

  // Skip enforceAppAccess untuk localhost development (opsional, tapi disamakan dengan admin-dashboard)
  if (request.nextUrl.hostname === 'localhost') {
    return undefined
  }
  return enforceAppAccess(request as any, 'manager')
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|public/|manifest.webmanifest|sw.js|workbox-|icons/|.*\\.(?:js|css|map)$).*)'],
}
