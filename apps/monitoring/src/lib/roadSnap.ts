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
  isStationary?: boolean
  stationaryRadiusM?: number
}

/** Menghitung rentang jarak terjauh antar titik untuk mendeteksi apakah staff hanya diam di satu gedung/outlet */
export function calculateMaxSpreadM(points: TrailPoint[]): number {
  if (points.length < 2) return 0
  const first = points[0]
  let maxDist = 0
  for (const pt of points) {
    const d = metersBetween(first.lat, first.lng, pt.lat, pt.lng)
    if (d > maxDist) maxDist = d
  }
  return maxDist
}

/**
 * Menyaring titik GPS mentah sebelum dikirim ke mesin routing jalan.
 * Menghilangkan fix palsu (mock), akurasi buruk (> 50m), jitter saat diam (< 25m),
 * dan loncatan mustahil (> 150 km/j).
 */
export function prepareWaypoints(raw: TrailPoint[], minDistanceM = 25): TrailPoint[] {
  const trusted = raw.filter(
    (p) => !p.isMock && (p.accuracyM === null || p.accuracyM <= 50),
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
 * Bila staff terdeteksi hanya berada di satu tempat (sebaran < 60 meter), snapping dihentikan
 * agar tidak menghasilkan rute U-turn putar balik palsu di jalan raya pembatas.
 */
export async function snapTrailToRoads(rawPoints: TrailPoint[]): Promise<RoadSnapResult> {
  const trusted = rawPoints.filter(
    (p) => !p.isMock && (p.accuracyM === null || p.accuracyM <= 50),
  )

  // Jika sebaran seluruh titik kurang dari 65 meter, staff berada di satu lokasi (outlet/rumah).
  // Jangan kirim ke OSRM agar tidak muncul rute putar balik tiruan sejauh berkilo-kilometer.
  const spreadM = calculateMaxSpreadM(trusted)
  if (trusted.length >= 2 && spreadM < 65) {
    return {
      positions: [],
      distanceKm: 0,
      isSnapped: false,
      isStationary: true,
      stationaryRadiusM: Math.round(spreadM),
    }
  }

  const waypoints = prepareWaypoints(rawPoints, 25)

  if (waypoints.length < 2) {
    return {
      positions: rawPoints.map((p) => [p.lat, p.lng]),
      distanceKm: 0,
      isSnapped: false,
      isStationary: rawPoints.length > 0,
      stationaryRadiusM: Math.round(spreadM),
    }
  }

  const cacheKey = hashWaypoints(waypoints)
  const cached = routeCache.get(cacheKey)
  if (cached) return cached

  // Hitung perkiraan jarak garis lurus titik-titik waypoint sebagai pembanding anomali OSRM
  let directDistanceM = 0
  for (let i = 1; i < waypoints.length; i++) {
    directDistanceM += metersBetween(
      waypoints[i - 1].lat,
      waypoints[i - 1].lng,
      waypoints[i].lat,
      waypoints[i].lng,
    )
  }

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
        const routeDist = json.routes[0].distance || 0
        
        // Hitung jarak lurus chunk ini
        let chunkDirectDist = 0
        for (let c = 1; c < chunk.length; c++) {
          chunkDirectDist += metersBetween(chunk[c - 1].lat, chunk[c - 1].lng, chunk[c].lat, chunk[c].lng)
        }

        // Bila OSRM menghasilkan rute > 2.8x jarak lurus (indikasi U-turn raksasa akibat titik jalan terbagi),
        // tolak hasil OSRM untuk chunk ini dan gunakan garis titik langsung.
        if (chunkDirectDist > 0 && routeDist > 2.8 * chunkDirectDist) {
          const direct = chunk.map((p): [number, number] => [p.lat, p.lng])
          if (allCoords.length > 0) direct.shift()
          allCoords.push(...direct)
          totalDistanceM += chunkDirectDist
        } else {
          anySuccess = true
          totalDistanceM += routeDist
          const segment: [number, number][] = json.routes[0].geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng],
          )
          if (allCoords.length > 0 && segment.length > 0) {
            segment.shift() // Buang titik tumpang tindih dari sambungan chunk
          }
          allCoords.push(...segment)
        }
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
    isStationary: false,
  }

  if (routeCache.size > 50) routeCache.clear()
  routeCache.set(cacheKey, result)

  return result
}
