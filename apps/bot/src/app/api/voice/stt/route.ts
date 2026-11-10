import { NextResponse } from 'next/server'
import { buatPengurai } from '@/lib/hermes'
import { ambilKonfigurasiVoiceServer } from '@/lib/server/voiceConfig'

export const dynamic = 'force-dynamic'

const MODEL_AUDIO_STT = ['ag/gemini-3.8-flash', 'ag/gemini-3.8-flash-low', 'ag/gemini-3.8-flash-high', 'CEO_SS', 'MANAGER_SS', 'hermes-combo']

const PROMPT_TRANSKRIPSI = `Transkripsikan ucapan suara Bahasa Indonesia pada audio ini menjadi teks kalimat perintah/pertanyaan secara akurat.
Konteks kosakata bisnis Suka Shawarma: Jarvis, laporan daily, daily briefing, omzet, penjualan, cabang, outlet, kemarin, hari ini, waste, bahan baku, void, kasir, OPEX, pengeluaran, utang PO, supplier, setoran kas, selisih, presensi, absen, kru telat, cuti, izin, Google Review, ulasan, kirim ke Telegram.
ATURAN OUTPUT:
1. Tuliskan HANYA kalimat hasil transkripsi suara pengguna tanpa tanda kutip, tanpa timestamp, dan tanpa komentar tambahan.
2. Jika audio hanya berisi keheningan, napas, atau noise tanpa ucapan manusia yang jelas, balas tepat satu kata: [HENING]`

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
      let timer: NodeJS.Timeout | null = setTimeout(() => ctrl.abort(), 14_000)
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
            temperature: 0.1,
            reasoning_effort: 'low',
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

        // Bersihkan artefak timestamp seperti "00:00" atau "[HENING]"
        const bersih = hasilMentah
          .replace(/\[HENING\]/gi, '')
          .replace(/\bHENING\b/g, '')
          .replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, '')
          .replace(/^["'“”]+|["'“”]+$/g, '')
          .replace(/\s+/g, ' ')
          .trim()

        return NextResponse.json({
          ok: true,
          teks: bersih,
          model,
        })
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
