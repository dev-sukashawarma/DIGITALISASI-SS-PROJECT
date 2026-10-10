// Helper untuk interaksi suara (STT: Speech-to-Text & TTS: Text-to-Speech)
// Menggunakan Web Speech API browser-native yang cepat, latensi rendah, dan mendukung bahasa Indonesia (id-ID).

let recognitionInstance: any = null
let sedangMendengar = false

export function apakahVoiceDidukung(): { stt: boolean; tts: boolean } {
  if (typeof window === 'undefined') return { stt: false, tts: false }
  const stt = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  const tts = 'speechSynthesis' in window
  return { stt, tts }
}

export interface ListenerSuaraOptions {
  onMulai?: () => void
  onHasil: (teks: string, isFinal: boolean) => void
  onSelesai?: () => void
  onGalat?: (pesan: string) => void
}

export function mulaiMendengar(options: ListenerSuaraOptions): boolean {
  if (typeof window === 'undefined') return false

  const SpeechRecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

  if (!SpeechRecognitionClass) {
    options.onGalat?.('Browser Anda belum mendukung input suara Web Speech API.')
    return false
  }

  // Jika sudah aktif, hentikan dulu
  if (recognitionInstance && sedangMendengar) {
    hentiMendengar()
    return false
  }

  try {
    const recognition = new SpeechRecognitionClass()
    recognition.lang = 'id-ID' // Bahasa Indonesia
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      sedangMendengar = true
      options.onMulai?.()
    }

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript
        } else {
          interim += event.results[i][0].transcript
        }
      }

      const hasil = final || interim
      if (hasil) {
        options.onHasil(hasil, Boolean(final))
      }
    }

    recognition.onerror = (event: any) => {
      sedangMendengar = false
      if (event.error !== 'no-speech') {
        options.onGalat?.(`Gagal menangkap suara: ${event.error}`)
      }
      options.onSelesai?.()
    }

    recognition.onend = () => {
      sedangMendengar = false
      options.onSelesai?.()
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

// Fitur Text-to-Speech untuk suara Jarvis
export function bicaraJarvis(teks: string, onSelesai?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

  // Hentikan suara sebelumnya bila masih bicara
  window.speechSynthesis.cancel()

  // Bersihkan karakter markdown sebelum dibacakan
  const teksBersih = teks
    .replace(/[#*_`~[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!teksBersih) return

  const utterance = new SpeechSynthesisUtterance(teksBersih)
  utterance.lang = 'id-ID'
  utterance.rate = 1.05 // Sedikit lebih tegas dan taktis
  utterance.pitch = 0.95 // Sedikit lebih berat/berwibawa ala AI

  // Cari suara Indonesia jika tersedia di OS
  const voices = window.speechSynthesis.getVoices()
  const suaraId = voices.find((v) => v.lang.startsWith('id') || v.name.toLowerCase().includes('indonesia'))
  if (suaraId) {
    utterance.voice = suaraId
  }

  if (onSelesai) {
    utterance.onend = () => onSelesai()
    utterance.onerror = () => onSelesai()
  }

  window.speechSynthesis.speak(utterance)
}

export function hentiBicaraJarvis() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}
