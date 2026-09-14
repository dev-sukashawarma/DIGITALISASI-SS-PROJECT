import { describe, it, expect } from 'vitest'
import { alokasiEfektif, validasiPenyesuaianVendor, itemRpcPenyesuaian, bolehPenyesuaianVendor } from './penyesuaianVendor'
import type { SaldoVendor } from './alokasiVendor'

describe('bolehPenyesuaianVendor', () => {
  it('kitchen, purchasing, admin, owner boleh', () => {
    for (const r of ['kitchen', 'purchasing', 'admin', 'owner']) expect(bolehPenyesuaianVendor(r)).toBe(true)
  })
  it('role lain & kosong tidak boleh', () => {
    for (const r of ['crew', 'spv', 'regional_manager', 'admin_finance', 'finance', 'admin_hr', 'developer', '', null, undefined])
      expect(bolehPenyesuaianVendor(r)).toBe(false)
  })
})

const dj: SaldoVendor = { vendor_id: 'dj', vendor_nama: 'Djafafood', sisa: 3, aktif: true }
const az: SaldoVendor = { vendor_id: 'az', vendor_nama: 'Pak Aziz', sisa: 0, aktif: true }

describe('alokasiEfektif', () => {
  it('satu vendor terpilih → ikut jumlah yang diketik', () => {
    expect(alokasiEfektif(7, [{ vendor_id: 'dj', qty: 2 }])).toEqual([{ vendor_id: 'dj', qty: 7 }])
  })
  it('pecahan dibiarkan apa adanya', () => {
    const a = [{ vendor_id: 'dj', qty: 2 }, { vendor_id: 'az', qty: 1 }]
    expect(alokasiEfektif(3, a)).toEqual(a)
  })
})

describe('validasiPenyesuaianVendor', () => {
  it('pengurangan melebihi sisa ditolak', () => {
    expect(validasiPenyesuaianVendor(4, 'keluar', [{ vendor_id: 'dj', qty: 4 }], [dj, az])).toMatch(/Sisa Djafafood/)
  })
  it('penambahan boleh ke vendor bersisa 0', () => {
    expect(validasiPenyesuaianVendor(5, 'masuk', [{ vendor_id: 'az', qty: 5 }], [dj, az])).toBeNull()
  })
  it('belum pilih vendor ditolak untuk dua arah', () => {
    expect(validasiPenyesuaianVendor(1, 'masuk', [], [dj, az])).toBe('Pilih vendor dulu')
    expect(validasiPenyesuaianVendor(1, 'keluar', [], [dj, az])).toBe('Pilih vendor dulu')
  })
  it('pecahan harus pas dengan jumlah', () => {
    expect(validasiPenyesuaianVendor(5, 'masuk', [{ vendor_id: 'dj', qty: 2 }, { vendor_id: 'az', qty: 2 }], [dj, az])).toMatch(/belum sama/)
  })
  it('bahan satu vendor tak perlu validasi', () => {
    expect(validasiPenyesuaianVendor(9, 'keluar', [], [dj])).toBeNull()
  })
})

describe('itemRpcPenyesuaian', () => {
  it('penyesuaian keluar bertanda negatif, masuk positif, transfer positif', () => {
    const a = [{ vendor_id: 'dj', qty: 2 }, { vendor_id: 'az', qty: 1 }]
    expect(itemRpcPenyesuaian('b1', 'adjustment', 'keluar', a, 'ss online')).toEqual([
      { bahan_baku_id: 'b1', vendor_id: 'dj', tipe: 'adjustment', qty_besar: -2, catatan: 'ss online' },
      { bahan_baku_id: 'b1', vendor_id: 'az', tipe: 'adjustment', qty_besar: -1, catatan: 'ss online' },
    ])
    expect(itemRpcPenyesuaian('b1', 'adjustment', 'masuk', [{ vendor_id: 'dj', qty: 3 }], 'x')[0].qty_besar).toBe(3)
    expect(itemRpcPenyesuaian('b1', 'transfer_keluar', 'keluar', [{ vendor_id: 'dj', qty: 3 }], 'x')[0].qty_besar).toBe(3)
  })
})
