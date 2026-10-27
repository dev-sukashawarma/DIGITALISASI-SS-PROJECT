'use client'

// Peta Leaflet murni — menyentuh `window`, jadi WAJIB di-import lewat
// next/dynamic({ ssr: false }) (lihat app/distribusi/driver/page.tsx).
// Pola mengikuti apps/monitoring/src/components/LiveLocationMap.tsx.

import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { kesegaranLokasi, labelStop, type Nada } from '@/lib/pelacakan/statusStop'
import type { PerjalananTampil, TitikJejak } from '@/lib/pelacakan/types'

const PUSAT_AWAL: [number, number] = [-6.5971, 106.806]

const WARNA: Record<Nada, string> = {
  ok: '#0a7d2c',
  peringatan: '#d97706',
  buruk: '#dc2626',
  netral: '#9ca3af',
}

function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? '&#39;'))
}

const ikonCache = new Map<string, L.DivIcon>()
function ikonDriver(nama: string, warna: string): L.DivIcon {
  const kunci = `${nama}|${warna}`
  const ada = ikonCache.get(kunci)
  if (ada) return ada
  const inisial = escapeHtml(nama.trim().split(/\s+/).slice(0, 2).map((k) => k[0] ?? '').join('').toUpperCase())
  const ikon = L.divIcon({
    className: '',
    html:
      `<div style="width:34px;height:34px;border-radius:9999px;background:#f29744;border:3px solid ${warna};` +
      `display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:12px;` +
      `box-shadow:0 2px 6px rgba(0,0,0,.3)">${inisial}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
  ikonCache.set(kunci, ikon)
  return ikon
}

function SesuaikanBatas({ titik, kunci }: { titik: [number, number][]; kunci: string }) {
  const map = useMap()
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 150)
    if (titik.length === 1) map.setView(titik[0], 14)
    else if (titik.length > 1) map.fitBounds(L.latLngBounds(titik), { padding: [40, 40] })
    return () => window.clearTimeout(t)
    // Hanya saat perjalanan terpilih berganti — bukan tiap posisi bergeser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci, map])
  return null
}

export default function PetaDriver({
  perjalanan,
  jejak,
  dipilihId,
}: {
  perjalanan: PerjalananTampil[]
  jejak: TitikJejak[]
  dipilihId: string | null
}) {
  const dipilih = perjalanan.find((p) => p.id === dipilihId) ?? null

  const titikBatas = useMemo(() => {
    const t: [number, number][] = []
    for (const p of dipilih ? [dipilih] : perjalanan) {
      if (p.terkini) t.push([Number(p.terkini.lat), Number(p.terkini.lng)])
      for (const s of p.stops) if (s.outlet_lat != null && s.outlet_lng != null) t.push([Number(s.outlet_lat), Number(s.outlet_lng)])
    }
    for (const j of jejak) t.push([Number(j.lat), Number(j.lng)])
    return t
  }, [dipilih, perjalanan, jejak])

  return (
    <MapContainer center={PUSAT_AWAL} zoom={12} className="h-full w-full rounded-2xl" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <SesuaikanBatas titik={titikBatas} kunci={`${dipilihId ?? 'semua'}|${perjalanan.length}|${jejak.length > 0}`} />

      {jejak.length > 1 && (
        <Polyline positions={jejak.map((j) => [Number(j.lat), Number(j.lng)] as [number, number])} pathOptions={{ color: '#701604', weight: 4, opacity: 0.7 }} />
      )}

      {(dipilih ? [dipilih] : perjalanan).flatMap((p) =>
        p.stops
          .filter((s) => s.outlet_lat != null && s.outlet_lng != null)
          .map((s) => {
            const label = labelStop(s)
            return (
              <CircleMarker
                key={s.id}
                center={[Number(s.outlet_lat), Number(s.outlet_lng)]}
                radius={9}
                pathOptions={{ color: '#fff', weight: 2, fillColor: WARNA[label.nada], fillOpacity: 1 }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  {s.urutan}. {s.outlet_name} — {label.teks}
                </Tooltip>
              </CircleMarker>
            )
          })
      )}

      {perjalanan.map((p) => {
        if (!p.terkini) return null
        const segar = kesegaranLokasi(p.terkini.direkam_at)
        return (
          <Marker key={p.id} position={[Number(p.terkini.lat), Number(p.terkini.lng)]} icon={ikonDriver(p.driver_name, WARNA[segar.nada])}>
            <Tooltip direction="top" offset={[0, -18]} permanent>
              {p.driver_name.split(/\s+/)[0]} · {segar.teks}
            </Tooltip>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
