import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from './supabase-server'
import { getOutletStaff } from './staff'
import { hasAppAccess } from './access'
import { resolveUserId, type CapturedCookieItem } from './jwt'
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
    // Rekonstruksi URL publik yang diminta pengguna (hormati x-forwarded-proto/host di balik reverse proxy Coolify)
    const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || request.nextUrl.protocol.replace(':', '')
    const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host') || request.nextUrl.host
    const publicTarget = `${proto}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`
    portalBase.searchParams.set('next', publicTarget)
  }
  return portalBase
}

function isCookieDeletion(value: string, options?: Record<string, unknown>): boolean {
  if (!value) return true
  const maxAge = options?.maxAge
  if (typeof maxAge === 'number' && maxAge <= 0) return true
  return false
}

/**
 * Gerbang akses tunggal untuk middleware sub-app SUKA.
 * Menolak (redirect ke portal) jika: belum login, role tak punya akses app,
 * atau status staff bukan `active`.
 *
 * Perlindungan anti-mental-login (race condition refresh token):
 * - Cookie JWT diperiksa lokal terlebih dahulu sebelum memanggil `getSession()`.
 * - Request prefetch (`<Link>`) TIDAK PERNAH me-refresh token ke GoTrue dan
 *   tidak me-redirect ke portal (agar Router Cache Next.js tidak meracuni rute
 *   seperti `/approval` dengan redirect ke halaman login).
 * - Refresh token paralel di-deduplikasi (singleflight + grace cache 30 detik).
 * - Kegagalan refresh di middleware TIDAK PERNAH mengirim `Set-Cookie: Max-Age=0`
 *   ke browser, sehingga sesi baru yang baru saja disimpan client (`AuthProvider`)
 *   tidak pernah terhapus oleh request paralel yang kalah balapan.
 */
export async function enforceAppAccess(
  request: NextRequest,
  app: AppName,
  options?: { rootRewritePath?: string }
): Promise<NextResponse> {
  // Anti-spoof: JANGAN pernah percaya header staff yang datang dari klien.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete(STAFF_HEADER)

  // Response sementara untuk menampung cookie baru yang di-refresh @supabase/ssr.
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  const capturedCookies: CapturedCookieItem[] = []

  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookies) => {
      cookies.forEach(({ name, value, options: cookieOpts }) => {
        // JANGAN menyalin instruksi penghapusan cookie otomatis dari @supabase/ssr!
        // Bila request paralel lain atau AuthProvider di browser baru saja merotasi
        // refresh token, request lama yang gagal tidak boleh menimpa cookie baru di browser.
        if (isCookieDeletion(value, cookieOpts)) return
        capturedCookies.push({ name, value, options: cookieOpts })
        response.cookies.set(
          name,
          value,
          cookieOpts as Parameters<typeof response.cookies.set>[2]
        )
      })
    },
  })

  const getRedirect = (url: string | URL) => {
    const redirectResponse = NextResponse.redirect(new URL(url, request.url))
    response.cookies.getAll().forEach((cookie: any) => {
      if (!cookie.value || cookie.maxAge === 0) return
      redirectResponse.cookies.set({ ...cookie })
    })
    redirectResponse.headers.set('Cache-Control', 'no-store')
    return redirectResponse
  }

  // --- Bypass auth untuk rute publik (tidak butuh login) ---
  if (request.nextUrl.pathname.startsWith('/public/')) {
    return response
  }

  const prefetch = isPrefetchRequest(request.headers)

  // --- Identitas: Cookie-First JWT lokal + Singleflight refresh ---
  const userId = await resolveUserId(supabase, process.env.SUPABASE_JWT_SECRET, {
    cookies: request.cookies.getAll(),
    isPrefetch: prefetch,
    getCapturedCookies: () => capturedCookies,
    replayCookies: (replayed) => {
      replayed.forEach(({ name, value, options: cookieOpts }) => {
        if (isCookieDeletion(value, cookieOpts)) return
        response.cookies.set(
          name,
          value,
          cookieOpts as Parameters<typeof response.cookies.set>[2]
        )
      })
    },
  })

  if (!userId) {
    // Pada request prefetch (<Link>), JANGAN mengembalikan 307 ke halaman login:
    // Next.js App Router akan meng-cache redirect tersebut untuk rute tujuan (mis. /approval),
    // sehingga saat user mengklik menu Approval ia langsung dilempar ke halaman login!
    if (prefetch) {
      return new NextResponse(null, {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    return getRedirect(buildPortalLoginRedirectUrl(request, true))
  }

  // --- Gate: role + status. Pakai cache bertanda tangan bila masih berlaku ---
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

  // staff ikut dikirim: staf pusat & crew di Kantor Pusat dibatasi (lihat kantor-pusat.ts).
  if (!staff || !hasAppAccess(staff.role, app, staff.username, staff) || staff.status !== 'active') {
    if (prefetch) {
      return new NextResponse(null, {
        status: 403,
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    // User terautentikasi tapi tidak punya hak akses ke app ini -> ke portal tanpa ?next= agar tidak loop
    return getRedirect(buildPortalLoginRedirectUrl(request, false))
  }

  // Teruskan staff tepercaya ke RSC/client.
  requestHeaders.set(STAFF_HEADER, serializeStaffHeader(staff))

  // Rewrite root → dashboard (tanpa 307) bila diminta.
  const pass =
    options?.rootRewritePath && request.nextUrl.pathname === '/'
      ? NextResponse.rewrite(new URL(options.rootRewritePath, request.url), {
          request: { headers: requestHeaders },
        })
      : NextResponse.next({ request: { headers: requestHeaders } })

  // Salin cookie baru yang sempat di-refresh ke response final.
  response.cookies.getAll().forEach((cookie: any) => {
    if (!cookie.value || cookie.maxAge === 0) return
    pass.cookies.set({ ...cookie })
  })
  return pass
}
