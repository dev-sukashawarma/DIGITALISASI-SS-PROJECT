import { describe, it, expect } from 'vitest'
import { cocokTargetRab, ringkasBiayaRab, type BiayaRabRow } from './biayaRab'

const MITRA = 'm-1'
const INTERNAL = 'i-1'
const mitra = new Set([MITRA])

const baris = (outlet_id: string | null, jumlah: number, nama = outlet_id ?? 'Kantor Pusat'): BiayaRabRow => ({
  marcom_expense_id: Math.random(),
  outlet_id,
  outlet_nama: nama,
  kategori: 'CETAK_BRANDING',
  kategori_label: 'Cetak',
  jumlah,
  keterangan: 'x',
  tanggal: '2026-11-05',
  receipt_url: null,
})

describe('cocokTargetRab', () => {
  it('memetakan setiap target Buku Kas', () => {
    expect(cocokTargetRab(null, 'all', mitra)).toBe(true)
    expect(cocokTargetRab(null, 'PUSAT', mitra)).toBe(true)
    expect(cocokTargetRab(INTERNAL, 'PUSAT', mitra)).toBe(false)
    expect(cocokTargetRab(null, 'ALL_OUTLETS', mitra)).toBe(false)
    expect(cocokTargetRab(MITRA, 'MITRA_OUTLETS', mitra)).toBe(true)
    expect(cocokTargetRab(INTERNAL, 'MITRA_OUTLETS', mitra)).toBe(false)
    expect(cocokTargetRab(INTERNAL, 'INTERNAL_OUTLETS', mitra)).toBe(true)
    expect(cocokTargetRab(MITRA, 'INTERNAL_OUTLETS', mitra)).toBe(false)
    expect(cocokTargetRab(null, 'INTERNAL_PUSAT', mitra)).toBe(true)
    expect(cocokTargetRab(MITRA, 'INTERNAL_PUSAT', mitra)).toBe(false)
    expect(cocokTargetRab(INTERNAL, INTERNAL, mitra)).toBe(true)
    expect(cocokTargetRab(MITRA, INTERNAL, mitra)).toBe(false)
  })
})

describe('ringkasBiayaRab', () => {
  it('menjumlah total & per outlet, terbesar dulu', () => {
    const r = ringkasBiayaRab([baris(INTERNAL, 1000), baris(MITRA, 5000), baris(INTERNAL, 2000)])
    expect(r.total).toBe(8000)
    expect(r.jumlahTransaksi).toBe(3)
    expect(r.perOutlet.map((o) => [o.outletId, o.total, o.jumlah])).toEqual([
      [MITRA, 5000, 1],
      [INTERNAL, 3000, 2],
    ])
  })
})
