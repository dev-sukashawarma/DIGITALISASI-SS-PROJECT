import { describe, it, expect } from 'vitest'
import { labelNamaBahan, namaVendorTampil } from './labelVendor'

describe('namaVendorTampil', () => {
  it('buang akhiran Tempo', () => expect(namaVendorTampil('Lettuce (Pak Aziz) - Tempo 15')).toBe('Lettuce (Pak Aziz)'))
})

describe('labelNamaBahan', () => {
  it('bahan ganda diberi vendor, tunggal tidak', () => {
    expect(labelNamaBahan([
      { id: '1', bahan_baku_id: 's', bahan_baku: { nama: 'SAPI' }, vendor: { nama: 'Djafafood' } },
      { id: '2', bahan_baku_id: 's', bahan_baku: { nama: 'SAPI' }, vendor: { nama: 'Lettuce (Pak Aziz) - Tempo 10' } },
      { id: '3', bahan_baku_id: 'k', bahan_baku: { nama: 'KENTANG' }, vendor: { nama: 'Agro' } },
    ])).toEqual({ '1': 'SAPI · Djafafood', '2': 'SAPI · Lettuce (Pak Aziz)', '3': 'KENTANG' })
  })
  it('bahan ganda tanpa vendor tetap nama saja', () => {
    expect(labelNamaBahan([
      { id: '1', bahan_baku_id: 's', bahan_baku: { nama: 'SAPI' }, vendor: null },
      { id: '2', bahan_baku_id: 's', bahan_baku: { nama: 'SAPI' }, vendor: null },
    ])).toEqual({ '1': 'SAPI', '2': 'SAPI' })
  })
})
