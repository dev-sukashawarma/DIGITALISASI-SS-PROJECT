import { describe, it, expect } from 'vitest'
import { periksaPengaturan, normalisasiWa, type InputPengaturan } from './pengaturanForm'

const sah: InputPengaturan = {
  menitPesanTerakhir: 30, menitTertahan: 10, estimasiSiap: '15–20 menit',
  waCs: '081234567890', versiMinimumAndroid: 1, urlSyarat: '', urlPrivasi: 'https://x.id/privasi',
}
describe('periksaPengaturan', () => {
  it('input sah -> null', () => expect(periksaPengaturan(sah)).toBeNull())
  it('batas CHECK DB', () => {
    expect(periksaPengaturan({ ...sah, menitPesanTerakhir: 181 })).toMatch(/0–180/)
    expect(periksaPengaturan({ ...sah, menitTertahan: 0 })).toMatch(/1–120/)
    expect(periksaPengaturan({ ...sah, estimasiSiap: '' })).toMatch(/Estimasi/)
    expect(periksaPengaturan({ ...sah, versiMinimumAndroid: 0 })).toMatch(/Versi/)
  })
  it('URL wajib https bila diisi', () => {
    expect(periksaPengaturan({ ...sah, urlSyarat: 'http://x.id' })).toMatch(/https/)
  })
  it('WA tak sah ditolak, kosong boleh', () => {
    expect(periksaPengaturan({ ...sah, waCs: '12345' })).toMatch(/WhatsApp/)
    expect(periksaPengaturan({ ...sah, waCs: '' })).toBeNull()
  })
})
describe('normalisasiWa', () => {
  it('08.. / +62.. / 62.. -> 62..', () => {
    expect(normalisasiWa('0812-3456-7890')).toBe('6281234567890')
    expect(normalisasiWa('+62 812 3456 7890')).toBe('6281234567890')
    expect(normalisasiWa('')).toBeNull()
  })
})
