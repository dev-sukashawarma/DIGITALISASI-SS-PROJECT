import { describe, it, expect } from 'vitest'
import { getPromoStatus, validateSchedule } from './promoSchedule'

const NOW = Date.parse('2026-08-14T10:00:00.000Z') // 17:00 WIB

describe('getPromoStatus', () => {
  it('nonaktif saat toggle mati, walau jadwal sedang berjalan', () => {
    expect(getPromoStatus({ is_active: false, start_date: null, end_date: null }, NOW)).toBe('nonaktif')
  })

  it('berjalan saat tanpa jadwal sama sekali (perilaku lama)', () => {
    expect(getPromoStatus({ is_active: true }, NOW)).toBe('berjalan')
  })

  it('terjadwal saat mulai masih di depan', () => {
    expect(getPromoStatus({ is_active: true, start_date: '2026-08-14T11:00:00.000Z' }, NOW)).toBe('terjadwal')
  })

  it('berjalan saat sudah lewat waktu mulai', () => {
    expect(getPromoStatus({ is_active: true, start_date: '2026-08-14T09:59:00.000Z' }, NOW)).toBe('berjalan')
  })

  it('berakhir saat sudah lewat waktu selesai', () => {
    expect(getPromoStatus({ is_active: true, end_date: '2026-08-14T09:00:00.000Z' }, NOW)).toBe('berakhir')
  })

  it('berakhir menang atas terjadwal kalau dua-duanya sudah lewat', () => {
    expect(getPromoStatus(
      { is_active: true, start_date: '2026-08-13T00:00:00.000Z', end_date: '2026-08-14T00:00:00.000Z' },
      NOW
    )).toBe('berakhir')
  })

  it('tepat di detik mulai sudah dianggap berjalan', () => {
    expect(getPromoStatus({ is_active: true, start_date: '2026-08-14T10:00:00.000Z' }, NOW)).toBe('berjalan')
  })
})

describe('validateSchedule', () => {
  it('valid saat salah satu kosong', () => {
    expect(validateSchedule({ start_date: null, end_date: '2026-08-20T00:00:00.000Z' })).toBeNull()
    expect(validateSchedule({ start_date: '2026-08-20T00:00:00.000Z', end_date: null })).toBeNull()
  })

  it('valid saat selesai setelah mulai', () => {
    expect(validateSchedule({
      start_date: '2026-08-14T00:00:00.000Z',
      end_date: '2026-08-15T00:00:00.000Z',
    })).toBeNull()
  })

  it('menolak selesai sebelum atau sama dengan mulai', () => {
    expect(validateSchedule({
      start_date: '2026-08-15T00:00:00.000Z',
      end_date: '2026-08-14T00:00:00.000Z',
    })).toMatch(/lebih akhir/)
    expect(validateSchedule({
      start_date: '2026-08-15T00:00:00.000Z',
      end_date: '2026-08-15T00:00:00.000Z',
    })).toMatch(/lebih akhir/)
  })
})
