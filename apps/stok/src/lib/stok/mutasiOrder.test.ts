import { describe, it, expect } from 'vitest'
import { bagiMutasiOrder, isMutasiOrder, pemakaianPosPeriode } from './mutasiOrder'

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

describe('pemakaianPosPeriode', () => {
  it('menjumlah potongan BOM per order dalam periode', () => {
    expect(
      pemakaianPosPeriode([
        { tipe: 'pemakaian', qty: -140, ref_order_id: 'o1' },
        { tipe: 'pemakaian', qty: -80, ref_order_id: 'o2' },
      ])
    ).toBe(220)
  })

  it('order batal dalam periode yang sama tidak terhitung', () => {
    expect(
      pemakaianPosPeriode([
        { tipe: 'pemakaian', qty: -140, ref_order_id: 'o1' },
        { tipe: 'adjustment', qty: 140, ref_order_id: 'o1' },
        { tipe: 'pemakaian', qty: -80, ref_order_id: 'o2' },
      ])
    ).toBe(80)
  })

  it('pembalik order dari periode sebelumnya tidak mengurangi pemakaian (sama dengan jurnal)', () => {
    // Neto order periode ini -80 + 200 = +120 → pemakaian 0, bukan negatif.
    expect(
      pemakaianPosPeriode([
        { tipe: 'pemakaian', qty: -80, ref_order_id: 'o2' },
        { tipe: 'adjustment', qty: 200, ref_order_id: 'o-lama' },
      ])
    ).toBe(0)
  })

  it('pemakaian manual tanpa order ikut dijumlah apa adanya', () => {
    expect(
      pemakaianPosPeriode([
        { tipe: 'pemakaian', qty: -50, ref_order_id: null },
        { tipe: 'pemakaian', qty: -70, ref_order_id: 'o1' },
      ])
    ).toBe(120)
  })

  it('waste, kiriman & adjustment manual bukan pemakaian POS', () => {
    expect(
      pemakaianPosPeriode([
        { tipe: 'waste', qty: -350, ref_order_id: null },
        { tipe: 'terima_kiriman', qty: 10000, ref_order_id: null },
        { tipe: 'adjustment', qty: -500, ref_order_id: null },
        { tipe: 'pemakaian', qty: -70, ref_order_id: 'o1' },
      ])
    ).toBe(70)
  })

  it('qty bertipe string dari Postgres numeric tetap terbaca', () => {
    expect(
      pemakaianPosPeriode([{ tipe: 'pemakaian', qty: '-41.25', ref_order_id: 'o1' }])
    ).toBeCloseTo(41.25, 10)
  })
})
