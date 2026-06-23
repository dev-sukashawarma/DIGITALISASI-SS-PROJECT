import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withTiming } from './timing'

describe('withTiming', () => {
  beforeEach(() => { process.env.PERF_LOG = '1' })
  afterEach(() => { delete process.env.PERF_LOG; vi.restoreAllMocks() })

  it('returns the wrapped fn result unchanged', async () => {
    const result = await withTiming('label', async () => 42)
    expect(result).toBe(42)
  })

  it('logs when duration exceeds threshold and PERF_LOG is set', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(500)
    await withTiming('slow-op', async () => 'x')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[slow-query] slow-op'))
  })

  it('does NOT log when PERF_LOG is unset', async () => {
    delete process.env.PERF_LOG
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(500)
    await withTiming('slow-op', async () => 'x')
    expect(spy).not.toHaveBeenCalled()
  })
})
