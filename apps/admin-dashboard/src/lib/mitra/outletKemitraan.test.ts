import { describe, it, expect } from 'vitest'
import { idOutletKemitraan } from './outletKemitraan'

const outlet = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'mitra',
  is_active: true,
  status: 'active',
  ...extra,
})

describe('idOutletKemitraan', () => {
  it('outlet mitra aktif tetap tampil walau belum punya data', () => {
    expect(idOutletKemitraan({ outlets: [outlet('a')] })).toEqual(['a'])
  })

  it('outlet mitra nonaktif tanpa data disembunyikan', () => {
    const outlets = [outlet('tes', { is_active: false, status: 'inactive' })]
    expect(idOutletKemitraan({ outlets })).toEqual([])
  })

  it('outlet mitra nonaktif yang punya investasi, profil, atau transfer tetap tampil', () => {
    const outlets = [
      outlet('inv', { is_active: false, status: 'inactive' }),
      outlet('prof', { is_active: false, status: 'inactive' }),
      outlet('trf', { is_active: false, status: 'inactive' }),
    ]
    const hasil = idOutletKemitraan({
      outlets,
      investments: [{ outlet_id: 'inv' }],
      profiles: [{ outlet_ids: ['prof'] }],
      transfers: [{ outlet_id: 'trf' }],
    })
    expect(hasil.sort()).toEqual(['inv', 'prof', 'trf'])
  })

  it('outlet Persiapan (belum Go-Live) tetap tampil supaya investasinya bisa diisi', () => {
    const outlets = [outlet('baru', { is_active: false, status: 'pending' })]
    expect(idOutletKemitraan({ outlets })).toEqual(['baru'])
  })

  it('outlet yang sudah ditandai terhapus disembunyikan walau masih punya investasi & profil', () => {
    const outlets = [outlet('batal', { is_active: false, status: 'inactive', deleted_at: '2026-11-13T12:21:28Z' })]
    const hasil = idOutletKemitraan({
      outlets,
      investments: [{ outlet_id: 'batal' }],
      profiles: [{ outlet_ids: ['batal'] }],
    })
    expect(hasil).toEqual([])
  })

  it('outlet bukan mitra tidak ikut kecuali punya data kemitraan', () => {
    const outlets = [outlet('int', { type: 'internal' }), outlet('lama', { type: 'internal' })]
    expect(idOutletKemitraan({ outlets, investments: [{ outlet_id: 'lama' }] })).toEqual(['lama'])
  })
})
