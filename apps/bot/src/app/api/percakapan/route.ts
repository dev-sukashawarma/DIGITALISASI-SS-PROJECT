import { NextResponse } from 'next/server'
import { ambilSesi } from '@/lib/server/sesi'
import { bolehChat } from '@/lib/server/izinChat'
import { adalahProfil } from '@/lib/peran'
import { BATAS } from '@/lib/batas'

export const dynamic = 'force-dynamic'

// Daftar percakapan satu bot (?profil=…) — hanya untuk bot yang boleh diajak chat pemanggil.
export async function GET(req: Request) {
  const g = await ambilSesi()
  if (!g.ok) return NextResponse.json({ galat: 'Tidak punya akses.' }, { status: g.status })
  const profil = new URL(req.url).searchParams.get('profil')
  if (!adalahProfil(profil)) return NextResponse.json({ galat: 'Bot tidak dikenal.' }, { status: 400 })
  if (!bolehChat(g.sesi.role, profil)) return NextResponse.json({ galat: 'Anda tidak punya akses ke bot ini.' }, { status: 403 })
  const { data, error } = await g.sesi.supabase
    .from('bot_percakapan').select('id, judul, profil, diperbarui_at')
    .eq('profil', profil)
    .order('diperbarui_at', { ascending: false }).limit(BATAS.percakapanMaks)
  if (error) return NextResponse.json({ galat: 'Gagal memuat percakapan.' }, { status: 500 })
  return NextResponse.json({ percakapan: data ?? [] })
}
