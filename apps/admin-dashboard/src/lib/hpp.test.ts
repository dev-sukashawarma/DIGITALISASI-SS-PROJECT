import { describe, it, expect } from 'vitest'
import { computeResepHpp, type HppBahan } from './hpp'

const bahan: Record<string, HppBahan> = {
  ayam: { hargaBeliDisplay: 47800, kemasanQty: 1000, kemasanSatuan: 'gram' }, // 47.8 / gram
  kulit: { hargaBeliDisplay: 27000, kemasanQty: 20, kemasanSatuan: 'lembar' }, // 1350 / lembar
  minyak: { hargaBeliDisplay: 23000, kemasanQty: 1000, kemasanSatuan: 'gram' }, // 23 / gram
  tanpaHarga: { hargaBeliDisplay: 0, kemasanQty: 0, kemasanSatuan: '' },
}

describe('computeResepHpp', () => {
  it('menghitung subtotal per bahan dari harga beli / isi kemasan', () => {
    const r = computeResepHpp(
      [
        { bahan_baku_id: 'ayam', qty_per_porsi: 100, satuan: 'gram' },
        { bahan_baku_id: 'kulit', qty_per_porsi: 1, satuan: 'lembar' },
        { bahan_baku_id: 'minyak', qty_per_porsi: 25, satuan: 'gram' },
      ],
      bahan,
      23418,
    )
    expect(r.lines[0].subtotal).toBe(4780)
    expect(r.lines[1].subtotal).toBe(1350)
    expect(r.lines[2].subtotal).toBe(575)
    expect(r.materialTotal).toBe(6705)
    expect(r.totalHpp).toBe(6705)
    expect(r.anyMissingPrice).toBe(false)
  })

  it('menambahkan buffer (Loss) ke total HPP', () => {
    const r = computeResepHpp(
      [{ bahan_baku_id: 'ayam', qty_per_porsi: 100, satuan: 'gram' }],
      bahan,
      23418,
      500,
    )
    expect(r.materialTotal).toBe(4780)
    expect(r.buffer).toBe(500)
    expect(r.totalHpp).toBe(5280)
    expect(r.marginRp).toBe(23418 - 5280)
  })

  it('menandai bahan tanpa harga sebagai parsial (subtotal 0)', () => {
    const r = computeResepHpp(
      [{ bahan_baku_id: 'tanpaHarga', qty_per_porsi: 5, satuan: 'gram' }],
      bahan,
      1000,
    )
    expect(r.lines[0].subtotal).toBe(0)
    expect(r.lines[0].hasPrice).toBe(false)
    expect(r.anyMissingPrice).toBe(true)
  })

  it('tidak membagi nol saat harga jual 0', () => {
    const r = computeResepHpp(
      [{ bahan_baku_id: 'ayam', qty_per_porsi: 100, satuan: 'gram' }],
      bahan,
      0,
    )
    expect(r.marginPct).toBeNull()
    expect(r.foodcostPct).toBeNull()
  })

  it('bahan tak dikenal dianggap tanpa harga, tidak error', () => {
    const r = computeResepHpp(
      [{ bahan_baku_id: 'hantu', qty_per_porsi: 3, satuan: 'gram' }],
      bahan,
      1000,
    )
    expect(r.lines[0].subtotal).toBe(0)
    expect(r.anyMissingPrice).toBe(true)
  })
})
