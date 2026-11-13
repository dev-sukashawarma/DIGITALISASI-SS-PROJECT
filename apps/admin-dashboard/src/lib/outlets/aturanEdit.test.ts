import { describe, expect, it } from 'vitest'
import { cekPerubahanOutlet } from './aturanEdit'

const lama = (status: string, type = 'mitra') => ({ status, type })

describe('cekPerubahanOutlet', () => {
  it('Persiapan → Aktif lewat form ditolak (harus lewat Go-Live)', () => {
    expect(cekPerubahanOutlet(lama('pending'), { status: 'active', type: 'mitra' })).toMatch(/Go-Live/)
  })
  it('Persiapan → Nonaktif lewat form ditolak (harus lewat Batalkan pembukaan)', () => {
    expect(cekPerubahanOutlet(lama('pending'), { status: 'inactive', type: 'mitra' })).toMatch(/Batalkan/)
  })
  it('outlet aktif tidak bisa dikembalikan ke Persiapan', () => {
    expect(cekPerubahanOutlet(lama('active'), { status: 'pending', type: 'mitra' })).toMatch(/Persiapan/)
  })
  it('jenis outlet terkunci setelah Go-Live', () => {
    expect(cekPerubahanOutlet(lama('active', 'mitra'), { status: 'active', type: 'internal' })).toMatch(/Jenis/)
    expect(cekPerubahanOutlet(lama('inactive', 'internal'), { status: 'inactive', type: 'mitra' })).toMatch(/Jenis/)
  })
  it('perubahan biasa lolos', () => {
    expect(cekPerubahanOutlet(lama('active'), { status: 'inactive', type: 'mitra' })).toBeNull()
    expect(cekPerubahanOutlet(lama('pending', 'internal'), { status: 'pending', type: 'mitra' })).toBeNull()
    expect(cekPerubahanOutlet(lama('active'), { status: 'active', type: 'mitra' })).toBeNull()
  })
})
