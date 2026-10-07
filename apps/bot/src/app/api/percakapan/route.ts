import { NextResponse } from 'next/server'
import { ambilSesi } from '@/lib/server/sesi'
import { BATAS } from '@/lib/batas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await ambilSesi()
  if (!g.ok) return NextResponse.json({ galat: 'Tidak punya akses.' }, { status: g.status })
  const { data, error } = await g.sesi.supabase
    .from('bot_percakapan').select('id, judul, profil, diperbarui_at')
    .order('diperbarui_at', { ascending: false }).limit(BATAS.percakapanMaks)
  if (error) return NextResponse.json({ galat: 'Gagal memuat percakapan.' }, { status: 500 })
  return NextResponse.json({ percakapan: data ?? [] })
}
