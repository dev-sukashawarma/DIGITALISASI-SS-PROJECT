export interface LatLng {
  lat: number
  lng: number
}

export function parseLatLng(input: string): LatLng | null {
  const cleaned = input.replace(/[°\s]/g, '')
  const parts = cleaned.split(',')
  if (parts.length !== 2) return null
  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}
