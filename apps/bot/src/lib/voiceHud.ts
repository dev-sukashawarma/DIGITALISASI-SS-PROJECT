// Sistem Interaksi Suara J.A.R.V.I.S. (Voice-to-Voice, Auto-Turn STT, Wake Word, & Neural TTS + Visualizer)
// Menggunakan Neural TTS Server (/api/voice/tts - id-ID-ArdiNeural) + Web Audio API AnalyserNode,
// dengan fallback instan ke Web Speech API browser-native.

let recognitionInstance: any = null
let wakeWordInstance: any = null
let sedangMendengar = false
let wakeWordAktif = false

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
  const stt = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  const tts = 'speechSynthesis' in window || typeof AudioContext !== 'undefined' || 'webkitAudioContext' in window
  return { stt, tts }
}

/**
 * Meringkas jawaban panjang/markdown menjadi 2-4 kalimat eksekutif yang enak didengar saat diucapkan J.A.R.V.I.S.
 * Tabel dan rincian panjang tetap tampil di layar HUD, sedangkan suara hanya membacakan intisarinya.
 */
export function ringkasUntukSuara(teks: string): string {
  if (!teks) return ''

  // Pisahkan per baris dan buang baris tabel markdown atau garis pemisah
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

  // Ambil maksimal 4 baris informatif pertama agar ringkas dan taktis
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

export function mulaiMendengar(options: ListenerSuaraOptions): boolean {
  if (typeof window === 'undefined') return false

  const SpeechRecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

  if (!SpeechRecognitionClass) {
    options.onGalat?.('Browser Anda belum mendukung input suara Web Speech API.')
    return false
  }

  // Hentikan suara Jarvis jika sedang bicara (Barge-In / Interrupt)
  if (sedangBicaraFlag) {
    hentiBicaraJarvis()
  }

  // Tunda wake word sementara mikrofon utama aktif
  const wakeSebelumnya = wakeWordAktif
  if (wakeWordInstance) {
    try {
      wakeWordInstance.stop()
    } catch {}
  }

  if (recognitionInstance && sedangMendengar) {
    hentiMendengar()
    return false
  }

  try {
    const recognition = new SpeechRecognitionClass()
    recognition.lang = 'id-ID'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    let teksTerkumpul = ''
    let sudahDikirim = false
    let silenceTimer: ReturnType<typeof setTimeout> | null = null
    const jedaAuto = options.autoKirimDelayMs ?? 1350

    const bersihkanTimer = () => {
      if (silenceTimer) {
        clearTimeout(silenceTimer)
        silenceTimer = null
      }
    }

    const picuFinal = () => {
      bersihkanTimer()
      if (sudahDikirim) return
      const bersih = teksTerkumpul.trim()
      if (!bersih) return
      sudahDikirim = true
      try {
        recognition.stop()
      } catch {}
      options.onHasil(bersih, true)
      options.onFinalOtomatis?.(bersih)
    }

    recognition.onstart = () => {
      sedangMendengar = true
      options.onMulai?.()
    }

    recognition.onresult = (event: any) => {
      let gabungan = ''
      let adaFinal = false

      for (let i = 0; i < event.results.length; ++i) {
        gabungan += event.results[i][0].transcript + ' '
        if (event.results[i].isFinal) {
          adaFinal = true
        }
      }

      const hasil = gabungan.trim()
      if (hasil) {
        teksTerkumpul = hasil
        options.onHasil(hasil, adaFinal)

        bersihkanTimer()
        silenceTimer = setTimeout(() => {
          picuFinal()
        }, adaFinal ? Math.min(850, jedaAuto) : jedaAuto)
      }
    }

    recognition.onerror = (event: any) => {
      bersihkanTimer()
      sedangMendengar = false
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        options.onGalat?.(`Gagal menangkap suara: ${event.error}`)
      }
      options.onSelesai?.()
    }

    recognition.onend = () => {
      bersihkanTimer()
      sedangMendengar = false
      if (!sudahDikirim && teksTerkumpul.trim() && options.onFinalOtomatis) {
        sudahDikirim = true
        options.onFinalOtomatis(teksTerkumpul.trim())
      }
      options.onSelesai?.()
      if (wakeSebelumnya && wakeWordAktif) {
        setTimeout(() => {
          if (!sedangMendengar && !sedangBicaraFlag && wakeWordAktif) {
            try {
              wakeWordInstance?.start()
            } catch {}
          }
        }, 400)
      }
    }

    recognitionInstance = recognition
    recognition.start()
    return true
  } catch (err) {
    options.onGalat?.((err as Error).message || 'Gagal memulai mikrofon.')
    return false
  }
}

export function hentiMendengar() {
  if (recognitionInstance) {
    try {
      recognitionInstance.stop()
    } catch {
      // ignore
    }
    recognitionInstance = null
    sedangMendengar = false
  }
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
 * Mendaftarkan callback untuk menerima spektrum 9-band frekuensi suara Jarvis secara real-time.
 */
export function pasangListenerSpektrumSuara(cb: ((bands: number[]) => void) | null) {
  listenerSpektrum = cb
}

function mulaiLoopSpektrum() {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  const dataArray = new Uint8Array(32)

  const tick = () => {
    if (!sedangBicaraFlag) {
      listenerSpektrum?.(DEFAULT_BANDS)
      return
    }
    if (activeAnalyser) {
      activeAnalyser.getByteFrequencyData(dataArray)
      const bands: number[] = []
      for (let i = 0; i < 9; i++) {
        const v1 = dataArray[i * 2 + 1] || 0
        const v2 = dataArray[i * 2 + 2] || 0
        const avg = (v1 + v2) / 510
        bands.push(Math.max(0.12, Math.min(1, avg * 1.45)))
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
