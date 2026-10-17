import { createRemoteJWKSet, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { ambilIdentitasTelegram } from '@/lib/server/identitasTelegram'
import { stafBolehPakaiStokist, supabaseAdmin } from '@/lib/server/telegram'

export const dynamic = 'force-dynamic'

const cookieName = 'stokist_telegram_login'
const jwks = createRemoteJWKSet(new URL('https://oauth.telegram.org/.well-known/jwks.json'))

function finish(status: string) {
  const response = NextResponse.redirect(`https://agents.sukashawarma.com/telegram?login=${status}`)
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
  const [expectedState, verifier, staffId] = stored?.split('.') ?? []
  if (!clientId || !clientSecret || !redirectUri || !code || !state || !expectedState || !verifier || !staffId
    || state !== expectedState) {
    return finish('invalid')
  }

  const identity = await ambilIdentitasTelegram()
  if (!identity || identity.userId !== staffId || !(await stafBolehPakaiStokist(staffId))) return finish('denied')

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
    if (!tokenResponse.ok) return finish('invalid')
    const token = await tokenResponse.json()
    if (typeof token.id_token !== 'string') return finish('invalid')
    const { payload } = await jwtVerify(token.id_token, jwks, {
      issuer: 'https://oauth.telegram.org',
      audience: clientId,
      algorithms: ['RS256'],
    })
    const telegramUserId = String(payload.id ?? '')
    if (!/^[0-9]{1,24}$/.test(telegramUserId)) return finish('invalid')

    const admin = supabaseAdmin()
    const { data: existing, error: existingError } = await admin.from('bot_telegram_links')
      .select('staff_id').eq('telegram_user_id', telegramUserId).maybeSingle()
    if (existingError) return finish('unavailable')
    if (existing && existing.staff_id !== staffId) return finish('used')
    const { error } = await admin.from('bot_telegram_links').upsert({
      staff_id: staffId,
      telegram_user_id: telegramUserId,
      chat_id: telegramUserId,
      telegram_username: typeof payload.preferred_username === 'string' ? payload.preferred_username.slice(0, 100) : null,
      telegram_first_name: typeof payload.given_name === 'string' ? payload.given_name.slice(0, 100) : null,
      linked_at: new Date().toISOString(),
    }, { onConflict: 'staff_id' })
    if (error) return finish('unavailable')
    return finish('connected')
  } catch {
    return finish('invalid')
  }
}
