'use server'

import { z } from 'zod'
import { jakartaDayKey } from '@suka/auth'
import { requireRole } from '@/lib/authz'
import { createServerComponentClient } from '@/lib/supabase-server'
import { tanyaHermes } from '@/lib/botHrd/hermes'

const ROLE_BOT_HRD = ['admin_hr', 'owner', 'admin']
const Masukan = z.object({ percakapanId: z.string().uuid().optional(), pesan: z.string().trim().min(1).max(1000) })

type Hasil<T> = ({ ok: true } & T) | { ok: false; galat: string }

const awalHariWib = () => `${jakartaDayKey()}T00:00:00+07:00`

export async function kirimPesanBotHrd(input: { percakapanId?: string; pesan: string }): Promise<Hasil<{ percakapanId: string; jawaban: string }>> {
  try {
    await requireRole(ROLE_BOT_HRD)
  } catch {
    return { ok: false, galat: 'Bot HRD hanya untuk HRD, owner, dan admin.' }
  }
  const p = Masukan.safeParse(input)
  if (!p.success) return { ok: false, galat: 'Pesan kosong atau terlalu panjang (maks 1.000 karakter).' }
  const baseUrl = process.env.HERMES_API_URL
  const kunci = process.env.HERMES_KEY_HRD
  if (!baseUrl || !kunci) return { ok: false, galat: 'Bot HRD belum dikonfigurasi.' }

  const db = await createServerComponentClient()

  const batas = Number(process.env.BOT_HRD_BATAS_HARIAN ?? 100)
  const { count, error: galatHitung } = await db
    .from('bot_pesan')
    .select('id, bot_percakapan!inner(profil)', { count: 'exact', head: true })
    .eq('peran', 'user')
    .eq('bot_percakapan.profil', 'hrd')
    .gte('dibuat_at', awalHariWib())
  if (galatHitung) return { ok: false, galat: 'Gagal memeriksa batas harian.' }
  if ((count ?? 0) >= batas) return { ok: false, galat: `Batas ${batas} pertanyaan per hari tercapai. Coba lagi besok.` }

  // Percakapan hanya berlanjut di hari yang sama (WIB), profil hrd.
  let percakapanId: string | undefined
  let sesiId: string | undefined
  if (p.data.percakapanId) {
    const { data } = await db
      .from('bot_percakapan')
      .select('id, profil, dibuat_at, hermes_session_id')
      .eq('id', p.data.percakapanId)
      .maybeSingle()
    if (data && data.profil === 'hrd' && jakartaDayKey(new Date(data.dibuat_at)) === jakartaDayKey()) {
      percakapanId = data.id as string
      sesiId = data.hermes_session_id as string
    }
  }
  if (!percakapanId || !sesiId) {
    const { data, error } = await db
      .from('bot_percakapan')
      .insert({ profil: 'hrd', judul: p.data.pesan.slice(0, 60) })
      .select('id, hermes_session_id')
      .single()
    if (error || !data) return { ok: false, galat: 'Gagal membuat percakapan.' }
    percakapanId = data.id as string
    sesiId = data.hermes_session_id as string
  }

  const { error: galatSimpan } = await db.from('bot_pesan').insert({ percakapan_id: percakapanId, peran: 'user', isi: p.data.pesan })
  if (galatSimpan) return { ok: false, galat: 'Gagal menyimpan pesan.' }

  let jawaban: string
  try {
    jawaban = await tanyaHermes({ baseUrl, kunci, sesiId, pesan: p.data.pesan })
  } catch (e) {
    return { ok: false, galat: e instanceof Error ? e.message : 'Bot HRD sedang tidak tersedia.' }
  }

  await db.from('bot_pesan').insert({ percakapan_id: percakapanId, peran: 'bot', isi: jawaban.slice(0, 20000) })
  await db.from('bot_percakapan').update({ diperbarui_at: new Date().toISOString() }).eq('id', percakapanId)
  return { ok: true, percakapanId, jawaban }
}

export async function ambilPesanBotHrd(percakapanId: string): Promise<Hasil<{ pesan: { peran: 'user' | 'assistant'; isi: string; dibuat_at: string }[] }>> {
  try {
    await requireRole(ROLE_BOT_HRD)
  } catch {
    return { ok: false, galat: 'Bot HRD hanya untuk HRD, owner, dan admin.' }
  }
  if (!z.string().uuid().safeParse(percakapanId).success) return { ok: false, galat: 'Percakapan tidak valid.' }
  const db = await createServerComponentClient()
  const { data: perc } = await db.from('bot_percakapan').select('id, profil').eq('id', percakapanId).maybeSingle()
  if (!perc || perc.profil !== 'hrd') return { ok: false, galat: 'Percakapan tidak ditemukan.' }
  const { data, error } = await db
    .from('bot_pesan')
    .select('peran, isi, dibuat_at')
    .eq('percakapan_id', percakapanId)
    .order('dibuat_at')
    .order('id')
    .limit(200)
  if (error) return { ok: false, galat: 'Gagal memuat percakapan.' }
  return {
    ok: true,
    pesan: (data ?? []).map((m) => ({
      peran: (m.peran === 'bot' ? 'assistant' : 'user') as 'user' | 'assistant',
      isi: m.isi as string,
      dibuat_at: m.dibuat_at as string,
    })),
  }
}
