import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@suka/auth', () => ({
  createSupabaseBrowserClient: () => {
    throw new Error('klien browser tidak dipakai di tes')
  },
}))

import { createSignalHub, type SignalChannel, type SignalClient } from './serverSignal'

type FakeChannel = SignalChannel & {
  topic: string
  opts: unknown
  status: (status: string) => void
  emit: (event: string, payload: Record<string, unknown>) => void
}

function fakeClient() {
  const channels: FakeChannel[] = []
  const removed: FakeChannel[] = []
  const client: SignalClient = {
    channel(topic, opts) {
      const handlers: Array<{ event: string; cb: (m: { payload?: Record<string, unknown> }) => void }> = []
      let onStatus: (status: string) => void = () => {}
      const channel: FakeChannel = {
        topic,
        opts,
        on(_type, filter, cb) {
          handlers.push({ event: filter.event, cb })
          return channel
        },
        subscribe(cb) {
          onStatus = cb
          return channel
        },
        status: (status) => onStatus(status),
        emit: (event, payload) =>
          handlers.filter((h) => h.event === event).forEach((h) => h.cb({ payload })),
      }
      channels.push(channel)
      return channel
    },
    removeChannel(channel) {
      removed.push(channel as FakeChannel)
      // realtime-js memanggil callback subscribe dengan CLOSED saat channel dilepas.
      ;(channel as FakeChannel).status('CLOSED')
      return 'ok'
    },
  }
  return { client, channels, removed }
}

describe('createSignalHub', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('dua pendengar topic yang sama berbagi satu channel privat', () => {
    const { client, channels } = fakeClient()
    const hub = createSignalHub(() => client)
    const a = vi.fn()
    const b = vi.fn()

    hub.subscribe('stok:1', 'stok_berubah', { onSignal: a })
    hub.subscribe('stok:1', 'stok_berubah', { onSignal: b })

    expect(channels).toHaveLength(1)
    expect(channels[0].topic).toBe('stok:1')
    expect(channels[0].opts).toEqual({ config: { private: true, broadcast: { self: false } } })
    channels[0].status('SUBSCRIBED')
    channels[0].emit('stok_berubah', { outlet_id: '1' })
    expect(a).toHaveBeenCalledWith({ outlet_id: '1' })
    expect(b).toHaveBeenCalledWith({ outlet_id: '1' })
  })

  it('channel dilepas hanya saat pendengar terakhir pergi, tanpa menyambung ulang', () => {
    const { client, channels, removed } = fakeClient()
    const hub = createSignalHub(() => client)
    const stopA = hub.subscribe('stok:1', 'stok_berubah', { onSignal: vi.fn() })
    const stopB = hub.subscribe('stok:1', 'stok_berubah', { onSignal: vi.fn() })
    channels[0].status('SUBSCRIBED')

    stopA()
    expect(removed).toHaveLength(0)
    stopB()
    expect(removed).toEqual([channels[0]])

    vi.advanceTimersByTime(120_000)
    expect(channels).toHaveLength(1)
  })

  it('channel error menyambung ulang dengan jeda lalu memanggil onResubscribe', () => {
    const { client, channels, removed } = fakeClient()
    const hub = createSignalHub(() => client)
    const onResubscribe = vi.fn()
    hub.subscribe('stok:1', 'stok_berubah', { onSignal: vi.fn(), onResubscribe })
    channels[0].status('SUBSCRIBED')
    expect(onResubscribe).not.toHaveBeenCalled()

    channels[0].status('CHANNEL_ERROR')
    expect(channels).toHaveLength(1)
    vi.advanceTimersByTime(1_000)

    expect(channels).toHaveLength(2)
    expect(removed).toEqual([channels[0]])
    channels[1].status('SUBSCRIBED')
    expect(onResubscribe).toHaveBeenCalledTimes(1)

    // CLOSED dari channel lama yang dilepas tidak boleh memicu sambung ulang tambahan.
    vi.advanceTimersByTime(120_000)
    expect(channels).toHaveLength(2)
  })

  it('backoff naik berlipat sampai 30 detik selama channel terus gagal', () => {
    const { client, channels } = fakeClient()
    const hub = createSignalHub(() => client)
    hub.subscribe('stok:1', 'stok_berubah', { onSignal: vi.fn() })

    const jeda: number[] = []
    for (let i = 0; i < 7; i++) {
      channels[channels.length - 1].status('CHANNEL_ERROR')
      const sebelum = channels.length
      let tunggu = 0
      while (channels.length === sebelum) {
        vi.advanceTimersByTime(1_000)
        tunggu += 1_000
      }
      jeda.push(tunggu)
    }

    expect(jeda).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000])
  })

  it('topic atau event berbeda memakai channel masing-masing', () => {
    const { client, channels } = fakeClient()
    const hub = createSignalHub(() => client)
    hub.subscribe('stok:1', 'stok_berubah', { onSignal: vi.fn() })
    hub.subscribe('stok:2', 'stok_berubah', { onSignal: vi.fn() })
    hub.subscribe('stok:1', 'lain', { onSignal: vi.fn() })

    expect(channels.map((c) => c.topic)).toEqual(['stok:1', 'stok:2', 'stok:1'])
  })

  it('pendengar yang melempar tidak memutus pendengar lain', () => {
    const { client, channels } = fakeClient()
    const hub = createSignalHub(() => client)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sehat = vi.fn()
    hub.subscribe('stok:1', 'stok_berubah', {
      onSignal: () => {
        throw new Error('bug')
      },
    })
    hub.subscribe('stok:1', 'stok_berubah', { onSignal: sehat })
    channels[0].status('SUBSCRIBED')

    channels[0].emit('stok_berubah', {})

    expect(sehat).toHaveBeenCalledTimes(1)
    error.mockRestore()
  })
})
