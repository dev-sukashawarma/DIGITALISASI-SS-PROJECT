import { describe, it, expect } from 'vitest'
import { kelompokLokasiPersediaan, bagiKelompokPersediaan } from './kelompokPersediaan'

const GUDANG_PUSAT = { outlet_id: 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90', outlet_type: 'office' }
const GUDANG_SS_ONLINE = { outlet_id: 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91', outlet_type: 'gudang' }
const KANTOR_PUSAT = { outlet_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', outlet_type: 'office' }
const OUTLET = { outlet_id: 'o1', outlet_type: 'internal' }
const MITRA = { outlet_id: 'o2', outlet_type: 'mitra' }

describe('kelompokLokasiPersediaan', () => {
  it('Gudang Pusat (type office) dan semua type gudang masuk kelompok gudang', () => {
    expect(kelompokLokasiPersediaan(GUDANG_PUSAT)).toBe('gudang')
    expect(kelompokLokasiPersediaan(GUDANG_SS_ONLINE)).toBe('gudang')
  })

  it('office selain Gudang Pusat (KANTOR PUSAT dummy) tidak masuk gudang maupun outlet', () => {
    expect(kelompokLokasiPersediaan(KANTOR_PUSAT)).toBe('lainnya')
    expect(kelompokLokasiPersediaan({ outlet_id: 'x', outlet_type: 'test' })).toBe('lainnya')
    expect(kelompokLokasiPersediaan({ outlet_id: 'x', outlet_type: 'system' })).toBe('lainnya')
  })

  it('outlet internal & mitra (dan type kosong) masuk kelompok outlet', () => {
    expect(kelompokLokasiPersediaan(OUTLET)).toBe('outlet')
    expect(kelompokLokasiPersediaan(MITRA)).toBe('outlet')
    expect(kelompokLokasiPersediaan({ outlet_id: 'x', outlet_type: null })).toBe('outlet')
  })
})

describe('bagiKelompokPersediaan', () => {
  it('setiap lokasi masuk tepat satu kelompok — jumlah ketiganya = semua lokasi', () => {
    const semua = [GUDANG_PUSAT, GUDANG_SS_ONLINE, KANTOR_PUSAT, OUTLET, MITRA]
    const k = bagiKelompokPersediaan(semua)
    expect(k.gudang).toEqual([GUDANG_PUSAT, GUDANG_SS_ONLINE])
    expect(k.outlet).toEqual([OUTLET, MITRA])
    expect(k.lainnya).toEqual([KANTOR_PUSAT])
    expect(k.gudang.length + k.outlet.length + k.lainnya.length).toBe(semua.length)
  })
})
