// Sistem Interaksi Suara J.A.R.V.I.S. (Dual-Engine Voice-to-Voice: Web Audio Mic Stream + MediaRecorder WAV + AI Server STT + Web Speech API)
// Bekerja di SEMUA browser (Chrome, Brave, Edge, Firefox, Safari) dengan visualisasi spektrum mikrofon real-time yang responsif.

let recognitionInstance: any = null
let wakeWordInstance: any = null
let sedangMendengar = false
let wakeWordAktif = false

// State untuk perekaman mikrofon langsung (Universal Web Audio + MediaRecorder + VAD)
let micStream: MediaStream | null = null
let micSourceNode: MediaStreamAudioSourceNode | null = null
let micAnalyserNode: AnalyserNode | null = null
let mediaRecorderInstance: MediaRecorder | null = null
let vadIntervalId: ReturnType<typeof setInterval> | null = null
let finalizeMicSessionFn: ((kirimSekarang: boolean) => void) | null = null

let audioCtxVoice: AudioContext | null = null
let activeSourceNode: AudioBufferSourceNode | null = null
let activeAnalyser: AnalyserNode | null = null
let ttsAbortController: AbortController | null = null
let sedangBicaraFlag = false
let animFrameId: number | null = null
let listenerSpektrum: ((bands: number[]) => void) | null = null

