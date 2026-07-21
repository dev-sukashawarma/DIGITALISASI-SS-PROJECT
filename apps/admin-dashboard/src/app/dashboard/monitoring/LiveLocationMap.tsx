'use client'

import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { User, MapPin, Navigation, Compass, Activity, Signal } from 'lucide-react'
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
  accuracy?: number
  speed?: number
  heading?: number
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

          // Speed in km/h (speed is in m/s)
          const speedKmh = crew.speed ? (crew.speed * 3.6).toFixed(1) : '0.0'
          const isMoving = crew.speed && crew.speed > 0.5 // > 0.5 m/s (~1.8 km/h) is walking
          const accuracyRadius = crew.accuracy || 10

          return (
            <div key={crew.staff_id}>
              {/* Accuracy Radar Circle */}
              <Circle 
                center={[crew.lat, crew.lng]} 
                radius={accuracyRadius} 
                pathOptions={{ 
                  color: isMoving ? '#10b981' : '#3b82f6', 
                  fillColor: isMoving ? '#10b981' : '#3b82f6', 
                  fillOpacity: 0.15,
                  weight: 1
                }} 
              />
              
              <Marker position={[crew.lat, crew.lng]} icon={crewIcon}>
                <Popup className="min-w-[240px]">
                  <div className="font-black text-[#1e1b15] text-lg mb-1">{crew.staff_name}</div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                      {crew.role}
                    </span>
                    <span className="bg-[#f5ede3] text-[#904d00] px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                      {matchedOutlet?.name || 'Cabang Unknown'}
                    </span>
                  </div>
                  
                  {/* Advanced Telemetry Panel */}
                  <div className="bg-gray-900 text-white rounded-lg p-2.5 mb-3 shadow-inner">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                        <Signal className="w-3 h-3 text-green-400" /> GPS Telemetry
                      </span>
                      {isMoving ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded animate-pulse">
                          <Activity className="w-3 h-3" /> BERGERAK
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">
                          DIAM
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div>
                        <div className="text-gray-500 text-[9px]">SPEED</div>
                        <div className="text-blue-300">{speedKmh} km/h</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-[9px]">ACCURACY</div>
                        <div className="text-yellow-300">± {Math.round(accuracyRadius)}m</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-gray-500 text-[9px]">COORDINATES</div>
                        <div className="text-gray-200 tracking-tight">
                          {crew.lat.toFixed(6)}, {crew.lng.toFixed(6)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-1.5 text-[#544437]">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#877365]" />
                      <span className="leading-tight">{matchedOutlet?.address || 'Alamat cabang tidak tersedia'}</span>
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
