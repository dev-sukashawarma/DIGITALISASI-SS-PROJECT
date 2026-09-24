/**
 * Batas "hari ini" menurut Asia/Jakarta (UTC+7, tanpa DST).
 *
 * Jangan pakai `setHours(0, 0, 0, 0)`: itu tengah malam zona waktu SERVER.
 * Container produksi berjalan di UTC, sehingga "hari ini" dulu baru mulai
 * pukul 07:00 WIB dan absen antara 00:00–06:59 WIB ikut hari kemarin.
 */
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000

/** Tanggal kalender Jakarta, format `YYYY-MM-DD`. */
export function jakartaDayKey(date: Date = new Date()): string {
  return new Date(date.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10)
}

/** Awal hari Jakarta (00:00 WIB) sebagai ISO UTC, untuk filter `gte`. */
export function jakartaDayStartIso(date: Date = new Date()): string {
  return new Date(Date.parse(`${jakartaDayKey(date)}T00:00:00.000Z`) - JAKARTA_OFFSET_MS).toISOString()
}
