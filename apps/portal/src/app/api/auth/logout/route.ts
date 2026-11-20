import { NextResponse, type NextRequest } from 'next/server'
import { GATE_COOKIE, createSupabaseServerClient, isTrustedAuthOrigin } from '@suka/auth'

export async function POST(request: NextRequest) {
  if (!isTrustedAuthOrigin(request.headers.get('origin'), request.nextUrl.origin)) {
    return NextResponse.json(
      { ok: false, error: 'Origin tidak diizinkan.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const response = NextResponse.json(
    { ok: true },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  )

  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookies) => {
      for (const { name, value, options } of cookies) {
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
      }
    },
  })

  try {
    await supabase.auth.signOut()
  } catch {
    // Tetap bersihkan cookie sesi walau jaringan ke GoTrue sempat terputus
  }

  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined
  for (const { name } of request.cookies.getAll()) {
    if (!name.startsWith('sb-') && name !== GATE_COOKIE) continue
    response.headers.append('Set-Cookie', `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`)
    if (domain) {
      response.headers.append('Set-Cookie', `${name}=; Max-Age=0; Path=/; Domain=${domain}; SameSite=Lax`)
    }
  }

  return response
}
