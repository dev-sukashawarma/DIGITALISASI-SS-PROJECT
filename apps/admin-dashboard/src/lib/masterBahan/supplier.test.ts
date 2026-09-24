import { describe, it, expect } from 'vitest'
import { saringDataSupplier } from './supplier'

describe('saringDataSupplier', () => {
  it('hanya kunci yang diizinkan simpan_supplier', () => {
    expect(saringDataSupplier({
      nama: 'A', kontak: '1', alamat: null, kategori: 'lainnya', catatan: '', termin_hari: 15,
      bahan_baku_ids: ['x'], is_active: true, id: 'zz', created_at: 'now',
    })).toEqual({ nama: 'A', kontak: '1', alamat: null, kategori: 'lainnya', catatan: '', termin_hari: 15, bahan_baku_ids: ['x'] })
  })
  it('tidak menambah kunci yang tak dikirim', () => {
    expect(saringDataSupplier({ termin_hari: 30 })).toEqual({ termin_hari: 30 })
  })
})
