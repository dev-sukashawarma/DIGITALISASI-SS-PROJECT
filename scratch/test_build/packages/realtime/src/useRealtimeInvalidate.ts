'use client'

import { useEffect, useMemo } from 'react'
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
}) {
  const { channelName, enabled = true, subs, debounceMs = 500 } = opts
  const qc = useQueryClient()
  const debouncer = useMemo(() => createDebouncer(debounceMs), [debounceMs])

  useEffect(() => () => debouncer.cancelAll(), [debouncer])

  useRealtimeChannel({
    channelName,
    enabled,
    // Event selama socket putus tidak di-replay server → sinkronkan ulang
    // begitu channel join lagi, supaya tak perlu refresh manual.
    onResubscribe: () => {
      subs.forEach((s) =>
        s.queryKeys.forEach((qk) => qc.invalidateQueries({ queryKey: qk }))
      )
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
