// @ts-nocheck
import { type NextRequest } from 'next/server'
import { enforceAppAccess } from '@suka/auth'

export function middleware(request: NextRequest) {
  return enforceAppAccess(request, 'stok', { rootRewritePath: '/dashboard' })
}

export const config = {
  // `auth/sso` dikecualikan: halaman serah-terima sesi dari app native dibuka
  // justru saat cookie belum ada — kalau digerbangi, user malah dilempar portal.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|auth/sso|api/health|manifest.webmanifest|sw.js|workbox-|icons/|.*\\.(?:js|css|map)$).*)'],
}
