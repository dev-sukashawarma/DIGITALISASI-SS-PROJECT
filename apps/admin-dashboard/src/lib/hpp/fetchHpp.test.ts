import { describe, it, expect } from 'vitest'
import { getItemHpp } from './fetchHpp'

describe('getItemHpp', () => {
  const globalSapiSedang = {
    id: '4adb4426-0d1f-4962-a5d9-2b9dfbb29ecd',
    name: 'Original Sapi Sedang',
    hpp_override: 14525.5,
    channel_hpp: {},
    is_package: false
  }

  const globalSukaBeef = {
    id: 'fea982b2-e172-4bfd-8fc6-1fa6de830c19',
    name: 'Suka Beef',
    hpp_override: 17090.7,
    channel_hpp: {},
    is_package: false
  }

  const byNameMap = new Map<string, any>([
    ['Original Sapi Sedang', globalSapiSedang],
    ['original sapi sedang', globalSapiSedang],
    ['Suka Beef', globalSukaBeef],
    ['suka beef', globalSukaBeef]
  ])

  it('fallback saat menuItem null dan fallbackName cocok', () => {
    const res = getItemHpp(null, 'mitra', 'Original Sapi Sedang', byNameMap)
    expect(res.baseHpp).toBe(14525.5)
    expect(res.hpp).toBe(Math.round(14525.5 * 1.1))
    expect(res.markup).toBe(res.hpp - res.baseHpp)
  })

  it('fallback saat menuItem lama memiliki hpp_override null dan channel_hpp kosong {}', () => {
    const legacyItem = {
      id: 'a7d7d3e5-0429-42f9-916c-4b8a0bf784d3',
      name: 'Original Sapi Sedang (Online)',
      hpp_override: null,
      channel_hpp: {},
      is_package: false
    }
    const res = getItemHpp(legacyItem, 'mitra', 'Original Sapi Sedang', byNameMap)
    expect(res.baseHpp).toBe(14525.5)
    expect(res.hpp).toBe(Math.round(14525.5 * 1.1))
  })

  it('mampu mencocokkan variasi nama ojol seperti SUKA Beef Shawarma', () => {
    const res = getItemHpp(null, 'mitra', 'SUKA Beef Shawarma', byNameMap)
    expect(res.baseHpp).toBe(17090.7)
  })
})
