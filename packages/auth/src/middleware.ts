import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from './supabase-server'
import { getOutletStaff } from './staff'
import { hasAppAccess } from './access'
import type { AppName } from './types'

/** URL portal untuk redirect saat akses ditolak; override via env per-app. */
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com'

/**
 * Gerbang akses tunggal untuk middleware sub-app SUKA.
 * Menolak (redirect ke portal) jika: belum login, role tak punya akses app,
 * atau status staff bukan `active`. Sumber kebenaran tunggal — hindari salin
 * logika gate ke tiap app (mudah kelewat, mis. owner-dashboard pernah lupa cek status).
 */
export async function enforceAppAccess(
  request: NextRequest,
  app: AppName
): Promise<NextResponse> {
  const response = NextResponse.next({ request })

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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL(PORTAL_URL, request.url))
  }

  const { staff } = await getOutletStaff(supabase, user.id)
  if (!staff || !hasAppAccess(staff.role, app) || staff.status !== 'active') {
    return NextResponse.redirect(new URL(PORTAL_URL, request.url))
  }

  return response
}
