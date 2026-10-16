import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { ambilIdentitasTelegram } from '@/lib/server/identitasTelegram'
import { supabaseAdmin, urlBotTelegram } from '@/lib/server/telegram'

export const dynamic = 'force-dynamic'

export async function GET() {
  const identity = await ambilIdentitasTelegram()
  if (!identity) return NextResponse.json({ error: 'Silakan login sebagai staf aktif.' }, { status: 401 })
  const { data, error } = await supabaseAdmin()
    .from('bot_telegram_links')
    .select('telegram_username, linked_at')
    .eq('staff_id', identity.userId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Status Telegram gagal dimuat.' }, { status: 500 })
  return NextResponse.json({ linked: !!data, username: data?.telegram_username ?? null, linkedAt: data?.linked_at ?? null })
}

export async function POST() {
  const identity = await ambilIdentitasTelegram()
  if (!identity) return NextResponse.json({ error: 'Silakan login sebagai staf aktif.' }, { status: 401 })
  const botUrl = await urlBotTelegram()
  if (!botUrl) return NextResponse.json({ error: 'Bot Stokist belum terhubung ke Telegram.' }, { status: 503 })

  const admin = supabaseAdmin()
  const token = randomBytes(24).toString('hex')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const { error: deleteError } = await admin.from('bot_telegram_link_tokens').delete().eq('staff_id', identity.userId)
  if (deleteError) return NextResponse.json({ error: 'Gagal menyiapkan tautan.' }, { status: 500 })
  const { error } = await admin.from('bot_telegram_link_tokens').insert({
    staff_id: identity.userId,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })
  if (error) return NextResponse.json({ error: 'Gagal menyiapkan tautan.' }, { status: 500 })
  return NextResponse.json({ url: `${botUrl}?start=${token}`, expiresInSeconds: 600 })
}

export async function DELETE() {
  const identity = await ambilIdentitasTelegram()
  if (!identity) return NextResponse.json({ error: 'Silakan login sebagai staf aktif.' }, { status: 401 })
  const admin = supabaseAdmin()
  const { error } = await admin.from('bot_telegram_links').delete().eq('staff_id', identity.userId)
  if (error) return NextResponse.json({ error: 'Gagal memutus koneksi.' }, { status: 500 })
  await admin.from('bot_telegram_link_tokens').delete().eq('staff_id', identity.userId)
  return NextResponse.json({ linked: false })
}
