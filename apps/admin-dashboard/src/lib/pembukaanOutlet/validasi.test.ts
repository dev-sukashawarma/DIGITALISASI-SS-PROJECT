import { describe, expect, it } from 'vitest'
import { namaKonfirmasiCocok, validasiInputWizard } from './validasi'
import type { InputWizard } from './types'

const HARI_INI = '2026-11-13'

const dasar = (ubah: Partial<InputWizard> = {}): InputWizard => ({
  jenis: 'internal',
  nama: 'SUKA SHAWARMA BEKASI',
  alamat: 'Jl. Uji 1',
  lat: -6.2,
  lng: 107,
  telepon: '',
  region: '',
  jamBuka: '14:00',
  jamTutup: '22:00',
  tanggalGrandOpening: null,
  amStaffId: 'am-1',
  leaderStaffId: null,
  mitra: null,
  rab: null,
  ...ubah,
})

const mitra = {
  nilaiInvestasi: 150_000_000,
  persentaseBagiHasil: 100,
  managementFee: 3,
  akun: { mode: 'baru' as const, nama: 'Budi', username: 'budi.mitra', password: 'rahasia123' },
  namaMitra: 'Budi',
}

describe('validasiInputWizard', () => {
  it('input internal lengkap lolos', () => {
    expect(validasiInputWizard(dasar(), HARI_INI)).toEqual({ ok: true })
  })

  it('nama kosong ditolak', () => {
    const r = validasiInputWizard(dasar({ nama: '   ' }), HARI_INI)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.galat.nama).toBeTruthy()
  })

  it('AM wajib dipilih', () => {
    const r = validasiInputWizard(dasar({ amStaffId: '' }), HARI_INI)
    expect(r.ok === false && r.galat.amStaffId).toBeTruthy()
  })

  it('jam tutup harus setelah jam buka', () => {
    const r = validasiInputWizard(dasar({ jamBuka: '22:00', jamTutup: '14:00' }), HARI_INI)
    expect(r.ok === false && r.galat.jamTutup).toBeTruthy()
  })

  it('tanggal grand opening boleh kosong, tapi tidak boleh lewat', () => {
    expect(validasiInputWizard(dasar({ tanggalGrandOpening: null }), HARI_INI).ok).toBe(true)
    expect(validasiInputWizard(dasar({ tanggalGrandOpening: '2026-11-13' }), HARI_INI).ok).toBe(true)
    const r = validasiInputWizard(dasar({ tanggalGrandOpening: '2026-11-12' }), HARI_INI)
    expect(r.ok === false && r.galat.tanggalGrandOpening).toBeTruthy()
  })

  it('internal tidak boleh membawa data mitra atau RAB', () => {
    const r1 = validasiInputWizard(dasar({ mitra }), HARI_INI)
    expect(r1.ok === false && r1.galat.mitra).toBeTruthy()
    const r2 = validasiInputWizard(dasar({ rab: { berlakuSampai: '2026-12-31', kategoriKecuali: [] } }), HARI_INI)
    expect(r2.ok === false && r2.galat.rab).toBeTruthy()
  })

  it('mitra wajib membawa data mitra', () => {
    const r = validasiInputWizard(dasar({ jenis: 'mitra' }), HARI_INI)
    expect(r.ok === false && r.galat.mitra).toBeTruthy()
    expect(validasiInputWizard(dasar({ jenis: 'mitra', mitra }), HARI_INI).ok).toBe(true)
  })

  it('akun mitra baru: password minimal 8 karakter, username wajib', () => {
    const pendek = { ...mitra, akun: { ...mitra.akun, password: 'abc' } }
    const r = validasiInputWizard(dasar({ jenis: 'mitra', mitra: pendek }), HARI_INI)
    expect(r.ok === false && r.galat['mitra.akun']).toBeTruthy()
    const tanpaUser = { ...mitra, akun: { ...mitra.akun, username: ' ' } }
    const r2 = validasiInputWizard(dasar({ jenis: 'mitra', mitra: tanpaUser }), HARI_INI)
    expect(r2.ok === false && r2.galat['mitra.akun']).toBeTruthy()
  })

  it('akun mitra lama wajib memilih akun', () => {
    const lama = { ...mitra, akun: { mode: 'lama' as const, userId: '' } }
    const r = validasiInputWizard(dasar({ jenis: 'mitra', mitra: lama }), HARI_INI)
    expect(r.ok === false && r.galat['mitra.akun']).toBeTruthy()
  })

  it('masa RAB tidak boleh berakhir sebelum hari ini', () => {
    const r = validasiInputWizard(
      dasar({ jenis: 'mitra', mitra, rab: { berlakuSampai: '2026-11-01', kategoriKecuali: [] } }),
      HARI_INI,
    )
    expect(r.ok === false && r.galat.rab).toBeTruthy()
  })
})

describe('namaKonfirmasiCocok', () => {
  it('abaikan spasi tepi dan huruf besar/kecil', () => {
    expect(namaKonfirmasiCocok('  mitra bekasi ', 'MITRA BEKASI')).toBe(true)
  })
  it('nama berbeda ditolak', () => {
    expect(namaKonfirmasiCocok('MITRA BEKAS', 'MITRA BEKASI')).toBe(false)
    expect(namaKonfirmasiCocok('', 'MITRA BEKASI')).toBe(false)
  })
})
