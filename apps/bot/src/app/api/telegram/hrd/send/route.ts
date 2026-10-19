import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { kirimPesanTelegram, supabaseAdmin } from '@/lib/server/telegram'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const expected = process.env.TELEGRAM_HRD_SEND_SECRET
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!expected || Buffer.byteLength(given) !== Buffer.byteLength(expected)
    || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const input = await request.json().catch(() => null)
  if (typeof input?.user_id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.user_id)
    || typeof input?.title !== 'string' || !input.title.trim() || input.title.length > 180
    || typeof input?.body !== 'string' || !input.body.trim() || input.body.length > 1200) {
    return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 })
  }
  // Fixed HR destination: payloads cannot redirect confidential alerts elsewhere.
  const url = 'https://hr.sukashawarma.com/attendance'
  try {
    const admin = supabaseAdmin(3_000)
    const results = await Promise.all([
      admin.from('outlet_staff').select('role,status').eq('id', input.user_id).maybeSingle(),
      admin.from('hermes_bot_user_access').select('staff_id').eq('bot_slug', 'hrd').eq('staff_id', input.user_id).maybeSingle(),
      admin.from('bot_telegram_links').select('chat_id').eq('staff_id', input.user_id).maybeSingle(),
    ])
    if (results.some(result => result.error)) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }
    const [{ data: staff }, { data: access }, { data: link }] = results
    // admin_hr is the canonical database role for the user's admin_hrd.
    if (!staff || !['admin_hr', 'developer'].includes(staff.role) || staff.status !== 'active' || !access || !link?.chat_id) {
      return NextResponse.json({ delivered: false, reason: 'not_eligible' })
    }
    await kirimPesanTelegram(link.chat_id, `${input.title.trim()}\n\n${input.body.trim()}`, url, 'hrd')
    return NextResponse.json({ delivered: true })
  } catch {
    // Do not log recipient identifiers, HR data, Telegram token or API response.
    console.error('[hrd] Pengiriman alert gagal; antrean akan mencoba kembali.')
    return NextResponse.json({ error: 'Delivery unavailable' }, { status: 503 })
  }
}
