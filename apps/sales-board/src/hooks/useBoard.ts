'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardPayload } from '@/lib/types'

const POLL_MS = 30_000

export type BoardMode = 'auto' | 'today' | 'yesterday'

export type BoardState = {
  data: BoardPayload | null
  /** ISO instant saat data terakhir BERHASIL diambil. */
  lastOk: string | null
  /** true bila permintaan terakhir gagal -- data yang tampil sudah basi. */
  stale: boolean
  error: string | null
}

export function useBoard(mode: BoardMode = 'auto'): BoardState & {
  refetch: () => Promise<void>
} {
  const [state, setState] = useState<BoardState>({
    data: null,
    lastOk: null,
    stale: false,
    error: null,
  })
  const aliveRef = useRef(true)

  const load = useCallback(async () => {
    try {
      const query = mode === 'auto' ? '' : `?mode=${mode}`
      const res = await fetch(`/api/board${query}`, { cache: 'no-store' })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      const payload = (await res.json()) as BoardPayload
      if (!aliveRef.current) return
      // Sukses: ganti data dan bersihkan penanda basi.
      setState({
        data: payload,
        lastOk: new Date().toISOString(),
        stale: false,
        error: null,
      })
    } catch (err) {
      if (!aliveRef.current) return
      const message = err instanceof Error ? err.message : 'Gagal memuat'
      // Gagal: PERTAHANKAN data terakhir, cukup tandai basi.
      setState((prev) => ({ ...prev, stale: true, error: message }))
    }
  }, [mode])

  useEffect(() => {
    aliveRef.current = true
    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => {
      aliveRef.current = false
      clearInterval(id)
    }
  }, [load])

  return {
    ...state,
    refetch: load,
  }
}
