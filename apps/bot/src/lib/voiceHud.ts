// Sistem Interaksi Suara J.A.R.V.I.S. (Dual-Engine Voice-to-Voice: Web Audio Mic Stream + MediaRecorder WAV + AI Server STT + Web Speech API)
// Bekerja di SEMUA browser (Chrome, Brave, Edge, Firefox, Safari) dengan visualisasi spektrum mikrofon real-time yang responsif.

import { setSedangVoiceBicaraHud } from '@/lib/audioHud'

let recognitionInstance: any = null
let wakeWordInstance: any = null
let sedangMendengar = false
let wakeWordAktif = false

// State untuk perekaman mikrofon langsung (Universal Web Audio + Lossless PCM + MediaRecorder + VAD)
let micStream: MediaStream | null = null
let micSourceNode: MediaStreamAudioSourceNode | null = null
let micAnalyserNode: AnalyserNode | null = null
let micProcessorNode: ScriptProcessorNode | null = null
let micSilentGainNode: GainNode | null = null
let mediaRecorderInstance: MediaRecorder | null = null
let vadIntervalId: ReturnType<typeof setInterval> | null = null
let finalizeMicSessionFn: ((kirimSekarang: boolean) => void) | null = null

let audioCtxVoice: AudioContext | null = null
let activeSourceNode: AudioBufferSourceNode | null = null
let activeAnalyser: AnalyserNode | null = null
let ttsAbortController: AbortController | null = null
let sedangBicaraFlag = false

// Singleton HTMLAudioElement & WakeLock khusus kontinuitas iOS (iPhone Safari & Chrome iOS / WKWebView)
let iosAudioEl: HTMLAudioElement | null = null
let activeBlobUrl: string | null = null
let iosAudioUnlocked = false
let iosUnlockListenerTerpasang = false
let wakeLockSentinel: any = null

// Data URI WAV hening 1-sampel (44 byte) untuk membuka kunci autoplay iOS Safari/Chrome pada sentuhan pertama
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

function setBicaraAktifInternal(aktif: boolean) {
  sedangBicaraFlag = aktif
  setSedangVoiceBicaraHud(aktif)
  if (aktif) {
    void aktifWakeLockLayar()
  } else if (!sedangMendengar) {
    void lepasWakeLockLayar()
  }
}

/**
 * Deteksi perangkat iOS / iPadOS (mencakup Mobile Safari, Chrome iOS CriOS, Brave, Firefox iOS, & WebView).
 */
export function apakahPerangkatIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function setKategoriAudioIos(kategori: 'playback' | 'play-and-record') {
  try {
    const navAny = navigator as any
    if (navAny?.audioSession && navAny.audioSession.type !== kategori) {
      navAny.audioSession.type = kategori
    }
  } catch {}
}

function getAtauBuatAudioElement(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
  if (!iosAudioEl) {
    const el = new Audio()
    el.preload = 'auto'
    ;(el as any).playsInline = true
    el.setAttribute('playsinline', 'true')
    el.setAttribute('webkit-playsinline', 'true')
    iosAudioEl = el
  }
  return iosAudioEl
}

function bersihkanHtmlAudioAktif() {
  if (iosAudioEl) {
    try {
      iosAudioEl.onloadedmetadata = null
      iosAudioEl.onended = null
      iosAudioEl.onerror = null
      iosAudioEl.pause()
    } catch {}
  }
  if (activeBlobUrl) {
    try {
      URL.revokeObjectURL(activeBlobUrl)
    } catch {}
    activeBlobUrl = null
  }
}

async function aktifWakeLockLayar() {
  if (typeof navigator === 'undefined' || !(navigator as any).wakeLock) return
  if (wakeLockSentinel) return
  try {
    wakeLockSentinel = await (navigator as any).wakeLock.request('screen')
    wakeLockSentinel?.addEventListener?.('release', () => {
      wakeLockSentinel = null
    })
  } catch {}
}

async function lepasWakeLockLayar() {
  if (!wakeLockSentinel) return
  try {
    await wakeLockSentinel.release()
  } catch {}
  wakeLockSentinel = null
}

/**
 * Membuka kunci AudioContext & HTMLAudioElement di iPhone/iPad tepat saat sentuhan/klik pengguna,
 * sehingga kalimat ke-2, ke-3, maupun balasan setelah jeda jaringan tidak pernah diblokir/terputus di tengah percakapan.
 */
export function siapkanAudioIos() {
  if (typeof window === 'undefined') return

  const unlockSekarang = () => {
    const ctx = getVoiceAudioContext()
    if (ctx) {
      const st = ctx.state as string
      if (st === 'suspended' || st === 'interrupted') {
        void ctx.resume().catch(() => {})
      }
      try {
        const buf = ctx.createBuffer(1, 1, 22050)
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.connect(ctx.destination)
        src.start(0)
      } catch {}
    }

    const el = getAtauBuatAudioElement()
    if (el && !iosAudioUnlocked && !sedangBicaraFlag) {
      try {
        el.src = SILENT_WAV_DATA_URI
        el.muted = true
        const p = el.play()
        if (p && typeof p.then === 'function') {
          p.then(() => {
            el.pause()
            el.muted = false
            el.currentTime = 0
            iosAudioUnlocked = true
          }).catch(() => {
            el.muted = false
          })
        } else {
          el.muted = false
          iosAudioUnlocked = true
        }
      } catch {
        el.muted = false
      }
    }
  }

  unlockSekarang()

  if (!iosUnlockListenerTerpasang) {
    iosUnlockListenerTerpasang = true
    const handlerInteraksi = () => {
      if (!iosAudioUnlocked) {
        unlockSekarang()
      } else if (audioCtxVoice) {
        const st = audioCtxVoice.state as string
        if (st === 'suspended' || st === 'interrupted') {
          void audioCtxVoice.resume().catch(() => {})
        }
      }
    }
    window.addEventListener('touchstart', handlerInteraksi, { passive: true })
    window.addEventListener('pointerdown', handlerInteraksi, { passive: true })
    window.addEventListener('click', handlerInteraksi, { passive: true })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && (sedangBicaraFlag || sedangMendengar)) {
        void aktifWakeLockLayar()
        if (audioCtxVoice) {
          const st = audioCtxVoice.state as string
          if (st === 'suspended' || st === 'interrupted') {
            void audioCtxVoice.resume().catch(() => {})
          }
        }
      }
    })
  }
}
let animFrameId: number | null = null
let listenerSpektrum: ((bands: number[]) => void) | null = null

const DEFAULT_BANDS = [0, 0, 0, 0, 0, 0, 0, 0, 0]
const STORAGE_KEY_VOICE = 'jarvis_voice_id'

export interface PilihanSuaraHud {
  id: string
  label: string
  deskripsi: string
  gender: 'Pria' | 'Wanita'
}

export const PILIHAN_SUARA_JARVIS: PilihanSuaraHud[] = [
  {
    id: 'brian',
    label: 'ALIF HD (Jarvis Executive Indonesia)',
    deskripsi: 'Pria Bariton Eksekutif Luwes & Natural (ElevenLabs Alif HD)',
    gender: 'Pria',
  },
  {
    id: 'andrew',
    label: 'JANU HD (Warm Executive)',
    deskripsi: 'Pria Hangat, Santai & Mengalir (ElevenLabs Janu HD)',
    gender: 'Pria',
  },
  {
    id: 'william',
    label: 'DANIEL HD (Aksen Jarvis Klasik)',
    deskripsi: 'Pria Elegan ala Butler J.A.R.V.I.S. (ElevenLabs Daniel HD)',
    gender: 'Pria',
  },
  {
    id: 'florian',
    label: 'AKBAR HD (Deep Commander)',
    deskripsi: 'Pria Suara Berat & Berwibawa (ElevenLabs Akbar HD)',
    gender: 'Pria',
  },
  {
    id: 'remy',
    label: 'JEFRI HD (Smooth Analyst)',
    deskripsi: 'Pria Suara Halus & Tenang (ElevenLabs Jefri HD)',
    gender: 'Pria',
  },
  {
    id: 'ava',
    label: 'F.R.I.D.A.Y. / VELORA HD (Wanita AI)',
    deskripsi: 'Wanita AI Luwes & Ekspresif (ElevenLabs Velora HD)',
    gender: 'Wanita',
  },
  {
    id: 'emma',
    label: 'RENATA HD (Wanita Hangat)',
    deskripsi: 'Wanita Lembut & Natural (ElevenLabs Renata HD)',
    gender: 'Wanita',
  },
  {
    id: 'ardi',
    label: 'ARDI / ALIF (Pria Indonesia)',
    deskripsi: 'Pria Indonesia Formal & Tegas (ElevenLabs Alif HD)',
    gender: 'Pria',
  },
  {
    id: 'gadis',
    label: 'ANJANI HD (Wanita Indonesia)',
    deskripsi: 'Wanita Indonesia Jernih & Santun (ElevenLabs Anjani HD)',
    gender: 'Wanita',
  },
]

let suaraJarvisAktifId = 'brian'

