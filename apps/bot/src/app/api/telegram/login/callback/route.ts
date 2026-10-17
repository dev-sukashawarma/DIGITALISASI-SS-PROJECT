import { createRemoteJWKSet, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/server/telegram'

export const dynamic = 'force-dynamic'

const cookieName = 'stokist_telegram_login'
const jwks = createRemoteJWKSet(new URL('https://oauth.telegram.org/.well-known/jwks.json'))

function finish(status: string, path = '/telegram') {
  const parameter = path === '/telegram/aktivasi' ? 'status' : 'login'
  const response = NextResponse.redirect(`https://agents.sukashawarma.com${path}?${parameter}=${status}`)
  response.cookies.delete({ name: cookieName, path: '/api/telegram/login' })
  return response
}

export async function GET(request: NextRequest) {
  const clientId = process.env.TELEGRAM_STOKIST_LOGIN_CLIENT_ID
  const clientSecret = process.env.TELEGRAM_STOKIST_LOGIN_CLIENT_SECRET
  const redirectUri = process.env.TELEGRAM_STOKIST_LOGIN_REDIRECT_URI
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const stored = request.cookies.get(cookieName)?.value
  let context: { state?: string; verifier?: string; staffId?: string; inviteHash?: string } = {}
  try {
    context = JSON.parse(Buffer.from(stored ?? '', 'base64url').toString('utf8'))
  } catch {
    return finish('invalid', '/telegram/aktivasi')
  }
  const { state: expectedState, verifier, inviteHash } = context
  if (!clientId || !clientSecret || !redirectUri || !code || !state || !expectedState || !verifier || !inviteHash
    || state !== expectedState) {
    return finish('invalid', '/telegram/aktivasi')
  }

  try {
    const tokenResponse = await fetch('https://oauth.telegram.org/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier,
      }),
      cache: 'no-store',
    })
    if (!tokenResponse.ok) return finish('invalid', '/telegram/aktivasi')
    const token = await tokenResponse.json()
    if (typeof token.id_token !== 'string') return finish('invalid', '/telegram/aktivasi')
    const { payload } = await jwtVerify(token.id_token, jwks, {
      issuer: 'https://oauth.telegram.org',
      audience: clientId,
      algorithms: ['RS256'],
    })
    const telegramUserId = String(payload.id ?? '')
    if (!/^[0-9]{1,24}$/.test(telegramUserId)) return finish('invalid', '/telegram/aktivasi')

    const admin = supabaseAdmin()
    if (inviteHash) {
      const { data, error } = await admin.rpc('hermes_telegram_redeem_activation_invite', {
        p_token_hash: inviteHash,
        p_telegram_user_id: telegramUserId,
        p_username: typeof payload.preferred_username === 'string' ? payload.preferred_username : '',
        p_first_name: typeof payload.given_name === 'string' ? payload.given_name : '',
      })
      if (error) return finish('unavailable', '/telegram/aktivasi')
      const result = data as { ok?: boolean; reason?: string; bot_username?: string } | null
      if (!result?.ok) return finish(result?.reason ?? 'invalid', '/telegram/aktivasi')
      if (!result.bot_username || !/^[A-Za-z0-9_]{5,32}$/.test(result.bot_username)) {
        return finish('unavailable', '/telegram/aktivasi')
      }
      const response = NextResponse.redirect(`https://t.me/${result.bot_username}?start=activated`)
      response.cookies.delete({ name: cookieName, path: '/api/telegram/login' })
      return response
    }

    return finish('invalid', '/telegram/aktivasi')
  } catch {
    return finish('invalid', '/telegram/aktivasi')
  }
}
