import { describe, expect, it } from 'vitest'
import { statusDariThreshold, terapkanOverrideThreshold, buangOverrideTersimpan } from './thresholdOverride'

describe('statusDariThreshold', () => {
  it('memakai skala besar: < setengah batas = below, < batas = warning, selain itu ok', () => {
    expect(statusDariThreshold(2, 5)).toBe('below')
    expect(statusDariThreshold(4, 5)).toBe('warning')
    expect(statusDariThreshold(5, 5)).toBe('ok')
  })
})

describe('terapkanOverrideThreshold', () => {
  it('membandingkan current_qty_besar, bukan current_qty mentah (gram)', () => {
    // Saldo 3.000 g = 3 Kg; batas baru 4 Kg -> warning. Dengan current_qty mentah
    // (3000) hasilnya keliru "ok".
    const item = { outlet_id: 'o', bahan_baku_id: 'b', current_qty: 3000, current_qty_besar: 3, threshold: 10, status: 'below' as const }
    const [hasil] = terapkanOverrideThreshold([item], { 'o-b': 4 })
    expect(hasil.threshold).toBe(4)
    expect(hasil.status).toBe('warning')
  })

  it('item tanpa override tidak berubah', () => {
    const item = { outlet_id: 'o', bahan_baku_id: 'b', current_qty: 1, current_qty_besar: 1, threshold: 10, status: 'below' as const }
    expect(terapkanOverrideThreshold([item], {})[0]).toBe(item)
  })
})

describe('buangOverrideTersimpan', () => {
  it('override dibuang begitu data server sudah membawa threshold yang sama', () => {
    const items = [
      { outlet_id: 'o', bahan_baku_id: 'b', threshold: 4 },
      { outlet_id: 'o', bahan_baku_id: 'c', threshold: 10 },
    ]
    expect(buangOverrideTersimpan({ 'o-b': 4, 'o-c': 7 }, items)).toEqual({ 'o-c': 7 })
  })

  it('tanpa perubahan mengembalikan objek yang sama (hindari render ulang)', () => {
    const ov = { 'o-c': 7 }
    expect(buangOverrideTersimpan(ov, [{ outlet_id: 'o', bahan_baku_id: 'c', threshold: 10 }])).toBe(ov)
  })
})
