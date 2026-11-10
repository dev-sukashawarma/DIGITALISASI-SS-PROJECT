import { NextResponse } from 'next/server'
import { buatPengurai } from '@/lib/hermes'
import { ambilSesi } from '@/lib/server/sesi'
import { ambilKonfigurasiVoiceServer } from '@/lib/server/voiceConfig'

export const dynamic = 'force-dynamic'

const MODEL_AUDIO_STT = [
  'ag/gemini-3.8-flash-low',
  'ag/gemini-3.8-flash',
  'ag/gemini-3.8-flash-high',
  'CEO_SS',
  'MANAGER_SS',
  'hermes-combo',
]

const PROMPT_TRANSKRIPSI = `Transkripsikan ucapan Bahasa Indonesia ini secara persis tanpa tanda kutip dan tanpa komentar. Kosakata: Jarvis, Suka Shawarma, omzet, cabang, outlet, kemarin, hari ini, waste, bahan, void, kasir, OPEX, setoran, PO, presensi, telat, cuti, izin, review. Jika hening/tanpa ucapan jelas, balas: [HENING]`

function normalisasiFormatAudioStt(rawFormat?: string): string {
  const f = (rawFormat || 'wav').trim().toLowerCase()
  if (f.includes('mp4') || f.includes('m4a') || f.includes('x-m4a')) return 'mp4'
  if (f.includes('aac')) return 'aac'
  if (f.includes('webm')) return 'webm'
  if (f.includes('ogg') || f.includes('opus')) return 'ogg'
  if (f.includes('mp3') || f.includes('mpeg')) return 'mp3'
  return 'wav'
}

export async function POST(req: Request) {
  const tMulai = Date.now()
  const g = await ambilSesi()
  if (!g.ok) {
    return NextResponse.json({ ok: false, galat: 'Tidak punya akses.' }, { status: g.status })
  }
  const durAuth = Date.now() - tMulai

  try {
    const body = (await req.json().catch(() => ({}))) as {
      audioBase64?: string
      format?: string
    }

    const audioBase64 = (body.audioBase64 || '').trim()
    const format = normalisasiFormatAudioStt(body.format)

    if (!audioBase64 || audioBase64.length < 100) {
      return NextResponse.json({ ok: false, galat: 'Data audio kosong atau terlalu pendek.' }, { status: 400 })
    }

    const cfg = await ambilKonfigurasiVoiceServer()
    const base = cfg.aiBaseUrl
    const key = cfg.aiApiKey

    if (!base || !key) {
      return NextResponse.json({ ok: false, galat: 'AI Router belum dikonfigurasi.' }, { status: 503 })
    }

    for (const model of MODEL_AUDIO_STT) {
      const ctrl = new AbortController()
      let timer: NodeJS.Timeout | null = setTimeout(() => ctrl.abort(), 10_000)
      try {
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            model,
            stream: true,
            temperature: 0.0,
            max_tokens: 150,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: PROMPT_TRANSKRIPSI },
                  {
                    type: 'input_audio',
                    input_audio: {
                      data: audioBase64,
                      format,
                    },
                  },
                ],
              },
            ],
          }),
          signal: ctrl.signal,
        })

        if (timer) {
          clearTimeout(timer)
          timer = null
        }

        if (!res.ok || !res.body) continue

        const pengurai = buatPengurai()
        const dekoder = new TextDecoder()
        const pembaca = res.body.getReader()
        let hasilMentah = ''

        try {
          for (;;) {
            const { done, value } = await pembaca.read()
            if (done) break
            const chunk = dekoder.decode(value, { stream: true })
            const deltas = pengurai.masukkan(chunk)
            for (const d of deltas) {
              if (d) hasilMentah += d
            }
            if (pengurai.selesai) break
          }
        } finally {
          pembaca.releaseLock()
        }

        const memangHening = /\[HENING\]|\bHENING\b/i.test(hasilMentah)

        // Bersihkan artefak timestamp seperti "00:00" atau "[HENING]"
        const bersih = hasilMentah
          .replace(/\[HENING\]/gi, '')
          .replace(/\bHENING\b/g, '')
          .replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, '')
          .replace(/^["'“”]+|["'“”]+$/g, '')
          .replace(/\s+/g, ' ')
          .trim()

        // Jika model mengembalikan output kosong TANPA penanda [HENING] (misal gangguan/thinking habis), lanjut coba model berikutnya!
        if (!bersih && !memangHening) {
          continue
        }

        const durTotal = Date.now() - tMulai
        return NextResponse.json(
          {
            ok: true,
            teks: bersih,
            model,
          },
          {
            headers: {
              'Server-Timing': `auth;dur=${durAuth}, total;dur=${durTotal}`,
            },
          }
        )
      } catch {
        if (timer) clearTimeout(timer)
        // Coba kandidat model audio berikutnya
      }
    }

    return NextResponse.json(
      { ok: false, galat: 'Gagal mentranskripsikan suara melalui AI Audio Gateway.' },
      { status: 502 }
    )
  } catch (err) {
    return NextResponse.json(
      { ok: false, galat: (err as Error)?.message || 'Kesalahan server STT.' },
      { status: 500 }
    )
  }
}
