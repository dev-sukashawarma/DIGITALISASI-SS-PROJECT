import { buatPengurai } from '@/lib/hermes'
import { ambilTokenBotTelegram } from '@/lib/server/telegram'
import { ambilKonfigurasiVoiceServer } from '@/lib/server/voiceConfig'

const MODEL_AUDIO_STT_TELEGRAM = [
  'ag/gemini-3.8-flash',
  'ag/gemini-3.8-flash-low',
  'ag/gemini-3.8-flash-high',
  'CEO_SS',
  'MANAGER_SS',
  'hermes-combo',
]

const PROMPT_TRANSKRIPSI_TELEGRAM = `Transkripsikan pesan suara (Voice Note Telegram) Bahasa Indonesia ini menjadi teks kalimat perintah/pertanyaan secara akurat.
Konteks kosakata bisnis Suka Shawarma: Jarvis, laporan daily, daily briefing, omzet, penjualan, cabang, outlet, kemarin, hari ini, waste, bahan baku, void, kasir, OPEX, pengeluaran, utang PO, supplier, setoran kas, selisih, presensi, absen, kru telat, cuti, izin, Google Review, ulasan.
ATURAN OUTPUT:
1. Tuliskan HANYA kalimat hasil transkripsi suara pengguna tanpa tanda kutip, tanpa timestamp, dan tanpa komentar tambahan.
2. Jika audio hanya berisi keheningan, napas, atau noise tanpa ucapan manusia yang jelas, balas tepat satu kata: [HENING]`

function deteksiFormatVoiceTelegram(filePath: string, mimeType?: string): string {
  const gabungan = `${filePath || ''} ${mimeType || ''}`.toLowerCase()
  if (gabungan.includes('mp4') || gabungan.includes('m4a')) return 'mp4'
  if (gabungan.includes('aac')) return 'aac'
  if (gabungan.includes('mp3') || gabungan.includes('mpeg')) return 'mp3'
  if (gabungan.includes('wav')) return 'wav'
  if (gabungan.includes('webm')) return 'webm'
  return 'ogg'
}

export async function transkripsiVoiceTelegram(
  fileId: string,
  profil: 'stokis' | 'hrd' | 'manager' | 'ceo' | 'finance' | 'review' = 'ceo',
  mimeType?: string
): Promise<{ ok: true; teks: string } | { ok: false; galat: string }> {
  try {
    const token =
      (await ambilTokenBotTelegram(profil)) ||
      (profil === 'ceo' || profil === 'finance'
        ? process.env.TELEGRAM_MANAGER_BOT_TOKEN || process.env.TELEGRAM_STOKIST_BOT_TOKEN
        : undefined)

    if (!token) {
      return { ok: false, galat: `Token bot Telegram (${profil}) belum dikonfigurasi.` }
    }

    const resFile = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(7_000) }
    )
    const jsonFile = (await resFile.json().catch(() => null)) as {
      ok?: boolean
      result?: { file_path?: string; file_size?: number }
    } | null

    const filePath = jsonFile?.result?.file_path
    if (!resFile.ok || !jsonFile?.ok || !filePath) {
      return { ok: false, galat: 'Gagal mengambil metadata file suara dari Telegram.' }
    }

    const resAudio = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
    if (!resAudio.ok) {
      return { ok: false, galat: 'Gagal mengunduh file suara dari server Telegram.' }
    }

    const arrBuf = await resAudio.arrayBuffer()
    if (arrBuf.byteLength < 100 || arrBuf.byteLength > 12 * 1024 * 1024) {
      return { ok: false, galat: 'Ukuran pesan suara tidak valid atau terlalu panjang.' }
    }

    const audioBase64 = Buffer.from(arrBuf).toString('base64')
    const format = deteksiFormatVoiceTelegram(filePath, mimeType)

    const cfg = await ambilKonfigurasiVoiceServer()
    if (!cfg.aiBaseUrl || !cfg.aiApiKey) {
      return { ok: false, galat: 'AI Audio Gateway belum dikonfigurasi.' }
    }

    for (const model of MODEL_AUDIO_STT_TELEGRAM) {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 14_000)
      try {
        const res = await fetch(`${cfg.aiBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.aiApiKey}`,
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
                  { type: 'text', text: PROMPT_TRANSKRIPSI_TELEGRAM },
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

        clearTimeout(timer)
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
            for (const d of pengurai.masukkan(chunk)) {
              if (d) hasilMentah += d
            }
            if (pengurai.selesai) break
          }
        } finally {
          pembaca.releaseLock()
        }

        const bersih = hasilMentah
          .replace(/\[HENING\]/gi, '')
          .replace(/\bHENING\b/g, '')
          .replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, '')
          .replace(/^["'“”]+|["'“”]+$/g, '')
          .replace(/\s+/g, ' ')
          .trim()

        return { ok: true, teks: bersih }
      } catch {
        clearTimeout(timer)
      }
    }

    return { ok: false, galat: 'Gagal mentranskripsikan pesan suara.' }
  } catch (err) {
    return { ok: false, galat: (err as Error)?.message || 'Kesalahan pemrosesan suara Telegram.' }
  }
}
