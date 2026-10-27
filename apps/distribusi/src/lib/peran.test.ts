import { describe, expect, it } from 'vitest'
import { bisaBuatSj, bisaLacakDriver, bisaLihatSemuaSj, isDriver, isPusat, isPusatSender } from './peran'

describe('peran distribusi', () => {
  it('driver bukan pusat dan bukan pengirim pusat', () => {
    expect(isPusat('driver')).toBe(false)
    expect(isPusatSender('driver')).toBe(false)
    expect(bisaBuatSj('driver')).toBe(false)
  })

  it('driver melihat semua SJ (read-only)', () => {
    expect(isDriver('driver')).toBe(true)
    expect(bisaLihatSemuaSj('driver')).toBe(true)
    expect(bisaLihatSemuaSj('kitchen')).toBe(true)
    expect(bisaLihatSemuaSj('crew')).toBe(false)
    expect(bisaLihatSemuaSj(null)).toBe(false)
  })

  it('pelacak driver = kitchen, admin, purchasing, owner, developer', () => {
    for (const r of ['kitchen', 'admin', 'purchasing', 'owner', 'developer']) expect(bisaLacakDriver(r)).toBe(true)
    for (const r of ['driver', 'spv', 'crew', 'leader', 'admin_hr', undefined]) expect(bisaLacakDriver(r)).toBe(false)
  })

  it('pusat sender memuat purchasing, pusat tidak', () => {
    expect(isPusatSender('purchasing')).toBe(true)
    expect(isPusat('purchasing')).toBe(false)
    expect(isPusat('kitchen')).toBe(true)
  })
})
