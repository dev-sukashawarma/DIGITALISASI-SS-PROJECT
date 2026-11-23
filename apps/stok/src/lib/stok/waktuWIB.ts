/**
 * Waktu WIB (UTC+7, tanpa daylight saving) untuk kueri berbasis hari.
 * Batas hari opname/waste/laporan adalah 00:00 WIB, bukan tengah malam zona
 * waktu browser atau UTC.
 */

const OFFSET_WIB_MS = 7 * 60 * 60 * 1000

/** Instan 00:00 WIB hari ini (menurut `sekarang`), sebagai ISO string UTC. */
export function awalHariWIBIso(sekarang: Date = new Date()): string {
  const tanggalWIB = new Date(sekarang.getTime() + OFFSET_WIB_MS).toISOString().slice(0, 10)
  return new Date(Date.parse(`${tanggalWIB}T00:00:00.000Z`) - OFFSET_WIB_MS).toISOString()
}
