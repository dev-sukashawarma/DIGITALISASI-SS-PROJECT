// Sistem Interaksi Suara J.A.R.V.I.S. (Dual-Engine Voice-to-Voice: Web Audio Mic Stream + VAD + AI Server STT + Web Speech API)
// Bekerja di SEMUA browser (Chrome, Brave, Edge, Firefox, Safari) menggunakan tangkapan mikrofon langsung (16kHz Mono WAV)
// yang dikirim ke /api/voice/stt serta live interim preview dari Web Speech API jika tersedia.

let recognitionInstance: any = null
let wakeWordInstance: any = null
let sedangMendengar = false
let wakeWordAktif = false

// State untuk perekaman mikrofon langsung (Universal Web Audio + VAD)
let micStream: MediaStream | null = null
let micSourceNode: MediaStreamAudioSourceNode | null = null
let micAnalyserNode: AnalyserNode | null = null
let micProcessorNode: ScriptProcessorNode | null = null
let micMuteGainNode: GainNode | null = null
let finalizeMicSessionFn: ((kirimSekarang: boolean) => void) | null = null

let audioCtxVoice: AudioContext | null = null
let activeSourceNode: AudioBufferSourceNode | null = null
let activeAnalyser: AnalyserNode | null = null
let ttsAbortController: AbortController | null = null
let sedangBicaraFlag = false
let animFrameId: number | null = null
let listenerSpektrum: ((bands: number[]) => void) | null = null

const DEFAULT_BANDS = [0.15, 0.25, 0.18, 0.35, 0.22, 0.35, 0.18, 0.25, 0.15]

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
 * Meringkas jawaban panjang/markdown menjadi 2-4 kalimat eksekutif yang enak didengar saat diucapkan J.A.R.V.I.S.
 * Tabel dan rincian panjang tetap tampil di layar HUD, sedangkan suara hanya membacakan intisarinya.
 */
