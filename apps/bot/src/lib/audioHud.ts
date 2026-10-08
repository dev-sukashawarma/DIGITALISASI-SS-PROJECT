// Audio synthesizer ringan menggunakan Web Audio API untuk efek suara sci-fi HUD (ala JARVIS)
// Tanpa butuh file audio eksternal, latensi nol, 100% browser-native.

let audioCtx: AudioContext | null = null
let suaraAktif = true

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

export function setSuaraHud(aktif: boolean) {
  suaraAktif = aktif
}

export function apakahSuaraHudAktif(): boolean {
  return suaraAktif
}

export type TipeSuaraHud = 'blip' | 'engage' | 'alert' | 'chirp' | 'process' | 'transmit'

export function mainkanSuaraHud(tipe: TipeSuaraHud = 'blip') {
  if (!suaraAktif) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    switch (tipe) {
      case 'blip': {
        // Soft high-tech UI blip (580Hz -> 880Hz)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(580, now)
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.05)
        gain.gain.setValueAtTime(0.04, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
        osc.start(now)
        osc.stop(now + 0.06)
        break
      }
      case 'engage': {
        // Double cybernetic chirp
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(440, now)
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08)
        gain.gain.setValueAtTime(0.05, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
        osc.start(now)
        osc.stop(now + 0.12)
        break
      }
      case 'chirp': {
        // High crisp tactile click
        osc.type = 'sine'
        osc.frequency.setValueAtTime(1200, now)
        osc.frequency.exponentialRampToValueAtTime(2400, now + 0.03)
        gain.gain.setValueAtTime(0.03, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
        osc.start(now)
        osc.stop(now + 0.04)
        break
      }
      case 'process': {
        // Subtle data streaming blip
        osc.type = 'sine'
        osc.frequency.setValueAtTime(900, now)
        osc.frequency.linearRampToValueAtTime(750, now + 0.04)
        gain.gain.setValueAtTime(0.02, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
        osc.start(now)
        osc.stop(now + 0.05)
        break
      }
      case 'transmit': {
        // Confirmation tone
        osc.type = 'sine'
        osc.frequency.setValueAtTime(650, now)
        osc.frequency.exponentialRampToValueAtTime(1050, now + 0.09)
        gain.gain.setValueAtTime(0.04, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
        osc.start(now)
        osc.stop(now + 0.15)
        break
      }
      case 'alert': {
        // Sci-fi warning alert tone
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(350, now)
        osc.frequency.linearRampToValueAtTime(250, now + 0.15)
        gain.gain.setValueAtTime(0.06, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
        osc.start(now)
        osc.stop(now + 0.2)
        break
      }
    }
  } catch {
    // Abaikan jika browser memblokir audio otomatis sebelum interaksi pengguna
  }
}
