import https from 'node:https'
import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { ambilSesi } from '@/lib/server/sesi'

export const dynamic = 'force-dynamic'

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const EDGE_VERSION = '1-132.0.2957.140'
const VOICE_DEFAULT = 'id-ID-ArdiNeural'

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Mengubah format angka Rupiah (contoh: Rp 42.500.000 atau Rp1.250.000)
 * menjadi teks terucap bahasa Indonesia yang natural ("42,5 juta rupiah")
 * agar suara Neural TTS J.A.R.V.I.S. terdengar luwes seperti asisten eksekutif asli.
 */
export function naturalisasiTeksSuara(teks: string): string {
  let s = teks
    // Hapus blok tabel markdown
    .replace(/^\|.*\|$/gm, ' ')
    // Hapus tag kutipan seperti [!NOTE], [!WARNING], [!IMPORTANT]
    .replace(/\[!(NOTE|WARNING|IMPORTANT|TIP|CAUTION)\]/gi, '')
    // Ubah Rp X.XXX.XXX.XXX menjadi miliar/juta/ribu
    .replace(/Rp\s?(\d{1,3}(?:\.\d{3})+)/gi, (_m, angkaStr: string) => {
      const n = Number(angkaStr.replace(/\./g, ''))
      if (isNaN(n) || n === 0) return '0 rupiah'
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
    // Ubah J.A.R.V.I.S. menjadi Jarvis agar tidak dieja per huruf
    .replace(/J\.A\.R\.V\.I\.S\.?/gi, 'Jarvis')
    .replace(/\bAOV\b/g, 'rata-rata struk')
    .replace(/\bATV\b/g, 'rata-rata struk')
    .replace(/\bOPEX\b/gi, 'opeks')
    .replace(/\bPOS\b/g, 'kasir')
    .replace(/\bHQ\b/g, 'Kantor Pusat')
    // Bersihkan simbol markdown & emoji berlebih
    .replace(/[#*_`~>|]/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Batasi maksimal ~420 karakter (sekitar 3-4 kalimat eksekutif) agar respons suara tetap cepat dan taktis
  if (s.length > 420) {
    const potong = s.slice(0, 420)
    const titikTerakhir = Math.max(potong.lastIndexOf('. '), potong.lastIndexOf('! '), potong.lastIndexOf('? '))
    if (titikTerakhir > 140) {
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

function synthesizeEdgeNeuralMp3(teks: string, voice = VOICE_DEFAULT): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const reqId = crypto.randomBytes(16).toString('hex')
    const secMsGec = generateSecMsGec()
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

      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='id-ID'>` +
        `<voice name='${escapeXml(voice)}'>` +
        `<prosody pitch='-3Hz' rate='+6%'>${escapeXml(teks)}</prosody>` +
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

export async function POST(req: Request) {
  const g = await ambilSesi()
  if (!g.ok) {
    return NextResponse.json({ galat: 'Tidak punya akses.' }, { status: g.status })
  }

  const body = await req.json().catch(() => ({}))
  const teksMentah = typeof body?.teks === 'string' ? body.teks.trim() : ''
  if (!teksMentah) {
    return NextResponse.json({ galat: 'Teks kosong.' }, { status: 400 })
  }

  const teksSuara = naturalisasiTeksSuara(teksMentah)
  if (!teksSuara) {
    return NextResponse.json({ galat: 'Teks tidak mengandung kalimat terucap.' }, { status: 400 })
  }

  try {
    const mp3Buffer = await synthesizeEdgeNeuralMp3(teksSuara, VOICE_DEFAULT)
    return new NextResponse(new Uint8Array(mp3Buffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-Jarvis-Voice': VOICE_DEFAULT,
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
