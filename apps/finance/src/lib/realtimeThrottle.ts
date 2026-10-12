/**
 * Pembatas refresh untuk handler realtime.
 */
export interface ThrottledRefresher {
  /** Dipanggil dari handler realtime. */
  trigger: () => void
  /** Wajib dipanggil saat cleanup effect. */
  dispose: () => void
}

export function createThrottledRefresher(
  run: () => void,
  minGapMs: number,
  opts: {
    now?: () => number
    isHidden?: () => boolean
    setTimer?: (fn: () => void, ms: number) => unknown
    clearTimer?: (t: unknown) => void
    onVisibilityChange?: (cb: () => void) => () => void
  } = {},
): ThrottledRefresher {
  const now = opts.now ?? (() => Date.now())
  const isHidden = opts.isHidden ?? (() => typeof document !== 'undefined' && document.hidden)
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = opts.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>))
  const listenVisibility =
    opts.onVisibilityChange ??
    ((cb: () => void) => {
      if (typeof document === 'undefined') return () => {}
      document.addEventListener('visibilitychange', cb)
      return () => document.removeEventListener('visibilitychange', cb)
    })

  let timer: unknown = null
  let lastRunAt: number | null = null
  let pendingWhileHidden = false
  let disposed = false

  const fire = () => {
    timer = null
    if (disposed) return
    if (isHidden()) {
      pendingWhileHidden = true
      return
    }
    lastRunAt = now()
    run()
  }

  const trigger = () => {
    if (disposed || timer !== null) return
    const delay = lastRunAt === null ? 0 : Math.max(0, lastRunAt + minGapMs - now())
    timer = setTimer(fire, delay)
  }

  const stopListening = listenVisibility(() => {
    if (!isHidden() && pendingWhileHidden) {
      pendingWhileHidden = false
      trigger()
    }
  })

  return {
    trigger,
    dispose: () => {
      disposed = true
      if (timer !== null) clearTimer(timer)
      timer = null
      stopListening()
    },
  }
}
