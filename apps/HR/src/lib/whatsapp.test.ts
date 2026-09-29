import { describe, expect, it } from 'vitest'
import { nomorWa, pesanKonfirmasiAset, tautanWa } from './whatsapp'

describe('nomorWa', () => {
  it('menormalkan berbagai penulisan nomor Indonesia', () => {
    expect(nomorWa('089675750974')).toBe('6289675750974')
    expect(nomorWa('+62 812-8994-7304')).toBe('6281289947304')
    expect(nomorWa('6285778613520')).toBe('6285778613520')
    expect(nomorWa('85930307245')).toBe('6285930307245')
  })
  it('menolak nomor kosong / tidak masuk akal', () => {
    expect(nomorWa(null)).toBeNull()
    expect(nomorWa('')).toBeNull()
    expect(nomorWa('-')).toBeNull()
    expect(nomorWa('12345')).toBeNull()
    expect(nomorWa('+1 415 555 0100')).toBeNull()
  })
})

describe('pesan WhatsApp', () => {
  it('menyusun pesan konfirmasi & tautan wa.me ter-encode', () => {
    const pesan = pesanKonfirmasiAset({
      namaAm: 'Tri Rizky', namaHr: 'Indra', outlet: 'MITRA CIBUBUR',
      barang: 'EXHAUST FAN', merek: 'Maspion', kondisi: 'rusak', catatanAm: 'baling-baling patah',
    })
    expect(pesan).toContain('Halo Tri Rizky, saya Indra dari HR')
    expect(pesan).toContain('EXHAUST FAN (Maspion) dilaporkan *RUSAK*')
    expect(pesan).toContain('Catatan: baling-baling patah')
    const url = tautanWa('6285778613520', pesan)
    expect(url.startsWith('https://wa.me/6285778613520?text=')).toBe(true)
    expect(decodeURIComponent(url.split('text=')[1])).toBe(pesan)
  })
})
