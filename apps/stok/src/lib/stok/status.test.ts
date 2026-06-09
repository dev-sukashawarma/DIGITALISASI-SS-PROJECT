import { describe, it, expect } from 'vitest'
import { stokStatus, isOpnameOverdue } from './status'

describe('stokStatus', () => {
  it('aman when saldo >= reorder', () => {
    expect(stokStatus(43, 30)).toBe('aman')
    expect(stokStatus(30, 30)).toBe('aman')
  })
  it('menipis between half and full reorder', () => {
    expect(stokStatus(20, 30)).toBe('menipis')
  })
  it('kritis below half reorder', () => {
    expect(stokStatus(10, 30)).toBe('kritis')
  })
  it('unknown when reorder not set (0)', () => {
    expect(stokStatus(5, 0)).toBe('unknown')
  })
})

describe('isOpnameOverdue', () => {
  const now = new Date('2026-06-10T12:00:00Z')
  it('false when last opname today/yesterday', () => {
    expect(isOpnameOverdue('2026-06-09', now)).toBe(false)
  })
  it('true when last opname older than 2 days', () => {
    expect(isOpnameOverdue('2026-06-06', now)).toBe(true)
  })
  it('true when never (null)', () => {
    expect(isOpnameOverdue(null, now)).toBe(true)
  })
})
