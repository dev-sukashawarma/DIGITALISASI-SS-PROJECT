// @ts-nocheck -- workspace still contains Next 15 and Next 16 type copies.
import { enforceAppAccess } from '@suka/auth'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  return enforceAppAccess(request, 'monitoring', { rootRewritePath: '/dashboard' })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:js|css|map)$).*)'],
}
