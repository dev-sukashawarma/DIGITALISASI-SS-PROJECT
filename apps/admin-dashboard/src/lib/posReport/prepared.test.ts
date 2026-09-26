import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { getPrepared, clearPrepared } from './prepared'

const make = (n: number) => ({ orders: Array.from({ length: n }, (_, i) => i) })

describe('getPrepared', () => {
  beforeEach(() => clearPrepared())
  afterEach(() => vi.useRealTimers())

  it('permintaan serentak dengan kunci sama berbagi satu build', async () => {
    const build = vi.fn(async () => make(3))
    const [a, b] = await Promise.all([getPrepared('k', 20_000, build), getPrepared('k', 20_000, build)])
    expect(build).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
  })

  it('dipakai ulang sampai TTL habis, lalu dibangun ulang', async () => {
    vi.useFakeTimers()
    const build = vi.fn(async () => make(1))
    await getPrepared('k', 20_000, build)
    vi.advanceTimersByTime(19_000)
    await getPrepared('k', 20_000, build)
    expect(build).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2_000)
    await getPrepared('k', 20_000, build)
    expect(build).toHaveBeenCalledTimes(2)
  })

  it('kegagalan tidak disimpan — permintaan berikutnya mencoba lagi', async () => {
    const build = vi.fn()
      .mockRejectedValueOnce(new Error('db sibuk'))
      .mockResolvedValueOnce(make(1))
    await expect(getPrepared('k', 20_000, build)).rejects.toThrow('db sibuk')
    await expect(getPrepared('k', 20_000, build)).resolves.toEqual(make(1))
    expect(build).toHaveBeenCalledTimes(2)
  })

  it('clearPrepared memaksa build ulang', async () => {
    const build = vi.fn(async () => make(1))
    await getPrepared('k', 60_000, build)
    clearPrepared()
    await getPrepared('k', 60_000, build)
    expect(build).toHaveBeenCalledTimes(2)
  })

  it('membuang entri terlama bila total order melebihi batas', async () => {
    const buildA = vi.fn(async () => make(100_000))
    const buildB = vi.fn(async () => make(100_000))
    await getPrepared('a', 60_000, buildA)
    await getPrepared('b', 60_000, buildB)
    await getPrepared('a', 60_000, buildA) // 'a' terbuang saat 'b' masuk
    await getPrepared('b', 60_000, buildB)
    expect(buildA).toHaveBeenCalledTimes(2)
  })
})
