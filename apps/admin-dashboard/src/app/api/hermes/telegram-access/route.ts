import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function authorized(request: Request) {
  const expected = process.env.HERMES_TELEGRAM_SYNC_SECRET
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Endpoint sinkronisasi privat untuk gateway Hermes di VPS. */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const [
    { data: bots, error: botsError },
    { data: grants, error: grantsError },
    { data: stokisGrants, error: stokisError },
    { data: links, error: linksError },
    { data: staff, error: staffError },
  ] = await Promise.all([
    service.from('hermes_bot_registry').select('slug'),
    service.from('hermes_bot_user_access').select('bot_slug, staff_id'),
    service.from('bot_telegram_access').select('staff_id'),
    service.from('bot_telegram_links').select('staff_id, telegram_user_id'),
    service.from('outlet_staff').select('id').eq('status', 'active'),
  ])

  if (botsError || grantsError || stokisError || linksError || staffError) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
  }

  const activeStaff = new Set((staff ?? []).map((row) => row.id))
  const telegramByStaff = new Map((links ?? []).map((row) => [row.staff_id, String(row.telegram_user_id)]))
  const staffByBot = new Map<string, Set<string>>((bots ?? []).map((bot) => [bot.slug, new Set<string>()] as const))
  for (const grant of grants ?? []) staffByBot.get(grant.bot_slug)?.add(grant.staff_id)
  // Stokis still has the legacy grant table used by alert delivery.
  for (const grant of stokisGrants ?? []) staffByBot.get('stokis')?.add(grant.staff_id)

  const profiles: Record<string, string[]> = {}
  for (const [slug, staffIds] of staffByBot) {
    profiles[slug] = [...staffIds]
      .filter((id) => activeStaff.has(id) && telegramByStaff.has(id))
      .map((id) => telegramByStaff.get(id)!)
      .sort()
  }
  return NextResponse.json({ profiles }, { headers: { 'Cache-Control': 'no-store' } })
}
