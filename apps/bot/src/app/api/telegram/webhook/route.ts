import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { kirimPesanTelegram, supabaseAdmin } from '@/lib/server/telegram'

export const dynamic = 'force-dynamic'

function secretValid(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function balas(chatId: string, text: string) {
  try {
    await kirimPesanTelegram(chatId, text)
  } catch (error) {
    console.error('[stokist] gagal membalas perintah:', error)
  }
  return NextResponse.json({ ok: true })
}

export async function POST(request: Request) {
  const expected = process.env.TELEGRAM_STOKIST_WEBHOOK_SECRET
  const given = request.headers.get('x-telegram-bot-api-secret-token') ?? ''
  if (!expected || !secretValid(given, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const update = await request.json().catch(() => null)
  const message = update?.message
  const chat = message?.chat
  const sender = message?.from
  const text = typeof message?.text === 'string' ? message.text.trim() : ''
  if (chat?.type !== 'private' || !chat?.id || !sender?.id || !text.startsWith('/')) {
    return NextResponse.json({ ok: true })
  }

  const chatId = String(chat.id)
  const senderId = String(sender.id)
  const start = text.match(/^\/start(?:@[a-zA-Z0-9_]+)?(?:\s+([0-9a-f]{48}))?$/i)
  if (start) {
    const token = start[1]
    if (!token) return balas(chatId, 'Buka halaman /telegram di aplikasi Bot, lalu pilih Hubungkan Telegram.')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const { data, error } = await supabaseAdmin().rpc('bot_telegram_tautkan', {
      p_token_hash: tokenHash,
      p_telegram_user_id: senderId,
      p_chat_id: chatId,
      p_username: typeof sender.username === 'string' ? sender.username : null,
      p_first_name: typeof sender.first_name === 'string' ? sender.first_name : null,
    })
    if (error) {
      console.error('[stokist] gagal menautkan akun:', error.message)
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }
    if (data?.ok) return balas(chatId, 'Akun terhubung. Bot Stokist akan mengirim alert Stok dan Distribusi yang sesuai role serta outlet Anda.')
    if (data?.reason === 'linked_elsewhere') return balas(chatId, 'Akun Telegram ini sudah terhubung ke akun staf lain.')
    return balas(chatId, 'Tautan sudah kedaluwarsa atau digunakan. Buat tautan baru di aplikasi.')
  }

  if (/^\/stop(?:@[a-zA-Z0-9_]+)?$/.test(text)) {
    const { error } = await supabaseAdmin().rpc('bot_telegram_putuskan', { p_telegram_user_id: senderId })
    if (error) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    return balas(chatId, 'Koneksi alert Stokist sudah diputus.')
  }
  if (/^\/help(?:@[a-zA-Z0-9_]+)?$/.test(text)) {
    return balas(chatId, 'Bot Stokist mengirim alert Stok dan Distribusi. Hubungkan akun melalui aplikasi Bot. Ketik /stop untuk berhenti.')
  }
  return NextResponse.json({ ok: true })
}
