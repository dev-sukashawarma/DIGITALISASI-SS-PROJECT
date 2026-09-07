import { describe, expect, it } from 'vitest'
import { presetRange, monthRange, previousRange, diffDays } from './period'

describe('presetRange — last_month', () => {
  it('mengembalikan bulan kalender penuh sebelum bulan berjalan', () => {
    expect(presetRange('last_month', new Date('2026-09-07T03:00:00Z'))).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    })
  })

  it('mundur ke Desember tahun sebelumnya saat bulan berjalan Januari', () => {
    expect(presetRange('last_month', new Date('2026-01-05T00:00:00Z'))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    })
  })

  it('tahu jumlah hari Februari', () => {
    expect(presetRange('last_month', new Date('2026-03-10T00:00:00Z'))).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    })
    // 2024 kabisat
    expect(presetRange('last_month', new Date('2024-03-10T00:00:00Z'))).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    })
  })

  it('memakai tanggal Asia/Jakarta, bukan UTC', () => {
    // 28 Feb 18:00 UTC = 1 Maret 01:00 WIB → bulan lalu = Februari, bukan Januari
    expect(presetRange('last_month', new Date('2026-02-28T18:00:00Z'))).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    })
  })

  it('tidak pernah beririsan dengan rentang "bulan ini"', () => {
    const now = new Date('2026-09-07T03:00:00Z')
    const lalu = presetRange('last_month', now)
    const ini = presetRange('this_month', now)
    expect(lalu.to < ini.from).toBe(true)
  })
})

describe('presetRange — preset lama tetap utuh', () => {
  const now = new Date('2026-09-07T03:00:00Z')

  it('today, yesterday, 7d, 30d, this_month tak berubah perilakunya', () => {
    expect(presetRange('today', now)).toEqual({ from: '2026-09-07', to: '2026-09-07' })
    expect(presetRange('yesterday', now)).toEqual({ from: '2026-09-06', to: '2026-09-06' })
    expect(presetRange('7d', now)).toEqual({ from: '2026-09-01', to: '2026-09-07' })
    expect(presetRange('30d', now)).toEqual({ from: '2026-08-09', to: '2026-09-07' })
    expect(presetRange('this_month', now)).toEqual({ from: '2026-09-01', to: '2026-09-07' })
  })
})

describe('helper rentang lain', () => {
  it('monthRange menghitung hari terakhir bulan', () => {
    expect(monthRange(2026, 2)).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthRange(2026, 12)).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })

  it('diffDays inklusif di kedua ujung', () => {
    expect(diffDays('2026-09-01', '2026-09-07')).toBe(7)
  })

  it('previousRange menggeser mundur sepanjang rentangnya', () => {
    expect(previousRange({ from: '2026-09-01', to: '2026-09-07' })).toEqual({
      from: '2026-08-25',
      to: '2026-08-31',
    })
  })
})
