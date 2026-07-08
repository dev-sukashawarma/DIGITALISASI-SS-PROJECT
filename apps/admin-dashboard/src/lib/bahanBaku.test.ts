import { describe, it, expect } from 'vitest'
import { normalizeBahanBaku, filterBahanBaku, parsePriceInput } from './bahanBaku'
import type { BahanBakuRaw } from './bahanBaku'

const raw = (over: Partial<BahanBakuRaw> = {}): BahanBakuRaw => ({
  id: '1', nama: 'Daging Sapi', satuan: 'kg', satuan_kecil: null,
  faktor_tampilan: null, kategori: 'item core',
  bahan_baku_harga: null, ...over,
})

describe('normalizeBahanBaku', () => {
  it('flattens embed object to harga', () => {
    const r = normalizeBahanBaku(raw({ bahan_baku_harga: { harga_beli: 120000, harga_updated_at: '2026-06-30T00:00:00Z' } }))
    expect(r.harga).toEqual({ harga_beli: 120000, harga_updated_at: '2026-06-30T00:00:00Z' })
  })
  it('flattens embed array (PostgREST to-many shape) to first element', () => {
    const r = normalizeBahanBaku(raw({ bahan_baku_harga: [{ harga_beli: 5000, harga_updated_at: null }] }))
    expect(r.harga).toEqual({ harga_beli: 5000, harga_updated_at: null })
  })
  it('returns null harga when embed is null or empty array', () => {
    expect(normalizeBahanBaku(raw({ bahan_baku_harga: null })).harga).toBeNull()
    expect(normalizeBahanBaku(raw({ bahan_baku_harga: [] })).harga).toBeNull()
  })
})

describe('filterBahanBaku', () => {
  const rows = [
    normalizeBahanBaku(raw({ id: '1', nama: 'Daging Sapi' })),
    normalizeBahanBaku(raw({ id: '2', nama: 'Roti Pita' })),
  ]
  it('matches by case-insensitive substring of nama', () => {
    expect(filterBahanBaku(rows, 'roti').map((r) => r.id)).toEqual(['2'])
    expect(filterBahanBaku(rows, 'SAPI').map((r) => r.id)).toEqual(['1'])
  })
  it('returns all rows when search empty', () => {
    expect(filterBahanBaku(rows, '').length).toBe(2)
  })
})

describe('parsePriceInput', () => {
  it('parses plain digits', () => { expect(parsePriceInput('5000')).toBe(5000) })
  it('strips Rp / separators', () => { expect(parsePriceInput('Rp 120.000')).toBe(120000) })
  it('returns null for empty or non-numeric', () => {
    expect(parsePriceInput('')).toBeNull()
    expect(parsePriceInput('abc')).toBeNull()
  })
})
