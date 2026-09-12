'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'

export default function LocationPresence() {
  const { outletId } = useMyOutlet()
  const [staffData, setStaffData] = useState<{ id: string, name: string, role: string } | null>(null)

  useEffect(() => {
    async function fetchStaff() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('outlet_staff').select('id, name, role').eq('id', user.id).single()
        if (data) {
          setStaffData(data)
        }
      }
    }
    fetchStaff()
  }, [])

  useEffect(() => {
    if (!outletId || !staffData) return

    const supabase = createClient()
    const room = supabase.channel('room:crew_location')

    let watchId: number | null = null
    let lastTrackTime = 0
    let lastLat = 0
    let lastLng = 0

    room
      .on('presence', { event: 'sync' }, () => {
        // Log sync if needed
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Start watching location
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
                
                await room.track({
                  outlet_id: outletId,
                  staff_id: staffData.id,
                  staff_name: staffData.name,
                  role: staffData.role,
                  device_type: 'KASIR',
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
              {
                enableHighAccuracy: true,
                maximumAge: 10000,
                timeout: 10000
              }
            )
          }
        }
      })

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      supabase.removeChannel(room)
    }
  }, [outletId, staffData])

  return null
}
