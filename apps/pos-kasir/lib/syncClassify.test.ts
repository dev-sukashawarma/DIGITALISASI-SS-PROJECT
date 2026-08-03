import { describe, it, expect } from 'vitest'
import { classifySyncFailure, backoffDelayMs } from './syncClassify'

describe('classifySyncFailure', () => {
  it('mencoba ulang error server sementara', () => {
    expect(classifySyncFailure(500)).toBe('retry')
    expect(classifySyncFailure(502)).toBe('retry')
    expect(classifySyncFailure(503)).toBe('retry')
  })

  it('mencoba ulang saat kena rate limit', () => {
    expect(classifySyncFailure(429)).toBe('retry')
  })

  it('mencoba ulang saat sesi kedaluwarsa — bisa pulih setelah token refresh', () => {
    expect(classifySyncFailure(401)).toBe('retry')
  })

  it('menyerah pada penolakan bisnis yang tidak akan berubah', () => {
    expect(classifySyncFailure(400)).toBe('give_up')
    expect(classifySyncFailure(403)).toBe('give_up')
    expect(classifySyncFailure(422)).toBe('give_up')
  })
})

describe('backoffDelayMs', () => {
  it('menunda lebih lama tiap percobaan gagal', () => {
    expect(backoffDelayMs(1)).toBeLessThan(backoffDelayMs(2))
    expect(backoffDelayMs(2)).toBeLessThan(backoffDelayMs(3))
  })

  it('percobaan pertama tidak menunggu lama', () => {
    expect(backoffDelayMs(0)).toBeLessThanOrEqual(30_000)
  })

  it('dibatasi supaya tidak menunda berjam-jam', () => {
    expect(backoffDelayMs(50)).toBeLessThanOrEqual(15 * 60 * 1000)
  })
})
