import type { TrailPoint } from './liveLocation'

function metersBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const rLat1 = (lat1 * Math.PI) / 180
  const rLat2 = (lat2 * Math.PI) / 180
  const dLat = rLat2 - rLat1
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export type RoadSnapResult = {
  positions: [number, number][]
  distanceKm: number
  isSnapped: boolean
}

/**
 * Menyaring titik GPS mentah sebelum dikirim ke mesin routing jalan.
 * Menghilangkan fix palsu (mock), akurasi buruk (> 60m), jitter saat diam (< 12m),
 * dan loncatan mustahil (> 150 km/j).
 */
export function prepareWaypoints(raw: TrailPoint[], minDistanceM = 12): TrailPoint[] {
  const trusted = raw.filter(
    (p) => !p.isMock && (p.accuracyM === null || p.accuracyM <= 60),
  )

  const waypoints: TrailPoint[] = []
  for (const pt of trusted) {
    const last = waypoints[waypoints.length - 1]
    if (!last) {
      waypoints.push(pt)
      continue
    }
    const dist = metersBetween(last.lat, last.lng, pt.lat, pt.lng)
    if (dist < minDistanceM) continue

    const secs =
      (new Date(pt.recordedAt).getTime() - new Date(last.recordedAt).getTime()) / 1000
    if (secs > 0 && (dist / secs) * 3.6 > 150) continue

    waypoints.push(pt)
  }
  return waypoints
}

// Cache rute jalan berbasis hash koordinat agar tidak memanggil OSRM berulang
const routeCache = new Map<string, RoadSnapResult>()

function hashWaypoints(waypoints: TrailPoint[]): string {
  if (waypoints.length === 0) return ''
  const first = waypoints[0]
  const last = waypoints[waypoints.length - 1]
  return `${waypoints.length}:${first.lat.toFixed(5)},${first.lng.toFixed(5)}->${last.lat.toFixed(5)},${last.lng.toFixed(5)}`
}

/**
 * Menyelaraskan titik-titik GPS ke jaringan jalan raya nyata via Open Source Routing Machine (OSRM).
 * Bila OSRM sedang lambat/timeout atau gagal, otomatis fallback ke garis titik GPS yang sudah dibersihkan.
 */
export async function snapTrailToRoads(rawPoints: TrailPoint[]): Promise<RoadSnapResult> {
  const waypoints = prepareWaypoints(rawPoints)

  if (waypoints.length < 2) {
    return {
      positions: rawPoints.map((p) => [p.lat, p.lng]),
      distanceKm: 0,
      isSnapped: false,
    }
  }

  const cacheKey = hashWaypoints(waypoints)
  const cached = routeCache.get(cacheKey)
  if (cached) return cached

  const CHUNK_SIZE = 35
  const allCoords: [number, number][] = []
  let totalDistanceM = 0
  let anySuccess = false

  for (let i = 0; i < waypoints.length; i += CHUNK_SIZE - 1) {
    const chunk = waypoints.slice(i, i + CHUNK_SIZE)
    if (chunk.length < 2) break

    const coordsStr = chunk.map((p) => `${p.lng},${p.lat}`).join(';')
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(7000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()

      if (json.code === 'Ok' && json.routes?.[0]?.geometry?.coordinates) {
        anySuccess = true
        totalDistanceM += json.routes[0].distance || 0
        const segment: [number, number][] = json.routes[0].geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng],
        )
        if (allCoords.length > 0 && segment.length > 0) {
          segment.shift() // Buang titik tumpang tindih dari sambungan chunk
        }
        allCoords.push(...segment)
      } else {
        const direct = chunk.map((p): [number, number] => [p.lat, p.lng])
        if (allCoords.length > 0) direct.shift()
        allCoords.push(...direct)
      }
    } catch {
      const direct = chunk.map((p): [number, number] => [p.lat, p.lng])
      if (allCoords.length > 0) direct.shift()
      allCoords.push(...direct)
    }
  }

  const result: RoadSnapResult = {
    positions: allCoords.length > 0 ? allCoords : waypoints.map((p) => [p.lat, p.lng]),
    distanceKm: Number((totalDistanceM / 1000).toFixed(2)),
    isSnapped: anySuccess,
  }

  if (routeCache.size > 50) routeCache.clear()
  routeCache.set(cacheKey, result)

  return result
}