export function ambilSuaraJarvisAktif(): string {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_VOICE)
      if (saved && PILIHAN_SUARA_JARVIS.some((v) => v.id === saved)) {
        suaraJarvisAktifId = saved
      }
    } catch {}
  }
  return suaraJarvisAktifId
}

export function setSuaraJarvisAktif(voiceId: string) {
  const valid = PILIHAN_SUARA_JARVIS.find((v) => v.id === voiceId)?.id ?? 'brian'
  suaraJarvisAktifId = valid
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY_VOICE, valid)
    } catch {}
  }
}

function getVoiceAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtxVoice) {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtxVoice = new AudioContextClass()
      audioCtxVoice.onstatechange = () => {
        if (!audioCtxVoice) return
        const st = audioCtxVoice.state as string
        if ((st === 'interrupted' || st === 'suspended') && (sedangBicaraFlag || sedangMendengar)) {
          void audioCtxVoice.resume().catch(() => {})
        }
      }
    }
  }
  if (audioCtxVoice) {
    const st = audioCtxVoice.state as string
    if (st === 'suspended' || st === 'interrupted') {
      void audioCtxVoice.resume().catch(() => {})
    }
  }
  return audioCtxVoice
}

export function apakahVoiceDidukung(): { stt: boolean; tts: boolean } {
  if (typeof window === 'undefined') return { stt: false, tts: false }
  const hasMediaDevices = Boolean(navigator?.mediaDevices?.getUserMedia)
  const hasWebSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  const stt = hasMediaDevices || hasWebSpeech
  const tts = 'speechSynthesis' in window || typeof AudioContext !== 'undefined' || 'webkitAudioContext' in window
  return { stt, tts }
}

/**
 * Mengonversi array Float32 PCM ke format WAV 16kHz 16-bit Mono dalam bentuk Base64.
 */
function encodeWav16kBase64(chunks: Float32Array[], sampleRateAsli: number): string {
  let totalSamples = 0
  for (const c of chunks) totalSamples += c.length
  if (totalSamples === 0) return ''

  const gabungan = new Float32Array(totalSamples)
  let offset = 0
  for (const c of chunks) {
    gabungan.set(c, offset)
    offset += c.length
  }

  const targetRate = 16000
  const rasio = sampleRateAsli / targetRate
  const panjangTarget = Math.max(1, Math.floor(totalSamples / rasio))
  const pcm16 = new Int16Array(panjangTarget)

  for (let i = 0; i < panjangTarget; i++) {
    const idxAsli = Math.min(totalSamples - 1, Math.floor(i * rasio))
    const s = Math.max(-1, Math.min(1, gabungan[idxAsli]))
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }

  const byteData = pcm16.length * 2
  const buffer = new ArrayBuffer(44 + byteData)
  const view = new DataView(buffer)

  const tulisStr = (pos: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(pos + i, str.charCodeAt(i))
    }
  }

  tulisStr(0, 'RIFF')
  view.setUint32(4, 36 + byteData, true)
  tulisStr(8, 'WAVE')
  tulisStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // Mono
  view.setUint32(24, targetRate, true)
  view.setUint32(28, targetRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  tulisStr(36, 'data')
  view.setUint32(40, byteData, true)

  let byteOffset = 44
  for (let i = 0; i < pcm16.length; i++, byteOffset += 2) {
    view.setInt16(byteOffset, pcm16[i], true)
  }

  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(buffer).toString('base64')
}

/**
 * Meringkas jawaban panjang/markdown menjadi 2-4 kalimat bahasa lisan/percakapan natural yang enak didengar
 * saat diucapkan J.A.R.V.I.S. (tidak terdengar kaku seperti membaca judul atau bullet-point laporan).
 */
/**
 * Mengekstrak kalimat pertama/pembuka yang utuh dari teks streaming agar TTS
 * bisa mulai disintesis dan diputar tanpa menunggu seluruh jawaban selesai di-generate.
 */
export function ekstrakKalimatAwalStreaming(ringkasan: string): string | null {
  if (!ringkasan || ringkasan.length < 15) return null

  // Cari semua penanda akhir kalimat (. ! ?)
  const regex = /[.!?]+(?:\s+|$)/g
  let match: RegExpExecArray | null
  const posisi: number[] = []

  while ((match = regex.exec(ringkasan)) !== null) {
    posisi.push(match.index + match[0].trimEnd().length)
  }

  if (posisi.length === 0) {
    // Jika kalimat sangat panjang tanpa titik (>= 140 karakter), cari koma terdekat
    if (ringkasan.length >= 140) {
      const idxKoma = ringkasan.lastIndexOf(', ', 120)
      if (idxKoma >= 30) {
        return ringkasan.slice(0, idxKoma + 1).trim()
      }
    }
    return null
  }

  // Cek posisi pertama
  const p1 = posisi[0]
  if (p1 >= 28) {
    return ringkasan.slice(0, p1).trim()
  }

  // Jika posisi pertama terlalu pendek (misal: "Siap Sir!"), ambil sampai posisi kedua jika ada
  if (posisi.length >= 2) {
    const p2 = posisi[1]
    return ringkasan.slice(0, p2).trim()
  }

  return null
}

