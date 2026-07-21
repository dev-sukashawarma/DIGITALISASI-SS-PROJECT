'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { usePrinterStore } from '@/lib/printerStore'

export default function PrinterPresence() {
  const { outletId } = useMyOutlet()
  const { device } = usePrinterStore()
  const [channel, setChannel] = useState<any>(null)

  useEffect(() => {
    if (!outletId) return

    const supabase = createClient()
    const room = supabase.channel('room:printer_status')

    room
      .on('presence', { event: 'sync' }, () => {
        // Optional: you can log or check other clients here if needed
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await room.track({
            outlet_id: outletId,
            is_connected: !!device,
            updated_at: new Date().toISOString()
          })
        }
      })

    setChannel(room)

    return () => {
      supabase.removeChannel(room)
    }
  }, [outletId])

  // Broadcast connection changes without remounting the channel
  useEffect(() => {
    if (channel && outletId) {
      channel.track({
        outlet_id: outletId,
        is_connected: !!device,
        updated_at: new Date().toISOString()
      }).catch((err: any) => console.error('Failed to track printer presence:', err))
    }
  }, [device, channel, outletId])

  return null
}
