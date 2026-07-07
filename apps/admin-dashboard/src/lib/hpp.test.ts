import { describe, it, expect } from 'vitest'
import { computeResepHpp, type HppBahan } from './hpp'

const bahan: Record<string, HppBahan> = {
  ayam: { harga_beli: 47800, faktor_konversi: 1000 },   // 47.8 / gram
  kulit: { harga_beli: 27000, faktor_konversi: 20 },    // 1350 / lembar
  tanpaHarga: { harga_beli: 0, faktor_konversi: 1 },
}

describe('computeResepHpp', () => {
  it('menghitung subtotal per bahan dan total HPP', () => {
    const r = computeResepHpp(
      [
        { bahan_baku_id: 'ayam', qty_per_porsi: 100, satuan: 'gram' },
        { bahan_baku_id: 'kulit', qty_per_porsi: 1, satuan: 'lembar' },
      ],
      bahan,
      23418,
    )
    expect(r.lines[0].subtotal).toBe(4780)
    expect(r.lines[1].subtotal).toBe(1350)
    expect(r.totalHpp).toBe(6130)
    expect(r.marginRp).toBe(23418 - 6130)
    expect(Math.round(r.marginPct ?? NaN)).toBe(74)
    expect(r.anyMissingPrice).toBe(false)
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
