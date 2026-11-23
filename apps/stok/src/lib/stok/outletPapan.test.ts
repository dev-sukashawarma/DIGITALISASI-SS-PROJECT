import { describe, expect, it } from 'vitest'
import { GUDANG_PUSAT_ID, isOutletPapan, idOutletPapan, saringItemPapan } from './outletPapan'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'

const o = (id: string, type: string | null, status: string | null) => ({ id, type, status })

describe('isOutletPapan', () => {
  it('outlet internal & mitra aktif tampil', () => {
    expect(isOutletPapan(o('a', 'internal', 'active'))).toBe(true)
    expect(isOutletPapan(o('b', 'mitra', 'active'))).toBe(true)
  })

  it('outlet tutup (inactive) tidak tampil', () => {
    expect(isOutletPapan(o('a', 'internal', 'inactive'))).toBe(false)
    expect(isOutletPapan(o('b', 'mitra', 'inactive'))).toBe(false)
  })

  it('Persiapan (pending) tidak tampil di papan', () => {
    expect(isOutletPapan(o('a', 'mitra', 'pending'))).toBe(false)
  })

  it('dummy kantor, sistem, marketplace, dan outlet tes tidak tampil', () => {
    expect(isOutletPapan(o('k', 'office', 'active'))).toBe(false) // KANTOR PUSAT
    expect(isOutletPapan(o('g', 'system', 'inactive'))).toBe(false) // GLOBAL OUTLET (SYSTEM)
    expect(isOutletPapan(o('s', 'marketplace', 'active'))).toBe(false)
    expect(isOutletPapan(o(TEST_OUTLET_ID, 'test', 'active'))).toBe(false)
  })

  it('Gudang Pusat (type office) tetap tampil — dikenali lewat id, bukan nama', () => {
    expect(isOutletPapan(o(GUDANG_PUSAT_ID, 'office', 'active'))).toBe(true)
    expect(isOutletPapan(o(GUDANG_PUSAT_ID, 'office', 'inactive'))).toBe(false)
  })

  it('gudang operasional lain (type gudang) aktif tetap tampil', () => {
    expect(isOutletPapan(o('ss-online', 'gudang', 'active'))).toBe(true)
  })

  it('type/status kosong tidak tampil (tak bisa dipastikan operasional)', () => {
    expect(isOutletPapan(o('x', null, 'active'))).toBe(false)
    expect(isOutletPapan(o('x', 'internal', null))).toBe(false)
  })
})

describe('idOutletPapan & saringItemPapan', () => {
  const outlets = [
    o('a', 'internal', 'active'),
    o('b', 'internal', 'inactive'),
    o('k', 'office', 'active'),
    o(GUDANG_PUSAT_ID, 'office', 'active'),
  ]

  it('hanya id outlet papan', () => {
    expect([...idOutletPapan(outlets)].sort()).toEqual(['a', GUDANG_PUSAT_ID].sort())
  })

  it('item outlet non-papan dibuang', () => {
    const items = [
      { outlet_id: 'a', status: 'below' },
      { outlet_id: 'b', status: 'below' },
      { outlet_id: 'k', status: 'below' },
      { outlet_id: GUDANG_PUSAT_ID, status: 'ok' },
    ]
    expect(saringItemPapan(items, outlets).map((i) => i.outlet_id)).toEqual(['a', GUDANG_PUSAT_ID])
  })
})
