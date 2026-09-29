import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDebouncer } from './debounce'

describe('createDebouncer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('tanpa maxWaitMs: debounce murni (perilaku lama) — badai event menunda terus', () => {
    const fn = vi.fn()
    const d = createDebouncer(5000)
    for (let i = 0; i < 20; i++) {
      d.schedule('k', fn)
      vi.advanceTimersByTime(1000)
    }
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(5000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('dengan maxWaitMs: tetap jalan paling lambat maxWait sejak event pertama', () => {
    const fn = vi.fn()
    const d = createDebouncer(5000, 15000)
    for (let i = 0; i < 20; i++) {
      d.schedule('k', fn)
      vi.advanceTimersByTime(1000)
    }
    // 20 dtk badai → minimal sekali jalan di detik ke-15
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('dengan maxWaitMs: event tunggal tetap menunggu waitMs', () => {
    const fn = vi.fn()
    const d = createDebouncer(5000, 15000)
    d.schedule('k', fn)
    vi.advanceTimersByTime(4999)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancelAll membatalkan semua', () => {
    const fn = vi.fn()
    const d = createDebouncer(5000, 15000)
    d.schedule('a', fn)
    d.schedule('b', fn)
    d.cancelAll()
    vi.advanceTimersByTime(60000)
    expect(fn).not.toHaveBeenCalled()
  })
})
