import { NextResponse, type NextRequest } from 'next/server'
import {
  checkAuthRateLimit,
  createSupabaseServerClient,
  createSupabaseServiceClient,
  enforceMinimumAuthDelay,
  extractClientIp,
  getOutletStaff,
  isTrustedAuthOrigin,
  recordAuthAttempt,
  resolveLoginCandidates,
} from '@suka/auth'

type LoginBody = {
  identifier?: unknown
  password?: unknown
  company_url?: unknown
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()

  if (!isTrustedAuthOrigin(request.headers.get('origin'), request.nextUrl.origin)) {
    return NextResponse.json(
      { ok: false, error: 'Permintaan tidak diizinkan.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  let body: LoginBody
  try {
    body = (await request.json()) as LoginBody
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Format permintaan tidak valid.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const rawIdentifier = typeof body.identifier === 'string' ? body.identifier : ''
  const rawPassword = typeof body.password === 'string' ? body.password : ''
  const honeypot = typeof body.company_url === 'string' ? body.company_url.trim() : ''

  const cleanId = rawIdentifier.trim()
  const cleanPassword = rawPassword.trim()

  if (!cleanId || !cleanPassword || cleanId.length > 160 || rawPassword.length > 256) {
    await enforceMinimumAuthDelay(startedAt)
    return NextResponse.json(
      { ok: false, error: 'Email atau kata sandi salah.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const clientIp = extractClientIp(request.headers)
  const serviceClient = createSupabaseServiceClient()

  // Honeypot terisi -> bot otomatis. Catat percobaan gagal & balas error generik.
  if (honeypot.length > 0) {
    await recordAuthAttempt(clientIp, cleanId, false, serviceClient)
    await enforceMinimumAuthDelay(startedAt)
    return NextResponse.json(
      { ok: false, error: 'Email atau kata sandi salah.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  // Cek rate-limit per akun & per IP sebelum memanggil GoTrue
  const rateStatus = await checkAuthRateLimit(clientIp, cleanId, serviceClient)
  if (!rateStatus.allowed) {
    const waitMinutes = Math.max(1, Math.ceil(rateStatus.retryAfterSec / 60))
    return NextResponse.json(
      {
        ok: false,
        error: `Terlalu banyak percobaan gagal. Demi keamanan akun, silakan tunggu sekitar ${waitMinutes} menit lalu coba kembali.`,
      },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(rateStatus.retryAfterSec),
        },
      }
    )
  }

  const pendingCookies: Array<{ name: string; value: string; options?: Record<string, unknown> }> = []

  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookies) => {
      pendingCookies.length = 0
      for (const cookie of cookies) {
        pendingCookies.push(cookie)
      }
    },
  })

  const candidateEmails = await resolveLoginCandidates(cleanId, serviceClient)
  const passwordVariants = rawPassword !== cleanPassword ? [cleanPassword, rawPassword] : [cleanPassword]

  let authUser: { id: string } | null = null

  outer: for (const candidate of candidateEmails) {
    for (const pwd of passwordVariants) {
      const res = await supabase.auth.signInWithPassword({ email: candidate, password: pwd })
      if (!res.error && res.data?.user) {
        authUser = res.data.user
        break outer
      }
    }
  }

  if (!authUser) {
    await recordAuthAttempt(clientIp, cleanId, false, serviceClient)
    await enforceMinimumAuthDelay(startedAt)
    const hint = !cleanId.includes('@')
      ? ' Jika Anda admin/owner/leader/regional manager, gunakan email lengkap.'
      : ''
    return NextResponse.json(
      { ok: false, error: `Email atau kata sandi salah.${hint}` },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  // Verifikasi profil & status aktif staff di server sebelum mengeluarkan cookie sesi
  const { staff } = await getOutletStaff(supabase, authUser.id)

  if (!staff) {
    await supabase.auth.signOut().catch(() => {})
    await enforceMinimumAuthDelay(startedAt)
    return NextResponse.json(
      { ok: false, error: 'Akun Anda belum terdaftar sebagai staff. Hubungi admin.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  if (staff.status !== 'active') {
    await supabase.auth.signOut().catch(() => {})
    await enforceMinimumAuthDelay(startedAt)
    return NextResponse.json(
      { ok: false, error: 'Akun Anda nonaktif. Hubungi admin untuk mengaktifkan kembali.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  await recordAuthAttempt(clientIp, cleanId, true, serviceClient)

  const response = NextResponse.json(
    { ok: true, role: staff.role },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  )

  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  }

  return response
}
