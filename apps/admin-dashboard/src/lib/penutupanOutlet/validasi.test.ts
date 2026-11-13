import { describe, expect, it } from 'vitest'
import { validasiAlasan, validasiTutup } from './validasi'

const ctx = { namaOutlet: 'SUKA SHAWARMA SAWANGAN', hariIni: '2026-11-13', tanggalDibuat: '2026-03-01' }
const sah = { tanggalTerakhir: '2026-11-10', alasan: 'Lokasi diambil alih mitra', konfirmasiNama: 'SUKA SHAWARMA SAWANGAN' }

describe('validasiAlasan', () => {
  it('menolak alasan kurang dari 10 karakter setelah trim', () => {
    expect(validasiAlasan('   pendek  ')).toMatch(/minimal 10/)
  })
  it('menerima alasan 10 karakter', () => {
    expect(validasiAlasan('1234567890')).toBeNull()
  })
})

describe('validasiTutup', () => {
  it('lolos untuk input sah', () => {
    expect(validasiTutup(sah, ctx)).toBeNull()
  })
  it('menolak tanggal di masa depan', () => {
    expect(validasiTutup({ ...sah, tanggalTerakhir: '2026-11-14' }, ctx)).toMatch(/masa depan/)
  })
  it('menolak tanggal sebelum outlet dibuat', () => {
    expect(validasiTutup({ ...sah, tanggalTerakhir: '2026-02-28' }, ctx)).toMatch(/sebelum outlet dibuat/)
  })
  it('menolak tanggal kosong', () => {
    expect(validasiTutup({ ...sah, tanggalTerakhir: '' }, ctx)).toMatch(/wajib/)
  })
  it('menolak alasan pendek', () => {
    expect(validasiTutup({ ...sah, alasan: 'tutup' }, ctx)).toMatch(/minimal 10/)
  })
  it('konfirmasi nama dibandingkan setelah trim + huruf besar', () => {
    expect(validasiTutup({ ...sah, konfirmasiNama: '  suka shawarma sawangan ' }, ctx)).toBeNull()
    expect(validasiTutup({ ...sah, konfirmasiNama: 'SUKA SHAWARMA SAWANGAN X' }, ctx)).toMatch(/nama outlet/)
  })
})
