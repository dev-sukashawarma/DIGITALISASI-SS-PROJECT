import { NextResponse } from 'next/server'
import { ambilSesi } from '@/lib/server/sesi'
import { validasiPesan, BATAS, GALAT_STANDAR } from '@/lib/batas'
import {
  tanyaHermes,
  kunciProfil,
  GalatHermes,
  apakahHermesSehat,
  catatHermesGagal,
  catatHermesSukses,
  HERMES_INTERACTIVE_TIMEOUT_MS,
} from '@/lib/hermes'
import { periksaProfilChat } from '@/lib/server/izinChat'
import {
  hitungPesanSejamTerakhir, buatPercakapan, ambilPercakapan, pangkasPercakapan, simpanPesan, sentuhPercakapan,
} from '@/lib/server/percakapan'
import { buatJawabanDev } from '@/lib/server/devSimulasi'
import { ambilTelemetriNyata } from '@/lib/server/telemetriNyata'
import { tanyaAiRouter } from '@/lib/server/aiRouter'
import { ambilKonfigurasiVoiceServer } from '@/lib/server/voiceConfig'

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
  const modeSuara = Boolean(body?.modeSuara)
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

  let riwayatPesan: Array<{ role: 'user' | 'assistant'; content: string }> = []
  if (percakapan && percakapan.id) {
    const { data: dbPesan } = await supabase
      .from('bot_pesan')
      .select('peran, isi')
      .eq('percakapan_id', percakapan.id)
      .order('dibuat_at', { ascending: false })
      .limit(10)

    riwayatPesan = (dbPesan || [])
      .reverse()
      .filter((r: any) => r.isi && r.isi.trim())
      .map((r: any) => ({
        role: (r.peran === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: r.isi,
      }))
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
        let suksesHermes = false
        // Pada modeSuara (Voice-to-Voice real-time), langsung gunakan jalur cepat AI Router + Telemetri agar tidak tertahan timeout Hermes 4 detik!
        if (!modeSuara && baseUrl && kunci && apakahHermesSehat(pc.profil)) {
          try {
            for await (const t of tanyaHermes({
              baseUrl,
              kunci,
              profil: pc.profil,
              sesiId: pc.hermes_session_id,
              pesan: v.pesan,
              signal: req.signal,
              timeoutMs: HERMES_INTERACTIVE_TIMEOUT_MS,
            })) {
              jawaban += t
              c.enqueue(enc.encode(t))
            }
            if (jawaban.trim()) {
              const textLower = jawaban.toLowerCase()
              const kendalaHermes =
                textLower.includes('provider authentication failed') ||
                textLower.includes('not connected to any ai provider') ||
                textLower.includes('belum memiliki endpoint') ||
                textLower.includes('belum memiliki tool mcp') ||
                textLower.includes('alat mcp belum tersambung')

              if (!kendalaHermes) {
                suksesHermes = true
                catatHermesSukses(pc.profil)
              } else {
                console.warn('[bot] Hermes menghasilkan kendala provider/tool saat streaming:', textLower)
                catatHermesGagal(pc.profil)
              }
            }
          } catch (hermesErr) {
            console.warn('[bot] Hermes gagal atau timeout, beralih ke fallback AI Router / telemetri:', hermesErr)
            catatHermesGagal(pc.profil)
          }
        } else if (baseUrl && kunci && !apakahHermesSehat(pc.profil)) {
          console.warn(`[bot] Hermes ${pc.profil} dalam cooldown circuit breaker, langsung gunakan AI Router.`)
        }

        if (!suksesHermes || !jawaban.trim()) {
          // Reset jawaban bila sebelumnya ada kendala Hermes agar tidak tercampur
          if (!suksesHermes) jawaban = ''
          const telemetri = await ambilTelemetriNyata()

          // Gunakan AI Router (9Router) dengan konfigurasi terpusat dari Supabase jarvis_voice_config / env
          let suksesAi = false
          const voiceCfg = await ambilKonfigurasiVoiceServer().catch(() => null)
          if (!process.env.AI_BASE_URL && voiceCfg?.aiBaseUrl) process.env.AI_BASE_URL = voiceCfg.aiBaseUrl
          if (!process.env.AI_API_KEY && voiceCfg?.aiApiKey) process.env.AI_API_KEY = voiceCfg.aiApiKey
          if (!process.env.AI_BASE_URL) process.env.AI_BASE_URL = 'http://76.13.193.138:20128/v1'
          if (!process.env.AI_API_KEY) process.env.AI_API_KEY = 'sk-09f612c52578948f-zfpefg-d18a0fd3'
          if (process.env.AI_BASE_URL && process.env.AI_API_KEY) {
            try {
              for await (const t of tanyaAiRouter({
                pesan: v.pesan,
                profil: pc.profil,
                telemetri,
                riwayat: riwayatPesan,
                signal: req.signal,
                modeSuara,
              })) {
                jawaban += t
                c.enqueue(enc.encode(t))
                suksesAi = true
              }
            } catch (aiErr) {
              console.warn('[bot] AI Router gagal, fallback ke template telemetri:', aiErr)
            }
          }

          // Fallback ke generator telemetri terstruktur jika AI Router belum siap atau gagal
          if (!suksesAi || !jawaban.trim()) {
            console.warn('[bot] AI Router tidak menghasilkan respon, mengalirkan fallback telemetri terstruktur...')
            const devChunks = buatJawabanDev(v.pesan, pc.profil, telemetri)
            for (const chunk of devChunks) {
              jawaban += chunk
              c.enqueue(enc.encode(chunk))
              await new Promise((r) => setTimeout(r, 20))
            }
          }
        }

        await simpanPesan(supabase, pc.id, 'bot', jawaban, { durasi_ms: Date.now() - mulai, status: 'ok' })
        return
      } catch (e) {
        const alasan = e instanceof GalatHermes ? e.alasan : 'lain'
        console.error('[bot] Chat handler error:', alasan, (e as Error)?.message)
        let teksGalat = GALAT_STANDAR
        if (process.env.NODE_ENV === 'development' && (alasan === 'jaringan' || alasan === 'timeout')) {
          teksGalat = `[Local Dev] Tidak dapat terhubung ke Hermes di ${baseUrl}. Server Hermes aktif di produksi (agents.sukashawarma.com).`
        }
        if (!req.signal.aborted) {
          const teks = jawaban ? `\n\n${teksGalat}` : teksGalat
          try {
            c.enqueue(enc.encode(teks))
          } catch {}
          await simpanPesan(supabase, pc.id, 'bot', jawaban + teks, { durasi_ms: Date.now() - mulai, status: 'galat', alasan })
            .catch((e2) => console.error('[bot] gagal simpan galat:', e2))
        }
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
