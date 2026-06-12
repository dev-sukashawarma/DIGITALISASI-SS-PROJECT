'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell } from 'lucide-react'

// You can customize the base64 or a public URL for the notification sound
const DING_SOUND = 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg' 

export default function OrderNotification() {
  const [permission, setPermission] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  useEffect(() => {
    // Initialize audio object
    audioRef.current = new Audio(DING_SOUND)
    audioRef.current.volume = 1.0

    const supabase = createClient()

    // Subscribe to new orders being inserted
    const channel = supabase
      .channel('public:orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.new && payload.new.status === 'pending') {
            console.log('New order received!', payload.new)
            playNotification()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const playNotification = async () => {
    try {
      if (audioRef.current) {
        // Reset to start if currently playing
        audioRef.current.currentTime = 0
        await audioRef.current.play()
      }
    } catch (err) {
      console.warn('Audio playback prevented by browser policy. User interaction needed.', err)
      setPermission(false)
    }
  }

  // To bypass browser auto-play policies, the user (cashier) needs to interact with the page once.
  // We'll show a small "Enable Sound" button if playback fails.
  if (!permission) {
    return (
      <button 
        onClick={() => {
          setPermission(true)
          playNotification() // Test play and unlock audio context
        }}
        className="fixed bottom-4 left-4 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-sm font-semibold hover:bg-gray-800 transition-all animate-bounce"
      >
        <Bell className="w-4 h-4 text-amber-400" />
        Aktifkan Suara Pesanan Masuk
      </button>
    )
  }

  return null
}
