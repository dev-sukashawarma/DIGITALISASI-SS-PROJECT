import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jakartaDate, isDateStr } from '@/lib/ownerDashboardCache'
import { sesiSukaBot } from '@/lib/sukaBot/server/sesi'
import { headerCors, originDiizinkan } from '@/lib/sukaBot/server/cors'
import { ambilOutlets, konteksPenjualan } from '@/lib/sukaBot/server/sumberData'
import { hitungRekap, teksRekap, tanggalRekapUntuk } from '@/lib/sukaBot/rekap'

export const dynamic = 'force-dynamic'

const KOLOM = 'id, tanggal, versi, teks, dibuat_at'

async function terbaru(supabase: any, tanggal: string) {
  const { data } = await supabase.from('suka_bot_rekap').select(KOLOM).eq('tanggal', tanggal).order('versi', { ascending: false }).limit(1).maybeSingle()
  return data
}

async function buatVersi(supabase: any, userId: string, tanggal: string, versi: number) {
  const sekarang = new Date()
  const outlets = await ambilOutlets(supabase)
  const data = await hitungRekap(konteksPenjualan(outlets, jakartaDate(sekarang), sekarang), tanggal)
  // Dua pembuka bersamaan: unique (tanggal, versi) memastikan hanya satu yang tersimpan.
  await supabase.from('suka_bot_rekap').insert({ tanggal, versi, data, teks: teksRekap(data), dibuat_oleh: userId })
  return terbaru(supabase, tanggal)
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: headerCors(req.headers.get('origin')) })
}

export async function GET(req: Request) {
  const cors = headerCors(req.headers.get('origin'))
  const sesi = await sesiSukaBot()
  if (!sesi) return NextResponse.json({ galat: 'Khusus admin, owner, developer' }, { status: 401, headers: cors })
  try {
    const tanggal = tanggalRekapUntuk(new Date())
    const ada = await terbaru(sesi.supabase, tanggal)
    const rekap = ada ?? (await buatVersi(sesi.supabase, sesi.userId, tanggal, 1))
    return NextResponse.json({ rekap }, { headers: cors })
  } catch (e: any) {
    console.error('[suka-bot] rekap gagal:', e?.message)
    return NextResponse.json({ galat: 'Rekap belum bisa dibuat, coba lagi sebentar.' }, { status: 503, headers: cors })
  }
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin')
  const cors = headerCors(origin)
  if (origin && !originDiizinkan(origin) && origin !== new URL(req.url).origin) return NextResponse.json({ galat: 'Origin tidak diizinkan' }, { status: 403, headers: cors })
  const sesi = await sesiSukaBot()
  if (!sesi) return NextResponse.json({ galat: 'Khusus admin, owner, developer' }, { status: 401, headers: cors })
  const parsed = z.object({ tanggal: z.string() }).safeParse(await req.json().catch(() => null))
  const hariIni = jakartaDate(new Date())
  if (!parsed.success || !isDateStr(parsed.data.tanggal) || parsed.data.tanggal >= hariIni) {
    return NextResponse.json({ galat: 'Tanggal rekap tidak valid' }, { status: 400, headers: cors })
  }
  try {
    const ada = await terbaru(sesi.supabase, parsed.data.tanggal)
    const rekap = await buatVersi(sesi.supabase, sesi.userId, parsed.data.tanggal, (ada?.versi ?? 0) + 1)
    return NextResponse.json({ rekap }, { headers: cors })
  } catch (e: any) {
    console.error('[suka-bot] perbarui rekap gagal:', e?.message)
    return NextResponse.json({ galat: 'Rekap belum bisa diperbarui.' }, { status: 503, headers: cors })
  }
}
