import { describe, expect, it } from 'vitest'
import { hitungStatusMasuk, hitungStatusPulang, type AturanJam } from './statusAbsen'

// Kasus disamakan dengan uji hitung_status_absen di DB produksi (dry-run 2026-10-03).
const siang: AturanJam = { jamMasuk: '13:00', jamKeluar: '22:00', toleransiMenit: 5 }

describe('hitungStatusMasuk', () => {
  it('sebelum/tepat jam shift = tepat', () => {
    expect(hitungStatusMasuk('12:50', siang)).toEqual({ status: 'tepat', menit: 0 })
    expect(hitungStatusMasuk('13:00', siang)).toEqual({ status: 'tepat', menit: 0 })
  })
  it('telat sampai batas toleransi (inklusif) = telat_toleransi', () => {
    expect(hitungStatusMasuk('13:03', siang)).toEqual({ status: 'telat_toleransi', menit: 3 })
    expect(hitungStatusMasuk('13:05', siang)).toEqual({ status: 'telat_toleransi', menit: 5 })
  })
  it('lewat toleransi = telat, menit dihitung dari jam shift', () => {
    expect(hitungStatusMasuk('13:06', siang)).toEqual({ status: 'telat', menit: 6 })
    expect(hitungStatusMasuk('13:15', siang)).toEqual({ status: 'telat', menit: 15 })
  })
  it('toleransi 0 → semenit pun telat', () => {
    expect(hitungStatusMasuk('13:01', { ...siang, toleransiMenit: 0 })).toEqual({ status: 'telat', menit: 1 })
  })
})

describe('hitungStatusPulang', () => {
  it('lebih awal / tepat / telat', () => {
    expect(hitungStatusPulang('21:40', siang)).toEqual({ status: 'lebih_awal', menit: 20 })
    expect(hitungStatusPulang('22:00', siang)).toEqual({ status: 'tepat', menit: 0 })
    expect(hitungStatusPulang('22:57', siang)).toEqual({ status: 'pulang_telat', menit: 57 })
  })
  it('shift lewat tengah malam', () => {
    expect(hitungStatusPulang('23:50', { jamMasuk: '14:00', jamKeluar: '00:00', toleransiMenit: 5 })).toEqual({
      status: 'lebih_awal',
      menit: 10,
    })
  })
})