export function ringkasUntukSuara(teks: string): string {
  if (!teks) return ''

  let sumberTeks = teks
  const matchSuaraPenuh = teks.match(/<suara>([\s\S]*?)<\/suara>/i)
  if (matchSuaraPenuh) {
    sumberTeks = matchSuaraPenuh[1]
  } else {
    const matchSuaraBuka = teks.match(/<suara>([\s\S]*)/i)
    if (matchSuaraBuka) {
      sumberTeks = matchSuaraBuka[1]
    }
  }
  sumberTeks = sumberTeks.replace(/<\/?suara>/gi, '')

  const barisBersih = sumberTeks
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => {
      if (!b) return false
      if (b.startsWith('|') && b.endsWith('|')) return false
      if (/^[-━═*]{3,}$/.test(b)) return false
      if (/^\[!(NOTE|WARNING|IMPORTANT|TIP|CAUTION)\]/i.test(b)) return false
      if (b.startsWith('📍') && b.includes('_Sumber:')) return false
      if (/^#{1,6}\s+/.test(b)) return false
      if (
        /^(?:\*\*|__)?(?:LAPORAN|RINGKASAN|EVALUASI|REKAPITULASI|DATA OPERASIONAL|RINCIAN|DAFTAR)\b[^:.\n]*[*_]*:?$/i.test(
          b
        )
      ) {
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

      line = line
        .replace(/^Total Omzet(?:\s+Jaringan)?\s*(Hari Ini|Kemarin)?\s*:\s*/i, 'Total omzet $1 ada di ')
        .replace(/^Total Penjualan(?:\s+Jaringan)?\s*(Hari Ini|Kemarin)?\s*:\s*/i, 'Total penjualan $1 mencapai ')
        .replace(
          /^Total(?:\s+Akumulasi)?\s+(?:Order|Transaksi)\s*(Hari Ini|Kemarin)?\s*:\s*/i,
          'dengan total transaksi $1 sebanyak '
        )
        .replace(
          /^Rata-rata\s+(?:Order|Struk)(?:\s*\(AOV\))?\s*(Hari Ini|Kemarin)?\s*:\s*/i,
          'dan rata-rata struk '
        )
        .replace(/^TEMUAN PENTING\s*:\s*/i, 'Catatan penting, ')
        .replace(/^PERINGATAN(?:\s+MIKROFON)?\s*:\s*/i, 'Perhatian, ')

      return line
    })

  let s = ''
  for (const line of barisBersih.slice(0, 5)) {
    if (!line) continue
    if (!s) {
      s = line
    } else if (/[.!?,;:]$/.test(s)) {
      s += ' ' + line
    } else {
      s += '. ' + line
    }
  }

  s = s
    .replace(/\.\s*\./g, '.')
    .replace(/Rp\s?(\d{1,3}(?:\.\d{3})+)/gi, (_m, angkaStr: string) => {
      const n = Number(angkaStr.replace(/\./g, ''))
      if (isNaN(n) || n === 0) return 'nol rupiah'
      if (n >= 1_000_000_000) {
        const val = (n / 1_000_000_000).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1').replace('.', ',')
        return `${val} miliar rupiah`
      }
      if (n >= 1_000_000) {
        const val = (n / 1_000_000).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1').replace('.', ',')
        return `${val} juta rupiah`
      }
      if (n >= 1_000) {
        const val = Math.round(n / 1_000)
        return `${val} ribu rupiah`
      }
      return `${n} rupiah`
    })
    .replace(/(\d+(?:[.,]\d+)?)\s*%/g, '$1 persen')
    .replace(/\b(\d{1,3})\.(\d{3})(?!\d)/g, '$1$2')
    .replace(
      /\(\s*(\d+\s*(?:struk|order|transaksi|cabang|outlet|PO|laporan|kru|ulasan)[^)]*)\)/gi,
      ', sekitar $1, '
    )
    .replace(/\bSUKA SHAWARMA\s+/gi, 'Cabang ')
    .replace(/\bCabang\s+Cabang\s+/gi, 'Cabang ')
    .replace(/\bBerikut adalah\b/gi, 'Ini')
    .replace(/\bBerikut rincian\b/gi, 'Ini rincian')
    .replace(/\bTidak terdapat\b/gi, 'Belum ada')
    .replace(/\bTercatat sebesar\b/gi, 'ada di')
    .replace(/J\.A\.R\.V\.I\.S\.?/gi, 'Jarvis')
    .replace(/F\.R\.I\.D\.A\.Y\.?/gi, 'Friday')
    .replace(/\bAOV\b/g, 'rata-rata struk')
    .replace(/\bATV\b/g, 'rata-rata struk')
    .replace(/\bOPEX\b/gi, 'biaya operasional')
    .replace(/\bPOS\b/g, 'kasir')
    .replace(/\bHQ\b/g, 'Kantor Pusat')
    .replace(/\bQRIS\b/gi, 'kris')
    .replace(/\bWIB\b/g, '')
    .replace(/[#*_`~\[\]()]/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim()

  if (s.length > 550) {
    const potong = s.slice(0, 550)
    const titik = Math.max(potong.lastIndexOf('. '), potong.lastIndexOf('! '), potong.lastIndexOf('? '))
    s = titik > 120 ? potong.slice(0, titik + 1) : potong + '.'
  }

  return s
}

/**
 * Mengekstrak daftar kalimat lisan yang sudah utuh secara bertahap (rolling sentence queue)
 * selama teks LLM sedang mengalir, sehingga kalimat ke-2, ke-3, dst. dapat disintesis paralel
 * tanpa jeda hening setelah kalimat pertama selesai diucapkan.
 */
export function ekstrakAntreanKalimatSuara(
  teks: string,
  streamSelesai = false,
  abaikanBlokTagSuara = false
): string[] {
  if (!teks) return []

  let sumberTeks = teks
  if (abaikanBlokTagSuara) {
    // Jika kalimat pembuka di luar <suara> sudah telanjur diantrekan saat streaming, buang blok <suara> di akhir agar indeks kalimat tetap monoton & tidak diulang
    sumberTeks = teks.replace(/<suara>[\s\S]*?(?:<\/suara>|$)/gi, '')
  } else {
    const matchSuaraPenuh = teks.match(/<suara>([\s\S]*?)<\/suara>/i)
    if (matchSuaraPenuh) {
      sumberTeks = matchSuaraPenuh[1]
    } else {
      const matchSuaraBuka = teks.match(/<suara>([\s\S]*)/i)
      if (matchSuaraBuka) {
        sumberTeks = matchSuaraBuka[1]
      }
    }
  }
  sumberTeks = sumberTeks.replace(/<\/?suara>/gi, '')

  const barisMentah = sumberTeks.split('\n')
  const barisValid: string[] = []
  for (let idx = 0; idx < barisMentah.length; idx++) {
    const isBarisTerakhirBelumSelesai = !streamSelesai && idx === barisMentah.length - 1
    const b = barisMentah[idx].trim()
    if (!b) continue
    if (b.startsWith('|')) continue
    if (/^[-━═*]{3,}$/.test(b)) continue
    if (/^\[!(NOTE|WARNING|IMPORTANT|TIP|CAUTION)\]/i.test(b)) continue
    if (b.startsWith('📍') && b.includes('_Sumber:')) continue
    if (/^#{1,6}(?:\s+|$)/.test(b)) continue
    if (
      /^(?:\*\*|__)?(?:LAPORAN|RINGKASAN|EVALUASI|REKAPITULASI|DATA OPERASIONAL|RINCIAN|DAFTAR)\b[^:.\n]*[*_]*:?$/i.test(
        b
      )
    ) {
      continue
    }

    const bersihAwal = b
      .replace(/^>\s*/, '')
      .replace(/^[-*•]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/J\.A\.R\.V\.I\.S\.?/gi, 'Jarvis')
      .replace(/F\.R\.I\.D\.A\.Y\.?/gi, 'Friday')
      .replace(/\bRp\.\s*/gi, 'Rp ')
      .replace(/\b(No|Dr|Bpk|Sdr|PT|CV)\.\s+/gi, '$1 ')
      .trim()

    if (!bersihAwal) continue

    if (!isBarisTerakhirBelumSelesai && !/[.!?]$/.test(bersihAwal)) {
      const rapihAkhir = bersihAwal.replace(/[,:;]+$/, '').trim()
      if (rapihAkhir) barisValid.push(rapihAkhir + '. ')
    } else {
      barisValid.push(bersihAwal + (isBarisTerakhirBelumSelesai ? '' : ' '))
    }
  }

  const gabungan = barisValid.join(' ')
  if (!gabungan.trim()) return []

  const kalimatMentah: string[] = []
  const regexBatas = /[.!?]+(?=\s+)/g
  let lastIdx = 0
  let m: RegExpExecArray | null
  while ((m = regexBatas.exec(gabungan)) !== null) {
    const endPos = m.index + m[0].length
    const potong = gabungan.slice(lastIdx, endPos).trim()
    if (potong) kalimatMentah.push(potong)
    lastIdx = endPos
  }

  const ekor = gabungan.slice(lastIdx).trim()
  if (streamSelesai && ekor) {
    kalimatMentah.push(ekor)
  }

  const hasil: string[] = []
  let bufferPendek = ''
  let totalKarakter = 0
  const BATAS_MAKS_CHUNKS = 4
  const BATAS_MAKS_KARAKTER = 520

  for (const km of kalimatMentah) {
    if (hasil.length >= BATAS_MAKS_CHUNKS || totalKarakter >= BATAS_MAKS_KARAKTER) break
    const gabung = bufferPendek ? `${bufferPendek} ${km}` : km
    if (gabung.length < 24) {
      bufferPendek = gabung
      continue
    }
    const natural = ringkasUntukSuara(gabung)
    if (natural) {
      hasil.push(natural)
      totalKarakter += natural.length
    }
    bufferPendek = ''
  }

  if (streamSelesai && bufferPendek && hasil.length < BATAS_MAKS_CHUNKS && totalKarakter < BATAS_MAKS_KARAKTER) {
    const natural = ringkasUntukSuara(bufferPendek)
    if (natural) {
      hasil.push(natural)
    }
  }

  return hasil
}

export interface ListenerSuaraOptions {
  onMulai?: () => void
  onHasil: (teks: string, isFinal: boolean) => void
  onFinalOtomatis?: (teksFinal: string) => void
  onSelesai?: () => void
  onGalat?: (pesan: string) => void
  autoKirimDelayMs?: number
}

function bersihkanResourceMikrofon() {
  if (vadIntervalId) {
    clearInterval(vadIntervalId)
    vadIntervalId = null
  }
  if (mediaRecorderInstance) {
    try {
      if (mediaRecorderInstance.state !== 'inactive') {
        mediaRecorderInstance.stop()
      }
    } catch {}
    mediaRecorderInstance = null
  }
  if (micProcessorNode) {
    try {
      micProcessorNode.onaudioprocess = null
      micProcessorNode.disconnect()
    } catch {}
    micProcessorNode = null
  }
  if (micSilentGainNode) {
    try {
      micSilentGainNode.disconnect()
    } catch {}
    micSilentGainNode = null
  }
  if (micSourceNode) {
    try {
      micSourceNode.disconnect()
    } catch {}
    micSourceNode = null
  }
  micAnalyserNode = null
  if (micStream) {
    try {
      micStream.getTracks().forEach((t) => t.stop())
    } catch {}
    micStream = null
  }
  if (recognitionInstance) {
    try {
      recognitionInstance.onend = null
      recognitionInstance.onerror = null
      recognitionInstance.onresult = null
      recognitionInstance.stop()
    } catch {}
    recognitionInstance = null
  }
}

export function mulaiMendengar(options: ListenerSuaraOptions): boolean {
  if (typeof window === 'undefined') return false

  // Hentikan suara Jarvis jika sedang bicara (Barge-In / Interrupt)
  if (sedangBicaraFlag) {
    hentiBicaraJarvis()
  }

  // Jika sedang mendengar, hentikan dan proses hasil yang sudah terekam
  if (sedangMendengar && finalizeMicSessionFn) {
    finalizeMicSessionFn(true)
    return false
  }

  bersihkanResourceMikrofon()

  // PENTING: Bangunkan AudioContext & buka kunci elemen <audio> iOS tepat saat user menyentuh tombol!
  siapkanAudioIos()
  setKategoriAudioIos('play-and-record')
  void aktifWakeLockLayar()

  const isIos = apakahPerangkatIos()
  const ctxSinkron = getVoiceAudioContext()
  if (ctxSinkron) {
    const st = ctxSinkron.state as string
    if (st === 'suspended' || st === 'interrupted') {
      void ctxSinkron.resume().catch(() => {})
    }
  }

  const SpeechRecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  const punyaGetUserMedia = Boolean(navigator?.mediaDevices?.getUserMedia)

  if (!punyaGetUserMedia && !SpeechRecognitionClass) {
    options.onGalat?.('Browser Anda belum mendukung akses mikrofon.')
    return false
  }

  // Tunda wake word sementara mikrofon utama aktif
  if (wakeWordInstance) {
    try {
      wakeWordInstance.stop()
    } catch {}
  }

  let teksWebSpeech = ''
  let sudahSelesai = false
  // Toleransi jeda napas manusia (1.6 detik di iPhone agar tidak memotong kalimat saat berpikir, 1.35 detik di desktop)
  const jedaAuto = options.autoKirimDelayMs ?? (isIos ? 1600 : 1350)

  // 1. Jalankan paralel Web Speech API HANYA di non-iOS (atau jika getUserMedia tidak tersedia).
  // Di iPhone (Safari/Chrome iOS), menjalankan webkitSpeechRecognition bersamaan dengan getUserMedia memicu bentrok AVAudioSession yang memutus suara!
  let webSpeechTimer: ReturnType<typeof setTimeout> | null = null
  if (SpeechRecognitionClass && (!isIos || !punyaGetUserMedia)) {
    try {
      const recognition = new SpeechRecognitionClass()
      recognition.lang = 'id-ID'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        if (!sedangMendengar) {
          sedangMendengar = true
          options.onMulai?.()
        }
      }

      recognition.onresult = (event: any) => {
        if (sudahSelesai) return
        let gabungan = ''
        let adaFinal = false
        for (let i = 0; i < event.results.length; ++i) {
          gabungan += event.results[i][0].transcript + ' '
          if (event.results[i].isFinal) adaFinal = true
        }
        const hasil = gabungan.trim()
        if (hasil) {
          teksWebSpeech = hasil
          options.onHasil(hasil, adaFinal)

          if (webSpeechTimer) clearTimeout(webSpeechTimer)
          webSpeechTimer = setTimeout(
            () => {
              if (!sudahSelesai && teksWebSpeech.trim()) {
                finalizeMicSessionFn?.(true)
              }
            },
            adaFinal ? Math.min(1150, jedaAuto) : jedaAuto
          )
        }
      }

      recognition.onerror = (event: any) => {
        if (!punyaGetUserMedia && event.error !== 'no-speech' && event.error !== 'aborted') {
          sudahSelesai = true
          sedangMendengar = false
          options.onGalat?.(`Gagal mengakses mikrofon: ${event.error}`)
          options.onSelesai?.()
        }
      }

      recognition.onend = () => {
        if (!punyaGetUserMedia && !sudahSelesai) {
          sudahSelesai = true
          sedangMendengar = false
          if (teksWebSpeech.trim()) {
            options.onHasil(teksWebSpeech.trim(), true)
            options.onFinalOtomatis?.(teksWebSpeech.trim())
          }
          options.onSelesai?.()
        }
      }

      recognitionInstance = recognition
      recognition.start()
    } catch {
      // Abaikan jika SpeechRecognition gagal, karena kita punya getUserMedia + Server STT
    }
  }

  if (!punyaGetUserMedia) {
    return true
  }

  // 2. Buka stream mikrofon nyata dengan getUserMedia + AnalyserNode (512 FFT + TimeDomain) + MediaRecorder
  sedangMendengar = true
  options.onMulai?.()

  void (async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      if (sudahSelesai || !sedangMendengar) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      micStream = stream
      const ctx = getVoiceAudioContext()
      if (!ctx) return
      const stCtx = ctx.state as string
      if (stCtx === 'suspended' || stCtx === 'interrupted') {
        await ctx.resume().catch(() => {})
      }

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      // fftSize 512 memberi resolusi ~93Hz per bin (frekuensi vokal manusia berada di bin 1..18)
      analyser.fftSize = 512
      analyser.minDecibels = -85
      analyser.maxDecibels = -18
      analyser.smoothingTimeConstant = 0.65

      source.connect(analyser)
      micSourceNode = source
      micAnalyserNode = analyser

      // Tangkap PCM kontinu tanpa celah (lossless) agar STT di iPhone Safari & Chrome iOS 100% utuh tanpa bergantung decodeAudioData MP4
      const pcmFallbackChunks: Float32Array[] = []
      let totalPcmSamples = 0
      const maksSampelPcm = (ctx.sampleRate || 48000) * 28 // Maks ~28 detik per giliran bicara
      try {
        const processor = ctx.createScriptProcessor(4096, 1, 1)
        const silentGain = ctx.createGain()
        silentGain.gain.value = 0
        processor.onaudioprocess = (ev) => {
          if (sudahSelesai || !sedangMendengar) return
          if (totalPcmSamples < maksSampelPcm) {
            const ch = ev.inputBuffer.getChannelData(0)
            const copy = new Float32Array(ch.length)
            copy.set(ch)
            pcmFallbackChunks.push(copy)
            totalPcmSamples += copy.length
          }
        }
        source.connect(processor)
        processor.connect(silentGain)
        silentGain.connect(ctx.destination)
        micProcessorNode = processor
        micSilentGainNode = silentGain
      } catch {}

      // Mulai animasi grafik spektrum suara mikrofon secara real-time!
      mulaiLoopSpektrum()

      // Cadangan MediaRecorder (tanpa timeslice 150ms di iOS agar kontainer MP4 tidak rusak)
      const recordedBlobs: BlobPart[] = []
      let recorder: MediaRecorder | null = null
      if (typeof MediaRecorder !== 'undefined') {
        try {
          const mimePilihan =
            typeof MediaRecorder.isTypeSupported === 'function'
              ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) =>
                  MediaRecorder.isTypeSupported(m)
                )
              : undefined
          recorder = mimePilihan ? new MediaRecorder(stream, { mimeType: mimePilihan }) : new MediaRecorder(stream)
          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              recordedBlobs.push(ev.data)
            }
          }
          if (isIos) {
            recorder.start()
          } else {
            recorder.start(250)
          }
          mediaRecorderInstance = recorder
        } catch {}
      }

      const timeDomainBuf = new Float32Array(analyser.fftSize)
      let pernahBicara = false
      let waktuTerakhirBicara = Date.now()
      let waktuMulaiBicara = 0
      const waktuMulaiSesi = Date.now()

      const akhiriDanProses = async (kirimSekarang: boolean) => {
        if (sudahSelesai) return
        sudahSelesai = true
        sedangMendengar = false
        finalizeMicSessionFn = null
        if (webSpeechTimer) clearTimeout(webSpeechTimer)

        // Hentikan MediaRecorder dengan aman dan tunggu blob terakhir
        if (recorder && recorder.state !== 'inactive') {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, 250)
            recorder!.onstop = () => {
              clearTimeout(timeout)
              resolve()
            }
            try {
              recorder!.stop()
            } catch {
              clearTimeout(timeout)
              resolve()
            }
          })
        }

        const sampleRate = ctx.sampleRate || 44100
        bersihkanResourceMikrofon()
        // Kembalikan sesi audio ke mode playback segera setelah mic ditutup agar speaker utama iPhone siap bersuara lantang!
        setKategoriAudioIos('playback')
        if (!sedangBicaraFlag) void lepasWakeLockLayar()
        listenerSpektrum?.(DEFAULT_BANDS)

        // Prioritas 1: Jika Web Speech API sudah menangkap teks kalimat secara utuh
        if (teksWebSpeech.trim().length >= 2) {
          const finalTeks = teksWebSpeech.trim()
          options.onHasil(finalTeks, true)
          options.onFinalOtomatis?.(finalTeks)
          options.onSelesai?.()
          return
        }

        // Prioritas 2: Kirim rekaman suara ke /api/voice/stt (prioritaskan PCM lossless langsung agar bebas gagal decode di iOS!)
        if (kirimSekarang && (pernahBicara || pcmFallbackChunks.length > 0 || recordedBlobs.length > 0)) {
          let wavB64 = ''
          if (pcmFallbackChunks.length > 0) {
            wavB64 = encodeWav16kBase64(pcmFallbackChunks, sampleRate)
          }

          if (!wavB64 && recordedBlobs.length > 0) {
            try {
              const fullBlob = new Blob(recordedBlobs, {
                type: recorder?.mimeType || (isIos ? 'audio/mp4' : 'audio/webm'),
              })
              const arrBuf = await fullBlob.arrayBuffer()
              const decoded = await ctx.decodeAudioData(arrBuf.slice(0))
              wavB64 = encodeWav16kBase64([decoded.getChannelData(0)], decoded.sampleRate)
            } catch {}
          }

          if (wavB64.length > 200) {
            options.onHasil('⏳ Mengenali suara Anda...', false)
            try {
              const res = await fetch('/api/voice/stt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audioBase64: wavB64, format: 'wav' }),
              })
              const data = (await res.json().catch(() => ({}))) as {
                ok?: boolean
                teks?: string
                galat?: string
              }
              const teksStt = (data.teks || '').trim()
              if (res.ok && data.ok && teksStt.length >= 2) {
                options.onHasil(teksStt, true)
                options.onFinalOtomatis?.(teksStt)
                options.onSelesai?.()
                return
              }
            } catch {
              // Lanjut ke onSelesai
            }
          }
        }

        options.onHasil('', true)
        options.onSelesai?.()
      }

      finalizeMicSessionFn = (kirimSekarang: boolean) => {
        void akhiriDanProses(kirimSekarang)
      }

      // Polling 45ms pada AnalyserNode untuk deteksi aktivitas suara (VAD) & tangkapan PCM cadangan
      vadIntervalId = setInterval(() => {
        if (sudahSelesai || !sedangMendengar || !micAnalyserNode) return

        micAnalyserNode.getFloatTimeDomainData(timeDomainBuf)
        let sumSq = 0
        for (let i = 0; i < timeDomainBuf.length; i++) {
          const s = timeDomainBuf[i]
          sumSq += s * s
        }
        const rms = Math.sqrt(sumSq / timeDomainBuf.length)

        const sekarang = Date.now()
        // Threshold sensitif untuk suara bicara di mikrofon laptop/HP
        if (rms > 0.012) {
          if (!pernahBicara) {
            pernahBicara = true
            waktuMulaiBicara = sekarang
            if (!teksWebSpeech) {
              options.onHasil('🎙️ Suara terdeteksi, silakan lanjut bicara...', false)
            }
          }
          waktuTerakhirBicara = sekarang
        } else if (pernahBicara) {
          const durasiBicara = waktuTerakhirBicara - waktuMulaiBicara
          const durasiHening = sekarang - waktuTerakhirBicara
          // Jika sudah bicara minimal 220ms lalu berhenti bicara selama ~1.35 detik -> kirim otomatis!
          if (durasiBicara >= 200 && durasiHening >= jedaAuto) {
            void akhiriDanProses(true)
          }
        } else if (sekarang - waktuMulaiSesi > 25_000) {
          void akhiriDanProses(false)
        }
      }, 45)
    } catch (err) {
      if (sudahSelesai) return
      sudahSelesai = true
      sedangMendengar = false
      bersihkanResourceMikrofon()
      const msg =
        (err as Error)?.name === 'NotAllowedError'
          ? 'Izin mikrofon diblokir oleh browser. Klik ikon gembok/pengaturan situs di sebelah kiri URL lalu izinkan Microphone (Allow).'
          : `Mikrofon tidak dapat diakses: ${(err as Error)?.message || 'Periksa perangkat mikrofon Anda.'}`
      options.onGalat?.(msg)
      options.onSelesai?.()
    }
  })()

  return true
}

