import { type NextRequest } from 'next/server'
import { enforceAppAccess } from '@suka/auth'

export function middleware(request: NextRequest) {
  return enforceAppAccess(request, 'absensi', { rootRewritePath: '/dashboard' })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|kiosk|kalibrasi|api/health|api/kalibrasi|manifest.webmanifest|sw.js|workbox-|icons/).*)'],
}
