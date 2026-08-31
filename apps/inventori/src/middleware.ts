// @ts-nocheck
import { type NextRequest } from 'next/server'
import { enforceAppAccess } from '@suka/auth'

export function middleware(request: NextRequest) {
  return enforceAppAccess(request, 'inventori', { rootRewritePath: '/dashboard' })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|api/health|manifest.webmanifest|sw.js|workbox-|icons/|.*\\.(?:js|css|map)$).*)'],
}
