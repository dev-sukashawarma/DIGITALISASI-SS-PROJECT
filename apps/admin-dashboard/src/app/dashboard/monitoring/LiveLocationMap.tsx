'use client'

import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { User, MapPin, Navigation } from 'lucide-react'
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
  address?: string | null
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

        {/* Render Crews Only */}

        {/* Render Crews */}
        {crews.map(crew => {
          const matchedOutlet = outlets.find(o => o.id === crew.outlet_id)
          const hasOutletLoc = matchedOutlet && matchedOutlet.lat && matchedOutlet.lng

          return (
            <div key={crew.staff_id}>
              <Marker position={[crew.lat, crew.lng]} icon={crewIcon}>
                <Popup className="min-w-[220px]">
                  <div className="font-black text-[#1e1b15] text-lg mb-1">{crew.staff_name}</div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                      {crew.role}
                    </span>
                    <span className="bg-[#f5ede3] text-[#904d00] px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                      {matchedOutlet?.name || 'Cabang Unknown'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-1.5 text-[#544437]">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#877365]" />
                      <span className="leading-tight">{matchedOutlet?.address || 'Alamat cabang tidak tersedia'}</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-[#544437]">
                      <Navigation className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-600" />
                      <span className="font-mono text-[10px] bg-gray-100 px-1 py-0.5 rounded text-gray-700">
                        Lat: {crew.lat.toFixed(6)} <br/>
                        Lng: {crew.lng.toFixed(6)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
                    <span className="text-gray-400">Update Terakhir:</span>
                    <span className="font-bold text-[#1e1b15]">
                      {new Date(crew.updated_at).toLocaleTimeString('id-ID')}
                    </span>
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
