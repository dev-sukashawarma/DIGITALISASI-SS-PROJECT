// @ts-nocheck
import { type NextRequest } from 'next/server'
import { enforceAppAccess } from '@suka/auth'

// Gate app 'finance' → hanya role dgn akses 'finance' (admin_finance/owner/admin,
// lihat ROLE_APP_ACCESS di @suka/auth). Root '/' di-rewrite ke '/'  (halaman utama).
export function middleware(request: NextRequest) {
  return enforceAppAccess(request, 'finance', { rootRewritePath: '/' })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|api/health|manifest.webmanifest|sw.js|workbox-|icons/|.*\\.(?:js|css|map)$).*)'],
}
