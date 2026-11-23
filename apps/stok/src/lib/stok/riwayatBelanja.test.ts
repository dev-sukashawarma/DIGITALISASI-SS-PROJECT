import { describe, it, expect } from 'vitest'
import { hitungBarisBelanja, batasHariWib, tanggalWib, awalBulanWib } from './riwayatBelanja'

// BAWANG: satuan besar Bal (20 kg), distribusi kg, satuan kecil gram.
const bawang = {
  satuan: 'Bal',
  satuan_distribusi: 'kg',
  satuan_kecil: 'gram',
  faktor_tampilan: 20000,
  satuan_tengah: null,
  faktor_tengah: null,
}

// KENTANG: distribusi = satuan besar (faktor 1).
const kentang = { satuan: 'Kg', satuan_distribusi: 'Kg', satuan_kecil: 'gram', faktor_tampilan: 1000 }

describe('hitungBarisBelanja', () => {
  it('subtotal = qty_disetujui (satuan besar) × harga_snapshot (per satuan besar), tanpa konversi distribusi', () => {
    // 0,5 Bal @ Rp 650.000/Bal = Rp 325.000 — bukan 10 kg × 650.000.
    const r = hitungBarisBelanja({ qtyDisetujui: 0.5, qtyDiminta: 1, hargaSnapshot: 650_000, bahan: bawang })
    expect(r.subtotal).toBe(325_000)
  })

  it('qty tampil dalam satuan distribusi, harga tampil per satuan distribusi — perkaliannya = subtotal', () => {
    const r = hitungBarisBelanja({ qtyDisetujui: 0.5, qtyDiminta: 1, hargaSnapshot: 650_000, bahan: bawang })
    expect(r.qtyDisetujuiDistribusi).toBe(10)
    expect(r.qtyDimintaDistribusi).toBe(20)
    expect(r.hargaPerDistribusi).toBe(32_500)
    expect(r.qtyDisetujuiDistribusi * r.hargaPerDistribusi).toBeCloseTo(r.subtotal, 6)
  })

  it('bahan dengan distribusi = satuan besar tidak berubah', () => {
    const r = hitungBarisBelanja({ qtyDisetujui: 3, qtyDiminta: 4, hargaSnapshot: 25_000, bahan: kentang })
    expect(r).toEqual({
      qtyDisetujuiDistribusi: 3,
      qtyDimintaDistribusi: 4,
      hargaPerDistribusi: 25_000,
      subtotal: 75_000,
    })
  })

  it('tanpa data bahan & nilai null diperlakukan sebagai 0 / satuan besar', () => {
    const r = hitungBarisBelanja({ qtyDisetujui: null, qtyDiminta: 2, hargaSnapshot: null, bahan: null })
    expect(r).toEqual({ qtyDisetujuiDistribusi: 0, qtyDimintaDistribusi: 2, hargaPerDistribusi: 0, subtotal: 0 })
  })
})

describe('batas tanggal WIB', () => {
  it('batasHariWib memakai offset +07:00, bukan UTC', () => {
    expect(batasHariWib('2026-11-19', '2026-11-25')).toEqual({
      dari: '2026-11-19T00:00:00.000+07:00',
      sampai: '2026-11-25T23:59:59.999+07:00',
    })
  })

  it('batasHariWib mengosongkan sisi yang tidak diisi', () => {
    expect(batasHariWib(undefined, '2026-11-25')).toEqual({ dari: null, sampai: '2026-11-25T23:59:59.999+07:00' })
    expect(batasHariWib('2026-11-19', undefined)).toEqual({ dari: '2026-11-19T00:00:00.000+07:00', sampai: null })
  })

  it('awal hari WIB (00:00–06:59 WIB) masih dihitung tanggal WIB, bukan tanggal UTC kemarin', () => {
    // 23 Nov 05:30 WIB = 22 Nov 22:30 UTC
    const d = new Date('2026-11-22T22:30:00.000Z')
    expect(tanggalWib(d)).toBe('2026-11-23')
  })

  it('awalBulanWib memakai bulan WIB', () => {
    // 1 Des 02:00 WIB = 30 Nov 19:00 UTC → bulan ini = Desember
    expect(awalBulanWib(new Date('2026-11-30T19:00:00.000Z'))).toBe('2026-12-01')
    expect(awalBulanWib(new Date('2026-11-23T10:00:00.000Z'))).toBe('2026-11-01')
  })
})
