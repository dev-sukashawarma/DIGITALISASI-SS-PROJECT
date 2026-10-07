// @ts-nocheck
import { NextResponse, type NextRequest } from 'next/server'
import { enforceAppAccess } from '@suka/auth'

export function middleware(request: NextRequest) {
  // Rute publik → langsung lolos tanpa cek auth
  if (request.nextUrl.pathname.startsWith('/public/')) {
    return NextResponse.next()
  }

  // SUKA Bot: route memeriksa sesi + is_owner_or_admin() sendiri. enforceAppAccess
  // akan me-redirect role owner (tak punya admin-dashboard di ROLE_APP_ACCESS) dan
  // preflight CORS dari portal.
  if (request.nextUrl.pathname.startsWith('/api/asisten/')) {
    return NextResponse.next()
  }

  // Hermes Agent (VPS): route memeriksa kunci API per bot sendiri
  // (lib/hermes/server/autentikasi). Tanpa bypass ini enforceAppAccess me-redirect
  // panggilan tanpa cookie ke portal.
  if (request.nextUrl.pathname.startsWith('/api/hermes/')) {
    return NextResponse.next()
  }

  // Skip enforceAppAccess untuk localhost development
  if (request.nextUrl.hostname === 'localhost') {
    return undefined
  }
  return enforceAppAccess(request, 'admin-dashboard', { rootRewritePath: '/dashboard' })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|public/|manifest.webmanifest|sw.js|workbox-|icons/|.*\\.(?:js|css|map|png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|otf)$).*)'],
}
