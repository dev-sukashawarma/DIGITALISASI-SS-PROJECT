'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Args {
  userId: string | null
  username: string | null
  outletId: string | null
}

/**
 * Hook untuk tablet kiosk:
 * - Mendaftarkan kehadiran (presence) ke channel outlet → muncul di panel kasir.
 * - Mendengar event `force_logout` dari kasir → signOut & kembali ke /login.
 *
 * Aman dipanggil dengan argumen null (mis. saat data sesi belum termuat): tidak melakukan apa pun.
 */
export function useKioskControl({ userId, username, outletId }: Args) {
  useEffect(() => {
    if (!userId || !outletId) return

    const supabase = createClient()

    let deviceLabel = typeof window !== 'undefined' ? window.localStorage.getItem('kiosk_device_label') : null
    if (!deviceLabel) {
      deviceLabel = `Kiosk-${Math.floor(Math.random() * 90 + 10)}`
      if (typeof window !== 'undefined') window.localStorage.setItem('kiosk_device_label', deviceLabel)
    }

    const channel = supabase.channel(`kiosk-control:${outletId}`, {
      config: { presence: { key: userId } },
    })

    const trackSelf = () =>
      channel.track({
        username,
        device_label: deviceLabel,
        online_at: new Date().toISOString(),
      })

    channel
      .on('broadcast', { event: 'force_logout' }, async ({ payload }) => {
        const target = (payload as { target?: string } | undefined)?.target
        if (target === 'all' || target === userId) {
          await supabase.auth.signOut({ scope: 'global' })
          window.location.href = '/login'
        }
      })
      // Kasir bisa meminta semua kiosk "lapor hadir" → kiosk re-track presence-nya.
      .on('broadcast', { event: 'request_presence' }, () => {
        trackSelf()
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await trackSelf()
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, username, outletId])
}
