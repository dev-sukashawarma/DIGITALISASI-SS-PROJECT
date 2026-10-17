import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { ambilIdentitasTelegram } from '@/lib/server/identitasTelegram'
import { stafBolehPakaiBotApaPun } from '@/lib/server/telegram'

export const dynamic = 'force-dynamic'

const cookieName = 'stokist_telegram_login'

export async function GET() {
  const identity = await ambilIdentitasTelegram()
  if (!identity) return NextResponse.redirect(process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com')
  if (!(await stafBolehPakaiBotApaPun(identity.userId))) return NextResponse.redirect('https://agents.sukashawarma.com/telegram?login=denied')

  const clientId = process.env.TELEGRAM_STOKIST_LOGIN_CLIENT_ID
  const clientSecret = process.env.TELEGRAM_STOKIST_LOGIN_CLIENT_SECRET
  const redirectUri = process.env.TELEGRAM_STOKIST_LOGIN_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect('https://agents.sukashawarma.com/telegram?login=unavailable')
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
  response.cookies.set(cookieName, `${state}.${verifier}.${identity.userId}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/telegram/login',
    maxAge: 600,
  })
  return response
}
