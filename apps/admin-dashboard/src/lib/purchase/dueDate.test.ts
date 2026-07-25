import { describe, it, expect } from 'vitest'
import { computeDueDate } from './dueDate'

describe('computeDueDate', () => {
  it('arrival + 30 hari', () => {
    expect(computeDueDate('2026-07-01', 30)).toBe('2026-07-31')
  })
  it('arrival + 45 hari lintas bulan', () => {
    expect(computeDueDate('2026-07-20', 45)).toBe('2026-09-03')
  })
  it('termin null → null', () => {
    expect(computeDueDate('2026-07-01', null)).toBeNull()
  })
  it('abaikan komponen jam pada arrival', () => {
    expect(computeDueDate('2026-07-01T14:30:00Z', 10)).toBe('2026-07-11')
  })
})
