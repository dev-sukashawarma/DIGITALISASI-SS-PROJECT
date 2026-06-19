import { describe, it, expect } from 'vitest'
import { presetRange, previousRange } from './period'

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
