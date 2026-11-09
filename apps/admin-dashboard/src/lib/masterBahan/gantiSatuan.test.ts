import { describe, expect, it } from 'vitest'
import { faktorGanti, kalimatJembatan, labelPenghalang } from './gantiSatuan'

describe('faktorGanti', () => {
  it('sachet → gram: 1 Dus 432 sachet, 1 Kg 1000 gram, jembatan 6', () => {
    const f = faktorGanti(432, 1000, 6)
    expect(f).not.toBeNull()
    expect(f!.kKecil).toBe(6)
    expect(f!.kBesar).toBeCloseTo(2.592, 12)
  })

  it('menolak jembatan nol, negatif, NaN, atau faktor tak positif', () => {
    expect(faktorGanti(432, 1000, 0)).toBeNull()
    expect(faktorGanti(432, 1000, -1)).toBeNull()
    expect(faktorGanti(432, 1000, Number.NaN)).toBeNull()
    expect(faktorGanti(0, 1000, 6)).toBeNull()
    expect(faktorGanti(432, Number.POSITIVE_INFINITY, 6)).toBeNull()
  })
})

describe('kalimatJembatan', () => {
  it('menyebut satuan kecil lama dan baru', () => {
    expect(kalimatJembatan('Sachet', 'gram', 6)).toBe('1 Sachet lama = 6 gram baru')
    expect(kalimatJembatan('Pcs', 'Pcs', 1)).toBe('1 Pcs lama = 1 Pcs baru')
  })

  it('angka pecahan ditulis gaya Indonesia', () => {
    expect(kalimatJembatan('gram', 'ml', 1.5)).toBe('1 gram lama = 1,5 ml baru')
  })
})

describe('labelPenghalang', () => {
  it('memberi nama dokumen yang terbaca manusia', () => {
    expect(labelPenghalang({ jenis: 'opname_draft', nomor: 'Opname 2026-11-08', outlet: 'BEJI' })).toBe('Draft opname · BEJI')
    expect(labelPenghalang({ jenis: 'surat_jalan', nomor: 'SJ-001', outlet: 'EMPANG' })).toBe('Surat jalan SJ-001 · EMPANG')
    expect(labelPenghalang({ jenis: 'purchase_order', nomor: 'PO/XI/2026/001', outlet: null })).toBe('PO PO/XI/2026/001')
    expect(labelPenghalang({ jenis: 'substitusi', nomor: 'Pasangan substitusi waterfall', outlet: null }))
      .toBe('Dipakai sebagai pasangan substitusi (waterfall)')
  })
})
