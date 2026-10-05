import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sesiSukaBot } from '@/lib/sukaBot/server/sesi'
import { headerCors } from '@/lib/sukaBot/server/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: headerCors(req.headers.get('origin')) })
}

export async function GET(req: Request) {
  const cors = headerCors(req.headers.get('origin'))
  const sesi = await sesiSukaBot()
  if (!sesi) return NextResponse.json({ galat: 'Khusus admin, owner, developer' }, { status: 401, headers: cors })
  const id = new URL(req.url).searchParams.get('id')
  if (id) {
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ galat: 'id tidak valid' }, { status: 400, headers: cors })
    const { data } = await sesi.supabase.from('suka_bot_pesan').select('peran, isi, dibuat_at').eq('percakapan_id', id).order('dibuat_at')
    return NextResponse.json({ pesan: data ?? [] }, { headers: cors })
  }
  const { data } = await sesi.supabase.from('suka_bot_percakapan').select('id, judul, diperbarui_at').order('diperbarui_at', { ascending: false }).limit(20)
  return NextResponse.json({ percakapan: data ?? [] }, { headers: cors })
}
