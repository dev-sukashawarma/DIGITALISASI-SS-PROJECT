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
    { data: whitelist, error: whitelistError },
  ] = await Promise.all([
    service.from('hermes_bot_registry').select('slug'),
    service.from('hermes_bot_user_access').select('bot_slug, staff_id'),
    service.from('bot_telegram_access').select('staff_id'),
    service.from('bot_telegram_links').select('staff_id, telegram_user_id'),
    service.from('outlet_staff').select('id').eq('status', 'active'),
    service.from('bot_telegram_whitelist').select('bot_slug, telegram_user_id').eq('is_active', true),
  ])

  // Ignore 42P01 if migration is pending in local/test
  const isWhitelistMissing = whitelistError && (whitelistError as { code?: string }).code === '42P01'
  if (botsError || grantsError || stokisError || linksError || staffError || (whitelistError && !isWhitelistMissing)) {
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
    const ids = new Set<string>()
    for (const id of staffIds) {
      if (activeStaff.has(id) && telegramByStaff.has(id)) {
        ids.add(telegramByStaff.get(id)!)
      }
    }
    // Tambahkan ID mandiri dari bot_telegram_whitelist
    for (const row of whitelist ?? []) {
      if (row.bot_slug === slug && row.telegram_user_id) {
        ids.add(String(row.telegram_user_id))
      }
    }
    profiles[slug] = Array.from(ids).sort((a, b) => a.length - b.length || a.localeCompare(b))
  }
  return NextResponse.json({ profiles }, { headers: { 'Cache-Control': 'no-store' } })
}
