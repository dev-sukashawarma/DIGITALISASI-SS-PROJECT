/** Threshold (ms) above which a wrapped call is logged. */
const SLOW_MS = Number(process.env.PERF_SLOW_MS ?? 300)

/**
 * Wraps an async call and logs `[slow-query] <label> <ms>ms` when it exceeds
 * the threshold AND `PERF_LOG=1`. Zero overhead when PERF_LOG is unset.
 */
export async function withTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (process.env.PERF_LOG !== '1') return fn()
  const start = Date.now()
  try {
    return await fn()
  } finally {
    const ms = Date.now() - start
    if (ms >= SLOW_MS) console.warn(`[slow-query] ${label} ${ms}ms`)
  }
}
