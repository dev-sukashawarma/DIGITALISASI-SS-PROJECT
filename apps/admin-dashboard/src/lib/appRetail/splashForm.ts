/**
 * Validasi formulir splash aplikasi. Cerminan CHECK di basis data
 * (`app_splash_setting.durasi_ms BETWEEN 1000 AND 5000`) supaya admin mendapat
 * pesan yang bisa dibaca, bukan galat constraint Postgres.
 */

export const DURASI_MIN_MS = 1000
export const DURASI_MAKS_MS = 5000
export const PILIHAN_DURASI_MS = [1000, 2000, 3000, 4000, 5000] as const

export type InputSplash = {
  /** Kosong = pakai gambar bawaan di dalam APK. */
  gambarUrl: string
  durasiMs: number
}

export function periksaSplash(input: InputSplash): string | null {
  if (!Number.isInteger(input.durasiMs)) return 'Durasi splash tidak valid.'
  if (input.durasiMs < DURASI_MIN_MS || input.durasiMs > DURASI_MAKS_MS) {
    return 'Durasi splash harus antara 1 dan 5 detik.'
  }
  const url = input.gambarUrl.trim()
  // Aplikasi mengunduh dan menyimpan berkas ini, jadi hanya https yang diterima.
  if (url !== '' && !url.startsWith('https://')) return 'Alamat gambar splash harus diawali https://.'
  return null
}

/** Baris siap tulis ke `app_splash_setting`. */
export function barisSplash(input: InputSplash) {
  const url = input.gambarUrl.trim()
  return {
    gambar_url: url === '' ? null : url,
    durasi_ms: input.durasiMs,
    diubah_pada: new Date().toISOString(),
  }
}