export function hentiMendengar(kirimJikaAdaSuara = false) {
  if (finalizeMicSessionFn) {
    const fn = finalizeMicSessionFn
    finalizeMicSessionFn = null
    fn(kirimJikaAdaSuara)
    return
  }
  sedangMendengar = false
  bersihkanResourceMikrofon()
  listenerSpektrum?.(DEFAULT_BANDS)
}

export function apakahSedangMendengar(): boolean {
  return sedangMendengar
}

/**
 * Mode Wake Word ("Halo Jarvis" / "Jarvis"):
 * Mendengarkan kata kunci pemicu di latar belakang saat mode Standby diaktifkan.
 */
export function mulaiWakeWordJarvis(onTerpanggil: (perintahLangsung?: string) => void): boolean {
  if (typeof window === 'undefined') return false
  const SpeechRecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SpeechRecognitionClass) return false

  hentiWakeWordJarvis()
  wakeWordAktif = true

  try {
    const rec = new SpeechRecognitionClass()
    rec.lang = 'id-ID'
    rec.continuous = true
    rec.interimResults = false
    rec.maxAlternatives = 1

    rec.onresult = (event: any) => {
      if (sedangMendengar || sedangBicaraFlag) return
      const last = event.results[event.results.length - 1]
      if (!last || !last[0]) return
      const transkrip = String(last[0].transcript || '').trim()
      const lower = transkrip.toLowerCase()

      const match = lower.match(/\b(?:halo\s+|hei\s+|hai\s+|oke\s+)?jarvis\b[,.\s]*(.*)/i)
      if (match) {
        const sisaPerintah = (match[1] || '').trim()
        try {
          rec.stop()
        } catch {}
        onTerpanggil(sisaPerintah || undefined)
      }
    }

    rec.onend = () => {
      if (wakeWordAktif && !sedangMendengar && !sedangBicaraFlag) {
        setTimeout(() => {
          if (wakeWordAktif && !sedangMendengar && !sedangBicaraFlag) {
            try {
              rec.start()
            } catch {}
          }
        }, 500)
      }
    }

    wakeWordInstance = rec
    if (!sedangMendengar && !sedangBicaraFlag) {
      rec.start()
    }
    return true
  } catch {
    wakeWordAktif = false
    return false
  }
}

