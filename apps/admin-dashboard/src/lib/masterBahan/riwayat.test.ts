import { describe, it, expect } from 'vitest'
import { rupiah } from '@/lib/format'
import { ringkasRiwayat, type BarisRiwayat } from './riwayat'

const dasar: BarisRiwayat = {
  bahan_baku_id: 'b1', changed_at: '2026-09-24T01:00:00Z', changed_by: null, jenis: 'data',
  tabel: 'bahan_baku', aksi: 'UPDATE', perubahan: null, alasan: null,
  harga_lama: null, harga_baru: null, supplier_id: null,
}

describe('ringkasRiwayat', () => {
  it('UPDATE data: satu kalimat per kolom, label manusiawi', () => {
    const r = ringkasRiwayat({ ...dasar, perubahan: { nama: { lama: 'A', baru: 'B' }, is_opname: { lama: true, baru: false } } })
    expect(r).toEqual(['Nama: A → B', 'Ikut opname: ya → tidak'])
  })
  it('INSERT & DELETE', () => {
    expect(ringkasRiwayat({ ...dasar, aksi: 'INSERT', perubahan: { nama: 'X' } })).toEqual(['Dibuat'])
    expect(ringkasRiwayat({ ...dasar, aksi: 'DELETE', perubahan: { nama: 'X' } })).toEqual(['Dihapus'])
  })
  it('SKU diberi awalan tabel', () => {
    expect(ringkasRiwayat({ ...dasar, tabel: 'bahan_baku_sku', aksi: 'INSERT', perubahan: {} })).toEqual(['SKU dibuat'])
    expect(ringkasRiwayat({ ...dasar, tabel: 'bahan_baku_sku', perubahan: { qty_isi: { lama: 1, baru: 2 } } }))
      .toEqual(['SKU Isi kemasan: 1 → 2'])
  })
  it('harga master & harga vendor', () => {
    expect(ringkasRiwayat({ ...dasar, jenis: 'harga_master', tabel: 'bahan_baku_harga', harga_lama: 1000, harga_baru: 1200 }))
      .toEqual([`Harga master: ${rupiah(1000)} → ${rupiah(1200)}`])
    expect(ringkasRiwayat({ ...dasar, jenis: 'harga_vendor', tabel: 'bahan_baku_supplier', harga_lama: null, harga_baru: 500,
      perubahan: { satuan_beli: 'roll', isi_satuan_kecil: 760, sumber: 'manual' } }))
      .toEqual([`Harga vendor: — → ${rupiah(500)}`, 'Per roll (isi 760), sumber manual'])
  })
  it('nilai kosong jadi —', () => {
    expect(ringkasRiwayat({ ...dasar, perubahan: { merek: { lama: null, baru: 'Z' } } })).toEqual(['Merek: — → Z'])
  })
})
