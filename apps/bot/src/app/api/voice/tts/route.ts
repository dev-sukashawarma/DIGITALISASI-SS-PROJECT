import https from 'node:https'
import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { ambilSesi } from '@/lib/server/sesi'

export const dynamic = 'force-dynamic'

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const EDGE_VERSION = '1-132.0.2957.140'

export interface OpsiSuaraJarvis {
  id: string
  label: string
  deskripsi: string
  gender: 'Pria' | 'Wanita'
  voiceName: string
  geminiVoice: string
  pitch: string
  rate: string
}

export const GEMINI_TTS_MODELS = [
  'gemini-3.8-flash-tts',
  'gemini-3.8-flash-lite-tts',
  'gemini-2.5-flash-preview-tts',
] as const

export const DAFTAR_SUARA_JARVIS: OpsiSuaraJarvis[] = [
  {
    id: 'brian',
    label: 'BRIAN / PUCK HD (Jarvis Conversational)',
    deskripsi: 'Suara AI Pria Bariton Luwes & Natural (Gemini Puck / Brian HD)',
    gender: 'Pria',
    voiceName: 'en-US-BrianMultilingualNeural',
    geminiVoice: 'Puck',
    pitch: '-2Hz',
    rate: '+3%',
  },
  {
    id: 'andrew',
    label: 'ANDREW / CHARON HD (Warm Executive)',
    deskripsi: 'Suara AI Pria Hangat, Santai & Mengalir (Gemini Charon / Andrew HD)',
    gender: 'Pria',
    voiceName: 'en-US-AndrewMultilingualNeural',
    geminiVoice: 'Charon',
    pitch: '-1Hz',
    rate: '+4%',
  },
  {
    id: 'william',
    label: 'WILLIAM / ORUS HD (Aksen Jarvis Klasik)',
    deskripsi: 'Suara AI Pria Elegan ala Butler J.A.R.V.I.S. (Gemini Orus / William HD)',
    gender: 'Pria',
    voiceName: 'en-AU-WilliamMultilingualNeural',
    geminiVoice: 'Orus',
    pitch: '-2Hz',
    rate: '+4%',
  },
  {
    id: 'florian',
    label: 'FLORIAN / FENRIR HD (Deep Commander)',
    deskripsi: 'Suara AI Pria Berat & Berwibawa (Gemini Fenrir / Florian HD)',
    gender: 'Pria',
    voiceName: 'de-DE-FlorianMultilingualNeural',
    geminiVoice: 'Fenrir',
    pitch: '-2Hz',
    rate: '+4%',
  },
  {
    id: 'remy',
    label: 'REMY / IAPETUS HD (Smooth Analyst)',
    deskripsi: 'Suara AI Pria Halus & Tenang (Gemini Iapetus / Remy HD)',
    gender: 'Pria',
    voiceName: 'fr-FR-RemyMultilingualNeural',
    geminiVoice: 'Iapetus',
    pitch: '-1Hz',
    rate: '+4%',
  },
  {
    id: 'ava',
    label: 'F.R.I.D.A.Y. / KORE HD (Wanita AI)',
    deskripsi: 'Suara AI Wanita Luwes & Ekspresif (Gemini Kore / Ava HD)',
    gender: 'Wanita',
    voiceName: 'en-US-AvaMultilingualNeural',
    geminiVoice: 'Kore',
    pitch: '+0Hz',
    rate: '+4%',
  },
  {
    id: 'emma',
    label: 'EMMA / AOEDE HD (Wanita Hangat)',
    deskripsi: 'Suara AI Wanita Lembut & Natural (Gemini Aoede / Emma HD)',
    gender: 'Wanita',
    voiceName: 'en-US-EmmaMultilingualNeural',
    geminiVoice: 'Aoede',
    pitch: '+0Hz',
    rate: '+4%',
  },
  {
    id: 'ardi',
    label: 'ARDI / ENCELADUS (Pria Indonesia)',
    deskripsi: 'Suara Pria Indonesia Formal & Tegas',
    gender: 'Pria',
    voiceName: 'id-ID-ArdiNeural',
    geminiVoice: 'Enceladus',
    pitch: '-2Hz',
    rate: '+4%',
  },
  {
    id: 'gadis',
    label: 'GADIS / ZEPHYR (Wanita Indonesia)',
    deskripsi: 'Suara Wanita Indonesia Jernih & Ramah',
    gender: 'Wanita',
    voiceName: 'id-ID-GadisNeural',
    geminiVoice: 'Zephyr',
    pitch: '+0Hz',
    rate: '+5%',
  },
]