export function hentiWakeWordJarvis() {
  wakeWordAktif = false
  if (wakeWordInstance) {
    try {
      wakeWordInstance.stop()
    } catch {}
    wakeWordInstance = null
  }
}

export function apakahWakeWordAktif(): boolean {
  return wakeWordAktif
}

/**
 * Mendaftarkan callback untuk menerima spektrum 9-band frekuensi suara Jarvis atau Mikrofon secara real-time.
 */
export function pasangListenerSpektrumSuara(cb: ((bands: number[]) => void) | null) {
  listenerSpektrum = cb
}

function mulaiLoopSpektrum() {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  const freqData = new Uint8Array(64)
  const timeData = new Uint8Array(128)

  const tick = () => {
    if (!sedangBicaraFlag && !sedangMendengar) {
      listenerSpektrum?.(DEFAULT_BANDS)
      return
    }
    const analyserAktif = activeAnalyser || micAnalyserNode
    if (analyserAktif) {
      analyserAktif.getByteFrequencyData(freqData)
      analyserAktif.getByteTimeDomainData(timeData)

      // Hitung energi amplitudo waktu nyata (time-domain RMS)
      let sumDev = 0
      let peakDev = 0
      for (let i = 0; i < timeData.length; i++) {
        const dev = Math.abs(timeData[i] - 128) / 128
        sumDev += dev * dev
        if (dev > peakDev) peakDev = dev
      }
      const rms = Math.sqrt(sumDev / timeData.length)
      const rmsBoost = Math.min(1, rms * 6.5 + peakDev * 1.8)

      // 9 band frekuensi vokal manusia (bin 1..18 pada FFT 512 mencakup ~93Hz s/d ~1700Hz)
      const bobotTengah = [0.55, 0.72, 0.88, 1.0, 1.08, 1.0, 0.88, 0.72, 0.55]
      const binIndex = [8, 6, 4, 2, 1, 3, 5, 7, 9]
      const t = Date.now() / 90

      // JIKA SEDANG BICARA (TTS playback): ketika suara jeda / hening (rms < 0.015), nol-kan spektrum!
      // Mulut dan equalizer HANYA bergerak saat ada suara audio nyata keluar dari speaker.
      const isVoiceSilent = sedangBicaraFlag && rms < 0.018 && peakDev < 0.035

      const bands: number[] = []
      for (let i = 0; i < 9; i++) {
        if (isVoiceSilent) {
          bands.push(0)
          continue
        }
        const bIdx = binIndex[i]
        const fVal = (freqData[bIdx] || 0) / 255
        // Idle breath hanya saat mic mendengarkan, BUKAN saat TTS bicara
        const idleBreath = sedangMendengar ? 0.12 + Math.abs(Math.sin(t + i * 0.65)) * 0.08 : 0
        const voiceEnergy = Math.max(fVal * 1.15, rmsBoost * bobotTengah[i])
        const nilai = Math.max(idleBreath, Math.min(1, voiceEnergy))
        bands.push(nilai)
      }
      listenerSpektrum?.(bands)
    } else if (sedangBicaraFlag) {
      // Simulasi ritmik saat memakai fallback speechSynthesis browser
      const t = Date.now() / 110
      const bands = [0.2, 0.35, 0.25, 0.5, 0.35, 0.5, 0.25, 0.35, 0.2].map((base, idx) => {
        const wave = Math.abs(Math.sin(t + idx * 0.7) * Math.cos(t * 0.6 - idx * 0.4))
        return Math.max(0.08, Math.min(0.85, base * 0.6 + wave * 0.4))
      })
      listenerSpektrum?.(bands)
    } else {
      listenerSpektrum?.(DEFAULT_BANDS)
    }
    animFrameId = requestAnimationFrame(tick)
  }

  animFrameId = requestAnimationFrame(tick)
}


export interface ProfilSuaraAkustik {
  id: string
  gender: 'Pria' | 'Wanita'
  playbackRate: number
  filterFreq: number
  filterGain: number
  filterQ: number
  browserPitch: number
  browserRate: number
  keywords: string[]
}

