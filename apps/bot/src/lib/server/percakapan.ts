// Semua query memakai klien SESI USER — RLS (staff_id = auth.uid()) yang menjaga kepemilikan.
import type { Profil } from '@/lib/peran'
import { judulDari, idUntukDipangkas } from '@/lib/batas'

export async function hitungPesanSejamTerakhir(supabase: any): Promise<number> {
  const sejak = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error } = await supabase
    .from('bot_pesan').select('id', { count: 'exact', head: true })
    .eq('peran', 'user').gte('dibuat_at', sejak)
  if (error) throw new Error(`hitung pesan: ${error.message}`)
  return count ?? 0
}

export async function buatPercakapan(supabase: any, profil: Profil, pesan: string) {
  const { data, error } = await supabase
    .from('bot_percakapan').insert({ profil, judul: judulDari(pesan) })
    .select('id, hermes_session_id').single()
  if (error) throw new Error(`buat percakapan: ${error.message}`)
  return data as { id: string; hermes_session_id: string }
}

export async function ambilPercakapan(supabase: any, id: string) {
  const { data, error } = await supabase
    .from('bot_percakapan').select('id, profil, hermes_session_id').eq('id', id).maybeSingle()
  if (error) throw new Error(`ambil percakapan: ${error.message}`)
  return data as { id: string; profil: Profil; hermes_session_id: string } | null
}

/** Simpan hanya 50 percakapan terbaru milik pemanggil (spec W6). */
export async function pangkasPercakapan(supabase: any): Promise<void> {
  const { data, error } = await supabase
    .from('bot_percakapan').select('id').order('diperbarui_at', { ascending: false })
  if (error) throw new Error(`daftar percakapan: ${error.message}`)
  const buang = idUntukDipangkas((data ?? []).map((r: { id: string }) => r.id))
  if (buang.length === 0) return
  const { error: e2 } = await supabase.from('bot_percakapan').delete().in('id', buang)
  if (e2) throw new Error(`pangkas percakapan: ${e2.message}`)
}

export async function simpanPesan(
  supabase: any, percakapanId: string, peran: 'user' | 'bot', isi: string, meta: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.from('bot_pesan').insert({ percakapan_id: percakapanId, peran, isi, meta })
  if (error) throw new Error(`simpan pesan: ${error.message}`)
}

export async function sentuhPercakapan(supabase: any, id: string): Promise<void> {
  await supabase.from('bot_percakapan').update({ diperbarui_at: new Date().toISOString() }).eq('id', id)
}
