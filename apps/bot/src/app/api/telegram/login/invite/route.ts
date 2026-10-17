import { createHash, randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/server/telegram'

export const dynamic = 'force-dynamic'

const cookieName = 'stokist_telegram_login'

function redirectStatus(status: string) {
  const response = NextResponse.redirect(`https://agents.sukashawarma.com/telegram/aktivasi?status=${status}`)
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? ''
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return redirectStatus('invalid')

  const clientId = process.env.TELEGRAM_STOKIST_LOGIN_CLIENT_ID
  const clientSecret = process.env.TELEGRAM_STOKIST_LOGIN_CLIENT_SECRET
  const redirectUri = process.env.TELEGRAM_STOKIST_LOGIN_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) return redirectStatus('unavailable')

  try {
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const admin = supabaseAdmin()
    const { data: invite, error } = await admin.from('hermes_telegram_activation_invites')
      .select('staff_id, expires_at, used_at, revoked_at')
      .eq('token_hash', tokenHash).maybeSingle()
    if (error) return redirectStatus('unavailable')
    if (!invite || invite.used_at || invite.revoked_at || Date.parse(invite.expires_at) <= Date.now()) {
      return redirectStatus('expired')
    }

    const state = randomBytes(24).toString('base64url')
    const verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const url = new URL('https://oauth.telegram.org/auth')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid profile telegram:bot_access')
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('code_challenge_method', 'S256')

    const response = NextResponse.redirect(url)
    response.headers.set('Referrer-Policy', 'no-referrer')
    response.headers.set('Cache-Control', 'no-store')
    response.cookies.set(cookieName, Buffer.from(JSON.stringify({
      state,
      verifier,
      staffId: invite.staff_id,
      inviteHash: tokenHash,
    })).toString('base64url'), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/telegram/login',
      maxAge: 600,
    })
    return response
  } catch {
    return redirectStatus('unavailable')
  }
}
