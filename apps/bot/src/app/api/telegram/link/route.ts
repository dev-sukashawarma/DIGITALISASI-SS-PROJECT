import { createHash, randomInt } from 'node:crypto'
import { NextResponse } from 'next/server'
import { ambilIdentitasTelegram } from '@/lib/server/identitasTelegram'
import { kirimPesanTelegram, stafBolehPakaiStokist, supabaseAdmin } from '@/lib/server/telegram'

export const dynamic = 'force-dynamic'

export async function GET() {
  const identity = await ambilIdentitasTelegram()
  if (!identity) return NextResponse.json({ error: 'Silakan login sebagai staf aktif.' }, { status: 401 })
  if (!(await stafBolehPakaiStokist(identity.userId))) return NextResponse.json({ error: 'Akses Bot Stokist belum diberikan.' }, { status: 403 })
  const { data, error } = await supabaseAdmin()
    .from('bot_telegram_links')
    .select('telegram_username, linked_at')
    .eq('staff_id', identity.userId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Status Telegram gagal dimuat.' }, { status: 500 })
  return NextResponse.json({ linked: !!data, username: data?.telegram_username ?? null, linkedAt: data?.linked_at ?? null })
}

export async function POST(request: Request) {
  const identity = await ambilIdentitasTelegram()
  if (!identity) return NextResponse.json({ error: 'Silakan login sebagai staf aktif.' }, { status: 401 })
  if (!(await stafBolehPakaiStokist(identity.userId))) return NextResponse.json({ error: 'Akses Bot Stokist belum diberikan.' }, { status: 403 })
  const input = await request.json().catch(() => null)
  const telegramUserId = input?.telegramUserId
  if (typeof telegramUserId !== 'string' || !/^[0-9]{1,24}$/.test(telegramUserId)) {
    return NextResponse.json({ error: 'Masukkan User ID Telegram numerik dari perintah /id di bot Stokist.' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: recent, error: rateError } = await admin.from('bot_telegram_link_tokens')
    .select('created_at').eq('staff_id', identity.userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (rateError) return NextResponse.json({ error: 'Gagal menyiapkan kode.' }, { status: 500 })
  if (recent && Date.now() - new Date(recent.created_at).getTime() < 60_000) {
    return NextResponse.json({ error: 'Tunggu satu menit sebelum meminta kode baru.' }, { status: 429 })
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const tokenHash = createHash('sha256').update(code).digest('hex')
  const { error: deleteError } = await admin.from('bot_telegram_link_tokens').delete().eq('staff_id', identity.userId)
  if (deleteError) return NextResponse.json({ error: 'Gagal menyiapkan kode.' }, { status: 500 })
  const { error } = await admin.from('bot_telegram_link_tokens').insert({
    staff_id: identity.userId,
    token_hash: tokenHash,
    telegram_user_id: telegramUserId,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })
  if (error) return NextResponse.json({ error: 'Gagal menyiapkan kode.' }, { status: 500 })
  try {
    await kirimPesanTelegram(telegramUserId, `Kode pengaitan Telegram Bot Stokist: ${code}\nKode berlaku 10 menit. Jangan bagikan kode ini.`)
  } catch {
    await admin.from('bot_telegram_link_tokens').delete().eq('staff_id', identity.userId)
    return NextResponse.json({ error: 'Kode gagal dikirim. Buka chat bot Stokist dan kirim /start terlebih dahulu.' }, { status: 502 })
  }
  return NextResponse.json({ sent: true, expiresInSeconds: 600 })
}

export async function PUT(request: Request) {
  const identity = await ambilIdentitasTelegram()
  if (!identity) return NextResponse.json({ error: 'Silakan login sebagai staf aktif.' }, { status: 401 })
  if (!(await stafBolehPakaiStokist(identity.userId))) return NextResponse.json({ error: 'Akses Bot Stokist belum diberikan.' }, { status: 403 })
  const input = await request.json().catch(() => null)
  const telegramUserId = input?.telegramUserId
  const code = input?.code
  if (typeof telegramUserId !== 'string' || !/^[0-9]{1,24}$/.test(telegramUserId)
    || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'User ID Telegram atau kode verifikasi tidak valid.' }, { status: 400 })
  }
  const tokenHash = createHash('sha256').update(code).digest('hex')
  const { data, error } = await supabaseAdmin().rpc('bot_telegram_tautkan_kode', {
    p_staff_id: identity.userId,
    p_token_hash: tokenHash,
    p_telegram_user_id: telegramUserId,
  })
  if (error) return NextResponse.json({ error: 'Gagal memverifikasi kode.' }, { status: 500 })
  if (data?.ok) return NextResponse.json({ linked: true })
  return NextResponse.json({ error: data?.reason === 'linked_elsewhere'
    ? 'Akun Telegram ini sudah terhubung ke akun staf lain.'
    : 'Kode salah, kedaluwarsa, atau sudah digunakan.' }, { status: 400 })
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
