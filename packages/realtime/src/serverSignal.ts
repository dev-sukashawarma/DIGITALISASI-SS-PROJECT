'use client'

import { createSupabaseBrowserClient } from '@suka/auth'

/**
 * Sinyal ringan yang dikirim DATABASE lewat Broadcast from Database (`realtime.send`)
 * ke channel privat, mis. `stok:<outlet_id>` dari trigger stok_balance.
 *
 * Beda dengan useRealtimeChannel: nama channel di sini adalah alamat yang dipakai server,
 * jadi tidak bisa dibuat unik per komponen. Dua komponen di halaman yang sama (mis.
 * KasirNav dan StockMarquee) yang masing-masing membuka channel bertopik sama akan saling
 * menendang: realtime-js melempar error saat `subscribe()` kedua, dan `removeChannel` milik
 * satu komponen memutus komponen lainnya. Karena itu satu topic = satu channel yang dibagi,
 * dengan hitungan pendengar.
 */

/** Bagian klien Supabase yang dipakai hub — cukup kecil untuk dipalsukan di tes. */
export interface SignalChannel {
  on(
    type: 'broadcast',
    filter: { event: string },
    callback: (message: { payload?: Record<string, unknown> }) => void
  ): SignalChannel
  subscribe(callback: (status: string) => void): unknown
}

export interface SignalClient {
  channel(
    topic: string,
    opts: { config: { private: boolean; broadcast: { self: boolean } } }
  ): SignalChannel
  removeChannel(channel: SignalChannel): unknown
}

export type SignalListener = {
  onSignal: (payload: Record<string, unknown>) => void
  /** Dipanggil tiap channel join ULANG (bukan join pertama): sinyal selama putus tidak diulang server. */
  onResubscribe?: () => void
}

/** Channel dianggap stabil (backoff di-reset) setelah join bertahan selama ini — sama dengan useRealtimeChannel. */
const STABLE_MS = 30_000
const MAX_BACKOFF_MS = 30_000

type Timer = ReturnType<typeof setTimeout>

type Entry = {
  topic: string
  event: string
  listeners: Set<SignalListener>
  channel: SignalChannel | null
  joined: boolean
  joinedOnce: boolean
  attempt: number
  retryTimer: Timer | null
  stableTimer: Timer | null
}

function safely(fn: () => void) {
  try {
    fn()
  } catch (error) {
    // Satu pendengar yang bermasalah tidak boleh memutus pendengar lain.
    console.error('[realtime] pendengar sinyal gagal', error)
  }
}

export function createSignalHub(getClient: () => SignalClient) {
  const entries = new Map<string, Entry>()
  let windowHooked = false

  const keyOf = (topic: string, event: string) => `${topic}\u0000${event}`

  const clearTimers = (entry: Entry) => {
    if (entry.retryTimer) clearTimeout(entry.retryTimer)
    if (entry.stableTimer) clearTimeout(entry.stableTimer)
    entry.retryTimer = null
    entry.stableTimer = null
  }

  // Channel lama dilepas SETELAH entri tidak lagi menunjuk ke sana: removeChannel memanggil
  // callback subscribe-nya dengan CLOSED, dan tanpa urutan ini CLOSED itu memicu reconnect.
  const dropChannel = (entry: Entry) => {
    const old = entry.channel
    entry.channel = null
    entry.joined = false
    if (old) getClient().removeChannel(old)
  }

  const scheduleReconnect = (entry: Entry) => {
    if (entry.retryTimer || entries.get(keyOf(entry.topic, entry.event)) !== entry) return
    const delay = Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** entry.attempt++)
    entry.retryTimer = setTimeout(() => {
      entry.retryTimer = null
      if (entries.get(keyOf(entry.topic, entry.event)) === entry) connect(entry)
    }, delay)
  }

  const connect = (entry: Entry) => {
    dropChannel(entry)
    const channel = getClient().channel(entry.topic, {
      config: { private: true, broadcast: { self: false } },
    })
    entry.channel = channel
    channel.on('broadcast', { event: entry.event }, (message) => {
      const payload = message?.payload ?? {}
      entry.listeners.forEach((listener) => safely(() => listener.onSignal(payload)))
    })
    channel.subscribe((status) => {
      if (entry.channel !== channel) return
      if (status === 'SUBSCRIBED') {
        entry.joined = true
        if (entry.stableTimer) clearTimeout(entry.stableTimer)
        entry.stableTimer = setTimeout(() => {
          entry.stableTimer = null
          entry.attempt = 0
        }, STABLE_MS)
        if (entry.joinedOnce) {
          entry.listeners.forEach((listener) => safely(() => listener.onResubscribe?.()))
        }
        entry.joinedOnce = true
        return
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        entry.joined = false
        if (entry.stableTimer) {
          clearTimeout(entry.stableTimer)
          entry.stableTimer = null
        }
        scheduleReconnect(entry)
      }
    })
  }

  /** Tab bangun dari tidur / jaringan kembali: jangan tunggu backoff. */
  const reconnectIdle = () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    entries.forEach((entry) => {
      if (entry.joined) return
      if (entry.retryTimer) {
        clearTimeout(entry.retryTimer)
        entry.retryTimer = null
      }
      connect(entry)
    })
  }

  const hookWindow = (on: boolean) => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || windowHooked === on) return
    windowHooked = on
    if (on) {
      document.addEventListener('visibilitychange', reconnectIdle)
      window.addEventListener('online', reconnectIdle)
    } else {
      document.removeEventListener('visibilitychange', reconnectIdle)
      window.removeEventListener('online', reconnectIdle)
    }
  }

  return {
    /** Mulai mendengar sinyal [event] di channel privat [topic]. Kembalian = berhenti mendengar. */
    subscribe(topic: string, event: string, listener: SignalListener): () => void {
      const key = keyOf(topic, event)
      let entry = entries.get(key)
      if (!entry) {
        entry = {
          topic,
          event,
          listeners: new Set(),
          channel: null,
          joined: false,
          joinedOnce: false,
          attempt: 0,
          retryTimer: null,
          stableTimer: null,
        }
        entries.set(key, entry)
        connect(entry)
        hookWindow(true)
      }
      entry.listeners.add(listener)
      const owned = entry
      return () => {
        owned.listeners.delete(listener)
        if (owned.listeners.size > 0 || entries.get(key) !== owned) return
        entries.delete(key)
        clearTimers(owned)
        dropChannel(owned)
        if (entries.size === 0) hookWindow(false)
      }
    },
  }
}

let defaultHub: ReturnType<typeof createSignalHub> | undefined

/** Hub bersama per tab, di atas klien browser tunggal dari @suka/auth. */
export function subscribeServerSignal(topic: string, event: string, listener: SignalListener): () => void {
  defaultHub ??= createSignalHub(() => createSupabaseBrowserClient() as unknown as SignalClient)
  return defaultHub.subscribe(topic, event, listener)
}
