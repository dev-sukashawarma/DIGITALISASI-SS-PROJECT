import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { kirimPesanTelegram, supabaseAdmin, urlAplikasiDiizinkan } from '@/lib/server/telegram'

export const dynamic = 'force-dynamic'

function authorized(request: Request): boolean {
  const expected = process.env.TELEGRAM_MANAGER_SEND_SECRET || process.env.TELEGRAM_STOKIST_SEND_SECRET
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
  const title = input?.title
  const body = input?.body
  if (
    typeof userId !== 'string' ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId) ||
    typeof title !== 'string' ||
    !title.trim() ||
    title.length > 180 ||
    typeof body !== 'string' ||
    !body.trim() ||
    body.length > 1200
  ) {
    return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 })
  }

  const rawUrl = input?.url === 'bot' ? 'https://manager.sukashawarma.com' : input?.url
  const url = rawUrl ? urlAplikasiDiizinkan(rawUrl, 'manager') : undefined
  if (rawUrl && !url) {
    return NextResponse.json({ error: 'URL aplikasi tidak valid.' }, { status: 400 })
  }

  try {
    const admin = supabaseAdmin(3_000)
    const results = await Promise.all([
      admin.from('outlet_staff').select('role,status').eq('id', userId).maybeSingle(),
      admin.from('bot_telegram_links').select('chat_id').eq('staff_id', userId).maybeSingle(),
    ])
    if (results.some(result => result.error)) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }
    const [{ data: staff }, { data: link }] = results

    const allowedRoles = ['area_manager', 'regional_manager', 'korlap', 'developer']
    if (!staff || !allowedRoles.includes(staff.role) || staff.status !== 'active' || !link?.chat_id) {
      return NextResponse.json({ delivered: false, reason: 'not_eligible' })
    }

    await kirimPesanTelegram(link.chat_id, `${title.trim()}\n\n${body.trim()}`, url ?? undefined, 'manager')
    return NextResponse.json({ delivered: true })
  } catch (error) {
    console.error('[manager] Pengiriman alert Telegram gagal:', error)
    return NextResponse.json({ error: 'Delivery unavailable' }, { status: 503 })
  }
}
