import { describe, expect, it } from 'vitest'
import { awalHariWIBIso } from './waktuWIB'

describe('awalHariWIBIso', () => {
  it('00:00 WIB = 17:00 UTC hari sebelumnya', () => {
    // 2026-11-23 09:00 WIB
    expect(awalHariWIBIso(new Date(Date.UTC(2026, 10, 23, 2, 0)))).toBe('2026-11-22T17:00:00.000Z')
  })

  it('pukul 00:30 WIB sudah masuk hari baru (bukan hari UTC kemarin)', () => {
    // 2026-11-23 00:30 WIB = 2026-11-22 17:30 UTC
    expect(awalHariWIBIso(new Date(Date.UTC(2026, 10, 22, 17, 30)))).toBe('2026-11-22T17:00:00.000Z')
  })

  it('pukul 23:59 WIB masih hari yang sama', () => {
    // 2026-11-22 23:59 WIB = 2026-11-22 16:59 UTC
    expect(awalHariWIBIso(new Date(Date.UTC(2026, 10, 22, 16, 59)))).toBe('2026-11-21T17:00:00.000Z')
  })
})
