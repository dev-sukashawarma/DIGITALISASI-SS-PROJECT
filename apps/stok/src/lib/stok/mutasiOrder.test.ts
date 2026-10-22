import { describe, it, expect } from 'vitest'
import { isMutasiOrder, pemakaianPosPerBahan, pemakaianPosPeriode } from './mutasiOrder'

const S = '2026-10-20T15:08:00Z' // awal periode (finalisasi opname sebelumnya)
const E = '2026-10-21T15:13:00Z' // akhir periode (finalisasi opname ini)
const DI = '2026-10-21T08:00:00Z'
const SEBELUM = '2026-10-10T11:00:00Z'
const SESUDAH = '2026-10-22T04:14:00Z'

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

describe('pemakaianPosPeriode', () => {
  it('menjumlah potongan BOM per order dalam periode', () => {
    expect(
      pemakaianPosPeriode(
        [
          { tipe: 'pemakaian', qty: -140, ref_order_id: 'o1', created_at: DI },
          { tipe: 'pemakaian', qty: -80, ref_order_id: 'o2', created_at: DI },
        ],
        S,
        E
      )
    ).toBe(220)
  })

  it('order batal dalam periode yang sama tidak terhitung', () => {
    expect(
      pemakaianPosPeriode(
        [
          { tipe: 'pemakaian', qty: -140, ref_order_id: 'o1', created_at: DI },
          { tipe: 'adjustment', qty: 140, ref_order_id: 'o1', created_at: DI },
          { tipe: 'pemakaian', qty: -80, ref_order_id: 'o2', created_at: DI },
        ],
        S,
        E
      )
    ).toBe(80)
  })

  it('pembalik order lama di periode ini diabaikan, tidak memakan pemakaian order baru', () => {
    // Cibubur 21 Okt: order 10 Okt dibatalkan pagi 21 Okt.
    expect(
      pemakaianPosPeriode(
        [
          { tipe: 'pemakaian', qty: -80, ref_order_id: 'o-lama', created_at: SEBELUM },
          { tipe: 'adjustment', qty: 80, ref_order_id: 'o-lama', created_at: DI },
          { tipe: 'pemakaian', qty: -430, ref_order_id: 'o2', created_at: DI },
        ],
        S,
        E
      )
    ).toBe(430)
  })

  it('pembalik yang datang SESUDAH periode tetap mengurangi periode potongannya', () => {
    // Cibubur #29: dipotong 20 Okt, dibatalkan 22 Okt.
    expect(
      pemakaianPosPeriode(
        [
          { tipe: 'pemakaian', qty: -80, ref_order_id: 'o29', created_at: DI },
          { tipe: 'adjustment', qty: 80, ref_order_id: 'o29', created_at: SESUDAH },
          { tipe: 'pemakaian', qty: -120, ref_order_id: 'o2', created_at: DI },
        ],
        S,
        E
      )
    ).toBe(120)
  })

  it('pemakaian manual tanpa order dihitung bila di dalam periode', () => {
    expect(
      pemakaianPosPeriode(
        [
          { tipe: 'pemakaian', qty: -50, ref_order_id: null, created_at: DI },
          { tipe: 'pemakaian', qty: -99, ref_order_id: null, created_at: SEBELUM },
          { tipe: 'pemakaian', qty: -70, ref_order_id: 'o1', created_at: DI },
        ],
        S,
        E
      )
    ).toBe(120)
  })

  it('waste, kiriman & adjustment manual bukan pemakaian POS', () => {
    expect(
      pemakaianPosPeriode(
        [
          { tipe: 'waste', qty: -350, ref_order_id: null, created_at: DI },
          { tipe: 'terima_kiriman', qty: 10000, ref_order_id: null, created_at: DI },
          { tipe: 'adjustment', qty: -500, ref_order_id: null, created_at: DI },
          { tipe: 'pemakaian', qty: -70, ref_order_id: 'o1', created_at: DI },
        ],
        S,
        E
      )
    ).toBe(70)
  })

  it('qty bertipe string dari Postgres numeric & offset zona berbeda tetap terbaca', () => {
    expect(
      pemakaianPosPeriode(
        [{ tipe: 'pemakaian', qty: '-41.25', ref_order_id: 'o1', created_at: '2026-10-21T15:00:00+07:00' }],
        S,
        E
      )
    ).toBeCloseTo(41.25, 10)
  })
})

describe('pemakaianPosPerBahan', () => {
  it('memisah per bahan dan neto per order × bahan', () => {
    const m = pemakaianPosPerBahan(
      [
        { tipe: 'pemakaian', qty: -80, ref_order_id: 'o1', created_at: DI, bahan_baku_id: 'ayam' },
        { tipe: 'pemakaian', qty: -30, ref_order_id: 'o1', created_at: DI, bahan_baku_id: 'tum' },
        { tipe: 'adjustment', qty: 30, ref_order_id: 'o1', created_at: SESUDAH, bahan_baku_id: 'tum' },
      ],
      S,
      E
    )
    expect(m.get('ayam')).toBe(80)
    expect(m.get('tum') || 0).toBe(0)
  })
})
