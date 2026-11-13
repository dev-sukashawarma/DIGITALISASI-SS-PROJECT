import { describe, it, expect } from 'vitest'
import { bolehCatatCicilan, labelStatusKasbon, statusEfektifKasbon } from './statusKasbon'

describe('statusEfektifKasbon', () => {
  it('disetujui HR tapi belum dicairkan = menunggu_cair', () => {
    expect(statusEfektifKasbon({ status: 'menunggu_cair', status_hr: 'approved' })).toBe('menunggu_cair')
  })
  it('sudah dicairkan = active', () => {
    expect(statusEfektifKasbon({ status: 'active', status_hr: 'approved' })).toBe('active')
  })
  it('pengajuan baru (status active bawaan) tetap pending', () => {
    expect(statusEfektifKasbon({ status: 'active', status_hr: 'pending' })).toBe('pending')
  })
  it('ditolak finance = rejected', () => {
    expect(
      statusEfektifKasbon({ status: 'menunggu_cair', status_hr: 'rejected', ditolak_finance_at: '2026-11-13T03:00:00Z' }),
    ).toBe('rejected')
  })
  it('lunas = paid_off', () => {
    expect(statusEfektifKasbon({ status: 'paid_off', status_hr: 'approved' })).toBe('paid_off')
  })
})

describe('labelStatusKasbon', () => {
  it('label status baru & tolak finance', () => {
    expect(labelStatusKasbon('menunggu_cair', false)).toBe('Menunggu pencairan')
    expect(labelStatusKasbon('rejected', true)).toBe('Ditolak (Finance)')
    expect(labelStatusKasbon('rejected', false)).toBe('Ditolak')
    expect(labelStatusKasbon('active', false)).toBe('Aktif')
  })
})

describe('bolehCatatCicilan', () => {
  it('hanya kasbon yang sudah dicairkan', () => {
    expect(bolehCatatCicilan('active')).toBe(true)
    expect(bolehCatatCicilan('menunggu_cair')).toBe(false)
    expect(bolehCatatCicilan('pending')).toBe(false)
  })
})
