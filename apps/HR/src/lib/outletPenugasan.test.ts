import { describe, expect, it } from 'vitest'
import { bisaDitugaskan } from './outletPenugasan'

describe('bisaDitugaskan', () => {
  it('outlet berstatus Persiapan bisa ditugaskan staf (AM/leader/crew sebelum Go-Live)', () => {
    expect(bisaDitugaskan({ is_active: false, status: 'pending' })).toBe(true)
  })
  it('outlet aktif bisa ditugaskan', () => {
    expect(bisaDitugaskan({ is_active: true, status: 'active' })).toBe(true)
  })
  it('outlet nonaktif tidak bisa ditugaskan', () => {
    expect(bisaDitugaskan({ is_active: false, status: 'inactive' })).toBe(false)
  })
  it('tanpa kolom status, jatuh ke is_active', () => {
    expect(bisaDitugaskan({ is_active: false })).toBe(false)
    expect(bisaDitugaskan({ is_active: true })).toBe(true)
  })
})
