// @ts-nocheck -- workspace still contains Next 15 and Next 16 type copies.
import { enforceAppAccess } from '@suka/auth'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  return enforceAppAccess(request, 'monitoring', { rootRewritePath: '/lokasi' })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|workbox-|icons/|.*\\.(?:js|css|map|png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|otf)$).*)'],
}
