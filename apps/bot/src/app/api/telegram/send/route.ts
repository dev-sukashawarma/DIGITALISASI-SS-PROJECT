import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { kirimPesanTelegram, supabaseAdmin, urlAplikasiDiizinkan } from '@/lib/server/telegram'

export const dynamic = 'force-dynamic'

function authorized(request: Request): boolean {
  const expected = process.env.TELEGRAM_STOKIST_SEND_SECRET
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const input = await request.json().catch(() => null)
  const userId = input?.user_id
  const app = input?.app
  const title = input?.title
  const body = input?.body
  if (typeof userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(userId)
    || (app !== 'stok' && app !== 'distribusi')
    || typeof title !== 'string' || !title.trim() || title.length > 180
    || typeof body !== 'string' || !body.trim() || body.length > 1200) {
    return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 })
  }
  const url = urlAplikasiDiizinkan(input?.url, app)
  if (input?.url && !url) return NextResponse.json({ error: 'URL aplikasi tidak valid.' }, { status: 400 })

  const admin = supabaseAdmin(3_000)
  const lookupStartedAt = Date.now()
  const [{ data: link, error: linkError }, { data: staff, error: staffError }, { data: access, error: accessError }] = await Promise.all([
    admin.from('bot_telegram_links').select('chat_id').eq('staff_id', userId).maybeSingle(),
    admin.from('outlet_staff').select('status, role').eq('id', userId).maybeSingle(),
    admin.from('bot_telegram_access').select('staff_id').eq('staff_id', userId).maybeSingle(),
  ])
  if (linkError || staffError || accessError) {
    console.error('[stokist] recipient lookup failed', {
      elapsedMs: Date.now() - lookupStartedAt,
      errors: [linkError?.message, staffError?.message, accessError?.message].filter(Boolean),
    })
    const { error: alertError } = await admin.rpc('bot_telegram_alert_delivery_failure', {
      p_app: app,
      p_failure_code: 'recipient_lookup_failed',
    })
    if (alertError) console.error('[stokist] gagal memberi tahu admin soal lookup penerima:', alertError)
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
  }
  if (!link || !access || staff?.status !== 'active') return NextResponse.json({ delivered: false, reason: 'not_linked' })
  if (staff?.role === 'leader') return NextResponse.json({ delivered: false, reason: 'role_not_eligible' })

  try {
    await kirimPesanTelegram(link.chat_id, `${title.trim()}\n\n${body.trim()}`, url ?? undefined)
    return NextResponse.json({ delivered: true })
  } catch (error) {
    console.error('[stokist] gagal mengirim alert:', error)
    const { error: alertError } = await admin.rpc('bot_telegram_alert_delivery_failure', {
      p_app: app,
      p_failure_code: 'telegram_api_error',
    })
    if (alertError) console.error('[stokist] gagal memberi tahu admin soal pengiriman Telegram:', alertError)
    return NextResponse.json({ delivered: false, reason: 'telegram_error' }, { status: 502 })
  }
}