export function ringkasUntukSuara(teks: string): string {
  if (!teks) return ''

  const barisBersih = teks
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => {
      if (!b) return false
      if (b.startsWith('|') && b.endsWith('|')) return false
      if (/^[-━═]{3,}$/.test(b)) return false
      if (/^\[!(NOTE|WARNING|IMPORTANT|TIP|CAUTION)\]/i.test(b)) return false
      if (b.startsWith('📍') && b.includes('_Sumber:')) return false
      return true
    })
    .map((b) =>
      b
        .replace(/^#{1,6}\s+/, '')
        .replace(/^>\s*/, '')
        .replace(/^[-*•]\s+/, '')
        .replace(/^\d+\.\s+/, '')
    )

  const kandidat = barisBersih.slice(0, 4).join('. ')

  let s = kandidat
    .replace(/\.\s*\./g, '.')
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
    .replace(/J\.A\.R\.V\.I\.S\.?/gi, 'Jarvis')
    .replace(/[#*_`~[\]()]/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (s.length > 380) {
    const potong = s.slice(0, 380)
    const titik = Math.max(potong.lastIndexOf('. '), potong.lastIndexOf('! '), potong.lastIndexOf('? '))
    s = titik > 120 ? potong.slice(0, titik + 1) : potong + '.'
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
  if (micProcessorNode) {
    try {
      micProcessorNode.onaudioprocess = null
      micProcessorNode.disconnect()
    } catch {}
    micProcessorNode = null
  }
  if (micSourceNode) {
    try {
      micSourceNode.disconnect()
    } catch {}
    micSourceNode = null
  }
  if (micMuteGainNode) {
    try {
      micMuteGainNode.disconnect()
    } catch {}
    micMuteGainNode = null
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
        // Jika getUserMedia TIDAK tersedia dan Web Speech gagal, laporkan galatnya
        if (!punyaGetUserMedia && event.error !== 'no-speech' && event.error !== 'aborted') {
          sudahSelesai = true
          sedangMendengar = false
          options.onGalat?.(`Gagal mengakses mikrofon: ${event.error}`)
          options.onSelesai?.()
        }
      }

      recognition.onend = () => {
        // Jika hanya mengandalkan Web Speech tanpa getUserMedia (misal di unit test)
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

  // 2. Jika hanya di lingkungan test atau browser tanpa getUserMedia, selesai di sini
  if (!punyaGetUserMedia) {
    return true
  }

  // 3. Buka stream mikrofon nyata dengan getUserMedia + VAD + Spektrum Visualizer + Server AI STT Fallback
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

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.7

      const processor = ctx.createScriptProcessor(4096, 1, 1)
      const muteGain = ctx.createGain()
      muteGain.gain.value = 0

      source.connect(analyser)
      analyser.connect(processor)
      processor.connect(muteGain)
      muteGain.connect(ctx.destination)

      micSourceNode = source
      micAnalyserNode = analyser
      micProcessorNode = processor
      micMuteGainNode = muteGain

      mulaiLoopSpektrum()

      const pcmChunks: Float32Array[] = []
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

        // Prioritas 2: Jika ada suara yang terekam di mikrofon, kirim ke /api/voice/stt (9Router Gemini Audio)
        if (kirimSekarang && (pernahBicara || pcmChunks.length > 4)) {
          const wavB64 = encodeWav16kBase64(pcmChunks, sampleRate)
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
              // Abaikan dan lanjut ke onSelesai
            }
          }
        }

        options.onHasil('', true)
        options.onSelesai?.()
      }

      finalizeMicSessionFn = (kirimSekarang: boolean) => {
        void akhiriDanProses(kirimSekarang)
      }

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (sudahSelesai || !sedangMendengar) return
        const input = e.inputBuffer.getChannelData(0)

        // Hitung energi RMS suara untuk Voice Activity Detection (VAD)
        let sumSq = 0
        for (let i = 0; i < input.length; i++) {
          sumSq += input[i] * input[i]
        }
        const rms = Math.sqrt(sumSq / input.length)

        // Simpan sampel audio (maksimal ~20 detik terakhir)
        if (pcmChunks.length < 240) {
          pcmChunks.push(new Float32Array(input))
        }

        const sekarang = Date.now()
        // Threshold suara bicara manusia normal
        if (rms > 0.016) {
          if (!pernahBicara) {
            pernahBicara = true
            waktuMulaiBicara = sekarang
            if (!teksWebSpeech) {
              options.onHasil('🎙️ Mendeteksi suara Anda...', false)
            }
          }
          waktuTerakhirBicara = sekarang
        } else if (pernahBicara) {
          const durasiBicara = waktuTerakhirBicara - waktuMulaiBicara
          const durasiHening = sekarang - waktuTerakhirBicara
          // Jika sudah bicara minimal 250ms lalu berhenti bicara selama ~1.35 detik -> kirim otomatis!
          if (durasiBicara >= 250 && durasiHening >= jedaAuto) {
            void akhiriDanProses(true)
          }
        } else if (sekarang - waktuMulaiSesi > 25_000) {
          // Timeout aman jika mikrofon dibiarkan tanpa bicara selama 25 detik
          void akhiriDanProses(false)
        }
      }
    } catch (err) {
      if (sudahSelesai) return
      // Jika getUserMedia ditolak izinnya (NotAllowedError), beri tahu pengguna dengan jelas
      sudahSelesai = true
      sedangMendengar = false
      bersihkanResourceMikrofon()
      const msg = (err as Error)?.name === 'NotAllowedError'
        ? 'Izin mikrofon diblokir oleh browser. Klik ikon gembok/mikrofon di address bar lalu pilih Allow (Izinkan).'
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
  const dataArray = new Uint8Array(32)

  const tick = () => {
    if (!sedangBicaraFlag && !sedangMendengar) {
      listenerSpektrum?.(DEFAULT_BANDS)
      return
    }
    const analyserAktif = activeAnalyser || micAnalyserNode
    if (analyserAktif) {
      analyserAktif.getByteFrequencyData(dataArray)
      const bands: number[] = []
      for (let i = 0; i < 9; i++) {
        const v1 = dataArray[i * 2 + 1] || 0
        const v2 = dataArray[i * 2 + 2] || 0
        const avg = (v1 + v2) / 510
        bands.push(Math.max(0.14, Math.min(1, avg * 1.65)))
      }
      listenerSpektrum?.(bands)
    } else {
      // Simulasi organik saat memakai fallback speechSynthesis
      const t = Date.now() / 110
      const bands = DEFAULT_BANDS.map((_, idx) => {
        const wave = Math.abs(Math.sin(t + idx * 0.7) * Math.cos(t * 0.6 - idx * 0.4))
        return Math.max(0.15, Math.min(0.95, 0.2 + wave * 0.75))
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
  opsi?: { gunakanTeksPenuh?: boolean }
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

  sedangBicaraFlag = true
  const controller = new AbortController()
  ttsAbortController = controller

  void (async () => {
    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teks: teksUcapan }),
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
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.75

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
