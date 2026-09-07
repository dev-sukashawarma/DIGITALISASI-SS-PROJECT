'use client'

// Peta Leaflet murni. Komponen ini menyentuh `window`, jadi HARUS di-import
// lewat next/dynamic dengan { ssr: false } (lihat LiveLocationBoard.tsx).

import { Fragment, useCallback, useEffect, useMemo, useRef } from 'react'
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Smartphone } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import {
  accuracyText,
  batteryText,
  initialsOf,
  relativeTime,
  roleLabel,
  speedKmh,
  STATUS_COLOR,
  STATUS_LABEL,
  statusOf,
  usablePhotoUrl,
  type StaffLocation,
  type TrailPoint,
} from '@/lib/liveLocation'

// Ikon default Leaflet rusak di bundler (URL relatif hilang saat build).
// Kita tidak memakainya sama sekali — semua marker pakai divIcon di bawah ini.
const DEFAULT_CENTER: [number, number] = [-6.5971, 106.806]
const DEFAULT_ZOOM = 12

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      default: return '&#39;'
    }
  })
}

// Cache ikon supaya identitas objeknya stabil antar render: react-leaflet hanya
// memanggil marker.setIcon() bila prop `icon` berubah, jadi marker cukup
// digeser (setLatLng) dan tidak pernah di-remount saat posisi ter-update.
const iconCache = new Map<string, L.DivIcon>()

/** Heading dibulatkan ke 15° supaya cache ikon tidak tumbuh tiap derajat perubahan. */
function headingBucket(heading: number | null): number | null {
  if (heading === null || !Number.isFinite(heading)) return null
  return Math.round(((heading % 360) + 360) % 360 / 15) * 15
}

type IconOptions = {
  name: string
  color: string
  mock: boolean
  selected: boolean
  moving: boolean
  photoUrl: string | null
  heading: number | null
}

function staffIcon(options: IconOptions): L.DivIcon {
  const cacheKey = [
    options.name,
    options.color,
    options.mock ? 1 : 0,
    options.selected ? 1 : 0,
    options.moving ? 1 : 0,
    options.photoUrl ?? '',
    options.heading ?? '',
  ].join('|')
  const cached = iconCache.get(cacheKey)
  if (cached) return cached
  const icon = buildStaffIcon(options)
  iconCache.set(cacheKey, icon)
  return icon
}

function buildStaffIcon({ name, color, mock, selected, moving, photoUrl, heading }: IconOptions): L.DivIcon {
  const label = escapeHtml(name.length > 18 ? `${name.slice(0, 17)}…` : name)
  const face = photoUrl
    ? `style="background-image:url('${escapeHtml(photoUrl)}')"`
    : ''
  const initials = photoUrl ? '' : escapeHtml(initialsOf(name))

  const className = [
    'staff-marker',
    selected ? 'staff-marker--selected' : '',
    mock ? 'staff-marker--mock' : '',
  ].filter(Boolean).join(' ')

  const html =
    `<span class="staff-marker__pin" style="--pin:${color}">` +
    (moving ? '<span class="staff-marker__pulse"></span>' : '') +
    (heading === null ? '' : `<span class="staff-marker__heading" style="transform:rotate(${heading}deg)"></span>`) +
    `<span class="staff-marker__avatar" ${face}>${initials}</span>` +
    `<span class="staff-marker__label">${label}${mock ? ' <b>PALSU</b>' : ''}</span>` +
    '</span>'

  return L.divIcon({
    className,
    html,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
  })
}

type MapBridgeProps = {
  onReady: (map: L.Map) => void
}

/** Menyerahkan instance map ke parent supaya bisa flyTo / fitBounds dari luar. */
function MapBridge({ onReady }: MapBridgeProps) {
  const map = useMap()
  useEffect(() => {
    onReady(map)
    // Peta sering di-mount saat container belum punya tinggi final.
    const timer = window.setTimeout(() => map.invalidateSize(), 150)

    // Marker digeser dengan transisi CSS supaya perpindahan posisi terlihat
    // mengalir, bukan meloncat. Transisi WAJIB dimatikan selama zoom: Leaflet
    // ikut menulis ulang transform tiap marker di sana, dan kalau ditransisikan
    // marker terlihat melayang menyusul peta.
    const container = map.getContainer()
    const enable = () => container.classList.add('staff-map--animated')
    const disable = () => container.classList.remove('staff-map--animated')
    enable()
    map.on('zoomstart', disable)
    map.on('zoomend', enable)

    return () => {
      window.clearTimeout(timer)
      map.off('zoomstart', disable)
      map.off('zoomend', enable)
    }
  }, [map, onReady])
  return null
}

export type LiveLocationMapProps = {
  staff: StaffLocation[]
  now: number
  /** Staff yang sedang dipilih di sidebar. */
  focusedId: string | null
  /** Berubah setiap kali user klik staff — memicu flyTo walau id-nya sama. */
  focusNonce: number
  /** Berubah setiap kali user menekan "Fit semua". */
  fitNonce: number
  trail: TrailPoint[]
  showTrail: boolean
  /** Klik pin: memilih staff di sidebar tanpa ikut menerbangkan peta. */
  onSelect: (staffId: string) => void
}

