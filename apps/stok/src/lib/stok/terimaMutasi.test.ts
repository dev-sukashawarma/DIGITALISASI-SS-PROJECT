import { describe, it, expect } from 'vitest'
import { hitungQtyDiterima } from './terimaMutasi'

// 1 Pack (satuan distribusi) = 250 g (basis) → keBase = x * 250
const dasar = { qtyDikirimBase: 500, qtyDikirimDist: 2, keBase: (d: number) => d * 250 }

describe('hitungQtyDiterima', () => {
  it('kondisi baik selalu = qty dikirim', () => {
    expect(hitungQtyDiterima({ ...dasar, kondisi: 'baik', inputDist: '1' })).toEqual({ ok: true, qty: 500 })
  })
  it('rusak/hilang tanpa isian = default dikirim', () => {
    expect(hitungQtyDiterima({ ...dasar, kondisi: 'rusak', inputDist: undefined })).toEqual({ ok: true, qty: 500 })
    expect(hitungQtyDiterima({ ...dasar, kondisi: 'hilang_qty', inputDist: '' })).toEqual({ ok: true, qty: 500 })
  })
  it('rusak/hilang memakai jumlah diterima yang diisi (dikonversi ke basis)', () => {
    expect(hitungQtyDiterima({ ...dasar, kondisi: 'hilang_qty', inputDist: '1,5' })).toEqual({ ok: true, qty: 375 })
    expect(hitungQtyDiterima({ ...dasar, kondisi: 'rusak', inputDist: '0' })).toEqual({ ok: true, qty: 0 })
  })
  it('isian sama dengan dikirim → qty basis persis (tanpa galat pembulatan)', () => {
    expect(hitungQtyDiterima({ ...dasar, qtyDikirimBase: 333.3333, qtyDikirimDist: 1.3333332, kondisi: 'rusak', inputDist: '1.33' })).toEqual({ ok: true, qty: 333.3333 })
  })
  it('menolak negatif, bukan angka, dan melebihi dikirim', () => {
    expect(hitungQtyDiterima({ ...dasar, kondisi: 'rusak', inputDist: '-1' }).ok).toBe(false)
    expect(hitungQtyDiterima({ ...dasar, kondisi: 'rusak', inputDist: 'abc' }).ok).toBe(false)
    expect(hitungQtyDiterima({ ...dasar, kondisi: 'rusak', inputDist: '2.5' }).ok).toBe(false)
  })
})