export const PROFIL_AKUSTIK_JARVIS: Record<string, ProfilSuaraAkustik> = {
  brian: {
    id: 'brian',
    gender: 'Pria',
    playbackRate: 1.02,
    filterFreq: 2500,
    filterGain: 2.2,
    filterQ: 1.1,
    browserPitch: 0.96,
    browserRate: 1.08,
    keywords: ['brian', 'david', 'guy', 'george', 'ardi', 'male', 'pria'],
  },
  andrew: {
    id: 'andrew',
    gender: 'Pria',
    playbackRate: 0.95,
    filterFreq: 1100,
    filterGain: 2.6,
    filterQ: 1.0,
    browserPitch: 0.86,
    browserRate: 1.00,
    keywords: ['andrew', 'ryan', 'mark', 'david', 'ardi', 'male', 'pria'],
  },
  william: {
    id: 'william',
    gender: 'Pria',
    playbackRate: 0.90,
    filterFreq: 750,
    filterGain: 3.0,
    filterQ: 1.2,
    browserPitch: 0.76,
    browserRate: 0.94,
    keywords: ['william', 'george', 'oliver', 'david', 'ardi', 'male'],
  },
  florian: {
    id: 'florian',
    gender: 'Pria',
    playbackRate: 0.82,
    filterFreq: 400,
    filterGain: 4.0,
    filterQ: 1.4,
    browserPitch: 0.60,
    browserRate: 0.90,
    keywords: ['florian', 'conrad', 'stefan', 'david', 'mark', 'ardi', 'male'],
  },
  remy: {
    id: 'remy',
    gender: 'Pria',
    playbackRate: 1.08,
    filterFreq: 3000,
    filterGain: 2.4,
    filterQ: 1.2,
    browserPitch: 1.08,
    browserRate: 1.14,
    keywords: ['remy', 'paul', 'henri', 'david', 'ardi', 'male'],
  },
  ava: {
    id: 'ava',
    gender: 'Wanita',
    playbackRate: 1.12,
    filterFreq: 3200,
    filterGain: 2.5,
    filterQ: 1.0,
    browserPitch: 1.18,
    browserRate: 1.08,
    keywords: ['ava', 'gadis', 'samantha', 'zira', 'kore', 'female', 'wanita', 'indonesia'],
  },
  emma: {
    id: 'emma',
    gender: 'Wanita',
    playbackRate: 1.18,
    filterFreq: 2600,
    filterGain: 2.0,
    filterQ: 0.9,
    browserPitch: 1.30,
    browserRate: 1.00,
    keywords: ['emma', 'jenny', 'gadis', 'zira', 'aoede', 'female', 'wanita', 'indonesia'],
  },
  ardi: {
    id: 'ardi',
    gender: 'Pria',
    playbackRate: 0.98,
    filterFreq: 1400,
    filterGain: 2.0,
    filterQ: 1.0,
    browserPitch: 0.92,
    browserRate: 1.04,
    keywords: ['ardi', 'indonesia male', 'pria', 'male', 'david', 'mark'],
  },
  gadis: {
    id: 'gadis',
    gender: 'Wanita',
    playbackRate: 1.15,
    filterFreq: 2400,
    filterGain: 2.5,
    filterQ: 1.0,
    browserPitch: 1.22,
    browserRate: 1.05,
    keywords: ['gadis', 'indonesia female', 'wanita', 'female', 'zira', 'indonesia'],
  },
}

function bicaraFallbackBrowser(
  teksBersih: string,
  onSelesai?: () => void,
  onMulai?: () => void,
  voiceId?: string
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    sedangBicaraFlag = false
    listenerSpektrum?.(DEFAULT_BANDS)
    onSelesai?.()
    return
  }

  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(teksBersih)
    const targetId = (voiceId || ambilSuaraJarvisAktif() || 'brian').toLowerCase()
    const profil = PROFIL_AKUSTIK_JARVIS[targetId] || PROFIL_AKUSTIK_JARVIS.brian

    utterance.pitch = profil.browserPitch
    utterance.rate = profil.browserRate

    const voices = window.speechSynthesis.getVoices()
    let suaraTerpilih: SpeechSynthesisVoice | undefined

    const isFemaleVoice = (v: SpeechSynthesisVoice) => {
      const n = v.name.toLowerCase()
      return (
        n.includes('female') ||
        n.includes('wanita') ||
        n.includes('gadis') ||
        n.includes('zira') ||
        n.includes('samantha') ||
        n.includes('google bahasa indonesia')
      )
    }

    const isMaleVoice = (v: SpeechSynthesisVoice) => {
      const n = v.name.toLowerCase()
      return (
        n.includes('male') ||
        n.includes('pria') ||
        n.includes('ardi') ||
        n.includes('david') ||
        n.includes('mark') ||
        n.includes('george') ||
        n.includes('brian') ||
        n.includes('andrew') ||
        n.includes('william') ||
        n.includes('florian') ||
        n.includes('remy')
      )
    }

    // 1. Cari berdasarkan preferensi keyword nama karakter yang ketat terhadap gender
    for (const kw of profil.keywords) {
      suaraTerpilih = voices.find((v) => {
        const n = v.name.toLowerCase()
        if (!n.includes(kw)) return false
        if (profil.gender === 'Pria' && isFemaleVoice(v)) return false
        if (profil.gender === 'Wanita' && isMaleVoice(v)) return false
        return true
      })
      if (suaraTerpilih) break
    }

    // 2. Jika belum ketemu dan karakternya Wanita, prioritaskan suara wanita
    if (!suaraTerpilih && profil.gender === 'Wanita') {
      suaraTerpilih =
        voices.find((v) => v.lang.startsWith('id') && isFemaleVoice(v)) ||
        voices.find((v) => isFemaleVoice(v)) ||
        voices.find((v) => v.lang.startsWith('id'))
    }

    // 3. Jika belum ketemu dan karakternya Pria, prioritaskan suara pria (JANGAN PERNAH ambil suara wanita)
    if (!suaraTerpilih && profil.gender === 'Pria') {
      suaraTerpilih =
        voices.find((v) => v.lang.startsWith('id') && isMaleVoice(v)) ||
        voices.find((v) => isMaleVoice(v)) ||
        voices.find((v) => !isFemaleVoice(v) && (v.name.includes('David') || v.name.includes('Mark') || v.lang.startsWith('en')))
    }

    // 4. Jika tetap tidak ada suara pria sama sekali di OS, gunakan suara yang ada tapi paksa pitch sangat rendah (bariton bass)
    if (!suaraTerpilih) {
      suaraTerpilih = voices[0]
      if (profil.gender === 'Pria' && suaraTerpilih && isFemaleVoice(suaraTerpilih)) {
        utterance.pitch = Math.min(0.50, profil.browserPitch)
      }
    }

    if (suaraTerpilih) {
      utterance.voice = suaraTerpilih
      utterance.lang = suaraTerpilih.lang || 'id-ID'
    } else {
      utterance.lang = 'id-ID'
    }

    let selesaiDipanggil = false
    const akhiri = () => {
      if (selesaiDipanggil) return
      selesaiDipanggil = true
      setBicaraAktifInternal(false)
      if (animFrameId) cancelAnimationFrame(animFrameId)
      listenerSpektrum?.(DEFAULT_BANDS)
      onSelesai?.()
    }

    utterance.onstart = () => {
      setBicaraAktifInternal(true)
      onMulai?.()
      mulaiLoopSpektrum()
    }

    utterance.onend = akhiri
    utterance.onerror = akhiri

    // Watchdog pengaman speechSynthesis agar tidak stuck
    const estimasiKata = Math.max(1, teksBersih.split(/\s+/).length)
    const timeoutMax = Math.min(60000, estimasiKata * 800 + 4000)
    setTimeout(() => {
      if (sedangBicaraFlag) akhiri()
    }, timeoutMax)

    window.speechSynthesis.speak(utterance)
  } catch {
    setBicaraAktifInternal(false)
    listenerSpektrum?.(DEFAULT_BANDS)
    onSelesai?.()
  }
}

/**
 * Pemutar audio berbasis HTML5 <audio playsinline> untuk iOS (iPhone Safari & Chrome iOS)
 * serta fallback otomatis bila WebAudio mengalami interupsi perangkat keras.
 */
function putarViaHtmlAudioElement(
  rawBuf: ArrayBuffer,
  contentType: string,
  onMulai?: () => void,
  onSelesai?: () => void
): boolean {
  const el = getAtauBuatAudioElement()
  if (!el) return false

  bersihkanHtmlAudioAktif()
  setKategoriAudioIos('playback')

  const blob = new Blob([rawBuf], { type: contentType || 'audio/mpeg' })
  const url = URL.createObjectURL(blob)
  activeBlobUrl = url

  let selesaiDipanggil = false
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null

  const bereskan = () => {
    if (selesaiDipanggil) return
    selesaiDipanggil = true
    if (watchdogTimer) {
      clearTimeout(watchdogTimer)
      watchdogTimer = null
    }
    if (activeBlobUrl === url) {
      try {
        URL.revokeObjectURL(url)
      } catch {}
      activeBlobUrl = null
    }
    onSelesai?.()
  }

  el.muted = false
  el.volume = 1.0
  el.playbackRate = 1.0
  el.src = url

  el.onloadedmetadata = () => {
    if (selesaiDipanggil) return
    const durasiDetik = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 15
    if (watchdogTimer) clearTimeout(watchdogTimer)
    watchdogTimer = setTimeout(bereskan, Math.ceil(durasiDetik * 1000) + 2200)
  }

  el.onended = bereskan
  el.onerror = bereskan

  // Watchdog awal sebelum metadata termuat
  watchdogTimer = setTimeout(bereskan, 25_000)

  activeAnalyser = null
  setBicaraAktifInternal(true)
  onMulai?.()
  mulaiLoopSpektrum()

  const playPromise = el.play()
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {
      bereskan()
    })
  }
  return true
}

