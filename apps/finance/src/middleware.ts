// @ts-nocheck
import { type NextRequest } from 'next/server'
import { enforceAppAccess } from '@suka/auth'

// Gate app 'finance' -> hanya role dgn akses 'finance'.
// Halaman dan API SSO handoff (/auth/sso & /api/auth/sso) dikecualikan agar serah-terima
// sesi dari notifikasi SuperApp / POS Android berjalan sebelum cookie terbentuk.
export function middleware(request: NextRequest) {
  return enforceAppAccess(request, 'finance', { rootRewritePath: '/' })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|auth/sso|api/auth/sso|api/health|api/etoll/|manifest.webmanifest|sw.js|workbox-|icons/|.*\\.(?:js|css|map|png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|otf)$).*)',
  ],
}
