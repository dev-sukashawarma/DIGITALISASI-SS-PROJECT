import https from 'node:https'
import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { ambilSesi } from '@/lib/server/sesi'
import {
  VOICE_DEFAULT,
  GEMINI_TTS_MODELS,
  cariKonfigurasiSuara,
  naturalisasiTeksSuara,
  type OpsiSuaraJarvis,
} from '@/lib/ttsConfig'

export const dynamic = 'force-dynamic'

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const EDGE_VERSION = '1-132.0.2957.140'

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
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
  let galatTerakhir = 'Tidak ada model Gemini TTS yang merespons.'

  for (const model of GEMINI_TTS_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: teks }] }],
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
        signal: AbortSignal.timeout(14000),
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
      if (rawAudio.length < 100) {
        galatTerakhir = `${model}: audio buffer terlalu kecil / kosong (${rawAudio.length} bytes).`
        continue
      }
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


/**
 * Sintesis suara bahasa Indonesia menggunakan Google TTS engine
 * (100% andal & responsif tanpa batas harian sebagai pelapis tangguh Gemini).
 */
async function synthesizeGoogleTts(teks: string): Promise<Buffer> {
  const sentences = teks.match(/[^.!?]+[.!?]+/g) || [teks]
  const chunks: string[] = []
  let cur = ''
  for (const s of sentences) {
    if ((cur + ' ' + s).length > 180) {
      if (cur) chunks.push(cur.trim())
      cur = s
    } else {
      cur += ' ' + s
    }
  }
  if (cur.trim()) chunks.push(cur.trim())

  const buffers = await Promise.all(
    chunks.map(async (chunk) => {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=${encodeURIComponent(chunk)}`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(7000),
      })
      if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`)
      return Buffer.from(await res.arrayBuffer())
    })
  )

  const combined = Buffer.concat(buffers)
  if (combined.length === 0) throw new Error('Audio Google TTS kosong')
  return combined
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
  }

  // 3. Fallback andal: Google Speech Cloud Engine (Cepat, jernih & selalu tersedia)
  try {
    const googleMp3Buffer = await synthesizeGoogleTts(teksSuara)
    return new NextResponse(new Uint8Array(googleMp3Buffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-Jarvis-Engine': 'google-cloud-tts',
        'X-Jarvis-Voice': opsiSuara.id,
      },
    })
  } catch (errGoogle) {
    console.warn('[jarvis-tts] Google Cloud TTS gagal, beralih ke fallback browser:', (errGoogle as Error)?.message)
    return NextResponse.json(
      { galat: 'Neural TTS tidak tersedia sementara, gunakan fallback browser.' },
      { status: 502 }
    )
  }
}
