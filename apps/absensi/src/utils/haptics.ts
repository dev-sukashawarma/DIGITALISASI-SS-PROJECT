/**
 * Haptics and Audio Feedback Utilities for Absensi
 */

function playSyntheticBeep(frequency: number, type: OscillatorType, durationMs: number) {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.type = type
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + durationMs / 1000)
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    
    osc.start()
    osc.stop(ctx.currentTime + durationMs / 1000)
  } catch (e) {
    console.warn('AudioContext not supported or blocked', e)
  }
}

export function triggerSuccessFeedback() {
  if (typeof window === 'undefined') return
  if (navigator.vibrate) navigator.vibrate([50, 100, 50])
  playSyntheticBeep(1200, 'sine', 150)
}

export function triggerErrorFeedback() {
  if (typeof window === 'undefined') return
  if (navigator.vibrate) navigator.vibrate([300])
  playSyntheticBeep(150, 'sawtooth', 400)
}

export function triggerWarningFeedback() {
  if (typeof window === 'undefined') return
  if (navigator.vibrate) navigator.vibrate([100, 50, 100])
  playSyntheticBeep(400, 'square', 200)
}
