import { describe, it, expect } from 'vitest'
import { bagiMutasiOrder, isMutasiOrder } from './mutasiOrder'

describe('isMutasiOrder', () => {
  it('pemakaian & adjustment ber-ref_order_id termasuk mutasi order', () => {
    expect(isMutasiOrder({ tipe: 'pemakaian', ref_order_id: 'o1' })).toBe(true)
    expect(isMutasiOrder({ tipe: 'adjustment', ref_order_id: 'o1' })).toBe(true)
  })

  it('adjustment manual & pemakaian tanpa order bukan mutasi order', () => {
    expect(isMutasiOrder({ tipe: 'adjustment', ref_order_id: null })).toBe(false)
    expect(isMutasiOrder({ tipe: 'pemakaian' })).toBe(false)
  })

  it('tipe lain tidak ikut walau ber-ref_order_id', () => {
    expect(isMutasiOrder({ tipe: 'waste', ref_order_id: 'o1' })).toBe(false)
  })
})

describe('bagiMutasiOrder', () => {
  it('order selesai biasa: seluruhnya pemakaian', () => {
    expect(bagiMutasiOrder(-30)).toEqual({ pakai: 30, pembalikSebelumPeriode: 0 })
  })

  it('order batal dalam periode yang sama: saling meniadakan', () => {
    // -30 (potong) + 30 (pembalik) = 0
    expect(bagiMutasiOrder(-30 + 30)).toEqual({ pakai: 0, pembalikSebelumPeriode: 0 })
  })

  it('pembalik order dari periode sebelumnya: bukan pemakaian negatif', () => {
    expect(bagiMutasiOrder(20)).toEqual({ pakai: 0, pembalikSebelumPeriode: 20 })
  })

  it('jumlahnya selalu sama dengan neto (stok sistem tak bergeser)', () => {
    for (const net of [-125.5, -1, 0, 0.25, 40]) {
      const r = bagiMutasiOrder(net)
      expect(-r.pakai + r.pembalikSebelumPeriode).toBeCloseTo(net, 10)
    }
  })
})