/**
 * Membacakan respons J.A.R.V.I.S. menggunakan Neural TTS Pria Indonesia (/api/voice/tts - id-ID-ArdiNeural)
 * disertai efek akustik HUD & analisis spektrum frekuensi real-time untuk Arc Reactor & Hologram Head 3D.
 */
export function bicaraJarvis(
  teks: string,
  onSelesai?: () => void,
  opsi?: { gunakanTeksPenuh?: boolean; voiceId?: string; onMulai?: () => void }
) {
  if (typeof window === 'undefined') {
    onSelesai?.()
    return
  }

  hentiBicaraJarvis()

  const teksUcapan = opsi?.gunakanTeksPenuh ? teks : ringkasUntukSuara(teks)
  if (!teksUcapan.trim()) {
    onSelesai?.()
    return
  }

  const voicePilihan = opsi?.voiceId || ambilSuaraJarvisAktif()
  const ctxAwal = getVoiceAudioContext()

  const controller = new AbortController()
  ttsAbortController = controller

  setKategoriAudioIos('playback')

  void (async () => {
    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teks: teksUcapan, voice: voicePilihan }),
        signal: controller.signal,
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const engineHeader = (res.headers.get('X-Jarvis-Engine') || '').toLowerCase()
      const contentType = res.headers.get('Content-Type') || 'audio/mpeg'
      const isStudioNatural = engineHeader.includes('elevenlabs') || engineHeader.includes('gemini-native')

      const arrayBuf = await res.arrayBuffer()
      if (controller.signal.aborted) return

      const selesaiBersih = () => {
        setBicaraAktifInternal(false)
        if (animFrameId) cancelAnimationFrame(animFrameId)
        listenerSpektrum?.(DEFAULT_BANDS)
        onSelesai?.()
      }

      // Di iPhone / iPad, gunakan jalur hardware HTML5 <audio playsinline> agar tidak pernah terputus akibat AudioContext 'interrupted'
      if (apakahPerangkatIos()) {
        if (putarViaHtmlAudioElement(arrayBuf, contentType, opsi?.onMulai, selesaiBersih)) {
          return
        }
      }

      const ctx = ctxAwal || getVoiceAudioContext()
      if (!ctx) {
        if (!putarViaHtmlAudioElement(arrayBuf, contentType, opsi?.onMulai, selesaiBersih)) {
          bicaraFallbackBrowser(teksUcapan, onSelesai, opsi?.onMulai, voicePilihan)
        }
        return
      }

      const st = ctx.state as string
      if (st === 'suspended' || st === 'interrupted') {
        await ctx.resume().catch(() => {})
      }

      try {
        const audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0))
        if (controller.signal.aborted) return

        opsi?.onMulai?.()
        mainkanAudioBufferJarvis(ctx, audioBuffer, voicePilihan, selesaiBersih, isStudioNatural)
      } catch {
        if (controller.signal.aborted) return
        if (!putarViaHtmlAudioElement(arrayBuf, contentType, opsi?.onMulai, selesaiBersih)) {
          bicaraFallbackBrowser(teksUcapan, onSelesai, opsi?.onMulai, voicePilihan)
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      bicaraFallbackBrowser(teksUcapan, onSelesai, opsi?.onMulai, voicePilihan)
    }
  })()
}

/**
 * Memutar satu AudioBuffer dan menyambungkannya ke analyser spektrum 9-band serta speaker.
 * Jika audio berasal dari Studio Neural HD (ElevenLabs / Gemini Native), filter EQ radio & pitch-shift
 * di-bypass sepenuhnya agar vokal asli terdengar 100% hangat, jernih, dan natural.
 */
function mainkanAudioBufferJarvis(
  ctx: AudioContext,
  audioBuffer: AudioBuffer,
  voiceId: string,
  onSelesaiBuffer: () => void,
  isStudioNatural = false
): AudioBufferSourceNode {
  const profil = PROFIL_AKUSTIK_JARVIS[voiceId.toLowerCase()] || PROFIL_AKUSTIK_JARVIS.brian

  const source = ctx.createBufferSource()
  source.buffer = audioBuffer
  source.playbackRate.value = isStudioNatural ? 1.0 : profil.playbackRate

  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  analyser.smoothingTimeConstant = 0.6

  if (isStudioNatural) {
    source.connect(analyser)
  } else {
    const presenceFilter = ctx.createBiquadFilter()
    presenceFilter.type = 'peaking'
    presenceFilter.frequency.value = profil.filterFreq
    presenceFilter.Q.value = profil.filterQ
    presenceFilter.gain.value = profil.filterGain
    source.connect(presenceFilter)
    presenceFilter.connect(analyser)
  }
  analyser.connect(ctx.destination)

  activeSourceNode = source
  activeAnalyser = analyser
  setBicaraAktifInternal(true)
  mulaiLoopSpektrum()

  let selesaiDipanggil = false
  const panggilSelesai = () => {
    if (selesaiDipanggil) return
    selesaiDipanggil = true
    if (activeSourceNode === source) {
      activeSourceNode = null
      activeAnalyser = null
    }
    onSelesaiBuffer()
  }

  source.onended = panggilSelesai

  const durasiEfektif = (audioBuffer.duration || 3) / Math.max(0.5, source.playbackRate.value)
  const durasiMs = Math.ceil(durasiEfektif * 1000) + 1200
  setTimeout(() => {
    if (activeSourceNode === source && !selesaiDipanggil) {
      panggilSelesai()
    }
  }, durasiMs)

  source.start(0)
  return source
}

export interface SesiBicaraStreamOptions {
  onMulai?: () => void
  onSelesai?: () => void
  voiceId?: string
}

export interface SesiBicaraStream {
  tambahTeksStream: (teksTerkumpul: string) => void
  selesaikanStream: (teksLengkap: string) => void
  batal: () => void
}

let sesiStreamAktif: SesiBicaraStream | null = null

/**
 * Rolling Sentence-by-Sentence Streaming TTS:
 * Memecah stream teks LLM per kalimat utuh secara real-time, mensintesis kalimat berikutnya di latar belakang
 * selagi kalimat sebelumnya sedang diucapkan, dan memutarnya secara berkesinambungan tanpa jeda hening kaku.
 */
