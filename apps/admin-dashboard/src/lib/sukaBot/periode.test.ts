import { describe, it, expect } from 'vitest'
import { resolvePeriode, periodePembanding, labelTanggal } from './periode'

// 2026-10-01 = Kamis. Senin minggu itu = 2026-09-28.
const KAMIS = '2026-10-01'

describe('labelTanggal', () => {
  it('menulis hari, tanggal, bulan singkat, tahun', () => {
    expect(labelTanggal('2026-10-01')).toBe('Kam 1 Okt 2026')
    expect(labelTanggal('2026-09-28')).toBe('Sen 28 Sep 2026')
  })
})

describe('resolvePeriode', () => {
  it('hari_ini berjalan', () => {
    expect(resolvePeriode('hari_ini', KAMIS)).toMatchObject({ dari: KAMIS, sampai: KAMIS, berjalan: true })
  })
  it('kemarin', () => {
    expect(resolvePeriode('kemarin', KAMIS)).toMatchObject({ dari: '2026-09-30', sampai: '2026-09-30', berjalan: false })
  })
  it('minggu_ini mulai Senin', () => {
    expect(resolvePeriode('minggu_ini', KAMIS)).toMatchObject({ dari: '2026-09-28', sampai: KAMIS, berjalan: true })
  })
  it('minggu_ini saat hari Minggu tetap mulai Senin sebelumnya', () => {
    expect(resolvePeriode('minggu_ini', '2026-10-04')).toMatchObject({ dari: '2026-09-28', sampai: '2026-10-04' })
  })
  it('minggu_lalu Senin–Minggu penuh', () => {
    expect(resolvePeriode('minggu_lalu', KAMIS)).toMatchObject({ dari: '2026-09-21', sampai: '2026-09-27' })
  })
  it('bulan_ini & bulan_lalu', () => {
    expect(resolvePeriode('bulan_ini', KAMIS)).toMatchObject({ dari: '2026-10-01', sampai: KAMIS, berjalan: true })
    expect(resolvePeriode('bulan_lalu', KAMIS)).toMatchObject({ dari: '2026-09-01', sampai: '2026-09-30' })
  })
  it('rentang dijepit ke hari ini & ditolak bila terbalik/terlalu panjang', () => {
    expect(resolvePeriode('rentang', KAMIS, { dari: '2026-09-25', sampai: '2026-10-09' })).toMatchObject({ dari: '2026-09-25', sampai: KAMIS })
    expect(() => resolvePeriode('rentang', KAMIS, { dari: '2026-09-25', sampai: '2026-09-01' })).toThrow()
    expect(() => resolvePeriode('rentang', KAMIS, { dari: '2025-01-01', sampai: '2026-09-01' })).toThrow()
    expect(() => resolvePeriode('rentang', KAMIS, { dari: 'kemarin' })).toThrow()
  })
  it('label memuat tanggal persis', () => {
    expect(resolvePeriode('minggu_ini', KAMIS).label).toBe('Minggu ini (Sen 28 Sep 2026 – Kam 1 Okt 2026)')
  })
})

describe('periodePembanding', () => {
  const p = (k: any, h = KAMIS) => periodePembanding(k, resolvePeriode(k, h))
  it('harian & mingguan: mundur 7 hari dengan panjang sama', () => {
    expect(p('kemarin')).toMatchObject({ dari: '2026-09-23', sampai: '2026-09-23' })
    expect(p('minggu_ini')).toMatchObject({ dari: '2026-09-21', sampai: '2026-09-24' })
    expect(p('minggu_lalu')).toMatchObject({ dari: '2026-09-14', sampai: '2026-09-20' })
  })
  it('bulan_ini: tanggal 1 s/d hari yang sama bulan lalu, dijepit akhir bulan', () => {
    expect(p('bulan_ini')).toMatchObject({ dari: '2026-09-01', sampai: '2026-09-01' })
    expect(p('bulan_ini', '2026-03-31')).toMatchObject({ dari: '2026-02-01', sampai: '2026-02-28' })
  })
  it('bulan_lalu: bulan penuh sebelumnya', () => {
    expect(p('bulan_lalu')).toMatchObject({ dari: '2026-08-01', sampai: '2026-08-31' })
  })
  it('rentang: rentang sama panjang tepat sebelumnya', () => {
    const r = resolvePeriode('rentang', KAMIS, { dari: '2026-09-21', sampai: '2026-09-23' })
    expect(periodePembanding('rentang', r)).toMatchObject({ dari: '2026-09-18', sampai: '2026-09-20' })
  })
})
