import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from './supabase-server'
import { getOutletStaff } from './staff'
import { hasAppAccess } from './access'
import { resolveUserId } from './jwt'
import { STAFF_HEADER, serializeStaffHeader } from './staff-header'
import type { AppName } from './types'

function getPortalUrl(request: NextRequest): string {
  const host = request.headers.get('host') || request.nextUrl.host || ''
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1')
  if (isLocal) {
    return 'http://localhost:3010'
  }
  return process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
}

/**
 * Gerbang akses tunggal untuk middleware sub-app SUKA.
 * Menolak (redirect ke portal) jika: belum login, role tak punya akses app,
 * atau status staff bukan `active`.
 *
 * Optimasi (lihat docs/.../2026-06-17-portal-app-navigation-perf):
 * - Identitas diverifikasi via JWT lokal (`SUPABASE_JWT_SECRET`) tanpa network;
 *   fallback ke `getUser()` bila secret belum di-set (lokal/dev).
 * - Staff tepercaya diteruskan ke RSC/client lewat header `x-suka-staff`
 *   (klien tidak bisa memalsukan: header dari request klien dihapus dulu).
 * - `rootRewritePath` me-rewrite `/` → mis. `/dashboard` (internal, tanpa 307)
 *   agar tak ada redirect berantai yang menggandakan middleware.
 */
export async function enforceAppAccess(
  request: NextRequest,
  app: AppName,
  options?: { rootRewritePath?: string }
): Promise<NextResponse> {
  // Anti-spoof: JANGAN pernah percaya header staff yang datang dari klien.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete(STAFF_HEADER)

  // Response sementara untuk menampung cookie yang di-refresh @supabase/ssr.
  const response = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookies) => {
      cookies.forEach(({ name, value, options }) =>
        response.cookies.set(
          name,
          value,
          options as Parameters<typeof response.cookies.set>[2]
        )
      )
    },
  })

  const getRedirect = (url: string | URL) => {
    const redirectResponse = NextResponse.redirect(new URL(url, request.url))
    response.cookies.getAll().forEach((cookie: any) => {
      redirectResponse.cookies.set({ ...cookie })
    })
    return redirectResponse
  }

  // --- Bypass auth untuk rute publik (tidak butuh login) ---
  if (request.nextUrl.pathname.startsWith('/public/')) {
    return response
  }

  // --- Identitas: JWT lokal bila secret ada, fallback getUser() ---
  const userId = await resolveUserId(supabase, process.env.SUPABASE_JWT_SECRET)
  if (!userId) {
    return getRedirect(getPortalUrl(request))
  }

  // --- Gate: role + status (1 RT DB; tetap dibutuhkan) ---
  const { staff } = await getOutletStaff(supabase, userId)
  if (!staff || !hasAppAccess(staff.role, app) || staff.status !== 'active') {
    return getRedirect(getPortalUrl(request))
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

  // Salin cookie yang sempat di-refresh ke response final.
  response.cookies.getAll().forEach((cookie: any) => {
    pass.cookies.set({ ...cookie })
  })
  return pass
}