export function buatSesiBicaraStreamJarvis(
  opsi?: SesiBicaraStreamOptions
): SesiBicaraStream {
  hentiBicaraJarvis()

  setKategoriAudioIos('playback')
  const isIos = apakahPerangkatIos()
  const voicePilihan = opsi?.voiceId || ambilSuaraJarvisAktif()
  const ctxAwal = getVoiceAudioContext()
  if (ctxAwal) {
    const st = ctxAwal.state as string
    if (st === 'suspended' || st === 'interrupted') {
      void ctxAwal.resume().catch(() => {})
    }
  }

  type PaketAudioMentah = {
    rawBuf: ArrayBuffer
    contentType: string
    isStudio: boolean
  }

  let dibatalkan = false
  let streamSelesai = false
  let sudahMulaiCallback = false
  let jumlahKalimatTerkirim = 0
  let sudahKirimTanpaTagSuara = false
  let indeksPutar = 0
  let loopPemutarAktif = false
  let selesaiTotalDipanggil = false
  let engineTerkunci = ''
  let teksKalimatSebelumnya = ''
  let rantaiSintesis: Promise<void> = Promise.resolve()
  const daftarController: AbortController[] = []
  const antreanPromise: Array<Promise<PaketAudioMentah | null>> = []

  const selesaiTotal = () => {
    if (dibatalkan || selesaiTotalDipanggil) return
    selesaiTotalDipanggil = true
    setBicaraAktifInternal(false)
    if (animFrameId) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
    activeSourceNode = null
    activeAnalyser = null
    listenerSpektrum?.(DEFAULT_BANDS)
    if (sesiStreamAktif === sesi) {
      sesiStreamAktif = null
    }
    opsi?.onSelesai?.()
  }

  const mintaTtsAudio = async (
    teksKirim: string,
    controller: AbortController,
    konteksSebelumnya = ''
  ): Promise<PaketAudioMentah | null> => {
    // Unduh bytes audio mentah secara berurutan (dengan hingga 3x percobaan bila sinyal seluler kedip),
    // sekaligus mengunci engine & previous_text agar karakter suara 100% identik dari kalimat pertama hingga terakhir!
    for (let coba = 0; coba < 3; coba++) {
      if (controller.signal.aborted || dibatalkan) return null
      try {
        const res = await fetch('/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teks: teksKirim,
            voice: voicePilihan,
            ...(konteksSebelumnya ? { teksSebelumnya: konteksSebelumnya } : {}),
            ...(engineTerkunci ? { kunciEngine: engineTerkunci } : {}),
          }),
          signal: controller.signal,
        })
        if (!res.ok) {
          if (coba < 2) {
            await new Promise((r) => setTimeout(r, 350 * (coba + 1)))
            continue
          }
          return null
        }

        const engineHeader = (res.headers.get('X-Jarvis-Engine') || '').toLowerCase()
        if (!engineTerkunci) {
          if (engineHeader.includes('elevenlabs')) engineTerkunci = 'elevenlabs'
          else if (engineHeader.includes('gemini-native')) engineTerkunci = 'gemini-native-tts'
          else if (engineHeader.includes('cloud-neural')) engineTerkunci = 'cloud-neural-hd'
        }
        const contentType = res.headers.get('Content-Type') || 'audio/mpeg'
        const isStudio = engineHeader.includes('elevenlabs') || engineHeader.includes('gemini-native')

        const arrayBuf = await res.arrayBuffer()
        if (controller.signal.aborted || dibatalkan || arrayBuf.byteLength < 64) return null

        return { rawBuf: arrayBuf, contentType, isStudio }
      } catch {
        if (controller.signal.aborted || dibatalkan) return null
        if (coba < 2) {
          await new Promise((r) => setTimeout(r, 350 * (coba + 1)))
        }
      }
    }
    return null
  }

  const putarSatuPaketAsync = (paket: PaketAudioMentah): Promise<void> => {
    return new Promise((resolve) => {
      if (dibatalkan) {
        resolve()
        return
      }

      const panggilMulaiSekali = () => {
        if (!sudahMulaiCallback) {
          sudahMulaiCallback = true
          opsi?.onMulai?.()
        }
      }

      const lanjutSetelahJeda = () => {
        setTimeout(resolve, 45)
      }

      // Di iPhone / iPad, putar langsung via singleton <audio playsinline> agar antarkalimat tidak pernah mati di tengah jalan
      if (isIos) {
        if (putarViaHtmlAudioElement(paket.rawBuf, paket.contentType, panggilMulaiSekali, lanjutSetelahJeda)) {
          return
        }
      }

      void (async () => {
        const ctx = ctxAwal || getVoiceAudioContext()
        if (!ctx) {
          if (!putarViaHtmlAudioElement(paket.rawBuf, paket.contentType, panggilMulaiSekali, lanjutSetelahJeda)) {
            resolve()
          }
          return
        }

        const st = ctx.state as string
        if (st === 'suspended' || st === 'interrupted') {
          await ctx.resume().catch(() => {})
        }

        try {
          const buf = await ctx.decodeAudioData(paket.rawBuf.slice(0))
          if (dibatalkan) {
            resolve()
            return
          }
          panggilMulaiSekali()
          mainkanAudioBufferJarvis(ctx, buf, voicePilihan, lanjutSetelahJeda, paket.isStudio)
        } catch {
          if (dibatalkan) {
            resolve()
            return
          }
          if (!putarViaHtmlAudioElement(paket.rawBuf, paket.contentType, panggilMulaiSekali, lanjutSetelahJeda)) {
            resolve()
          }
        }
      })()
    })
  }

  const jalankanPemutarAntrean = async () => {
    if (loopPemutarAktif || dibatalkan) return
    loopPemutarAktif = true

    try {
      while (!dibatalkan && indeksPutar < antreanPromise.length) {
        const tugas = antreanPromise[indeksPutar]
        indeksPutar++
        const hasil = await tugas
        if (dibatalkan) return
        if (hasil?.rawBuf) {
          await putarSatuPaketAsync(hasil)
        }
      }
    } finally {
      loopPemutarAktif = false
    }

    if (!dibatalkan && indeksPutar < antreanPromise.length) {
      void jalankanPemutarAntrean()
      return
    }

    if (!dibatalkan && streamSelesai && indeksPutar >= antreanPromise.length) {
      selesaiTotal()
    }
  }

  const antrekanKalimatBaru = (kalimatList: string[]) => {
    if (dibatalkan) return
    while (jumlahKalimatTerkirim < kalimatList.length) {
      const kalimat = kalimatList[jumlahKalimatTerkirim]
      jumlahKalimatTerkirim++
      if (!kalimat.trim()) continue
      const konteksSebelumnya = teksKalimatSebelumnya
      teksKalimatSebelumnya = kalimat
      const ctrl = new AbortController()
      daftarController.push(ctrl)
      // Antrekan sintesis secara berurutan (prefetch kalimat N+1 saat kalimat N sedang diputar)
      // agar tidak pernah terkena HTTP 429 concurrency limit dan engineTerkunci terwariskan utuh!
      const tugasPaket = new Promise<PaketAudioMentah | null>((resolvePaket) => {
        rantaiSintesis = rantaiSintesis
          .then(async () => {
            if (dibatalkan || ctrl.signal.aborted) {
              resolvePaket(null)
              return
            }
            const pkt = await mintaTtsAudio(kalimat, ctrl, konteksSebelumnya)
            resolvePaket(pkt)
          })
          .catch(() => resolvePaket(null))
      })
      antreanPromise.push(tugasPaket)
    }
    void jalankanPemutarAntrean()
  }

  const sesi: SesiBicaraStream = {
    tambahTeksStream: (teksTerkumpul: string) => {
      if (dibatalkan || streamSelesai) return
      const adaTagSuara = /<suara>/i.test(teksTerkumpul)
      const siap = ekstrakAntreanKalimatSuara(teksTerkumpul, false, sudahKirimTanpaTagSuara)
      if (siap.length > jumlahKalimatTerkirim) {
        if (jumlahKalimatTerkirim === 0 && !adaTagSuara) {
          sudahKirimTanpaTagSuara = true
        }
        antrekanKalimatBaru(siap)
      }
    },

    selesaikanStream: (teksLengkap: string) => {
      if (dibatalkan || streamSelesai) return
      streamSelesai = true

      const kalimatAkhir = ekstrakAntreanKalimatSuara(teksLengkap, true, sudahKirimTanpaTagSuara)
      if (kalimatAkhir.length === 0) {
        selesaiTotal()
        return
      }

      // Jika belum ada 1 pun kalimat yang dikirim saat stream berakhir, antrekan sekaligus dengan fallback browser bila gagal
      if (jumlahKalimatTerkirim === 0) {
        const gabunganPenuh = kalimatAkhir.join(' ')
        jumlahKalimatTerkirim = kalimatAkhir.length
        const ctrl = new AbortController()
        daftarController.push(ctrl)
        void (async () => {
          const hasil = await mintaTtsAudio(gabunganPenuh, ctrl)
          if (dibatalkan) return
          if (hasil?.rawBuf) {
            await putarSatuPaketAsync(hasil)
            if (!dibatalkan) selesaiTotal()
          } else {
            selesaiTotalDipanggil = true
            bicaraFallbackBrowser(gabunganPenuh, opsi?.onSelesai, opsi?.onMulai, voicePilihan)
          }
        })()
        return
      }

      if (kalimatAkhir.length > jumlahKalimatTerkirim) {
        antrekanKalimatBaru(kalimatAkhir)
      } else if (!loopPemutarAktif && indeksPutar >= antreanPromise.length) {
        selesaiTotal()
      }
    },

    batal: () => {
      if (dibatalkan) return
      dibatalkan = true
      for (const c of daftarController) {
        try {
          c.abort()
        } catch {}
      }
      daftarController.length = 0
      antreanPromise.length = 0

      if (activeSourceNode) {
        try {
          activeSourceNode.onended = null
          activeSourceNode.stop()
          activeSourceNode.disconnect()
        } catch {}
        activeSourceNode = null
      }
      bersihkanHtmlAudioAktif()
      activeAnalyser = null
      setBicaraAktifInternal(false)
      if (animFrameId) {
        cancelAnimationFrame(animFrameId)
        animFrameId = null
      }
      listenerSpektrum?.(DEFAULT_BANDS)
      if (sesiStreamAktif === sesi) {
        sesiStreamAktif = null
      }
    },
  }

  sesiStreamAktif = sesi
  return sesi
}

export function hentiBicaraJarvis() {
  if (sesiStreamAktif) {
    sesiStreamAktif.batal()
    sesiStreamAktif = null
  }
  bersihkanHtmlAudioAktif()
  setBicaraAktifInternal(false)
  if (ttsAbortController) {
    ttsAbortController.abort()
    ttsAbortController = null
  }
  if (activeSourceNode) {
    try {
      activeSourceNode.onended = null
      activeSourceNode.stop()
      activeSourceNode.disconnect()
    } catch {}
    activeSourceNode = null
  }
  activeAnalyser = null
  if (animFrameId) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel()
    } catch {}
  }
  listenerSpektrum?.(DEFAULT_BANDS)
}

export function apakahSedangBicaraJarvis(): boolean {
  return sedangBicaraFlag
}
