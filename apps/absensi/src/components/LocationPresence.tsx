'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getDeviceInfo } from '@/lib/device'

export function LocationPresence({ 
  outletId, 
  staffId, 
  staffName, 
  role 
}: { 
  outletId?: string | null, 
  staffId?: string | null, 
  staffName?: string | null, 
  role?: string | null 
}) {
  useEffect(() => {
    if (!outletId || !staffId) return

    const supabase = createClient()
    const room = supabase.channel('room:crew_location')

    let watchId: number | null = null
    let lastTrackTime = 0
    let lastLat = 0
    let lastLng = 0

    room
      .on('presence', { event: 'sync' }, () => {})
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          if ('geolocation' in navigator) {
            watchId = navigator.geolocation.watchPosition(
              async (position) => {
                const lat = position.coords.latitude
                const lng = position.coords.longitude
                const accuracy = position.coords.accuracy || 0
                const speed = position.coords.speed || 0
                const heading = position.coords.heading || null
                const now = Date.now()

                // Filter: Hanya kirim broadcast jika belum pernah kirim, atau sudah > 15 detik, atau bergerak > ~15 meter
                const distApprox = Math.hypot((lat - lastLat) * 111000, (lng - lastLng) * 111000)
                if (lastTrackTime > 0 && now - lastTrackTime < 15000 && distApprox < 15) {
                  return
                }

                lastTrackTime = now
                lastLat = lat
                lastLng = lng
                
                const { os, device } = getDeviceInfo(navigator.userAgent)
                
                await room.track({
                  outlet_id: outletId,
                  staff_id: staffId,
                  staff_name: staffName,
                  role: role,
                  device_type: 'PERSONAL',
                  device_os: os,
                  device_model: device,
                  lat,
                  lng,
                  accuracy,
                  speed,
                  heading,
                  updated_at: new Date().toISOString()
                }).catch(() => {})
              },
              (err) => {
                console.warn('Geolocation error:', err.message)
              },
              { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
            )
          }
        }
      })

    // keep room alive


    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      supabase.removeChannel(room)
    }
  }, [outletId, staffId, staffName, role])

  return null
}
