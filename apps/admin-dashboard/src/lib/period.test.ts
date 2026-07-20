import { describe, it, expect } from 'vitest'
import { presetRange, previousRange, monthRange } from './period'

describe('presetRange', () => {
  it('7 hari termasuk hari ini', () => {
    expect(presetRange('7d', new Date('2026-06-19T10:00:00+07:00')))
      .toEqual({ from: '2026-06-13', to: '2026-06-19' })
  })
})
describe('previousRange', () => {
  it('periode sebelum, sama panjang', () => {
    expect(previousRange({ from: '2026-06-13', to: '2026-06-19' }))
      .toEqual({ from: '2026-06-06', to: '2026-06-12' })
  })
})
describe('monthRange', () => {
  it('Juli 2026 (31 hari)', () => {
    expect(monthRange(2026, 7)).toEqual({ from: '2026-07-01', to: '2026-07-31' })
  })
  it('Februari 2026, bukan tahun kabisat (28 hari)', () => {
    expect(monthRange(2026, 2)).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })
  it('Februari 2024, tahun kabisat (29 hari)', () => {
    expect(monthRange(2024, 2)).toEqual({ from: '2024-02-01', to: '2024-02-29' })
  })
  it('Januari (padding bulan single-digit)', () => {
    expect(monthRange(2026, 1)).toEqual({ from: '2026-01-01', to: '2026-01-31' })
  })
})
