import { describe, it, expect } from 'vitest'
import { expectedUsage } from './bom'
import type { ResepItem } from '@/types/stok'

const recipe: ResepItem[] = [
  { id: '1', resep_id: 'r', bahan_baku_id: 'ayam', qty_per_porsi: 0.15, satuan: 'kg' },
  { id: '2', resep_id: 'r', bahan_baku_id: 'roti', qty_per_porsi: 1, satuan: 'pcs' },
]

describe('expectedUsage', () => {
  it('multiplies recipe by porsi sold', () => {
    const out = expectedUsage(10, recipe)
    expect(out['ayam']).toBeCloseTo(1.5)
    expect(out['roti']).toBe(10)
  })
  it('returns empty for zero sales', () => {
    expect(expectedUsage(0, recipe)).toEqual({})
  })
})
