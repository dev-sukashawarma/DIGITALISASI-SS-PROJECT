'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRealtimeChannel } from './useRealtimeChannel'
import { createDebouncer } from './debounce'

export type InvalidateSub = {
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string
  queryKeys: unknown[][]
}

export function useRealtimeInvalidate(opts: {
  channelName: string
  enabled?: boolean
  subs: InvalidateSub[]
  debounceMs?: number
  /**
   * Jarak minimum (ms) antar-sinkronisasi ulang saat channel join lagi.
   * Reconnect yang lebih rapat digabung jadi satu sinkronisasi di akhir
   * jendela. Default 30 detik: dulu 0 (sinkron di tiap reconnect), dan channel
   * yang putus-sambung memicu badai refetch server action (2026-09-25).
   */
  resubscribeMinIntervalMs?: number
}) {
  const { channelName, enabled = true, subs, debounceMs = 500, resubscribeMinIntervalMs = 30_000 } = opts
  const qc = useQueryClient()
  const debouncer = useMemo(() => createDebouncer(debounceMs), [debounceMs])
  const lastResyncAt = useRef(0)
  const pendingResync = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => debouncer.cancelAll(), [debouncer])
  useEffect(
    () => () => {
      if (pendingResync.current) clearTimeout(pendingResync.current)
    },
    []
  )

  const resyncAll = () => {
    lastResyncAt.current = Date.now()
    subs.forEach((s) =>
      s.queryKeys.forEach((qk) => qc.invalidateQueries({ queryKey: qk }))
    )
  }

  useRealtimeChannel({
    channelName,
    enabled,
    // Event selama socket putus tidak di-replay server → sinkronkan ulang
    // begitu channel join lagi, supaya tak perlu refresh manual.
    onResubscribe: () => {
      const wait = lastResyncAt.current + resubscribeMinIntervalMs - Date.now()
      if (wait <= 0) {
        resyncAll()
        return
      }
      if (pendingResync.current) return
      pendingResync.current = setTimeout(() => {
        pendingResync.current = null
        resyncAll()
      }, wait)
    },
    subs: subs.map((s) => ({
      table: s.table,
      event: s.event,
      filter: s.filter,
      handler: () => {
        s.queryKeys.forEach((qk) =>
          debouncer.schedule(JSON.stringify(qk), () =>
            qc.invalidateQueries({ queryKey: qk })
          )
        )
      },
    })),
  })
}
