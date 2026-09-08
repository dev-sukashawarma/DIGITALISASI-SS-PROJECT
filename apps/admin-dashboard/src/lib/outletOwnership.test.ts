import { describe, expect, it } from 'vitest'
import { mitraOutletIds, isInScope, type ProfitScope } from './outletOwnership'

const OUTLETS = [
  { id: 'a', name: 'SUKA SHAWARMA EMPANG' },
  { id: 'b', name: 'SUKA SHAWARMA MITRA CIBUBUR' },
  { id: 'c', name: 'SUKA SHAWARMA BNR' },
  { id: 'ss-online', name: 'SS ONLINE' },
]

describe('mitraOutletIds', () => {
  it('menandai outlet yang punya baris investasi mitra', () => {
    const ids = mitraOutletIds(OUTLETS, { c: { nilai_investasi: 125_000_000 } })
    expect(ids.has('c')).toBe(true)
  })

  it('menandai outlet yang namanya mengandung "mitra" walau tanpa baris investasi', () => {
    const ids = mitraOutletIds(OUTLETS, {})
    expect(ids.has('b')).toBe(true)
  })

  it('tidak menandai outlet pusat maupun SS ONLINE', () => {
    const ids = mitraOutletIds(OUTLETS, { c: {} })
    expect(ids.has('a')).toBe(false)
    expect(ids.has('ss-online')).toBe(false)
  })

  it('tidak peduli besar-kecil huruf pada nama', () => {
    const ids = mitraOutletIds([{ id: 'x', name: 'Outlet Mitra Depok' }], {})
    expect(ids.has('x')).toBe(true)
  })

  it('aman terhadap outlet tanpa nama', () => {
    const ids = mitraOutletIds([{ id: 'x', name: null as unknown as string }], {})
    expect(ids.has('x')).toBe(false)
  })
})

describe('isInScope', () => {
  const mitra = new Set(['b', 'c'])

  it('scope "all" meloloskan semua outlet', () => {
    for (const id of ['a', 'b', 'c', 'ss-online']) {
      expect(isInScope('all' as ProfitScope, id, mitra)).toBe(true)
    }
  })

  it('scope "mitra" hanya meloloskan outlet kemitraan', () => {
    expect(isInScope('mitra', 'b', mitra)).toBe(true)
    expect(isInScope('mitra', 'a', mitra)).toBe(false)
  })

  it('scope "internal" hanya meloloskan outlet non-mitra', () => {
    expect(isInScope('internal', 'a', mitra)).toBe(true)
    expect(isInScope('internal', 'ss-online', mitra)).toBe(true)
    expect(isInScope('internal', 'c', mitra)).toBe(false)
  })

  it('outlet tak dikenal dihitung internal, bukan mitra', () => {
    expect(isInScope('internal', 'entah', mitra)).toBe(true)
    expect(isInScope('mitra', 'entah', mitra)).toBe(false)
  })

  it('id kosong tidak pernah lolos scope mitra', () => {
    expect(isInScope('mitra', null, mitra)).toBe(false)
    expect(isInScope('internal', null, mitra)).toBe(true)
  })
})
