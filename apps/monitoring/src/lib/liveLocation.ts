// Tipe & util bersama untuk halaman lokasi staff lapangan.

export const STALE_AFTER_MS = 5 * 60 * 1000
export const TRAIL_WINDOW_HOURS = 4

export type StaffLocation = {
  outletStaffId: string
  outletId: string | null
  lat: number
  lng: number
  accuracyM: number | null
  speedMps: number | null
  headingDeg: number | null
  altitudeM: number | null
  batteryPct: number | null
  isCharging: boolean | null
  isMock: boolean
  isMoving: boolean
  provider: string | null
  deviceName: string | null
  recordedAt: string
  staffName: string
  role: string | null
  outletName: string | null
  refPhotoUrl: string | null
}

export type TrailPoint = {
  lat: number
  lng: number
  recordedAt: string
  accuracyM: number | null
  isMock: boolean
}

/** Ambang penyaringan jejak. Titik di atas TRAIL_MAX_ACCURACY_M biasanya fix Wi-Fi/menara
 *  yang meleset puluhan-ratusan meter; digambar apa adanya, jejaknya terlihat seperti staff
 *  meloncat bolak-balik padahal dia diam di tempat. */
export const TRAIL_MAX_ACCURACY_M = 50
/** Tidak ada staff outlet yang berpindah secepat ini; kalau terjadi, titiknya palsu/rusak. */
export const TRAIL_MAX_SPEED_KMH = 120
/** Pergeseran di bawah ini masih dalam derau GPS saat orang berdiri diam. */
export const TRAIL_MIN_STEP_M = 5

export type TrailFilterResult = {
  points: TrailPoint[]
  /** Berapa titik dibuang, dipecah per alasan — angka ini ditampilkan ke user supaya
   *  penyaringan tidak terjadi diam-diam di belakang layar. */
  dropped: { mock: number; accuracy: number; jump: number; jitter: number }
}

