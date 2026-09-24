import { describe, it, expect } from 'vitest'
import { hitungSampai } from './tutupSementara'

const wib = (s: string) => new Date(`${s}+07:00`)
describe('hitungSampai', () => {
  it('tutup hari ini = jam tutup hari ini', () => {
    expect(hitungSampai('tutup_hari_ini', wib('2026-09-24T15:00:00'), '22:00:00', '14:00:00', null).toISOString())
      .toBe(wib('2026-09-24T22:00:00').toISOString())
  })
  it('besok buka = jam buka besok', () => {
    expect(hitungSampai('besok_buka', wib('2026-09-24T15:00:00'), '22:00:00', '14:00:00', null).toISOString())
      .toBe(wib('2026-09-25T14:00:00').toISOString())
  })
  it('kustom dipakai apa adanya; di masa lalu melempar', () => {
    const k = wib('2026-09-26T10:00:00')
    expect(hitungSampai('kustom', wib('2026-09-24T15:00:00'), null, null, k)).toEqual(k)
    expect(() => hitungSampai('kustom', wib('2026-09-24T15:00:00'), null, null, wib('2026-09-24T14:00:00'))).toThrow()
  })
  it('tutup hari ini setelah jam tutup melempar (tak ada artinya)', () => {
    expect(() => hitungSampai('tutup_hari_ini', wib('2026-09-24T23:00:00'), '22:00:00', '14:00:00', null)).toThrow()
  })
})
