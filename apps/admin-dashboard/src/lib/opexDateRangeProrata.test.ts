import { describe, expect, it } from 'vitest'
import { calculateDateRangeProrata } from './opexDateRangeProrata'

describe('calculateDateRangeProrata', () => {
  it('mengenali September 1 s/d 30 sebagai 1 bulan kalender penuh (tidak prorata)', () => {
    const res = calculateDateRangeProrata('2026-09-01', '2026-09-30')
    expect(res).toEqual({
      overlapDays: 30,
      totalDays: 30,
      ratio: 1,
      isProrated: false,
      label: '1 Bulan Penuh'
    })
  })

  it('jika terpotong 1 s/d 29 September, terdeteksi prorata 29 hari', () => {
    const res = calculateDateRangeProrata('2026-09-01', '2026-09-29')
    expect(res.isProrated).toBe(true)
    expect(res.overlapDays).toBe(29)
    expect(res.totalDays).toBe(30)
    expect(res.ratio).toBeCloseTo(29 / 30, 4)
  })

  it('mengenali Oktober 1 s/d 31 sebagai 1 bulan kalender penuh', () => {
    const res = calculateDateRangeProrata('2026-10-01', '2026-10-31')
    expect(res).toEqual({
      overlapDays: 31,
      totalDays: 31,
      ratio: 1,
      isProrated: false,
      label: '1 Bulan Penuh'
    })
  })

  it('mengenali Februari 2024 (kabisat) 1 s/d 29 sebagai 1 bulan penuh', () => {
    const res = calculateDateRangeProrata('2024-02-01', '2024-02-29')
    expect(res).toEqual({
      overlapDays: 29,
      totalDays: 29,
      ratio: 1,
      isProrated: false,
      label: '1 Bulan Penuh'
    })
  })
})

describe('perhitungan filter preset bulan lalu', () => {
  function computeLastMonthRange(today: Date) {
    const prevYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
    const prevMonth = today.getMonth() === 0 ? 12 : today.getMonth() // 1-indexed (1 to 12)
    const padM = String(prevMonth).padStart(2, '0')
    const start = `${prevYear}-${padM}-01`
    const lastDay = new Date(prevYear, prevMonth, 0).getDate()
    const end = `${prevYear}-${padM}-${String(lastDay).padStart(2, '0')}`
    return { start, end }
  }

  it('saat bulan berjalan Oktober 2026, bulan lalu adalah 1 s/d 30 September 2026 (bukan 29)', () => {
    // 10 Oktober 2026
    const today = new Date(2026, 9, 10)
    const range = computeLastMonthRange(today)
    expect(range.start).toBe('2026-09-01')
    expect(range.end).toBe('2026-09-30')
  })

  it('saat bulan berjalan Januari 2026, bulan lalu adalah 1 s/d 31 Desember 2025', () => {
    // 5 Januari 2026
    const today = new Date(2026, 0, 5)
    const range = computeLastMonthRange(today)
    expect(range.start).toBe('2025-12-01')
    expect(range.end).toBe('2025-12-31')
  })

  it('saat bulan berjalan Maret 2024 (kabisat), bulan lalu adalah 1 s/d 29 Februari 2024', () => {
    // 15 Maret 2024
    const today = new Date(2024, 2, 15)
    const range = computeLastMonthRange(today)
    expect(range.start).toBe('2024-02-01')
    expect(range.end).toBe('2024-02-29')
  })

  it('saat bulan berjalan Maret 2026 (non-kabisat), bulan lalu adalah 1 s/d 28 Februari 2026', () => {
    // 15 Maret 2026
    const today = new Date(2026, 2, 15)
    const range = computeLastMonthRange(today)
    expect(range.start).toBe('2026-02-01')
    expect(range.end).toBe('2026-02-28')
  })
})
