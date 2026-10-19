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

export async function simpanIdTelegramStaf(botSlug: string, staffId: string, telegramIdInput: string) {
  await requireRole(['owner', 'admin'])
  if (typeof botSlug !== 'string' || typeof staffId !== 'string' || typeof telegramIdInput !== 'string') {
    return { error: 'Data Telegram tidak valid.' }
  }
  const telegramUserId = telegramIdInput.trim()
  if (!botSlugPattern.test(botSlug) || !staffIdPattern.test(staffId)
    || (telegramUserId !== '' && !/^[0-9]{1,24}$/.test(telegramUserId))) {
    return { error: 'ID Telegram harus berupa angka.' }
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

  if (!telegramUserId) {
    const { error } = await service.from('bot_telegram_links').delete().eq('staff_id', staffId)
    if (error) return { error: 'ID Telegram gagal dihapus.' }
    return { telegramUserId: null }
  }

  const { data: existing, error: existingError } = await service.from('bot_telegram_links')
    .select('staff_id').eq('telegram_user_id', telegramUserId).maybeSingle()
  if (existingError) return { error: 'ID Telegram gagal diperiksa.' }
  if (existing && existing.staff_id !== staffId) return { error: 'ID Telegram ini sudah terhubung ke staf lain.' }

  const { error } = await service.from('bot_telegram_links').upsert({
    staff_id: staffId,
    telegram_user_id: telegramUserId,
    chat_id: telegramUserId,
    telegram_username: null,
    telegram_first_name: null,
    linked_at: new Date().toISOString(),
  }, { onConflict: 'staff_id' })
  if (error) return { error: error.code === '23505' ? 'ID Telegram ini sudah terhubung ke staf lain.' : 'ID Telegram gagal disimpan.' }
  return { telegramUserId }
}

export async function simpanBotUsername(botSlug: string, usernameInput: string) {
  await requireRole(['owner', 'admin'])
  const slug = botSlug.trim().toLowerCase()
  const username = usernameInput.trim().replace(/^@/, '')
  if (!botSlugPattern.test(slug)) return { error: 'Slug bot tidak valid.' }
  if (username && !/^[A-Za-z0-9_]{5,32}$/.test(username)) {
    return { error: 'Username bot harus 5-32 karakter (huruf, angka, garis bawah).' }
  }
  const service = createServiceClient()
  const { error } = await service.from('hermes_bot_registry')
    .update({ bot_username: username || null })
    .eq('slug', slug)
  if (error) return { error: 'Gagal memperbarui username bot.' }
  return { ok: true, botUsername: username || null }
}

export async function ambilDataWhitelistDanInvite(botSlug: string) {
  await requireRole(['owner', 'admin'])
  const slug = botSlug.trim().toLowerCase()
  if (!botSlugPattern.test(slug)) return { error: 'Slug bot tidak valid.' }
  const service = createServiceClient()

  const [{ data: whitelist, error: wErr }, { data: invites, error: iErr }, { data: bot, error: bErr }] = await Promise.all([
    service.from('bot_telegram_whitelist')
      .select('id, bot_slug, telegram_user_id, nama_pengguna, username_telegram, is_active, catatan, dibuat_at')
      .eq('bot_slug', slug)
      .order('dibuat_at', { ascending: false }),
    service.from('bot_telegram_invite_codes')
      .select('id, code, bot_slug, label, max_uses, used_count, expires_at, is_active, dibuat_at')
      .eq('bot_slug', slug)
      .order('dibuat_at', { ascending: false })
      .limit(20),
    service.from('hermes_bot_registry').select('slug, nama, bot_username').eq('slug', slug).maybeSingle(),
  ])

  if (wErr || iErr || bErr) {
    return { error: 'Gagal memuat data whitelist atau undangan bot.' }
  }

  return {
    whitelist: whitelist ?? [],
    invites: invites ?? [],
    botUsername: bot?.bot_username ?? null,
  }
}

export async function buatInviteCode(botSlug: string, label: string, maxUses: number | null = 1, expiresHours: number | null = 24) {
  const { userId } = await requireRole(['owner', 'admin'])
  const slug = botSlug.trim().toLowerCase()
  if (!botSlugPattern.test(slug)) return { error: 'Slug bot tidak valid.' }

  const service = createServiceClient()
  const { data: bot } = await service.from('hermes_bot_registry').select('bot_username').eq('slug', slug).maybeSingle()

  // Generate 8-character random readable hex code
  const code = Math.random().toString(36).substring(2, 10).toUpperCase()
  const expiresAt = expiresHours ? new Date(Date.now() + expiresHours * 3600 * 1000).toISOString() : null

  const { data, error } = await service.from('bot_telegram_invite_codes').insert({
    code,
    bot_slug: slug,
    label: label.trim() || 'Undangan Pengguna',
    max_uses: maxUses && maxUses > 0 ? maxUses : null,
    expires_at: expiresAt,
    dibuat_oleh: userId,
  }).select().single()

  if (error) return { error: 'Gagal membuat kode undangan.' }

  const deepLink = bot?.bot_username
    ? `https://t.me/${bot.bot_username}?start=inv_${code}`
    : `/start inv_${code}`

  return { ok: true, invite: data, deepLink }
}

export async function tambahWhitelistManual(botSlug: string, telegramUserId: string, namaPengguna: string, catatan = '') {
  const { userId } = await requireRole(['owner', 'admin'])
  const slug = botSlug.trim().toLowerCase()
  const tgId = telegramUserId.trim()
  const nama = namaPengguna.trim()

  if (!botSlugPattern.test(slug) || !/^[0-9]{1,24}$/.test(tgId) || nama.length < 2) {
    return { error: 'Data ID Telegram dan Nama Pengguna tidak valid.' }
  }

  const service = createServiceClient()
  const { error } = await service.from('bot_telegram_whitelist').upsert({
    bot_slug: slug,
    telegram_user_id: tgId,
    nama_pengguna: nama,
    catatan: catatan.trim() || 'Ditambahkan manual oleh admin',
    is_active: true,
    dibuat_oleh: userId,
  }, { onConflict: 'bot_slug,telegram_user_id' })

  if (error) return { error: 'Gagal menambahkan ID Telegram ke whitelist.' }
  return { ok: true }
}

export async function ubahStatusWhitelist(id: string, isActive: boolean) {
  await requireRole(['owner', 'admin'])
  const service = createServiceClient()
  const { error } = await service.from('bot_telegram_whitelist').update({ is_active: isActive }).eq('id', id)
  if (error) return { error: 'Gagal mengubah status akses.' }
  return { ok: true }
}

export async function hapusWhitelist(id: string) {
  await requireRole(['owner', 'admin'])
  const service = createServiceClient()
  const { error } = await service.from('bot_telegram_whitelist').delete().eq('id', id)
  if (error) return { error: 'Gagal menghapus ID Telegram dari whitelist.' }
  return { ok: true }
}

export async function ubahStatusInviteCode(id: string, isActive: boolean) {
  await requireRole(['owner', 'admin'])
  const service = createServiceClient()
  const { error } = await service.from('bot_telegram_invite_codes').update({ is_active: isActive }).eq('id', id)
  if (error) return { error: 'Gagal mengubah status kode undangan.' }
  return { ok: true }
}

export async function daftarkanCommandBotTelegram(botToken: string) {
  await requireRole(['owner', 'admin'])
  const token = botToken.trim()
  if (!/^\d{8,12}:[A-Za-z0-9_-]{30,50}$/.test(token)) {
    return { error: 'Format token bot Telegram tidak valid. Contoh: 123456789:AAFnk...' }
  }
  const commands = [
    { command: 'start', description: 'Mulai bot & aktivasi akun' },
    { command: 'help', description: 'Panduan & 10 trigger alert operasional' },
    { command: 'omzet', description: 'Cek omzet & ranking cabang hari ini' },
    { command: 'buka', description: 'Cek cabang buka & belum transaksi' },
    { command: 'absen', description: 'Presensi & kedisiplinan kru outlet' },
    { command: 'stok', description: 'Status stok opname & bahan baku' },
    { command: 'sidak', description: 'Kepatuhan ceklist & audit cabang' },
    { command: 'new', description: 'Mulai sesi percakapan baru' },
    { command: 'id', description: 'Lihat info akun Telegram Anda' },
  ]
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    })
    const json = await res.json()
    if (!json.ok) {
      return { error: `Telegram Bot API: ${json.description || 'Gagal mendaftarkan menu commands'}` }
    }
    return { ok: true }
  } catch (err: unknown) {
    return { error: `Jaringan error: ${err instanceof Error ? err.message : 'Unknown'}` }
  }
}

