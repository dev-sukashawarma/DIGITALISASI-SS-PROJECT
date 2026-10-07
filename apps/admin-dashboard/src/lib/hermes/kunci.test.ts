import { buatKunciBaru, hashKunci, uraiBearer, hashCocok } from './kunci'

describe('kunci Hermes', () => {
  it('format hms_<prefix8>_<rahasia32> dan hash = sha256 kunci', () => {
    const k = buatKunciBaru()
    expect(k.kunci).toMatch(/^hms_[0-9a-f]{8}_[A-Za-z0-9_-]{32}$/)
    expect(k.kunci.slice(4, 12)).toBe(k.prefix)
    expect(k.hash).toBe(hashKunci(k.kunci))
    expect(k.hash).toMatch(/^[0-9a-f]{64}$/)
  })
  it('dua kunci tidak pernah sama', () => {
    expect(buatKunciBaru().kunci).not.toBe(buatKunciBaru().kunci)
  })
  it('uraiBearer menerima Bearer + format benar saja', () => {
    const k = buatKunciBaru()
    expect(uraiBearer(`Bearer ${k.kunci}`)).toEqual({ kunci: k.kunci, prefix: k.prefix })
    expect(uraiBearer(`bearer  ${k.kunci} `)).toEqual({ kunci: k.kunci, prefix: k.prefix })
    expect(uraiBearer(null)).toBeNull()
    expect(uraiBearer(k.kunci)).toBeNull()
    expect(uraiBearer('Bearer hms_XYZ')).toBeNull()
    expect(uraiBearer(`Bearer ${k.kunci}x`)).toBeNull()
  })
  it('hashCocok: sama → true, beda/kosong/panjang beda → false', () => {
    const h = hashKunci('a')
    expect(hashCocok(h, hashKunci('a'))).toBe(true)
    expect(hashCocok(h, hashKunci('b'))).toBe(false)
    expect(hashCocok(h, '')).toBe(false)
    expect(hashCocok(h, h.slice(2))).toBe(false)
  })
})
