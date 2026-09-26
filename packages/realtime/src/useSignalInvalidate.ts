'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { subscribeServerSignal } from './serverSignal'
import { createDebouncer } from './debounce'

/**
 * Seperti useRealtimeInvalidate, tetapi pemicunya sinyal broadcast dari database
 * (channel privat bertopik tetap, mis. `stok:<outlet_id>`), bukan postgres_changes.
 * Beberapa komponen boleh memakai topic yang sama sekaligus — channel-nya dibagi.
 */
export function useSignalInvalidate(opts: {
  topic: string
  event: string
  enabled?: boolean
  queryKeys: unknown[][]
  debounceMs?: number
  /** Jarak minimum antar-sinkronisasi ulang saat channel join lagi (sama dengan useRealtimeInvalidate). */
  resubscribeMinIntervalMs?: number
}) {
  const { topic, event, enabled = true, queryKeys, debounceMs = 500, resubscribeMinIntervalMs = 30_000 } = opts
  const qc = useQueryClient()
  const keysRef = useRef(queryKeys)
  keysRef.current = queryKeys
  const keysSignature = JSON.stringify(queryKeys)

  useEffect(() => {
    if (!enabled) return
    const debouncer = createDebouncer(debounceMs)
    let lastResyncAt = 0
    let pendingResync: ReturnType<typeof setTimeout> | null = null

    const resyncAll = () => {
      lastResyncAt = Date.now()
      keysRef.current.forEach((qk) => qc.invalidateQueries({ queryKey: qk }))
    }

    const unsubscribe = subscribeServerSignal(topic, event, {
      onSignal: () => {
        keysRef.current.forEach((qk) =>
          debouncer.schedule(JSON.stringify(qk), () => qc.invalidateQueries({ queryKey: qk }))
        )
      },
      // Sinyal selama socket putus tidak diulang server → tarik ulang begitu join lagi.
      onResubscribe: () => {
        const wait = lastResyncAt + resubscribeMinIntervalMs - Date.now()
        if (wait <= 0) {
          resyncAll()
          return
        }
        if (pendingResync) return
        pendingResync = setTimeout(() => {
          pendingResync = null
          resyncAll()
        }, wait)
      },
    })

    return () => {
      unsubscribe()
      debouncer.cancelAll()
      if (pendingResync) clearTimeout(pendingResync)
    }
    // keysSignature menggantikan queryKeys (array baru di tiap render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, topic, event, enabled, debounceMs, resubscribeMinIntervalMs, keysSignature])
}
