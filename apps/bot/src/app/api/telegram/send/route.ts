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

  const admin = supabaseAdmin()
  const [{ data: link, error: linkError }, { data: staff, error: staffError }] = await Promise.all([
    admin.from('bot_telegram_links').select('chat_id').eq('staff_id', userId).maybeSingle(),
    admin.from('outlet_staff').select('status').eq('id', userId).maybeSingle(),
  ])
  if (linkError || staffError) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
  if (!link || staff?.status !== 'active') return NextResponse.json({ delivered: false, reason: 'not_linked' })

  try {
    await kirimPesanTelegram(link.chat_id, `${title.trim()}\n\n${body.trim()}`, url ?? undefined)
    return NextResponse.json({ delivered: true })
  } catch (error) {
    console.error('[stokist] gagal mengirim alert:', error)
    return NextResponse.json({ delivered: false, reason: 'telegram_error' }, { status: 502 })
  }
}
