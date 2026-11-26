import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from './supabase-server'
import { getOutletStaff } from './staff'
import { hasAppAccess } from './access'
import {
  hasActiveSessionCookieWrite,
  resolveUserId,
  type CapturedCookieItem,
} from './jwt'
import { STAFF_HEADER, serializeStaffHeader } from './staff-header'
import {
  GATE_COOKIE,
  gateCookieOptions,
  getGateSecret,
  isGateEntryUsable,
  isPrefetchRequest,
  readGateCookie,
  signGateCookie,
} from './gate-cookie'
import type { AppName, OutletStaffProfile } from './types'

function getPortalUrl(request: NextRequest): string {
  const host = request.headers.get('host') || request.nextUrl.host || ''
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1')
  if (isLocal) {
    return 'http://localhost:3010'
  }
  return process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
}

function buildPortalLoginRedirectUrl(request: NextRequest, includeNext: boolean): URL {
  const portalBase = new URL(getPortalUrl(request))
  if (includeNext && request.method === 'GET') {
    const proto =
      request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
      request.nextUrl.protocol.replace(':', '')
    const host =
      request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
      request.headers.get('host') ||
      request.nextUrl.host
    const publicTarget = `${proto}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`
    portalBase.searchParams.set('next', publicTarget)
  }
  return portalBase
}

/**
 * Gerbang akses tunggal untuk middleware sub-app SUKA.
 *
 * Perlindungan anti-mental-login & anti-zombie-cookie:
 * - Cookie JWT diperiksa lokal di seluruh kandidat (utuh maupun `.0`+`.1`) sebelum `getSession()`.
 * - Request prefetch (`<Link>`) TIDAK PERNAH me-refresh token ke GoTrue dan tidak me-redirect 307.
 * - Saat penulisan sesi baru berhasil (`hasActiveSessionCookieWrite(cookies) === true`), seluruh
 *   batch diterapkan termasuk pembersihan chunk lama (`maxAge: 0`), sehingga cookie utuh lama
 *   tidak pernah menutupi pecahan `.0`/`.1` yang baru.
 * - Sebaliknya saat refresh gagal total (`hasActiveSessionCookieWrite(cookies) === false`),
 *   instruksi penghapusan cookie diabaikan agar request paralel yang kalah balapan tidak
 *   menghapus sesi sah milik request pemenang.
 */
export async function enforceAppAccess(
  request: NextRequest,
  app: AppName,
  options?: { rootRewritePath?: string }
): Promise<NextResponse> {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete(STAFF_HEADER)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  const capturedCookies: CapturedCookieItem[] = []

  const applyAuthorizedCookieBatch = (cookies: CapturedCookieItem[]) => {
    if (!hasActiveSessionCookieWrite(cookies)) return
    cookies.forEach(({ name, value, options: cookieOpts }) => {
      capturedCookies.push({ name, value, options: cookieOpts })
      response.cookies.set(
        name,
        value,
        cookieOpts as Parameters<typeof response.cookies.set>[2]
      )
    })
  }

  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookies) => {
      applyAuthorizedCookieBatch(cookies)
    },
  })

  const copyResponseCookies = (target: NextResponse) => {
    response.cookies.getAll().forEach((cookie: any) => {
      target.cookies.set({ ...cookie })
    })
  }

  const getRedirect = (url: string | URL) => {
    const redirectResponse = NextResponse.redirect(new URL(url, request.url))
    copyResponseCookies(redirectResponse)
    redirectResponse.headers.set('Cache-Control', 'no-store')
    return redirectResponse
  }

  if (request.nextUrl.pathname.startsWith('/public/')) {
    return response
  }

  const prefetch = isPrefetchRequest(request.headers)

  const userId = await resolveUserId(supabase, process.env.SUPABASE_JWT_SECRET, {
    cookies: request.cookies.getAll(),
    isPrefetch: prefetch,
    getCapturedCookies: () => capturedCookies,
    replayCookies: (replayed) => {
      if (!hasActiveSessionCookieWrite(replayed)) return
      replayed.forEach(({ name, value, options: cookieOpts }) => {
        response.cookies.set(
          name,
          value,
          cookieOpts as Parameters<typeof response.cookies.set>[2]
        )
      })
    },
  })

  if (!userId) {
    if (prefetch) {
      return new NextResponse(null, {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    return getRedirect(buildPortalLoginRedirectUrl(request, true))
  }

  const gateSecret = getGateSecret()
  const cached = gateSecret
    ? await readGateCookie<OutletStaffProfile>(request.cookies.get(GATE_COOKIE)?.value, {
        app,
        sub: userId,
        secret: gateSecret,
      })
    : null

  let staff: OutletStaffProfile | null = null
  if (cached && isGateEntryUsable(cached, prefetch)) {
    staff = cached.data
  } else {
    const result = await getOutletStaff(supabase, userId)
    staff = result.staff
    if (gateSecret) {
      if (staff) {
        response.cookies.set(
          GATE_COOKIE,
          await signGateCookie(app, userId, staff, gateSecret),
          gateCookieOptions()
        )
      } else if (!result.error && request.cookies.has(GATE_COOKIE)) {
        response.cookies.delete(GATE_COOKIE)
      }
    }
  }

  if (!staff || !hasAppAccess(staff.role, app, staff.username, staff) || staff.status !== 'active') {
    if (prefetch) {
      return new NextResponse(null, {
        status: 403,
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    return getRedirect(buildPortalLoginRedirectUrl(request, false))
  }

  requestHeaders.set(STAFF_HEADER, serializeStaffHeader(staff))

  const pass =
    options?.rootRewritePath && request.nextUrl.pathname === '/'
      ? NextResponse.rewrite(new URL(options.rootRewritePath, request.url), {
          request: { headers: requestHeaders },
        })
      : NextResponse.next({ request: { headers: requestHeaders } })

  copyResponseCookies(pass)
  return pass
}