function metersBetween(a: TrailPoint, b: TrailPoint): number {
  const R = 6371000
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const dLat = lat2 - lat1
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Membersihkan jejak sebelum digambar. Urutannya penting: titik palsu dan tidak akurat
 * dibuang DULU, baru lompatan dihitung — kalau tidak, satu fix buruk ikut jadi acuan
 * kecepatan dan malah menjatuhkan titik berikutnya yang sebenarnya benar.
 */
export function cleanTrail(raw: TrailPoint[]): TrailFilterResult {
  const dropped = { mock: 0, accuracy: 0, jump: 0, jitter: 0 }

  const trusted = raw.filter((point) => {
    if (point.isMock) {
      dropped.mock += 1
      return false
    }
    if (point.accuracyM !== null && point.accuracyM > TRAIL_MAX_ACCURACY_M) {
      dropped.accuracy += 1
      return false
    }
    return true
  })

  const points: TrailPoint[] = []
  for (const point of trusted) {
    const last = points[points.length - 1]
    if (!last) {
      points.push(point)
      continue
    }
    const meters = metersBetween(last, point)
    const seconds = (new Date(point.recordedAt).getTime() - new Date(last.recordedAt).getTime()) / 1000
    if (seconds > 0 && (meters / seconds) * 3.6 > TRAIL_MAX_SPEED_KMH) {
      dropped.jump += 1
      continue
    }
    if (meters < TRAIL_MIN_STEP_M) {
      dropped.jitter += 1
      continue
    }
    points.push(point)
  }

  return { points, dropped }
}

export function droppedTotal(dropped: TrailFilterResult['dropped']): number {
  return dropped.mock + dropped.accuracy + dropped.jump + dropped.jitter
}

/** Baris mentah staff_live_locations (tanpa join) — dipakai payload realtime. */
export type LiveLocationRow = {
  outlet_staff_id: string
  outlet_id: string | null
  lat: number
  lng: number
  accuracy_m: number | null
  speed_mps: number | null
  heading_deg: number | null
  altitude_m: number | null
  battery_pct: number | null
  is_charging: boolean | null
  is_mock: boolean
  is_moving: boolean
  provider: string | null
  device_name: string | null
  recorded_at: string
  updated_at: string
}

type Embedded<T> = T | T[] | null

export type LiveLocationJoinedRow = LiveLocationRow & {
  outlet_staff: Embedded<{
    name: string | null
    role: string | null
    status: string | null
    ref_photo_url: string | null
  }>
  outlets: Embedded<{ name: string | null }>
}

/** PostgREST bisa mengembalikan objek (to-one) atau array; normalkan keduanya. */
function one<T>(value: Embedded<T>): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export function mapJoinedRow(row: LiveLocationJoinedRow): StaffLocation {
  const staff = one(row.outlet_staff)
  const outlet = one(row.outlets)
  return {
    ...mapRow(row),
    staffName: staff?.name?.trim() || 'Staff tanpa nama',
    role: staff?.role ?? null,
    outletName: outlet?.name ?? null,
    refPhotoUrl: staff?.ref_photo_url ?? null,
  }
}

/** Untuk payload realtime yang tidak membawa join — meta diambil dari data lama. */
export function mapRow(row: LiveLocationRow, previous?: StaffLocation): StaffLocation {
  return {
    outletStaffId: row.outlet_staff_id,
    outletId: row.outlet_id,
    lat: Number(row.lat),
    lng: Number(row.lng),
    accuracyM: row.accuracy_m === null ? null : Number(row.accuracy_m),
    speedMps: row.speed_mps === null ? null : Number(row.speed_mps),
    headingDeg: row.heading_deg === null ? null : Number(row.heading_deg),
    altitudeM: row.altitude_m === null ? null : Number(row.altitude_m),
    batteryPct: row.battery_pct === null ? null : Number(row.battery_pct),
    isCharging: row.is_charging,
    isMock: Boolean(row.is_mock),
    isMoving: Boolean(row.is_moving),
    provider: row.provider,
    deviceName: row.device_name,
    recordedAt: row.recorded_at,
    staffName: previous?.staffName ?? 'Staff tanpa nama',
    role: previous?.role ?? null,
    outletName: previous?.outletName ?? null,
    refPhotoUrl: previous?.refPhotoUrl ?? null,
  }
}

export type StaffStatus = 'bergerak' | 'diam' | 'offline'

export function statusOf(staff: StaffLocation, now: number): StaffStatus {
  const age = now - new Date(staff.recordedAt).getTime()
  if (!Number.isFinite(age) || age > STALE_AFTER_MS) return 'offline'
  return staff.isMoving ? 'bergerak' : 'diam'
}

export const STATUS_COLOR: Record<StaffStatus, string> = {
  bergerak: '#059669',
  diam: '#ea580c',
  offline: '#94a3b8',
}

export const STATUS_LABEL: Record<StaffStatus, string> = {
  bergerak: 'Bergerak',
  diam: 'Diam',
  offline: 'Offline',
}

export function relativeTime(iso: string, now: number): string {
  const time = new Date(iso).getTime()
  if (!Number.isFinite(time)) return 'waktu tidak diketahui'
  const diff = Math.max(0, now - time)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.floor(hours / 24)} hari lalu`
}

export function speedKmh(speedMps: number | null): string {
  if (speedMps === null || !Number.isFinite(speedMps)) return '-'
  return `${(speedMps * 3.6).toFixed(1)} km/j`
}

export function accuracyText(accuracyM: number | null): string {
  if (accuracyM === null || !Number.isFinite(accuracyM)) return '-'
  return `±${Math.round(accuracyM)} m`
}

export function batteryText(pct: number | null, charging: boolean | null): string {
  if (pct === null || !Number.isFinite(pct)) return '-'
  return `${Math.round(pct)}%${charging ? ' (mengisi)' : ''}`
}

export const ROLE_LABEL: Record<string, string> = {
  crew: 'Crew',
  leader: 'Leader',
  spv: 'Supervisor',
  korlap: 'Korlap',
  area_manager: 'Area Manager',
  regional_manager: 'Regional Manager',
  admin: 'Admin',
  admin_hr: 'Admin HR',
  owner: 'Owner',
  developer: 'Developer',
}

export function roleLabel(role: string | null): string {
  if (!role) return 'Tanpa role'
  return ROLE_LABEL[role] ?? role.replace(/_/g, ' ')
}

/** Inisial untuk pin tanpa foto — maksimal 2 huruf supaya muat di lingkaran 34px. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase()
}

/** ref_photo_url bisa berisi path storage, bukan URL penuh. Pin hanya memuat yang
 *  benar-benar bisa di-render langsung; sisanya jatuh ke inisial. */
export function usablePhotoUrl(url: string | null): string | null {
  if (!url) return null
  return /^https?:\/\//i.test(url) ? url : null
}
