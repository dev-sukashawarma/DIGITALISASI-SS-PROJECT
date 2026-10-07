import { NextResponse } from 'next/server'
import { ambilSesi } from '@/lib/server/sesi'
import { validasiPesan, BATAS, GALAT_STANDAR } from '@/lib/batas'
import { tanyaHermes, kunciProfil, GalatHermes } from '@/lib/hermes'
import { periksaProfilChat } from '@/lib/server/izinChat'
import {
  hitungPesanSejamTerakhir, buatPercakapan, ambilPercakapan, pangkasPercakapan, simpanPesan, sentuhPercakapan,
} from '@/lib/server/percakapan'

export const dynamic = 'force-dynamic'
export const maxDuration = 150

const UUID = /^[0-9a-f-]{36}$/i
const galat = (status: number, pesan: string) => NextResponse.json({ galat: pesan }, { status })

export async function POST(req: Request) {
  const g = await ambilSesi()
  if (!g.ok) return galat(g.status, g.status === 401 ? 'Silakan login dulu.' : 'Anda tidak punya akses ke bot ini.')
  const { supabase, role } = g.sesi

  const body = await req.json().catch(() => ({}))
  const v = validasiPesan(body?.pesan)
  if (!v.ok) return galat(400, v.galat)
  const idDiminta = typeof body?.percakapanId === 'string' && UUID.test(body.percakapanId) ? body.percakapanId : null

  let percakapan = idDiminta ? await ambilPercakapan(supabase, idDiminta) : null
  if (idDiminta && !percakapan) return galat(404, 'Percakapan tidak ditemukan.')

  const izin = periksaProfilChat(body?.profil, role, percakapan?.profil ?? null)
  if (!izin.ok) {
    const pesanIzin = { 400: 'Bot tidak dikenal.', 403: 'Anda tidak punya akses ke bot ini.', 409: 'Percakapan ini milik bot lain.' }
    return galat(izin.status, pesanIzin[izin.status])
  }
  const profil = izin.profil

  if ((await hitungPesanSejamTerakhir(supabase)) >= BATAS.pesanPerJam) {
    return galat(429, `Batas ${BATAS.pesanPerJam} pesan per jam tercapai. Coba lagi nanti.`)
  }

  if (!percakapan) {
    const baru = await buatPercakapan(supabase, profil, v.pesan)
    percakapan = { ...baru, profil }
    await pangkasPercakapan(supabase)
  }
  await simpanPesan(supabase, percakapan.id, 'user', v.pesan)

  const baseUrl = process.env.HERMES_API_URL
  const kunci = kunciProfil(percakapan.profil)
  const mulai = Date.now()
  const enc = new TextEncoder()
  const pc = percakapan

  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      let jawaban = ''
      try {
        if (!baseUrl || !kunci) throw new GalatHermes('konfigurasi', 'HERMES_API_URL / kunci profil kosong')
        for await (const t of tanyaHermes({ baseUrl, kunci, profil: pc.profil, sesiId: pc.hermes_session_id, pesan: v.pesan, signal: req.signal })) {
          jawaban += t
          c.enqueue(enc.encode(t))
        }
        await simpanPesan(supabase, pc.id, 'bot', jawaban, { durasi_ms: Date.now() - mulai, status: 'ok' })
      } catch (e) {
        const alasan = e instanceof GalatHermes ? e.alasan : 'lain'
        console.error('[bot] Hermes gagal:', alasan, (e as Error)?.message)
        const teks = jawaban ? `\n\n${GALAT_STANDAR}` : GALAT_STANDAR
        c.enqueue(enc.encode(teks))
        await simpanPesan(supabase, pc.id, 'bot', jawaban + teks, { durasi_ms: Date.now() - mulai, status: 'galat', alasan })
          .catch((e2) => console.error('[bot] gagal simpan galat:', e2))
      } finally {
        await sentuhPercakapan(supabase, pc.id).catch(() => {})
        c.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Percakapan-Id': pc.id },
  })
}
