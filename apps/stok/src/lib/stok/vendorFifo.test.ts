import { describe, expect, it } from 'vitest'
import { attributeFifo, hargaRataFifo, labelFifo, nilaiFifoRp, TIDAK_TERCATAT } from './vendorFifo'

// SAPI: 1 Blok = 2000 gram. Harga lapisan per gram.
const MASTER_KECIL = 95000 / 2000
const TIS = 105000 / 2000
const SW = 95000 / 2000

describe('attributeFifo dengan harga', () => {
  it('pemakaian mengonsumsi lapisan tertua dan membawa harganya', () => {
    const attr = attributeFifo({
      openingBalance: 4000,
      priorInflowsNewestFirst: [{ qty: 4000, vendor: 'TIS FOOD', harga: TIS }],
      windowRows: [
        { id: 'masuk', qty: 10000, vendor: 'Sapi Warna', harga: SW },
        { id: 'pakai', qty: -6000, vendor: null },
      ],
    })
    expect(attr.get('pakai')).toEqual([
      { vendor: 'TIS FOOD', harga: TIS, qty: 4000 },
      { vendor: 'Sapi Warna', harga: SW, qty: 2000 },
    ])
  })

  it('vendor sama dengan harga berbeda tetap dipisah', () => {
    const attr = attributeFifo({
      openingBalance: 0,
      priorInflowsNewestFirst: [],
      windowRows: [
        { id: 'a', qty: 2000, vendor: 'TIS FOOD', harga: 50 },
        { id: 'b', qty: 2000, vendor: 'TIS FOOD', harga: TIS },
        { id: 'pakai', qty: -4000, vendor: null },
      ],
    })
    expect(attr.get('pakai')).toHaveLength(2)
    expect(labelFifo(attr.get('pakai'))).toBe('TIS FOOD')
  })

  it('kekurangan lapisan = vendor tidak tercatat tanpa harga', () => {
    const attr = attributeFifo({
      openingBalance: 0,
      priorInflowsNewestFirst: [],
      windowRows: [{ id: 'pakai', qty: -500, vendor: null }],
    })
    expect(attr.get('pakai')).toEqual([{ vendor: TIDAK_TERCATAT, harga: null, qty: 500 }])
  })
})

describe('nilaiFifoRp & hargaRataFifo', () => {
  it('menilai tiap bagian dengan harga lapisannya', () => {
    const parts = [
      { vendor: 'TIS FOOD', harga: TIS, qty: 4000 },
      { vendor: 'Sapi Warna', harga: SW, qty: 2000 },
    ]
    expect(nilaiFifoRp(parts, MASTER_KECIL)).toBe(210000 + 95000)
    expect(hargaRataFifo(parts)).toBeCloseTo((TIS * 4000 + SW * 2000) / 6000, 6)
  })

  it('bagian tanpa harga dinilai dengan harga master', () => {
    const parts = [{ vendor: TIDAK_TERCATAT, harga: null, qty: 2000 }]
    expect(nilaiFifoRp(parts, MASTER_KECIL)).toBe(95000)
    expect(hargaRataFifo(parts)).toBeNull()
  })

  it('tanpa bagian: nilai 0, harga null', () => {
    expect(nilaiFifoRp(undefined, MASTER_KECIL)).toBe(0)
    expect(hargaRataFifo(undefined)).toBeNull()
  })
})
