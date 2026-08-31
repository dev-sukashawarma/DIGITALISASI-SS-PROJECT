// @ts-nocheck
import { type NextRequest } from 'next/server'
import { enforceAppAccess } from '@suka/auth'

export function middleware(request: NextRequest) {
  return enforceAppAccess(request, 'inventori', { rootRewritePath: '/dashboard' })
}

export const config = {
  // API melakukan validasi session, role, dan scope outlet sendiri.
  // Jangan ubah error auth API menjadi redirect HTML ke portal.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|api/|manifest.webmanifest|sw.js|workbox-|icons/|.*\\.(?:js|css|map)$).*)'],
}