const VOICE_DEFAULT = DAFTAR_SUARA_JARVIS[0]

export function cariKonfigurasiSuara(voiceId?: string): OpsiSuaraJarvis {
  if (!voiceId) return VOICE_DEFAULT
  const clean = voiceId.trim().toLowerCase()
  return (
    DAFTAR_SUARA_JARVIS.find(
      (v) => v.id === clean || v.voiceName.toLowerCase() === clean
    ) ?? VOICE_DEFAULT
  )
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Mengubah teks laporan/markdown yang kaku menjadi kalimat bahasa lisan/percakapan Indonesia yang natural
 * sehingga saat diucapkan terdengar seperti mengobrol langsung dengan asisten pribadi (bukan membaca teks laporan).
 */
export function naturalisasiTeksSuara(teks: string): string {
  if (!teks) return ''

  // 1. Jika ada blok khusus <suara>...</suara>, prioritaskan isi percakapan di dalamnya
  const matchSuara = teks.match(/<suara>([\s\S]*?)<\/suara>/i)
  const sumberTeks = matchSuara ? matchSuara[1] : teks

  // 2. Bersihkan baris tabel, garis pemisah, dan judul-judul laporan yang kaku
  const baris = sumberTeks
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => {
      if (!b) return false
      if (b.startsWith('|') && b.endsWith('|')) return false
      if (/^[-━═*]{3,}$/.test(b)) return false
      if (/^\[!(NOTE|WARNING|IMPORTANT|TIP|CAUTION)\]/i.test(b)) return false
      if (b.startsWith('📍') && b.includes('_Sumber:')) return false
      // Buang baris yang hanya berupa judul bab/dokumen kaku (misal: ### Laporan Penjualan Hari Ini)
      if (/^#{1,6}\s+/.test(b)) return false
      if (/^(?:\*\*|__)?(?:LAPORAN|RINGKASAN|EVALUASI|REKAPITULASI|DATA OPERASIONAL|RINCIAN|DAFTAR)\b[^:.\n]*[*_]*:?$/i.test(b)) {
        return false
      }
      return true
    })
    .map((b) => {
      let line = b
        .replace(/^#{1,6}\s+/, '')
        .replace(/^>\s*/, '')
        .replace(/^[-*•]\s+/, '')
        .replace(/^\d+\.\s+/, '')
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .trim()

      // Ubah pola kaku "Label: Nilai" di awal kalimat menjadi alur bicara natural ("Untuk Label tercatat Nilai")
      line = line
        .replace(/^Total Omzet(?:\s+Jaringan)?\s*(Hari Ini|Kemarin)?\s*:\s*/i, 'Total omzet $1 ada di angka ')
        .replace(/^Total Penjualan(?:\s+Jaringan)?\s*(Hari Ini|Kemarin)?\s*:\s*/i, 'Total penjualan $1 mencapai ')
        .replace(/^Total(?:\s+Akumulasi)?\s+(?:Order|Transaksi)\s*(Hari Ini|Kemarin)?\s*:\s*/i, 'dengan total transaksi $1 sebanyak ')
        .replace(/^Rata-rata\s+(?:Order|Struk)(?:\s*\(AOV\))?\s*(Hari Ini|Kemarin)?\s*:\s*/i, 'dan rata-rata nilai struk ')
        .replace(/^TEMUAN PENTING\s*:\s*/i, 'Sebagai catatan penting, ')
        .replace(/^PERINGATAN(?:\s+MIKROFON)?\s*:\s*/i, 'Perhatian, ')
        .replace(/^([A-Za-z0-9\s/()-]{3,32})\s*:\s+/i, '$1 tercatat ')

      return line
    })

  // Gabungkan maksimal 3-4 kalimat pertama agar obrolan terasa mengalir dan tidak bertele-tele
  let s = baris.slice(0, 4).join('. ')

  s = s
    .replace(/\.\s*\./g, '.')
    // Ubah Rp X.XXX.XXX.XXX menjadi pengucapan lisan natural ("42,5 juta rupiah")
    .replace(/Rp\s?(\d{1,3}(?:\.\d{3})+)/gi, (_m, angkaStr: string) => {
      const n = Number(angkaStr.replace(/\./g, ''))
      if (isNaN(n) || n === 0) return 'nol rupiah'
      if (n >= 1_000_000_000) {
        const val = (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '').replace('.', ',')
        return `${val} miliar rupiah`
      }
      if (n >= 1_000_000) {
        const val = (n / 1_000_000).toFixed(1).replace(/\.0$/, '').replace('.', ',')
        return `${val} juta rupiah`
      }
      if (n >= 1_000) {
        const val = Math.round(n / 1_000)
        return `${val} ribu rupiah`
      }
      return `${n} rupiah`
    })
    // PENTING: Hilangkan titik ribuan pada angka non-Rupiah (misal 1.080 struk -> 1080 struk) agar tidak dibaca "satu titik nol delapan nol"
    .replace(/\b(\d{1,3})\.(\d{3})(?!\d)/g, '$1$2')
    // Ubah angka di dalam kurung seperti (1080 struk) menjadi ", sebanyak 1080 struk," agar tidak terdengar kaku
    .replace(/\(\s*(\d+\s*(?:struk|order|transaksi|cabang|outlet|PO|laporan|kru|ulasan)[^)]*)\)/gi, ', yaitu $1, ')
    // Sederhanakan pengulangan nama brand "SUKA SHAWARMA " pada penyebutan cabang agar enak didengar
    .replace(/\bSUKA SHAWARMA\s+/gi, 'Cabang ')
    .replace(/\bCabang\s+Cabang\s+/gi, 'Cabang ')
    // Naturalisasi kata-kata tulisan kaku menjadi bahasa lisan
    .replace(/\bBerikut adalah\b/gi, 'Ini untuk')
    .replace(/\bBerikut rincian\b/gi, 'Ini rincian')
    .replace(/\bTidak terdapat\b/gi, 'Belum ada')
    .replace(/\bTercatat sebesar\b/gi, 'ada di angka')
    .replace(/J\.A\.R\.V\.I\.S\.?/gi, 'Jarvis')
    .replace(/F\.R\.I\.D\.A\.Y\.?/gi, 'Friday')
    .replace(/\bAOV\b/g, 'rata-rata struk')
    .replace(/\bATV\b/g, 'rata-rata struk')
    .replace(/\bOPEX\b/gi, 'biaya operasional')
    .replace(/\bPOS\b/g, 'kasir')
    .replace(/\bHQ\b/g, 'Kantor Pusat')
    .replace(/\bWIB\b/g, '')
    // Bersihkan simbol markdown & emoji
    .replace(/[#*_`~>|[\]()]/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim()

  if (s.length > 380) {
    const potong = s.slice(0, 380)
    const titikTerakhir = Math.max(potong.lastIndexOf('. '), potong.lastIndexOf('! '), potong.lastIndexOf('? '))
    if (titikTerakhir > 110) {
      s = potong.slice(0, titikTerakhir + 1)
    } else {
      s = potong + '.'
    }
  }

  return s
}

function generateSecMsGec(epochMs = Date.now()): string {
  const WIN_EPOCH = 11644473600
  let ticks = Math.floor(epochMs / 1000) + WIN_EPOCH
  ticks -= ticks % 300
  ticks *= 1e7
  const strToHash = ticks.toFixed(0) + TRUSTED_CLIENT_TOKEN
  return crypto.createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase()
}

function sendWsText(socket: import('node:net').Socket, text: string) {
  const payload = Buffer.from(text, 'utf8')
  const mask = crypto.randomBytes(4)
  let header: Buffer
  if (payload.length < 126) {
    header = Buffer.alloc(6)
    header[0] = 0x81
    header[1] = 0x80 | payload.length
    mask.copy(header, 2)
  } else {
    header = Buffer.alloc(8)
    header[0] = 0x81
    header[1] = 0x80 | 126
    header.writeUInt16BE(payload.length, 2)
    mask.copy(header, 4)
  }
  const masked = Buffer.alloc(payload.length)
  for (let i = 0; i < payload.length; i++) {
    masked[i] = payload[i] ^ mask[i % 4]
  }
  socket.write(Buffer.concat([header, masked]))
}

let clockSkewOffsetMs = 0

function synthesizeEdgeNeuralMp3(
  teks: string,
  opsiSuara = VOICE_DEFAULT,
  sudahRetryClock = false
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const reqId = crypto.randomBytes(16).toString('hex')
    const secMsGec = generateSecMsGec(Date.now() + clockSkewOffsetMs)
    const path =
      `/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key=${TRUSTED_CLIENT_TOKEN}` +
      `&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${EDGE_VERSION}&ConnectionId=${reqId}`

    const timeout = setTimeout(() => {
      reject(new Error('Edge Neural TTS timeout'))
    }, 10_000)

    const req = https.request({
      hostname: 'api.msedgeservices.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
        'Sec-WebSocket-Version': '13',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.2957.140',
      },
    })

    req.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })

    req.on('response', (res) => {
      clearTimeout(timeout)
      if (!sudahRetryClock && res.headers?.date) {
        const serverMs = Date.parse(res.headers.date)
        if (!isNaN(serverMs)) {
          clockSkewOffsetMs = serverMs - Date.now()
          synthesizeEdgeNeuralMp3(teks, opsiSuara, true).then(resolve, reject)
          return
        }
      }
      reject(new Error(`Edge TTS unexpected HTTP ${res.statusCode}`))
    })

    req.on('upgrade', (_upRes, socket) => {
      const configMsg =
        `X-Timestamp:${new Date().toString()}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: 'false',
                  wordBoundaryEnabled: 'false',
                },
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
              },
            },
          },
        })

      sendWsText(socket, configMsg)

      // PENTING: Jangan gunakan tag <break/> di dalam <prosody> karena Edge WebSocket menolak nested tag di dalam prosody (menyebabkan 0 byte audio).
      const xmlLang = opsiSuara.voiceName.slice(0, 5) || 'id-ID'
      const kalimatBersihXml = escapeXml(teks)

      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${escapeXml(xmlLang)}'>` +
        `<voice name='${escapeXml(opsiSuara.voiceName)}'>` +
        `<prosody pitch='${opsiSuara.pitch}' rate='${opsiSuara.rate}'>${kalimatBersihXml}</prosody>` +
        `</voice></speak>`

      const ssmlMsg =
        `X-RequestId:${reqId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${new Date().toString()}Z\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml

      sendWsText(socket, ssmlMsg)

      let buf = Buffer.alloc(0)
      const mp3Chunks: Buffer[] = []
      let finished = false

      const done = (err?: Error) => {
        if (finished) return
        finished = true
        clearTimeout(timeout)
        try {
          socket.destroy()
        } catch {}
        if (err) {
          reject(err)
        } else {
          const total = Buffer.concat(mp3Chunks)
          if (total.length === 0) {
            reject(new Error('Audio MP3 kosong'))
          } else {
            resolve(total)
          }
        }
      }

      socket.on('error', (err) => done(err))
      socket.on('close', () => done())

      socket.on('data', (chunk: Buffer) => {
        buf = Buffer.concat([buf, chunk])
        while (buf.length >= 2) {
          const opcode = buf[0] & 0x0f
          let len = buf[1] & 0x7f
          let offset = 2
          if (len === 126) {
            if (buf.length < 4) return
            len = buf.readUInt16BE(2)
            offset = 4
          } else if (len === 127) {
            if (buf.length < 10) return
            len = Number(buf.readBigUInt64BE(2))
            offset = 10
          }
          if (buf.length < offset + len) return

          const frame = buf.subarray(offset, offset + len)
          buf = buf.subarray(offset + len)

          if (opcode === 1) {
            const str = frame.toString('utf8')
            if (str.includes('Path:turn.end')) {
              done()
              return
            }
          } else if (opcode === 2) {
            const sep = Buffer.from('Path:audio\r\n')
            const idx = frame.indexOf(sep)
            if (idx !== -1) {
              mp3Chunks.push(frame.subarray(idx + sep.length))
            }
          } else if (opcode === 8) {
            done()
            return
          }
        }
      })
    })

    req.end()
  })
}

/**
 * Membungkus raw 16-bit signed little-endian mono PCM (24kHz) dari Gemini Native Audio TTS
 * menjadi file RIFF WAV standar agar langsung bisa di-decode oleh Web Audio API (`decodeAudioData`).
 */
function wrapPcm16ToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1): Buffer {
  const bitsPerSample = 16
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8
  const dataSize = pcmBuffer.length
  const header = Buffer.alloc(44)

  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8, 'ascii')
  header.write('fmt ', 12, 'ascii')
  header.writeUInt32LE(16, 16) // Subchunk1Size (16 untuk PCM)
  header.writeUInt16LE(1, 20) // AudioFormat (1 = Linear PCM)
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36, 'ascii')
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcmBuffer])
}

/**
 * Sintesis suara menggunakan Google Gemini Native Audio TTS terbaru
 * (cascade: `gemini-3.8-flash-tts` -> `gemini-3.8-flash-lite-tts` -> `gemini-2.5-flash-preview-tts`).
 */
async function synthesizeGeminiNativeWav(
  teks: string,
  opsiSuara: OpsiSuaraJarvis,
  apiKey: string
): Promise<{ wavBuffer: Buffer; modelUsed: string }> {
  const promptBerpengarah = `Ucapkan kalimat berikut dalam Bahasa Indonesia dengan gaya asisten eksekutif J.A.R.V.I.S. yang sangat natural, luwes, hangat, dan mengalir seperti obrolan telepon langsung:\n\n${teks}`
  let galatTerakhir = 'Tidak ada model Gemini TTS yang merespons.'

  for (const model of GEMINI_TTS_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptBerpengarah }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: opsiSuara.geminiVoice || 'Puck',
                },
              },
            },
          },
        }),
        signal: AbortSignal.timeout(9500),
      })

      if (!res.ok) {
        const errTxt = await res.text().catch(() => '')
        galatTerakhir = `${model} HTTP ${res.status}: ${errTxt.slice(0, 140)}`
        continue
      }

      const data = await res.json()
      const inlineData = data?.candidates?.[0]?.content?.parts?.find(
        (p: { inlineData?: { data?: string; mimeType?: string } }) => p?.inlineData?.data
      )?.inlineData

      if (!inlineData?.data) {
        galatTerakhir = `${model}: respons tidak memuat inlineData audio.`
        continue
      }

      const rawAudio = Buffer.from(inlineData.data, 'base64')
      const mime = String(inlineData.mimeType || '').toLowerCase()
      const matchRate = mime.match(/rate=(\d+)/)
      const sampleRate = matchRate ? Number(matchRate[1]) || 24000 : 24000

      // Jika sudah memiliki header RIFF/WAV langsung gunakan, jika masih raw PCM L16 bungkus dengan WAV header
      const wavBuffer =
        rawAudio.subarray(0, 4).toString('ascii') === 'RIFF'
          ? rawAudio
          : wrapPcm16ToWav(rawAudio, sampleRate, 1)

      return { wavBuffer, modelUsed: model }
    } catch (err) {
      galatTerakhir = `${model}: ${(err as Error)?.message}`
    }
  }

  throw new Error(galatTerakhir)
}

export async function POST(req: Request) {
  const g = await ambilSesi()
  if (!g.ok) {
    return NextResponse.json({ galat: 'Tidak punya akses.' }, { status: g.status })
  }

  const body = await req.json().catch(() => ({}))
  const teksMentah = typeof body?.teks === 'string' ? body.teks.trim() : ''
  const voiceId = typeof body?.voice === 'string' ? body.voice.trim() : undefined

  if (!teksMentah) {
    return NextResponse.json({ galat: 'Teks kosong.' }, { status: 400 })
  }

  const teksSuara = naturalisasiTeksSuara(teksMentah)
  if (!teksSuara) {
    return NextResponse.json({ galat: 'Teks tidak mengandung kalimat terucap.' }, { status: 400 })
  }

  const opsiSuara = cariKonfigurasiSuara(voiceId)
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim()

  // 1. Prioritaskan Google Gemini Native Audio TTS terbaru jika GEMINI_API_KEY / GOOGLE_API_KEY tersedia
  if (geminiKey) {
    try {
      const { wavBuffer, modelUsed } = await synthesizeGeminiNativeWav(teksSuara, opsiSuara, geminiKey)
      return new NextResponse(new Uint8Array(wavBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'audio/wav',
          'Cache-Control': 'no-store',
          'X-Jarvis-Engine': `gemini-native-tts (${modelUsed})`,
          'X-Jarvis-Voice': opsiSuara.geminiVoice,
        },
      })
    } catch (err) {
      console.warn('[jarvis-tts] Gemini Native TTS gagal, beralih ke Cloud Neural HD:', (err as Error)?.message)
    }
  }

  // 2. Fallback otomatis tanpa API key: Cloud Neural HD 24kHz (100% Gratis & Unlimited)
  try {
    const mp3Buffer = await synthesizeEdgeNeuralMp3(teksSuara, opsiSuara)
    return new NextResponse(new Uint8Array(mp3Buffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-Jarvis-Engine': 'cloud-neural-hd',
        'X-Jarvis-Voice': opsiSuara.voiceName,
      },
    })
  } catch (err) {
    console.warn('[jarvis-tts] Gagal melakukan sintesis neural TTS:', (err as Error)?.message)
    return NextResponse.json(
      { galat: 'Neural TTS tidak tersedia sementara, gunakan fallback browser.' },
      { status: 502 }
    )
  }
}
