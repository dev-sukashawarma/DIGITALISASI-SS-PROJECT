import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createThrottledRefresher } from './realtimeThrottle'

describe('createThrottledRefresher', () => {
  let hidden = false
  let visCb: (() => void) | null = null
  const opts = () => ({
    isHidden: () => hidden,
    onVisibilityChange: (cb: () => void) => {
      visCb = cb
      return () => { visCb = null }
    },
  })

  beforeEach(() => {
    vi.useFakeTimers()
    hidden = false
    visCb = null
  })
  afterEach(() => vi.useRealTimers())

  it('event pertama langsung refresh', () => {
    const run = vi.fn()
    const r = createThrottledRefresher(run, 20_000, opts())
    r.trigger()
    vi.advanceTimersByTime(0)
    expect(run).toHaveBeenCalledTimes(1)
    r.dispose()
  })

  it('badai event dalam jeda digabung jadi satu refresh trailing', () => {
    const run = vi.fn()
    const r = createThrottledRefresher(run, 20_000, opts())
    r.trigger()
    vi.advanceTimersByTime(0)
    for (let i = 0; i < 50; i++) {
      vi.advanceTimersByTime(100)
      r.trigger()
    }
    expect(run).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(20_000)
    expect(run).toHaveBeenCalledTimes(2)
    // tanpa event baru, tidak ada refresh lagi
    vi.advanceTimersByTime(60_000)
    expect(run).toHaveBeenCalledTimes(2)
    r.dispose()
  })

  it('tab tersembunyi: ditunda, lalu satu refresh saat terlihat', () => {
    const run = vi.fn()
    const r = createThrottledRefresher(run, 20_000, opts())
    hidden = true
    r.trigger()
    vi.advanceTimersByTime(0)
    r.trigger()
    vi.advanceTimersByTime(0)
    expect(run).not.toHaveBeenCalled()
    hidden = false
    visCb?.()
    vi.advanceTimersByTime(0)
    expect(run).toHaveBeenCalledTimes(1)
    r.dispose()
  })

  it('dispose membatalkan refresh tertunda', () => {
    const run = vi.fn()
    const r = createThrottledRefresher(run, 20_000, opts())
    r.trigger()
    vi.advanceTimersByTime(0)
    r.trigger()
    r.dispose()
    vi.advanceTimersByTime(60_000)
    expect(run).toHaveBeenCalledTimes(1)
    expect(visCb).toBeNull()
  })
})
