import { NextResponse } from 'next/server'
import { ambilSesi } from '@/lib/server/sesi'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f-]{36}$/i

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const g = await ambilSesi()
  if (!g.ok) return NextResponse.json({ galat: 'Tidak punya akses.' }, { status: g.status })
  if (!UUID.test(id)) return NextResponse.json({ galat: 'ID tidak valid.' }, { status: 400 })
  const { data, error } = await g.sesi.supabase
    .from('bot_pesan').select('id, peran, isi, dibuat_at')
    .eq('percakapan_id', id).order('dibuat_at', { ascending: true }).limit(500)
  if (error) return NextResponse.json({ galat: 'Gagal memuat pesan.' }, { status: 500 })
  return NextResponse.json({ pesan: data ?? [] })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  const g = await ambilSesi()
  if (!g.ok) return NextResponse.json({ galat: 'Tidak punya akses.' }, { status: g.status })
  if (!UUID.test(id)) return NextResponse.json({ galat: 'ID tidak valid.' }, { status: 400 })
  const { error } = await g.sesi.supabase.from('bot_percakapan').delete().eq('id', id)
  if (error) return NextResponse.json({ galat: 'Gagal menghapus.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
