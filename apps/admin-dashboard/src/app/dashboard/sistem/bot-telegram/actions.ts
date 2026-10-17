'use server'

import { createHash, randomBytes } from 'node:crypto'
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'

const botSlugPattern = /^[a-z][a-z0-9_-]{1,39}$/
const staffIdPattern = /^[0-9a-f-]{36}$/i

export async function daftarkanBotTelegram(slugInput: string, namaInput: string) {
  const { userId } = await requireRole(['owner', 'admin'])
  const slug = slugInput.trim().toLowerCase()
  const nama = namaInput.trim()
  if (!botSlugPattern.test(slug) || nama.length < 2 || nama.length > 80) {
    return { error: 'Isi nama profil Hermes dan nama bot yang valid.' }
  }
  const service = createServiceClient()
  const { error } = await service.from('hermes_bot_registry').insert({ slug, nama, dibuat_oleh: userId })
  if (error) return { error: error.code === '23505' ? 'Profil bot sudah terdaftar.' : 'Bot gagal didaftarkan.' }
  return { bot: { slug, nama } }
}

export async function ubahAksesBotTelegram(botSlug: string, staffId: string, enabled: boolean) {
  const { userId } = await requireRole(['owner', 'admin'])
  if (!botSlugPattern.test(botSlug) || !staffIdPattern.test(staffId) || typeof enabled !== 'boolean') {
    return { error: 'Data akses tidak valid.' }
  }

  const service = createServiceClient()
  const { data: bot, error: botError } = await service.from('hermes_bot_registry')
    .select('slug').eq('slug', botSlug).maybeSingle()
  if (botError) return { error: 'Bot gagal diperiksa.' }
  if (!bot) return { error: 'Bot belum terdaftar.' }

  if (enabled) {
    const { data: staff, error: staffError } = await service.from('outlet_staff')
      .select('id').eq('id', staffId).eq('status', 'active').maybeSingle()
    if (staffError) return { error: 'Staf gagal diperiksa.' }
    if (!staff) return { error: 'Staf tidak aktif.' }

    const table = botSlug === 'stokis' ? 'bot_telegram_access' : 'hermes_bot_user_access'
    const { error } = await service.from(table).upsert({
      ...(botSlug === 'stokis' ? {} : { bot_slug: botSlug }),
      staff_id: staffId,
      granted_by: userId,
      granted_at: new Date().toISOString(),
    }, { onConflict: botSlug === 'stokis' ? 'staff_id' : 'bot_slug,staff_id' })
    if (error) return { error: 'Akses gagal diberikan.' }
  } else {
    const query = botSlug === 'stokis'
      ? service.from('bot_telegram_access').delete().eq('staff_id', staffId)
      : service.from('hermes_bot_user_access').delete().eq('bot_slug', botSlug).eq('staff_id', staffId)
    const { error } = await query
    if (error) return { error: 'Akses gagal dicabut.' }
  }

  return { ok: true }
}

export async function buatLinkAktivasiTelegram(botSlug: string, staffId: string, usernameInput: string) {
  const { userId } = await requireRole(['owner', 'admin'])
  const botUsername = usernameInput.trim().replace(/^@/, '')
  if (!botSlugPattern.test(botSlug) || !staffIdPattern.test(staffId)
    || !/^[A-Za-z0-9_]{5,32}$/.test(botUsername)) {
    return { error: 'Username bot Telegram tidak valid.' }
  }

  const service = createServiceClient()
  const [{ data: bot, error: botError }, { data: staff, error: staffError }] = await Promise.all([
    service.from('hermes_bot_registry').select('slug').eq('slug', botSlug).maybeSingle(),
    service.from('outlet_staff').select('id').eq('id', staffId).eq('status', 'active').maybeSingle(),
  ])
  if (botError || staffError) return { error: 'Bot atau staf gagal diperiksa.' }
  if (!bot) return { error: 'Bot belum terdaftar.' }
  if (!staff) return { error: 'Staf tidak aktif.' }

  const grantTable = botSlug === 'stokis' ? 'bot_telegram_access' : 'hermes_bot_user_access'
  let grantQuery = service.from(grantTable).select('staff_id').eq('staff_id', staffId)
  if (botSlug !== 'stokis') grantQuery = grantQuery.eq('bot_slug', botSlug)
  const { data: grant, error: grantError } = await grantQuery.maybeSingle()
  if (grantError) return { error: 'Akses staf gagal diperiksa.' }
  if (!grant) return { error: 'Beri akses bot kepada staf lebih dulu.' }

  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const { error: revokeError } = await service.from('hermes_telegram_activation_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('staff_id', staffId).eq('bot_slug', botSlug).is('used_at', null).is('revoked_at', null)
  if (revokeError) return { error: 'Undangan sebelumnya gagal diperbarui. Pastikan migrasi aktivasi Telegram sudah diterapkan.' }

  const { error: insertError } = await service.from('hermes_telegram_activation_invites').insert({
    token_hash: tokenHash,
    bot_slug: botSlug,
    staff_id: staffId,
    bot_username: botUsername,
    issued_by: userId,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })
  if (insertError) return { error: 'Link aktivasi gagal dibuat. Pastikan migrasi aktivasi Telegram sudah diterapkan.' }

  return {
    url: `https://agents.sukashawarma.com/api/telegram/login/invite?token=${token}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }
}
