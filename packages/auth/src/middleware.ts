import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from './supabase-server'
import { getOutletStaff } from './staff'
import { hasAppAccess } from './access'
import { verifyAccessToken } from './jwt'
import { STAFF_HEADER, serializeStaffHeader } from './staff-header'
import type { AppName } from './types'

/** URL portal untuk redirect saat akses ditolak; override via env per-app. */
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com'

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
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set({ ...cookie })
    })
    return redirectResponse
  }

  // --- Identitas: JWT lokal bila secret ada, fallback getUser() ---
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  let userId: string | null = null
  if (jwtSecret) {
    const { data: { session } } = await supabase.auth.getSession()
    const claims = session?.access_token
      ? await verifyAccessToken(session.access_token, jwtSecret)
      : null
    userId = claims?.sub ?? null
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[perf] SUPABASE_JWT_SECRET unset in production — falling back to slow network getUser() per request')
    }
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  }
  if (!userId) {
    return getRedirect(PORTAL_URL)
  }

  // --- Gate: role + status (1 RT DB; tetap dibutuhkan) ---
  const { staff } = await getOutletStaff(supabase, userId)
  if (!staff || !hasAppAccess(staff.role, app) || staff.status !== 'active') {
    return getRedirect(PORTAL_URL)
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
  response.cookies.getAll().forEach((cookie) => {
    pass.cookies.set({ ...cookie })
  })
  return pass
}
