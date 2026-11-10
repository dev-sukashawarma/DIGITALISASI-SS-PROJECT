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
  hitungPesanSejamTerakhir,
  buatPercakapan,
  ambilPercakapan,
  pangkasPercakapan,
  simpanPesan,
  sentuhPercakapan,
} from '@/lib/server/percakapan'
import { buatJawabanDev } from '@/lib/server/devSimulasi'
import { ambilTelemetriNyata } from '@/lib/server/telemetriNyata'
import { tanyaAiRouter, apakahPesanHanyaSapaan } from '@/lib/server/aiRouter'
import { ambilKonfigurasiVoiceServer } from '@/lib/server/voiceConfig'

export const dynamic = 'force-dynamic'
export const maxDuration = 150

const UUID = /^[0-9a-f-]{36}$/i
const galat = (status: number, pesan: string) => NextResponse.json({ galat: pesan }, { status })

export async function POST(req: Request) {
  const tReqMulai = Date.now()
  const g = await ambilSesi()
  if (!g.ok) return galat(g.status, g.status === 401 ? 'Silakan login dulu.' : 'Anda tidak punya akses ke bot ini.')
  const durAuth = Date.now() - tReqMulai
  const { supabase, role } = g.sesi

  const body = await req.json().catch(() => ({}))
  const v = validasiPesan(body?.pesan)
  if (!v.ok) return galat(400, v.galat)
  const modeSuara = Boolean(body?.modeSuara)
  const adalahSapaan = apakahPesanHanyaSapaan(v.pesan)
  const idDiminta = typeof body?.percakapanId === 'string' && UUID.test(body.percakapanId) ? body.percakapanId : null

  // Mulai pre-fetch konfigurasi & telemetri paralel sejak milidetik pertama!
  // Khusus sapaan ringan ("Halo Jarvis apa kabar"), beri batas tunggu 60ms (ambil instan bila cache hangat, panaskan di latar belakang bila dingin).
  const promiseVoiceCfg = ambilKonfigurasiVoiceServer().catch(() => null)
  const promiseTelemetriAwal = adalahSapaan
    ? Promise.race([
        ambilTelemetriNyata().catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 60)),
      ])
    : modeSuara
    ? ambilTelemetriNyata().catch(() => null)
    : null

  const [percakapanAwal, jumlahPesanSejam, hasilDbPesan] = await Promise.all([
    idDiminta ? ambilPercakapan(supabase, idDiminta) : Promise.resolve(null),
    hitungPesanSejamTerakhir(supabase),
    idDiminta
      ? Promise.resolve(
          supabase
            .from('bot_pesan')
            .select('peran, isi')
            .eq('percakapan_id', idDiminta)
            .order('dibuat_at', { ascending: false })
            .limit(modeSuara ? 4 : 10)
        ).catch(() => ({ data: null }))
      : Promise.resolve({ data: null }),
  ])

  let percakapan = percakapanAwal
  if (idDiminta && !percakapan) return galat(404, 'Percakapan tidak ditemukan.')

  const izin = periksaProfilChat(body?.profil, role, percakapan?.profil ?? null)
  if (!izin.ok) {
    const pesanIzin = { 400: 'Bot tidak dikenal.', 403: 'Anda tidak punya akses ke bot ini.', 409: 'Percakapan ini milik bot lain.' }
    return galat(izin.status, pesanIzin[izin.status])
  }
  const profil = izin.profil

  if (jumlahPesanSejam >= BATAS.pesanPerJam) {
    return galat(429, `Batas ${BATAS.pesanPerJam} pesan per jam tercapai. Coba lagi nanti.`)
  }

  let riwayatPesan: Array<{ role: 'user' | 'assistant'; content: string }> = []
  if (percakapan && percakapan.id && hasilDbPesan?.data) {
    riwayatPesan = (hasilDbPesan.data || [])
      .reverse()
      .filter((r: any) => r.isi && r.isi.trim())
      .map((r: any) => ({
        role: (r.peran === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: modeSuara && r.isi.length > 380 ? r.isi.slice(0, 380) + '...' : r.isi,
      }))
  }

  if (!percakapan) {
    const baru = await buatPercakapan(supabase, profil, v.pesan)
    percakapan = { ...baru, profil }
    void pangkasPercakapan(supabase).catch(() => {})
  }

  const pc = percakapan
  // Jalankan penyimpanan pesan user secara paralel tanpa menahan pembukaan stream ke AI Router!
  const promiseSimpanUser = Promise.resolve(simpanPesan(supabase, pc.id, 'user', v.pesan)).catch((e) =>
    console.error('[bot] gagal simpan pesan user:', e)
  )

  const baseUrl = process.env.HERMES_API_URL
  const kunci = kunciProfil(pc.profil)
  const mulai = Date.now()
  const durPre = mulai - tReqMulai
  const enc = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      let jawaban = ''
      let modelTerpakai = ''
      let ttftMs = -1
      let streamDitutup = false
      const tutupStreamSegera = () => {
        if (streamDitutup) return
        streamDitutup = true
        try {
          c.close()
        } catch {}
      }

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
              if (ttftMs < 0 && t) ttftMs = Date.now() - mulai
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
                modelTerpakai = `hermes:${pc.profil}`
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
          const [telemetri, voiceCfg] = await Promise.all([
            promiseTelemetriAwal
              ? promiseTelemetriAwal
              : adalahSapaan
              ? Promise.race([
                  ambilTelemetriNyata().catch(() => null),
                  new Promise<null>((resolve) => setTimeout(() => resolve(null), 60)),
                ])
              : ambilTelemetriNyata(),
            promiseVoiceCfg,
          ])

          // Gunakan AI Router (9Router) dengan konfigurasi terpusat dari Supabase jarvis_voice_config / env
          let suksesAi = false
          const isTestEnv = process.env.NODE_ENV === 'test'
          const aiBaseUrl = process.env.AI_BASE_URL || (!isTestEnv ? voiceCfg?.aiBaseUrl : undefined)
          const aiApiKey = process.env.AI_API_KEY || (!isTestEnv ? voiceCfg?.aiApiKey : undefined)
          if (aiBaseUrl && aiApiKey) {
            try {
              for await (const t of tanyaAiRouter({
                pesan: v.pesan,
                profil: pc.profil,
                telemetri,
                riwayat: riwayatPesan,
                signal: req.signal,
                modeSuara,
                baseUrl: aiBaseUrl,
                apiKey: aiApiKey,
                onModelTerpilih: (m) => {
                  modelTerpakai = m
                },
              })) {
                if (ttftMs < 0 && t) ttftMs = Date.now() - mulai
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
            modelTerpakai = 'dev-fallback'
            const devChunks = buatJawabanDev(v.pesan, pc.profil, telemetri)
            for (const chunk of devChunks) {
              if (ttftMs < 0 && chunk) ttftMs = Date.now() - mulai
              jawaban += chunk
              c.enqueue(enc.encode(chunk))
              await new Promise((r) => setTimeout(r, 20))
            }
          }
        }

        const durasiMs = Date.now() - mulai
        // Tutup stream SEGERA agar klien langsung mengeksekusi kalimat terakhir TTS tanpa menunggu penulisan DB!
        tutupStreamSegera()

        void (async () => {
          await promiseSimpanUser
          await Promise.all([
            simpanPesan(supabase, pc.id, 'bot', jawaban, {
              durasi_ms: durasiMs,
              ...(ttftMs >= 0 ? { ttft_ms: ttftMs } : {}),
              ...(modelTerpakai ? { model: modelTerpakai } : {}),
              status: 'ok',
            }).catch((e2) => console.error('[bot] gagal simpan jawaban bot:', e2)),
            sentuhPercakapan(supabase, pc.id).catch(() => {}),
          ])
        })()
        return
      } catch (e) {
        const alasan = e instanceof GalatHermes ? e.alasan : 'lain'
        console.error('[bot] Chat handler error:', alasan, (e as Error)?.message)
        let teksGalat = GALAT_STANDAR
        if (process.env.NODE_ENV === 'development' && (alasan === 'jaringan' || alasan === 'timeout')) {
          teksGalat = `[Local Dev] Tidak dapat terhubung ke Hermes di ${baseUrl}. Server Hermes aktif di produksi (agents.sukashawarma.com).`
        }
        const durasiMs = Date.now() - mulai
        if (!req.signal.aborted) {
          const teks = jawaban ? `\n\n${teksGalat}` : teksGalat
          try {
            c.enqueue(enc.encode(teks))
          } catch {}
          tutupStreamSegera()
          void (async () => {
            await promiseSimpanUser
            await Promise.all([
              simpanPesan(supabase, pc.id, 'bot', jawaban + teks, {
                durasi_ms: durasiMs,
                status: 'galat',
                alasan,
              }).catch((e2) => console.error('[bot] gagal simpan galat:', e2)),
              sentuhPercakapan(supabase, pc.id).catch(() => {}),
            ])
          })()
          return
        }
        tutupStreamSegera()
        void sentuhPercakapan(supabase, pc.id).catch(() => {})
      } finally {
        tutupStreamSegera()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Percakapan-Id': pc.id,
      'Server-Timing': `auth;dur=${durAuth}, pre;dur=${durPre}`,
    },
  })
}
