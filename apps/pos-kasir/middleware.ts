import {
  GATE_COOKIE,
  createSupabaseServerClient,
  gateCookieOptions,
  getGateSecret,
  hasAppAccess,
  isGateEntryUsable,
  isPrefetchRequest,
  readGateCookie,
  resolveUserId,
  signGateCookie,
} from '@suka/auth'
import { NextResponse, type NextRequest } from 'next/server'

/** Cookie cache lama TANPA tanda tangan (bisa dipalsukan) — hanya dihapus, tak pernah dibaca. */
const LEGACY_STAFF_CACHE_COOKIE = '_suka_staff_cache'

type PosGate = { role: string | null; outlet_id: string | null; status: string | null }

export async function middleware(request: NextRequest) {
  const isLocal = request.nextUrl.hostname === 'localhost' || request.nextUrl.hostname === '127.0.0.1' || process.env.NODE_ENV === 'development'
  const PORTAL_URL = isLocal ? 'http://localhost:3010' : (process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com')

  const response = NextResponse.next()

  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookies) => {
      cookies.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
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

  // Identitas diverifikasi lokal (JWKS/HS256); juga me-refresh cookie sesi bila perlu.
  const userId = await resolveUserId(supabase, process.env.SUPABASE_JWT_SECRET)

  if (request.cookies.has(LEGACY_STAFF_CACHE_COOKIE)) {
    response.cookies.delete(LEGACY_STAFF_CACHE_COOKIE)
  }

  const path = request.nextUrl.pathname

  // API route handler memvalidasi sesi/role sendiri (request tanpa login pun
  // selalu diteruskan ke sini), jadi tidak perlu query outlet_staff di sini.
  const isApiPath = path.startsWith('/api')
  if (isApiPath) {
    return response
  }

  let role: string | null = null
  let outlet_id: string | null = null
  let status: string | null = null

  if (userId) {
    // Hasil gerbang di-cache 3 menit di cookie bertanda tangan HMAC
    // (pengganti `_suka_staff_cache` yang dulu tanpa tanda tangan).
    const gateSecret = getGateSecret()
    const cached = gateSecret
      ? await readGateCookie<PosGate>(request.cookies.get(GATE_COOKIE)?.value, {
          app: 'pos-kasir',
          sub: userId,
          secret: gateSecret,
        })
      : null

    let gate: PosGate | null = null
    if (cached && isGateEntryUsable(cached, isPrefetchRequest(request.headers))) {
      gate = cached.data
    } else {
      const { data: profile, error } = await supabase
        .from('outlet_staff')
        .select('role, outlet_id, status')
        .eq('id', userId)
        .maybeSingle()

      if (profile) {
        gate = { role: profile.role, outlet_id: profile.outlet_id, status: profile.status }
        if (gateSecret) {
          response.cookies.set(
            GATE_COOKIE,
            await signGateCookie('pos-kasir', userId, gate, gateSecret),
            gateCookieOptions()
          )
        }
      } else if (error) {
        // DB/jaringan server error → pakai hasil gerbang terakhir yang
        // BERTANDA TANGAN sah (walau basi, maks. umur cookie). Tanpa itu → portal.
        if (cached) gate = cached.data
        if (!gate?.role) {
          return getRedirect(PORTAL_URL)
        }
      } else {
        // No staff profile found → redirect to portal
        if (request.cookies.has(GATE_COOKIE)) response.cookies.delete(GATE_COOKIE)
        return getRedirect(PORTAL_URL)
      }
    }

    role = gate.role
    outlet_id = gate.outlet_id
    status = gate.status
  }

  // Proteksi Route Admin
  if (path.startsWith('/admin')) {
    if (!userId || role !== 'admin' || !hasAppAccess(role, 'pos-kasir') || status !== 'active') {
      return getRedirect(PORTAL_URL)
    }
  }

  // Proteksi Route Kasir
  if (path.startsWith('/kasir')) {
    if (!userId || !['leader', 'crew', 'regional_manager'].includes(role as string) || !hasAppAccess(role as any, 'pos-kasir') || status !== 'active') {
      return getRedirect(PORTAL_URL)
    }
  }

  // Proteksi Route Pelanggan (Self-Order Kiosk)
  // Device self-order HARUS sudah di-login kan kasir via QR (role 'kiosk').
  // Halaman pesan pelanggan ('/', menu, checkout, dst) tidak boleh dibuka
  // kalau device belum punya sesi kiosk aktif.
  const PUBLIC_PATHS = ['/kiosk/qr-login', '/panduan', '/cancellations/approve', '/~offline']
  const isPublicPath = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'))
  const isDashboardPath = path.startsWith('/admin') || path.startsWith('/kasir')

  if (!isPublicPath && !isDashboardPath) {
    // Belum login sama sekali → device belum di-aktifkan kasir
    if (!userId) {
      return getRedirect(PORTAL_URL)
    }
    // Status check: inactive/on_leave cannot use kiosk
    if (status !== 'active') {
      return getRedirect(PORTAL_URL)
    }
    // Sudah login tapi bukan device kiosk.
    // Admin dan Kasir yang nyasar ke sini dikembalikan ke dashboard-nya.
    if (role !== 'kiosk') {
      if (role === 'admin') return getRedirect('/admin')
      if (role === 'leader' || role === 'crew' || role === 'regional_manager') return getRedirect('/kasir')
      return getRedirect(PORTAL_URL)
    }
    // Kiosk harus memiliki valid session (role kiosk dengan outlet_id valid)
    if (role === 'kiosk' && !outlet_id) {
      return getRedirect(PORTAL_URL)
    }
  }

  // Inject session data untuk digunakan di App (khususnya untuk Kiosk)
  // Ini membantu Kiosk UI tahu dia ada di outlet mana
  if (role === 'kiosk' && outlet_id) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-outlet-id', outlet_id)
    
    // Create new response with updated request headers for server components
    const finalResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
    
    // Copy cookies to final response
    response.cookies.getAll().forEach((cookie) => {
      finalResponse.cookies.set({ ...cookie })
    })
    
    return finalResponse
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - manifest.webmanifest, sw.js, workbox-*, icons/
     * - public files (images, audio, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|sw\\.js|workbox-|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|js|css|map|woff2?|ttf|otf)$).*)',
  ],
}
