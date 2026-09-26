'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { subsSignature } from './signature'

/** Channel dianggap stabil (backoff di-reset) setelah join bertahan selama ini. */
const STABLE_MS = 30_000

export type RealtimeSub = {
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string
  handler: (payload: any) => void
}

export function useRealtimeChannel(opts: {
  channelName: string
  enabled?: boolean
  subs: RealtimeSub[]
  /** Dipanggil tiap channel JOIN ULANG (bukan join pertama) — dipakai untuk
   *  menarik ulang data yang terlewat selagi socket putus. */
  onResubscribe?: () => void
}) {
  const { channelName, enabled = true, subs, onResubscribe } = opts
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  // Simpan subs terbaru di ref supaya handler selalu fresh tanpa re-subscribe tiap render.
  const subsRef = useRef(subs)
  subsRef.current = subs
  const onResubRef = useRef(onResubscribe)
  onResubRef.current = onResubscribe

  // Re-subscribe hanya saat channelName/enabled/bentuk-subs (tabel|event|filter) berubah.
  const signature = subsSignature(subs)

  useEffect(() => {
    if (!enabled) return

    // Gunakan nama channel deterministik berbasis channelName + signature untuk mencegah channel yatim.
    const actualChannelName = `${channelName}:${signature}`

    let current: ReturnType<typeof supabase.channel> | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let stableTimer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let joinedOnce = false
    let disposed = false

    const scheduleReconnect = () => {
      if (disposed || retryTimer) return
      const delay = Math.min(30_000, 1_000 * 2 ** attempt++)
      retryTimer = setTimeout(() => {
        retryTimer = null
        connect()
      }, delay)
    }

    const connect = () => {
      if (disposed) return

      // Bersihkan channel lama yang memiliki topik sama bila ada.
      const existing = supabase
        .getChannels()
        .find((c) => c.topic === `realtime:${actualChannelName}`)
      if (existing) supabase.removeChannel(existing)

      const channel = supabase.channel(actualChannelName)
      current = channel

      subsRef.current.forEach((sub, idx) => {
        channel.on(
          'postgres_changes' as any,
          {
            event: sub.event ?? '*',
            schema: 'public',
            table: sub.table,
            ...(sub.filter ? { filter: sub.filter } : {}),
          },
          (payload: any) => {
            subsRef.current[idx]?.handler(payload)
          }
        )
      })

      channel.subscribe((status) => {
        // Abaikan status dari channel yang sudah digantikan/dibuang.
        if (disposed || current !== channel) return

        if (status === 'SUBSCRIBED') {
          // Backoff baru di-reset setelah channel bertahan STABLE_MS. Dulu di-reset
          // seketika, jadi channel yang join lalu langsung putus (flapping) mencoba
          // ulang tiap ~1 detik — dan tiap join memicu onResubscribe (refetch
          // semua query terkait). Sesi 2026-09-25: ~100 refetch/menit per tab.
          if (stableTimer) clearTimeout(stableTimer)
          stableTimer = setTimeout(() => {
            stableTimer = null
            attempt = 0
          }, STABLE_MS)
          // Event selama socket putus TIDAK di-replay server → tarik ulang data.
          if (joinedOnce) onResubRef.current?.()
          joinedOnce = true
          return
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (stableTimer) {
            clearTimeout(stableTimer)
            stableTimer = null
          }
          scheduleReconnect()
        }
      })
    }

    // Tab bangun dari tidur / jaringan balik → jangan tunggu backoff.
    const reconnectNow = () => {
      if (disposed || document.visibilityState !== 'visible') return
      if (current && (current as any).state === 'joined') return
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
      // `attempt` sengaja tidak di-reset: bila channel memang flapping, backoff
      // tetap naik; reset hanya lewat stableTimer setelah join bertahan.
      connect()
    }

    connect()
    document.addEventListener('visibilitychange', reconnectNow)
    window.addEventListener('online', reconnectNow)

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', reconnectNow)
      window.removeEventListener('online', reconnectNow)
      if (retryTimer) clearTimeout(retryTimer)
      if (stableTimer) clearTimeout(stableTimer)
      if (current) supabase.removeChannel(current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, channelName, enabled, signature])
}