export default function LiveLocationMap({
  staff,
  now,
  focusedId,
  focusNonce,
  fitNonce,
  trail,
  showTrail,
  onSelect,
}: LiveLocationMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const didFitRef = useRef(false)

  // Data terbaru dibaca lewat ref supaya `fitAll` punya identitas stabil —
  // kalau tidak, efek di bawah ikut jalan setiap ada update realtime.
  const staffRef = useRef<StaffLocation[]>(staff)
  staffRef.current = staff

  const onMapReady = useCallback((map: L.Map) => {
    mapRef.current = map
  }, [])

  const fitAll = useCallback(() => {
    const map = mapRef.current
    const items = staffRef.current
    if (!map || items.length === 0) return
    const bounds = L.latLngBounds(items.map((item) => [item.lat, item.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16 })
  }, [])

  // Fit otomatis sekali saja saat data pertama masuk.
  useEffect(() => {
    if (didFitRef.current || staff.length === 0) return
    didFitRef.current = true
    fitAll()
  }, [fitAll, staff.length])

  useEffect(() => {
    if (fitNonce === 0) return
    fitAll()
  }, [fitAll, fitNonce])

  // Fly ke staff terpilih + buka popup-nya.
  useEffect(() => {
    if (focusNonce === 0 || !focusedId) return
    const map = mapRef.current
    const target = staff.find((item) => item.outletStaffId === focusedId)
    if (!map || !target) return
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 17), { duration: 0.85 })
    const marker = markersRef.current.get(focusedId)
    if (marker) window.setTimeout(() => marker.openPopup(), 900)
    // `staff` sengaja tidak jadi dependency: fly hanya saat user menekan item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce, focusedId])

  const trailPositions = useMemo<[number, number][]>(
    () => trail.map((point) => [point.lat, point.lng]),
    [trail],
  )

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className="h-full w-full"
      preferCanvas
    >
      <MapBridge onReady={onMapReady} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      {showTrail && trailPositions.length > 1 && (
        <Polyline positions={trailPositions} pathOptions={{ color: '#ea580c', weight: 4, opacity: 0.75 }} />
      )}

      {staff.map((item) => {
        const status = statusOf(item, now)
        const color = STATUS_COLOR[status]
        const selected = item.outletStaffId === focusedId
        return (
          <Fragment key={item.outletStaffId}>
            {item.accuracyM !== null && item.accuracyM > 0 && (
              <Circle
                center={[item.lat, item.lng]}
                radius={item.accuracyM}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.1, weight: 1, opacity: 0.4 }}
              />
            )}
            <Marker
              position={[item.lat, item.lng]}
              icon={staffIcon({
                name: item.staffName,
                color,
                mock: item.isMock,
                selected,
                moving: status === 'bergerak',
                photoUrl: usablePhotoUrl(item.refPhotoUrl),
                heading: status === 'offline' ? null : headingBucket(item.headingDeg),
              })}
              zIndexOffset={selected ? 1000 : 0}
              riseOnHover
              eventHandlers={{ click: () => onSelect(item.outletStaffId) }}
              ref={(instance) => {
                if (instance) markersRef.current.set(item.outletStaffId, instance)
                else markersRef.current.delete(item.outletStaffId)
              }}
            >
              <Tooltip direction="top" offset={[0, -20]} opacity={1} className="staff-tooltip">
                <b>{item.staffName}</b> · {STATUS_LABEL[status]} · {relativeTime(item.recordedAt, now)}
              </Tooltip>
              <Popup>
                <div className="min-w-[200px] space-y-2 font-sans">
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">{item.staffName}</p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      {roleLabel(item.role)} · {item.outletName ?? 'Tanpa outlet'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                      style={{ background: color }}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                    {item.isMock && (
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                        Lokasi palsu
                      </span>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600">
                    <dt className="font-semibold text-slate-400">Akurasi</dt>
                    <dd className="text-right font-semibold">{accuracyText(item.accuracyM)}</dd>
                    <dt className="font-semibold text-slate-400">Kecepatan</dt>
                    <dd className="text-right font-semibold">{speedKmh(item.speedMps)}</dd>
                    <dt className="font-semibold text-slate-400">Baterai</dt>
                    <dd className="text-right font-semibold">{batteryText(item.batteryPct, item.isCharging)}</dd>
                    <dt className="font-semibold text-slate-400">Update</dt>
                    <dd className="text-right font-semibold">{relativeTime(item.recordedAt, now)}</dd>
                  </dl>
                  <p className="flex items-start gap-1.5 border-t border-slate-100 pt-2 text-[10px] font-semibold text-slate-500">
                    <Smartphone size={12} className="mt-px shrink-0 text-slate-400" />
                    <span className="break-words">{item.deviceName ?? 'Perangkat tidak diketahui'}</span>
                  </p>
                </div>
              </Popup>
            </Marker>
          </Fragment>
        )
      })}
    </MapContainer>
  )
}
