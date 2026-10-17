import { NextResponse } from 'next/server'
import { ambilIdentitasTelegram } from '@/lib/server/identitasTelegram'
import { supabaseAdmin } from '@/lib/server/telegram'

export const dynamic = 'force-dynamic'

async function adminIdentity() {
  const identity = await ambilIdentitasTelegram()
  return identity && ['owner', 'admin'].includes(identity.role) ? identity : null
}

export async function GET() {
  const identity = await adminIdentity()
  if (!identity) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
  const admin = supabaseAdmin()
  const [{ data: staff, error: staffError }, { data: access, error: accessError }, { data: links, error: linksError }] = await Promise.all([
    admin.from('outlet_staff').select('id, name, username, role').eq('status', 'active').order('name').limit(1000),
    admin.from('bot_telegram_access').select('staff_id'),
    admin.from('bot_telegram_links').select('staff_id, telegram_user_id'),
  ])
  if (staffError || accessError || linksError) return NextResponse.json({ error: 'Daftar staf gagal dimuat.' }, { status: 503 })
  const allowed = new Set((access ?? []).map((row) => row.staff_id))
  const linked = new Map((links ?? []).map((row) => [row.staff_id, row.telegram_user_id]))
  return NextResponse.json({ staff: (staff ?? []).map((row) => ({
    ...row,
    allowed: allowed.has(row.id),
    telegramUserId: linked.get(row.id) ?? null,
  })) })
}

export async function PUT(request: Request) {
  const identity = await adminIdentity()
  if (!identity) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
  const origin = request.headers.get('origin')
  const allowedOrigin = process.env.NODE_ENV === 'production'
    ? 'https://agents.sukashawarma.com'
    : new URL(request.url).origin
  if (origin !== allowedOrigin) {
    return NextResponse.json({ error: 'Asal permintaan tidak valid.' }, { status: 403 })
  }
  const input = await request.json().catch(() => null)
  if (typeof input?.staffId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.staffId)
    || typeof input?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Data akses tidak valid.' }, { status: 400 })
  }
  const admin = supabaseAdmin()
  if (input.enabled) {
    const { data: staff, error: staffError } = await admin.from('outlet_staff')
      .select('id').eq('id', input.staffId).eq('status', 'active').maybeSingle()
    if (staffError) return NextResponse.json({ error: 'Staf gagal diperiksa.' }, { status: 503 })
    if (!staff) return NextResponse.json({ error: 'Staf tidak aktif.' }, { status: 400 })
    const { error } = await admin.from('bot_telegram_access').upsert({
      staff_id: input.staffId,
      granted_by: identity.userId,
      granted_at: new Date().toISOString(),
    }, { onConflict: 'staff_id' })
    if (error) return NextResponse.json({ error: 'Akses gagal diberikan.' }, { status: 503 })
  } else {
    const { error } = await admin.from('bot_telegram_access').delete().eq('staff_id', input.staffId)
    if (error) return NextResponse.json({ error: 'Akses gagal dicabut.' }, { status: 503 })
  }
  return NextResponse.json({ ok: true })
}
