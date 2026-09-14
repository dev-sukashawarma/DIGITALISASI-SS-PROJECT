/**
 * Pemetaan baris `app_splash_setting` menjadi bentuk yang dikonsumsi aplikasi.
 *
 * Tidak pernah gagal: splash tampil SETIAP kali aplikasi dibuka, jadi baris
 * yang hilang atau rusak harus jatuh ke nilai aman (gambar bawaan APK, 3
 * detik), bukan membuat aplikasi menunggu atau menampilkan layar kosong.
 */

export const DURASI_BAWAAN_MS = 3000
export const DURASI_MIN_MS = 1000
export const DURASI_MAKS_MS = 5000

export type SplashApp = {
  /** null = aplikasi memakai gambar bawaan di dalam APK. */
  gambar_url: string | null
  durasi_ms: number
}

export const SPLASH_BAWAAN: SplashApp = { gambar_url: null, durasi_ms: DURASI_BAWAAN_MS }

export function petakanSplash(baris: unknown): SplashApp {
  if (typeof baris !== 'object' || baris === null) return SPLASH_BAWAAN
  const r = baris as Record<string, unknown>

  let gambar: string | null = null
  if (typeof r.gambar_url === 'string') {
    const rapi = r.gambar_url.trim()
    // Hanya https: aplikasi mengunduh berkas ini dan menyimpannya.
    if (rapi.startsWith('https://')) gambar = rapi
  }

  // Dibatasi di sini JUGA, walau CHECK basis data sudah membatasi 1-5 detik:
  // baris bisa lahir sebelum constraint itu ada, atau lewat jalur lain.
  let durasi = DURASI_BAWAAN_MS
  if (typeof r.durasi_ms === 'number' && Number.isFinite(r.durasi_ms)) {
    durasi = Math.min(DURASI_MAKS_MS, Math.max(DURASI_MIN_MS, Math.round(r.durasi_ms)))
  }

  return { gambar_url: gambar, durasi_ms: durasi }
}
