// @ts-nocheck
import { type NextRequest } from 'next/server'
import { enforceAppAccess } from '@suka/auth'

export function middleware(request: NextRequest) {
  // Skip enforceAppAccess untuk localhost development
  if (request.nextUrl.hostname === 'localhost') {
    return undefined
  }
  return enforceAppAccess(request, 'owner-dashboard', { rootRewritePath: '/dashboard' })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|api/health|manifest.webmanifest|sw.js|workbox-|icons/|.*\\.(?:js|css|map)$).*)'],
}