const DEFAULT_BANDS = [0.15, 0.25, 0.18, 0.35, 0.22, 0.35, 0.18, 0.25, 0.15]
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
    label: 'BRIAN (Jarvis Natural)',
    deskripsi: 'Pria Bariton Luwes & Mengalir',
    gender: 'Pria',
  },
  {
    id: 'andrew',
    label: 'ANDREW (Eksekutif Santai)',
    deskripsi: 'Pria Hangat & Percakapan Natural',
    gender: 'Pria',
  },
  {
    id: 'ardi',
    label: 'ARDI (Komando Tegas)',
    deskripsi: 'Pria Indonesia Formal & Jelas',
    gender: 'Pria',
  },
  {
    id: 'ava',
    label: 'F.R.I.D.A.Y. / AVA (Wanita AI)',
    deskripsi: 'Wanita AI Luwes & Natural',
    gender: 'Wanita',
  },
  {
    id: 'gadis',
    label: 'GADIS (Asisten Ramah)',
    deskripsi: 'Wanita Indonesia Jernih & Santun',
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
    }
  }
  if (audioCtxVoice && audioCtxVoice.state === 'suspended') {
    void audioCtxVoice.resume().catch(() => {})
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
export function ringkasUntukSuara(teks: string): string {
  if (!teks) return ''

  const matchSuara = teks.match(/<suara>([\s\S]*?)<\/suara>/i)
  const sumberTeks = matchSuara ? matchSuara[1] : teks

  const barisBersih = sumberTeks
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => {
      if (!b) return false
      if (b.startsWith('|') && b.endsWith('|')) return false
      if (/^[-━═*]{3,}$/.test(b)) return false
      if (/^\[!(NOTE|WARNING|IMPORTANT|TIP|CAUTION)\]/i.test(b)) return false
      if (b.startsWith('📍') && b.includes('_Sumber:')) return false
      // Buang baris judul dokumen/bab laporan yang kaku
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
        .replace(/^Total Omzet(?:\s+Jaringan)?\s*(Hari Ini|Kemarin)?\s*:\s*/i, 'Total omzet $1 ada di angka ')
        .replace(/^Total Penjualan(?:\s+Jaringan)?\s*(Hari Ini|Kemarin)?\s*:\s*/i, 'Total penjualan $1 mencapai ')
        .replace(
          /^Total(?:\s+Akumulasi)?\s+(?:Order|Transaksi)\s*(Hari Ini|Kemarin)?\s*:\s*/i,
          'dengan total transaksi $1 sebanyak '
        )
        .replace(
          /^Rata-rata\s+(?:Order|Struk)(?:\s*\(AOV\))?\s*(Hari Ini|Kemarin)?\s*:\s*/i,
          'dan rata-rata nilai struk '
        )
        .replace(/^TEMUAN PENTING\s*:\s*/i, 'Sebagai catatan penting, ')
        .replace(/^PERINGATAN(?:\s+MIKROFON)?\s*:\s*/i, 'Perhatian, ')
        .replace(/^([A-Za-z0-9\s/()-]{3,32})\s*:\s+/i, '$1 tercatat ')

      return line
    })

  const kandidat = barisBersih.slice(0, 4).join('. ')

  let s = kandidat
    .replace(/\.\s*\./g, '.')
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
    .replace(/\b(\d{1,3})\.(\d{3})(?!\d)/g, '$1$2')
    .replace(
      /\(\s*(\d+\s*(?:struk|order|transaksi|cabang|outlet|PO|laporan|kru|ulasan)[^)]*)\)/gi,
      ', yaitu $1, '
    )
    .replace(/\bSUKA SHAWARMA\s+/gi, 'Cabang ')
    .replace(/\bCabang\s+Cabang\s+/gi, 'Cabang ')
    .replace(/\bBerikut adalah\b/gi, 'Ini untuk')
    .replace(/\bBerikut rincian\b/gi, 'Ini rincian')
    .replace(/\bTidak terdapat\b/gi, 'Belum ada')
    .replace(/\bTercatat sebesar\b/gi, 'ada di angka')
    .replace(/J\.A\.R\.V\.I\.S\.?/gi, 'Jarvis')
    .replace(/F\.R\.I\.D\.A\.Y\.?/gi, 'Friday')
    .replace(/[#*_`~[\]()]/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim()

  if (s.length > 380) {
    const potong = s.slice(0, 380)
    const titik = Math.max(potong.lastIndexOf('. '), potong.lastIndexOf('! '), potong.lastIndexOf('? '))
    s = titik > 110 ? potong.slice(0, titik + 1) : potong + '.'
  }

  return s
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

  // PENTING: Bangunkan AudioContext secara sinkron tepat di dalam event klik user!
  const ctxSinkron = getVoiceAudioContext()
  if (ctxSinkron && ctxSinkron.state === 'suspended') {
    void ctxSinkron.resume().catch(() => {})
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
  const jedaAuto = options.autoKirimDelayMs ?? 1350

  // 1. Jalankan paralel Web Speech API (jika ada) untuk live teks instan
  let webSpeechTimer: ReturnType<typeof setTimeout> | null = null
  if (SpeechRecognitionClass) {
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
            adaFinal ? Math.min(850, jedaAuto) : jedaAuto
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
      if (ctx.state === 'suspended') {
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

      // Mulai animasi grafik spektrum suara mikrofon secara real-time!
      mulaiLoopSpektrum()

      // Rekam audio mikrofon via MediaRecorder untuk dikirim ke /api/voice/stt
      const recordedBlobs: BlobPart[] = []
      let recorder: MediaRecorder | null = null
      if (typeof MediaRecorder !== 'undefined') {
        try {
          recorder = new MediaRecorder(stream)
          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              recordedBlobs.push(ev.data)
            }
          }
          recorder.start(150)
          mediaRecorderInstance = recorder
        } catch {}
      }

      const timeDomainBuf = new Float32Array(analyser.fftSize)
      const pcmFallbackChunks: Float32Array[] = []
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
        listenerSpektrum?.(DEFAULT_BANDS)

        // Prioritas 1: Jika Web Speech API sudah menangkap teks kalimat secara utuh
        if (teksWebSpeech.trim().length >= 2) {
          const finalTeks = teksWebSpeech.trim()
          options.onHasil(finalTeks, true)
          options.onFinalOtomatis?.(finalTeks)
          options.onSelesai?.()
          return
        }

        // Prioritas 2: Kirim rekaman suara ke /api/voice/stt (9Router Gemini Audio)
        if (kirimSekarang && (pernahBicara || recordedBlobs.length > 0)) {
          let wavB64 = ''
          try {
            if (recordedBlobs.length > 0) {
              const fullBlob = new Blob(recordedBlobs, {
                type: recorder?.mimeType || 'audio/webm',
              })
              const arrBuf = await fullBlob.arrayBuffer()
              const decoded = await ctx.decodeAudioData(arrBuf.slice(0))
              wavB64 = encodeWav16kBase64([decoded.getChannelData(0)], decoded.sampleRate)
            }
          } catch {
            // Fallback ke sampel PCM langsung jika decodeAudioData gagal
          }

          if (!wavB64 && pcmFallbackChunks.length > 0) {
            wavB64 = encodeWav16kBase64(pcmFallbackChunks, sampleRate)
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

        if (pcmFallbackChunks.length < 400) {
          pcmFallbackChunks.push(new Float32Array(timeDomainBuf))
        }

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
          if (durasiBicara >= 220 && durasiHening >= jedaAuto) {
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

      // Hitung energi amplitudo waktu nyata (time-domain RMS) agar suara pelan di mic tetap menggerakkan grafik dengan jelas
      let sumDev = 0
      let peakDev = 0
      for (let i = 0; i < timeData.length; i++) {
        const dev = Math.abs(timeData[i] - 128) / 128
        sumDev += dev * dev
        if (dev > peakDev) peakDev = dev
      }
      const rmsBoost = Math.min(1, Math.sqrt(sumDev / timeData.length) * 6.5 + peakDev * 1.8)

      // 9 band frekuensi vokal manusia (bin 1..18 pada FFT 512 mencakup ~93Hz s/d ~1700Hz)
      // Disusun simetris (center-weighted) agar bar tengah paling tinggi saat bicara
      const bobotTengah = [0.55, 0.72, 0.88, 1.0, 1.08, 1.0, 0.88, 0.72, 0.55]
      const binIndex = [8, 6, 4, 2, 1, 3, 5, 7, 9]
      const t = Date.now() / 90

      const bands: number[] = []
      for (let i = 0; i < 9; i++) {
        const bIdx = binIndex[i]
        const fVal = (freqData[bIdx] || 0) / 255
        // Gelombang hidup halus saat mic aktif menunggu suara + lonjakan drastis saat ada suara
        const idleBreath = 0.16 + Math.abs(Math.sin(t + i * 0.65)) * 0.1
        const voiceEnergy = Math.max(fVal * 1.15, rmsBoost * bobotTengah[i])
        const nilai = Math.max(idleBreath, Math.min(1, voiceEnergy))
        bands.push(nilai)
      }
      listenerSpektrum?.(bands)
    } else {
      // Simulasi organik saat memakai fallback speechSynthesis
      const t = Date.now() / 110
      const bands = DEFAULT_BANDS.map((_, idx) => {
        const wave = Math.abs(Math.sin(t + idx * 0.7) * Math.cos(t * 0.6 - idx * 0.4))
        return Math.max(0.18, Math.min(0.95, 0.22 + wave * 0.75))
      })
      listenerSpektrum?.(bands)
    }
    animFrameId = requestAnimationFrame(tick)
  }

  animFrameId = requestAnimationFrame(tick)
}

function bicaraFallbackBrowser(teksBersih: string, onSelesai?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    sedangBicaraFlag = false
    listenerSpektrum?.(DEFAULT_BANDS)
    onSelesai?.()
    return
  }

  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(teksBersih)
    utterance.lang = 'id-ID'
    utterance.rate = 1.06
    utterance.pitch = 0.92

    const voices = window.speechSynthesis.getVoices()
    const suaraId =
      voices.find((v) => v.lang.startsWith('id') && v.name.toLowerCase().includes('ardi')) ||
      voices.find((v) => v.lang.startsWith('id') || v.name.toLowerCase().includes('indonesia'))
    if (suaraId) {
      utterance.voice = suaraId
    }

    sedangBicaraFlag = true
    mulaiLoopSpektrum()

    const akhiri = () => {
      sedangBicaraFlag = false
      if (animFrameId) cancelAnimationFrame(animFrameId)
      listenerSpektrum?.(DEFAULT_BANDS)
      onSelesai?.()
    }

    utterance.onend = akhiri
    utterance.onerror = akhiri
    window.speechSynthesis.speak(utterance)
  } catch {
    sedangBicaraFlag = false
    listenerSpektrum?.(DEFAULT_BANDS)
    onSelesai?.()
  }
}

/**
 * Membacakan respons J.A.R.V.I.S. menggunakan Neural TTS Pria Indonesia (/api/voice/tts - id-ID-ArdiNeural)
 * disertai efek akustik HUD & analisis spektrum frekuensi real-time untuk Arc Reactor.
 */
export function bicaraJarvis(
  teks: string,
  onSelesai?: () => void,
  opsi?: { gunakanTeksPenuh?: boolean; voiceId?: string }
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

  sedangBicaraFlag = true
  const controller = new AbortController()
  ttsAbortController = controller

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

      const arrayBuf = await res.arrayBuffer()
      if (controller.signal.aborted) return

      const ctx = getVoiceAudioContext()
      if (!ctx) {
        bicaraFallbackBrowser(teksUcapan, onSelesai)
        return
      }

      const audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0))
      if (controller.signal.aborted) return

      const source = ctx.createBufferSource()
      source.buffer = audioBuffer

      // Filter akustik halus ala helm/HUD J.A.R.V.I.S. (sedikit presence boost di 2.5kHz)
      const presenceFilter = ctx.createBiquadFilter()
      presenceFilter.type = 'peaking'
      presenceFilter.frequency.value = 2500
      presenceFilter.Q.value = 1.1
      presenceFilter.gain.value = 2.5

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.7

      source.connect(presenceFilter)
      presenceFilter.connect(analyser)
      analyser.connect(ctx.destination)

      activeSourceNode = source
      activeAnalyser = analyser
      sedangBicaraFlag = true
      mulaiLoopSpektrum()

      source.onended = () => {
        if (activeSourceNode === source) {
          activeSourceNode = null
          activeAnalyser = null
          sedangBicaraFlag = false
          if (animFrameId) cancelAnimationFrame(animFrameId)
          listenerSpektrum?.(DEFAULT_BANDS)
          onSelesai?.()
        }
      }

      source.start(0)
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      // Fallback mulus ke Web Speech API browser jika jaringan/server TTS terkendala
      bicaraFallbackBrowser(teksUcapan, onSelesai)
    }
  })()
}

export function hentiBicaraJarvis() {
  sedangBicaraFlag = false
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
