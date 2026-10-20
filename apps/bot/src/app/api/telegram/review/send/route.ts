import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { kirimPesanTelegram, supabaseAdmin, urlAplikasiDiizinkan } from '@/lib/server/telegram'

export const dynamic = 'force-dynamic'

function authorized(request: Request): boolean {
  const expected = process.env.TELEGRAM_REVIEW_SEND_SECRET || process.env.TELEGRAM_MANAGER_SEND_SECRET || process.env.TELEGRAM_STOKIST_SEND_SECRET
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const input = await request.json().catch(() => null)
  const title = input?.title
  const body = input?.body || input?.message
  const chatId = input?.chat_id
  const userId = input?.user_id
  const isBroadcast = input?.broadcast === true

  if (
    typeof title !== 'string' ||
    !title.trim() ||
    title.length > 250 ||
    typeof body !== 'string' ||
    !body.trim() ||
    body.length > 3000
  ) {
    return NextResponse.json({ error: 'Payload tidak valid (title dan body wajib diisi).' }, { status: 400 })
  }

  const rawUrl = input?.url === 'review' || input?.url === 'sukareview'
    ? 'https://suka.pantaureview.com'
    : input?.url === 'agents' || input?.url === 'bot'
    ? 'https://agents.sukashawarma.com'
    : input?.url

  const url = rawUrl ? urlAplikasiDiizinkan(rawUrl, 'review') : undefined
  if (rawUrl && !url) {
    return NextResponse.json({ error: 'URL aplikasi tidak valid.' }, { status: 400 })
  }

  const pesanLengkap = `${title.trim()}\n\n${body.trim()}`

  try {
    // KASUS 1: Kirim langsung ke chat_id tertentu (bisa single atau array)
    if (chatId) {
      const chatIds = Array.isArray(chatId) ? chatId : [String(chatId)]
      let sukses = 0
      for (const c of chatIds) {
        if (c && typeof c === 'string') {
          await kirimPesanTelegram(c.trim(), pesanLengkap, url ?? undefined, 'review')
          sukses++
        }
      }
      return NextResponse.json({ delivered: true, count: sukses })
    }

    // KASUS 2: Kirim ke user_id tertentu (lookup staf & bot_telegram_links)
    if (userId) {
      if (typeof userId !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId)) {
        return NextResponse.json({ error: 'Format user_id UUID tidak valid.' }, { status: 400 })
      }
      const admin = supabaseAdmin(3_000)
      const results = await Promise.all([
        admin.from('outlet_staff').select('role,status').eq('id', userId).maybeSingle(),
        admin.from('bot_telegram_links').select('chat_id').eq('staff_id', userId).maybeSingle(),
      ])
      if (results.some((result) => result.error)) {
        return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
      }
      const [{ data: staff }, { data: link }] = results

      const allowedRoles = ['owner', 'admin', 'developer', 'marcom', 'area_manager', 'regional_manager']
      if (!staff || !allowedRoles.includes(staff.role) || staff.status !== 'active' || !link?.chat_id) {
        return NextResponse.json({ delivered: false, reason: 'not_eligible' })
      }

      await kirimPesanTelegram(link.chat_id, pesanLengkap, url ?? undefined, 'review')
      return NextResponse.json({ delivered: true, count: 1 })
    }

    // KASUS 3: Broadcast ke staf penerima alert ulasan
    if (isBroadcast) {
      const admin = supabaseAdmin(3_000)
      const { data: links, error: linkErr } = await admin
        .from('bot_telegram_links')
        .select('chat_id, staff_id, outlet_staff!inner(role, status)')
        .eq('outlet_staff.status', 'active')
        .in('outlet_staff.role', ['owner', 'admin', 'developer', 'marcom'])

      if (linkErr) {
        return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
      }

      const unikChatIds = Array.from(new Set((links ?? []).map((l: any) => l.chat_id).filter(Boolean)))
      let sukses = 0
      for (const c of unikChatIds) {
        try {
          await kirimPesanTelegram(String(c), pesanLengkap, url ?? undefined, 'review')
          sukses++
        } catch (e) {
          console.warn(`[review-send] Gagal kirim ke chat_id ${c}:`, e)
        }
      }
      return NextResponse.json({ delivered: true, count: sukses })
    }

    return NextResponse.json({ error: 'Wajib menyertakan chat_id, user_id, atau broadcast: true' }, { status: 400 })
  } catch (error) {
    console.error('[review] Pengiriman alert Telegram gagal:', error)
    return NextResponse.json({ error: 'Delivery unavailable' }, { status: 503 })
  }
}
