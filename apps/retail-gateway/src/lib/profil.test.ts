import { describe, it, expect } from 'vitest'
import { normalisasiWhatsApp, periksaNama, periksaWhatsApp, NAMA_MAKS } from './profil'

describe('normalisasiWhatsApp', () => {
  it('menyatukan semua cara menulis ke bentuk 628xxxx', () => {
    expect(normalisasiWhatsApp('081234567890')).toBe('6281234567890')
    expect(normalisasiWhatsApp('+6281234567890')).toBe('6281234567890')
    expect(normalisasiWhatsApp('6281234567890')).toBe('6281234567890')
    expect(normalisasiWhatsApp('0812-3456-7890')).toBe('6281234567890')
    expect(normalisasiWhatsApp('0812 3456 7890')).toBe('6281234567890')
  })

  it('menolak yang bukan nomor HP Indonesia', () => {
    expect(normalisasiWhatsApp('0212345678')).toBeNull() // telepon rumah, bukan 08
    expect(normalisasiWhatsApp('12345')).toBeNull()
    expect(normalisasiWhatsApp('+15551234567')).toBeNull()
    expect(normalisasiWhatsApp('08123')).toBeNull() // terlalu pendek
    expect(normalisasiWhatsApp('08abc4567890')).toBeNull()
  })
})

describe('periksaNama', () => {
  it('merapikan spasi', () => {
    expect(periksaNama('  Maulana   Yusuf ')).toEqual({ ok: true, nilai: 'Maulana Yusuf' })
  })

  it('menolak terlalu pendek, terlalu panjang, dan bukan teks', () => {
    expect(periksaNama(' A ').ok).toBe(false)
    expect(periksaNama('x'.repeat(NAMA_MAKS + 1)).ok).toBe(false)
    expect(periksaNama(123).ok).toBe(false)
  })
})

describe('periksaWhatsApp', () => {
  it('kosong berarti menghapus nomor', () => {
    expect(periksaWhatsApp('')).toEqual({ ok: true, nilai: null })
    expect(periksaWhatsApp('   ')).toEqual({ ok: true, nilai: null })
    expect(periksaWhatsApp(null)).toEqual({ ok: true, nilai: null })
  })

  it('nomor wajar disimpan kanonik', () => {
    expect(periksaWhatsApp('0812 3456 7890')).toEqual({ ok: true, nilai: '6281234567890' })
  })

  it('nomor tak wajar ditolak dengan pesan', () => {
    const h = periksaWhatsApp('12345')
    expect(h.ok).toBe(false)
  })
})
