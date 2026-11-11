import { describe, it, expect } from 'vitest'
import { barisRabDariExpense, barisRabDariKasKecil, cocokTargetRab, ringkasBiayaRab, type BiayaRabRow } from './biayaRab'

const MITRA = 'm-1'
const INTERNAL = 'i-1'
const mitra = new Set([MITRA])

const baris = (outlet_id: string | null, jumlah: number, nama = outlet_id ?? 'Kantor Pusat'): BiayaRabRow => ({
  id: String(Math.random()),
  outlet_id,
  outlet_nama: nama,
  kategori_label: 'Input Pengeluaran',
  sumber: 'input',
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

describe('barisRabDariExpense', () => {
  it('memecah keterangan Marcom', () => {
    const r = barisRabDariExpense({
      id: 'e1', outlet_id: 'o1', amount: '2500000', expense_date: '2026-11-05', receipt_url: null,
      description: '[MARCOM: Cetak & Branding] Banner opening (Alokasi: SS Cibubur)', outlets: { name: 'SS Cibubur' },
    })
    expect(r).toMatchObject({ sumber: 'marcom', kategori_label: 'Marcom · Cetak & Branding', keterangan: 'Banner opening', jumlah: 2500000, outlet_nama: 'SS Cibubur' })
  })

  it('baris dari form Input Pengeluaran', () => {
    const r = barisRabDariExpense({ id: 'e2', outlet_id: 'o1', amount: 1000, expense_date: '2026-11-05', description: 'Renovasi dapur', outlets: { name: 'X' } })
    expect(r).toMatchObject({ sumber: 'input', kategori_label: 'Input Pengeluaran', keterangan: 'Renovasi dapur' })
  })
})

describe('barisRabDariKasKecil', () => {
  it('menandai sumber kas kecil outlet', () => {
    const r = barisRabDariKasKecil({ id: 'p1', outlet_id: 'o1', amount: '32000', expense_date: '2026-11-09', description: 'lalamove sayur', outlets: { name: 'MITRA KARAWACI' } })
    expect(r).toMatchObject({ sumber: 'kas_kecil', kategori_label: 'Kas Kecil Outlet', jumlah: 32000, keterangan: 'lalamove sayur', outlet_nama: 'MITRA KARAWACI' })
  })
})
