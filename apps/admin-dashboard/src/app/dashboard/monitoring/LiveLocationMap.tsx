'use client'

import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Store, User } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'

// Fix leaflet default icons for Next.js
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  })
}

// Custom icons using Lucide
const createCustomIcon = (iconElement: React.ReactElement, colorClass: string, bgClass: string) => {
  if (typeof window === 'undefined') return new L.Icon.Default()
  const html = renderToStaticMarkup(
    <div className={`flex items-center justify-center w-8 h-8 rounded-full shadow-lg border-2 border-white ${bgClass} ${colorClass}`}>
      {iconElement}
    </div>
  )
  return L.divIcon({
    html,
    className: 'custom-leaflet-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  })
}

export type OutletLocation = {
  id: string
  name: string
  lat: number | null
  lng: number | null
}

export type CrewLocation = {
  staff_id: string
  staff_name: string
  role: string
  outlet_id: string
  lat: number
  lng: number
  updated_at: string
}

interface LiveLocationMapProps {
  outlets: OutletLocation[]
  crews: CrewLocation[]
}

export default function LiveLocationMap({ outlets, crews }: LiveLocationMapProps) {
  // Center map on the first outlet or default to Jakarta
  const center = outlets.find(o => o.lat && o.lng) 
    ? [outlets.find(o => o.lat && o.lng)!.lat!, outlets.find(o => o.lat && o.lng)!.lng!] 
    : [-6.200000, 106.816666]

  const outletIcon = createCustomIcon(<Store size={18} />, 'text-[#904d00]', 'bg-[#f29744]')
  const crewIcon = createCustomIcon(<User size={18} />, 'text-blue-700', 'bg-blue-100')

  return (
    <div className="w-full h-[600px] rounded-2xl overflow-hidden shadow-sm border border-[#d9c2b2] z-0">
      <MapContainer 
        center={center as [number, number]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">Carto</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Render Outlets */}
        {outlets.map(outlet => {
          if (!outlet.lat || !outlet.lng) return null
          return (
            <Marker key={outlet.id} position={[outlet.lat, outlet.lng]} icon={outletIcon}>
              <Popup>
                <div className="font-bold text-[#1e1b15]">{outlet.name}</div>
                <div className="text-xs text-[#877365]">Cabang Resmi</div>
              </Popup>
            </Marker>
          )
        })}

        {/* Render Crews */}
        {crews.map(crew => {
          const matchedOutlet = outlets.find(o => o.id === crew.outlet_id)
          const hasOutletLoc = matchedOutlet && matchedOutlet.lat && matchedOutlet.lng

          return (
            <div key={crew.staff_id}>
              <Marker position={[crew.lat, crew.lng]} icon={crewIcon}>
                <Popup>
                  <div className="font-bold text-[#1e1b15]">{crew.staff_name}</div>
                  <div className="text-xs text-blue-600 font-semibold mb-1 uppercase tracking-wider">{crew.role}</div>
                  <div className="text-xs text-[#877365]">Di Cabang: {matchedOutlet?.name || 'Tidak diketahui'}</div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Update: {new Date(crew.updated_at).toLocaleTimeString('id-ID')}
                  </div>
                </Popup>
              </Marker>

              {/* Draw a subtle line connecting the crew to their assigned outlet */}
              {hasOutletLoc && (
                <Polyline 
                  positions={[[crew.lat, crew.lng], [matchedOutlet.lat!, matchedOutlet.lng!]]} 
                  pathOptions={{ color: '#3b82f6', weight: 2, dashArray: '5, 5', opacity: 0.5 }} 
                />
              )}
            </div>
          )
        })}
      </MapContainer>
    </div>
  )
}
