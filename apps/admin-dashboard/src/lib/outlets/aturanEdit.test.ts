import { describe, expect, it } from 'vitest'
import { cekHapusOutlet, cekPerubahanOutlet, cekTayangAplikasi } from './aturanEdit'

describe('cekTayangAplikasi', () => {
  it('outlet internal/mitra yang sudah tutup tidak bisa ditayangkan di aplikasi', () => {
    expect(cekTayangAplikasi({ status: 'inactive', type: 'mitra' }, true)).toMatch(/sudah ditutup/)
  })
  it('mematikan selalu boleh; outlet aktif boleh dinyalakan', () => {
    expect(cekTayangAplikasi({ status: 'inactive', type: 'mitra' }, false)).toBeNull()
    expect(cekTayangAplikasi({ status: 'active', type: 'internal' }, true)).toBeNull()
  })
})

describe('cekHapusOutlet', () => {
  it('outlet internal/mitra yang masih aktif harus ditutup dulu', () => {
    expect(cekHapusOutlet({ status: 'active', type: 'internal' })).toMatch(/Tutup Outlet/)
    expect(cekHapusOutlet({ status: 'active', type: 'mitra' })).toMatch(/Tutup Outlet/)
  })
  it('outlet yang sudah ditutup, dan lokasi lain, boleh dihapus', () => {
    expect(cekHapusOutlet({ status: 'inactive', type: 'internal' })).toBeNull()
    expect(cekHapusOutlet({ status: 'active', type: 'office' })).toBeNull()
  })
})

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
    expect(cekPerubahanOutlet(lama('pending', 'internal'), { status: 'pending', type: 'mitra' })).toBeNull()
    expect(cekPerubahanOutlet(lama('active'), { status: 'active', type: 'mitra' })).toBeNull()
  })
  it('Aktif → Nonaktif untuk internal/mitra harus lewat Tutup Outlet', () => {
    expect(cekPerubahanOutlet(lama('active', 'mitra'), { status: 'inactive', type: 'mitra' })).toMatch(/Tutup Outlet/)
    expect(cekPerubahanOutlet(lama('active', 'internal'), { status: 'inactive', type: 'internal' })).toMatch(/Tutup Outlet/)
  })
  it('Nonaktif → Aktif untuk internal/mitra harus lewat Buka kembali', () => {
    expect(cekPerubahanOutlet(lama('inactive', 'internal'), { status: 'active', type: 'internal' })).toMatch(/Buka kembali/)
  })
  it('lokasi selain internal/mitra tetap bebas aktif/nonaktif', () => {
    expect(cekPerubahanOutlet(lama('active', 'office'), { status: 'inactive', type: 'office' })).toBeNull()
    expect(cekPerubahanOutlet(lama('inactive', 'gudang'), { status: 'active', type: 'gudang' })).toBeNull()
  })
})
