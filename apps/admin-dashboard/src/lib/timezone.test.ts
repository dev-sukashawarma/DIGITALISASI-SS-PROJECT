import { describe, it, expect } from 'vitest'
import { toWibInputValue, fromWibInputValue, formatWib } from './timezone'

describe('konversi WIB', () => {
  it('ISO UTC → input datetime-local dalam WIB (+7 jam)', () => {
    expect(toWibInputValue('2026-08-14T10:00:00.000Z')).toBe('2026-08-14T17:00')
  })

  it('input WIB → ISO UTC (-7 jam)', () => {
    expect(fromWibInputValue('2026-08-14T17:00')).toBe('2026-08-14T10:00:00.000Z')
  })

  it('bolak-balik tidak menggeser waktu', () => {
    const iso = '2026-12-31T17:30:00.000Z'
    expect(fromWibInputValue(toWibInputValue(iso))).toBe(iso)
  })

  it('lintas tengah malam WIB tetap benar', () => {
    // 00:30 WIB tanggal 15 = 17:30 UTC tanggal 14
    expect(fromWibInputValue('2026-08-15T00:30')).toBe('2026-08-14T17:30:00.000Z')
    expect(toWibInputValue('2026-08-14T17:30:00.000Z')).toBe('2026-08-15T00:30')
  })

  it('nilai kosong / tidak valid tidak melempar', () => {
    expect(toWibInputValue(null)).toBe('')
    expect(toWibInputValue('bukan-tanggal')).toBe('')
    expect(fromWibInputValue('')).toBeNull()
    expect(fromWibInputValue('bukan-tanggal')).toBeNull()
    expect(formatWib(null)).toBe('-')
  })

  it('format tampilan memakai zona Asia/Jakarta apa pun zona perangkat', () => {
    expect(formatWib('2026-08-14T10:00:00.000Z')).toContain('17')
    expect(formatWib('2026-08-14T10:00:00.000Z')).toContain('WIB')
  })
})
