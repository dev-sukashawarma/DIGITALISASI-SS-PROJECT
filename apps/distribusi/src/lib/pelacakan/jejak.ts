import type { TitikJejak } from './types'

/** Retensi titik rute di DB (global_settings.driver_tracking.retensi_hari). */
export const RETENSI_JEJAK_HARI = 60

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

/** Total km rute berurutan (sama dengan cara DB menghitung total_km). */
export function jarakJejakKm(jejak: TitikJejak[]): number {
  let m = 0
  for (let i = 1; i < jejak.length; i++) m += haversineM(jejak[i - 1], jejak[i])
  return m / 1000
}

/** Titik rute perjalanan ini belum terhapus retensi. */
export function masihAdaJejak(berangkatAt: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(berangkatAt).getTime() < RETENSI_JEJAK_HARI * 86_400_000
}
