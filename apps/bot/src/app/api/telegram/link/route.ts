import { NextResponse } from 'next/server'
import { ambilIdentitasTelegram } from '@/lib/server/identitasTelegram'
import { stafBolehPakaiBotApaPun, supabaseAdmin } from '@/lib/server/telegram'

export const dynamic = 'force-dynamic'

export async function GET() {
  const identity = await ambilIdentitasTelegram()
  if (!identity) return NextResponse.json({ error: 'Silakan login sebagai staf aktif.' }, { status: 401 })
  if (!(await stafBolehPakaiBotApaPun(identity.userId))) return NextResponse.json({ error: 'Akses ke bot Telegram belum diberikan.' }, { status: 403 })
  const { data, error } = await supabaseAdmin()
    .from('bot_telegram_links')
    .select('telegram_username, linked_at')
    .eq('staff_id', identity.userId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Status Telegram gagal dimuat.' }, { status: 500 })
  return NextResponse.json({ linked: !!data, username: data?.telegram_username ?? null, linkedAt: data?.linked_at ?? null })
}

export async function POST() {
  return NextResponse.json({ error: 'Pengaitan Telegram dilakukan admin melalui link aktivasi.' }, { status: 403 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Pengaitan Telegram dilakukan admin melalui link aktivasi.' }, { status: 403 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Hubungi admin untuk mengubah pengaitan Telegram.' }, { status: 403 })
}
