import { describe, expect, it } from 'vitest'
import { adalahBarisRab, cekAturanRab } from './rab'

const OUTLET = '11111111-1111-1111-1111-111111111111'

describe('cekAturanRab', () => {
  it('RAB baru di outlet, tanpa rekening: boleh', () => {
    expect(cekAturanRab({ kategoriBaru: 'rab', outletId: OUTLET, tanggalBaru: '2026-11-11' })).toBeNull()
  })

  it('RAB baru bertanggal bulan closing tetap boleh (tidak menggeser angka apa pun)', () => {
    expect(cekAturanRab({ kategoriBaru: 'rab', outletId: OUTLET, tanggalBaru: '2026-10-05' })).toBeNull()
  })

  it('RAB tanpa outlet atau ke Head Office: ditolak', () => {
    expect(cekAturanRab({ kategoriBaru: 'rab', outletId: null, tanggalBaru: '2026-11-11' })).toMatch(/outlet/)
    expect(cekAturanRab({ kategoriBaru: 'rab', outletId: 'PUSAT', tanggalBaru: '2026-11-11' })).toMatch(/outlet/)
  })

  it('RAB dengan rekening pusat: ditolak', () => {
    expect(
      cekAturanRab({ kategoriBaru: 'rab', outletId: OUTLET, cashLocationId: 'x', tanggalBaru: '2026-11-11' })
    ).toMatch(/rekening/)
  })

  it('ubah pengeluaran November menjadi RAB: boleh', () => {
    expect(
      cekAturanRab({ kategoriBaru: 'rab', outletId: OUTLET, tanggalBaru: '2026-11-03', tipeLama: 'expense', tanggalLama: '2026-11-03' })
    ).toBeNull()
  })

  it('ubah pengeluaran Oktober (closing) menjadi RAB: ditolak', () => {
    expect(
      cekAturanRab({ kategoriBaru: 'rab', outletId: OUTLET, tanggalBaru: '2026-10-20', tipeLama: 'expense', tanggalLama: '2026-10-20' })
    ).toMatch(/closing/)
  })

  it('RAB November dipindah ke Oktober sambil jadi pengeluaran biasa: ditolak', () => {
    expect(
      cekAturanRab({ kategoriBaru: 'promo', outletId: OUTLET, tanggalBaru: '2026-10-31', tipeLama: 'rab', tanggalLama: '2026-11-02' })
    ).toMatch(/closing/)
  })

  it('pengeluaran Oktober dari closing ke November jadi RAB: ditolak (tanggal lama dihitung)', () => {
    expect(
      cekAturanRab({ kategoriBaru: 'rab', outletId: OUTLET, tanggalBaru: '2026-11-02', tipeLama: 'expense', tanggalLama: '2026-10-31' })
    ).toMatch(/closing/)
  })

  it('RAB Oktober tetap RAB, hanya ubah nominal: boleh', () => {
    expect(
      cekAturanRab({ kategoriBaru: 'rab', outletId: OUTLET, tanggalBaru: '2026-10-05', tipeLama: 'rab', tanggalLama: '2026-10-05' })
    ).toBeNull()
  })

  it('pemasukan tidak bisa diubah menjadi RAB', () => {
    expect(
      cekAturanRab({ kategoriBaru: 'rab', outletId: OUTLET, tanggalBaru: '2026-11-05', tipeLama: 'income', tanggalLama: '2026-11-05' })
    ).toMatch(/biasa/)
  })

  it('pengeluaran biasa di bulan closing yang bukan RAB tidak terpengaruh', () => {
    expect(
      cekAturanRab({ kategoriBaru: 'promo', outletId: OUTLET, tanggalBaru: '2026-10-05', tipeLama: 'expense', tanggalLama: '2026-10-05' })
    ).toBeNull()
  })
})

describe('adalahBarisRab', () => {
  it('mengenali dari type atau kategori', () => {
    expect(adalahBarisRab({ type: 'rab' })).toBe(true)
    expect(adalahBarisRab({ category: 'rab' })).toBe(true)
    expect(adalahBarisRab({ type: 'expense', category: 'promo' })).toBe(false)
    expect(adalahBarisRab(null)).toBe(false)
  })
})
