import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jakartaDate } from '@/lib/ownerDashboardCache'
import { sesiSukaBot } from '@/lib/sukaBot/server/sesi'
import { headerCors, originDiizinkan } from '@/lib/sukaBot/server/cors'
import { ambilOutlets, konteksPenjualan, konteksStok } from '@/lib/sukaBot/server/sumberData'
import { jalankanAlat } from '@/lib/sukaBot/alat/registry'
import { buatPanggilLLM } from '@/lib/sukaBot/llm'
import { buatPromptSistem } from '@/lib/sukaBot/prompt'
import { jalankanAgen } from '@/lib/sukaBot/agen'
import { susunRiwayat, type BarisPesan } from '@/lib/sukaBot/riwayat'
import { tanggalRekapUntuk } from '@/lib/sukaBot/rekap'

export const dynamic = 'force-dynamic'

const BODY = z.object({ percakapanId: z.string().uuid().optional(), pesan: z.string().trim().min(1).max(1000) })
const RIWAYAT_MAKS = 20

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: headerCors(req.headers.get('origin')) })
}

/** Percakapan hanya berlanjut di hari yang sama (WIB): besok mulai baru dengan rekap baru. */
async function percakapanHariIni(supabase: any, id: string | undefined, hariIni: string): Promise<string | undefined> {
  if (!id) return undefined
  const { data } = await supabase.from('suka_bot_percakapan').select('id, dibuat_at').eq('id', id).maybeSingle()
  return data && jakartaDate(data.dibuat_at) === hariIni ? (data.id as string) : undefined
}

/** Percakapan baru dibuka dengan rekap terakhir sebagai pesan pertama, supaya AI tahu apa yang dilihat Bos. */
async function buatPercakapan(supabase: any, pesan: string, sekarang: Date): Promise<string | null> {
  const { data, error } = await supabase.from('suka_bot_percakapan').insert({ judul: pesan.slice(0, 60) }).select('id').single()
  if (error) return null
  const { data: rekap } = await supabase
    .from('suka_bot_rekap').select('id, tanggal, teks').eq('tanggal', tanggalRekapUntuk(sekarang))
    .order('versi', { ascending: false }).limit(1).maybeSingle()
  if (rekap) {
    await supabase.from('suka_bot_pesan').insert({
      percakapan_id: data.id, peran: 'assistant', isi: rekap.teks,
      meta: { jenis: 'rekap', rekap_id: rekap.id, tanggal: rekap.tanggal },
    })
  }
  return data.id as string
}

async function ambilRiwayat(supabase: any, percakapanId: string): Promise<BarisPesan[]> {
  const { data: terbaru } = await supabase
    .from('suka_bot_pesan').select('id, peran, isi, meta').eq('percakapan_id', percakapanId)
    .order('dibuat_at', { ascending: false }).limit(RIWAYAT_MAKS)
  const baris = (terbaru ?? []).reverse()
  // Rekap selalu ikut walau percakapan sudah lebih panjang dari jendela riwayat.
  if (!baris.some((b: any) => b.meta?.jenis === 'rekap')) {
    const { data: rekap } = await supabase
      .from('suka_bot_pesan').select('id, peran, isi, meta').eq('percakapan_id', percakapanId)
      .eq('meta->>jenis', 'rekap').limit(1).maybeSingle()
    if (rekap) baris.unshift(rekap)
  }
  return baris
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin')
  const cors = headerCors(origin)
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: cors })

  // Tolak POST lintas-origin yang tidak diizinkan (CORS saja tidak mencegah request terkirim).
  if (origin && !originDiizinkan(origin) && origin !== new URL(req.url).origin) return json({ galat: 'Origin tidak diizinkan' }, 403)

  const sesi = await sesiSukaBot()
  if (!sesi) return json({ galat: 'Khusus admin, owner, developer' }, 401)
  const { supabase, userId, nama } = sesi

  const parsed = BODY.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return json({ galat: 'Pesan tidak valid' }, 400)
  const { pesan } = parsed.data

  const sekarang = new Date()
  const hariIni = jakartaDate(sekarang)
  const batas = Number(process.env.SUKA_BOT_BATAS_HARIAN) || 100
  const { data: pakai } = await supabase.from('suka_bot_pemakaian').select('jumlah_pertanyaan').eq('user_id', userId).eq('tanggal', hariIni).maybeSingle()
  if ((pakai?.jumlah_pertanyaan ?? 0) >= batas) return json({ galat: `Batas ${batas} pertanyaan per hari sudah tercapai, Bos. Lanjut besok ya.` }, 429)

  let percakapanId = await percakapanHariIni(supabase, parsed.data.percakapanId, hariIni)
  if (!percakapanId) {
    const baru = await buatPercakapan(supabase, pesan, sekarang)
    if (!baru) return json({ galat: 'Gagal membuat percakapan' }, 500)
    percakapanId = baru
  }

  const baris = await ambilRiwayat(supabase, percakapanId)
  const tanggalRekap = (baris.find((b) => b.meta?.jenis === 'rekap')?.meta as any)?.tanggal ?? null

  await supabase.from('suka_bot_pesan').insert({ percakapan_id: percakapanId, peran: 'user', isi: pesan })

  try {
    const outlets = await ambilOutlets(supabase)
    const deps = {
      penjualan: konteksPenjualan(outlets, hariIni, sekarang),
      stok: konteksStok(supabase, outlets, hariIni),
      catatGagal: async (alasan: string) => { await supabase.from('suka_bot_gagal').insert({ pertanyaan: pesan, alasan }) },
    }
    const hasil = await jalankanAgen({
      sistem: buatPromptSistem({ hariIni, sekarang, namaPengguna: nama, outlets, tanggalRekap }),
      riwayat: susunRiwayat(baris),
      pertanyaan: pesan,
      panggilLLM: buatPanggilLLM(),
      jalankan: (n, a) => jalankanAlat(n, a, deps),
    })
    if (hasil.habisPutaran) await deps.catatGagal('habis_putaran')
    await supabase.from('suka_bot_pesan').insert({
      percakapan_id: percakapanId, peran: 'assistant', isi: hasil.jawaban,
      meta: { alat: hasil.alatDipakai, jejak: hasil.jejak },
    })
    await supabase.from('suka_bot_percakapan').update({ diperbarui_at: new Date().toISOString() }).eq('id', percakapanId)
    await supabase.rpc('suka_bot_catat_pemakaian', { p_token_masuk: hasil.tokenMasuk, p_token_keluar: hasil.tokenKeluar })
    return json({ percakapanId, jawaban: hasil.jawaban })
  } catch (e: any) {
    console.error('[suka-bot] chat gagal:', e?.message)
    await supabase.from('suka_bot_gagal').insert({ pertanyaan: pesan, alasan: `galat_sistem: ${String(e?.message).slice(0, 200)}` })
    return json({ galat: 'SUKA Bot sedang tidak tersedia, coba lagi sebentar ya Bos.' }, 503)
  }
}
