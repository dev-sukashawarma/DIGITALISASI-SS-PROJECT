'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { usePrinterStore } from '@/lib/printerStore'

export default function PrinterPresence() {
  const { outletId } = useMyOutlet()
  const { device } = usePrinterStore()
  const channelRef = useRef<any>(null)
  const isSubscribedRef = useRef(false)
  const lastConnectedRef = useRef<boolean | null>(null)

  useEffect(() => {
    if (!outletId) return

    const supabase = createClient()
    const room = supabase.channel('room:printer_status')
    channelRef.current = room
    isSubscribedRef.current = false

    room
      .on('presence', { event: 'sync' }, () => {
        // Optional: you can log or check other clients here if needed
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true
          const isConnected = !!usePrinterStore.getState().device
          lastConnectedRef.current = isConnected
          await room.track({
            outlet_id: outletId,
            is_connected: isConnected,
            updated_at: new Date().toISOString()
          }).catch((err: any) => console.error('Failed to track printer presence:', err))
        }
      })

    return () => {
      isSubscribedRef.current = false
      channelRef.current = null
      supabase.removeChannel(room)
    }
  }, [outletId])

  // Broadcast connection changes only when connection state actually changes
  useEffect(() => {
    const isConnected = !!device
    if (channelRef.current && isSubscribedRef.current && outletId) {
      if (lastConnectedRef.current !== isConnected) {
        lastConnectedRef.current = isConnected
        channelRef.current.track({
          outlet_id: outletId,
          is_connected: isConnected,
          updated_at: new Date().toISOString()
        }).catch((err: any) => console.error('Failed to track printer presence:', err))
      }
    }
  }, [device, outletId])

  return null
}
