'use server'

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
