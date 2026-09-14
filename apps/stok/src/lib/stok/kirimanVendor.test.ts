import { describe, it, expect } from 'vitest'
import { canLihatKirimanVendor, labelVendor, rentangDefault, kelompokkanRekap, type BarisRekap } from './kirimanVendor'

const r = (p: Partial<BarisRekap>): BarisRekap => ({
  vendor_id: 'v1', vendor_nama: 'Djafafood', bahan_baku_id: 'b1', bahan_nama: 'SAPI', satuan: 'Blok',
  outlet_id: 'o1', outlet_nama: 'BEJI', qty: 1, nilai: 100, harga_rata: 100, jumlah_sj: 1, ada_belum_diterima: false, ...p,
})

describe('canLihatKirimanVendor', () => {
  it('role berhak', () => { for (const x of ['kitchen','purchasing','admin','owner','admin_finance','spv','regional_manager']) expect(canLihatKirimanVendor(x)).toBe(true) })
  it('role lain', () => { for (const x of ['crew','leader','admin_hr','developer',null,undefined]) expect(canLihatKirimanVendor(x)).toBe(false) })
})

describe('labelVendor', () => {
  it('kosong → belum tercatat', () => expect(labelVendor(null, false)).toBe('Belum tercatat'))
  it('otomatis → (katalog)', () => expect(labelVendor('Meyer', true)).toBe('Meyer (katalog)'))
  it('biasa', () => expect(labelVendor('Djafafood', false)).toBe('Djafafood'))
})

describe('rentangDefault', () => {
  it('7 hari terakhir berdasar tanggal WIB', () => {
    // 2026-09-13 18:30 UTC = 2026-09-14 01:30 WIB
    expect(rentangDefault(new Date('2026-09-13T18:30:00Z'))).toEqual({ dari: '2026-09-08', sampai: '2026-09-14' })
  })
})

describe('kelompokkanRekap', () => {
  it('kelompok vendor → bahan → outlet dengan subtotal, vendor kosong di akhir', () => {
    const hasil = kelompokkanRekap([
      r({ outlet_id: 'o1', qty: 2, nilai: 200 }),
      r({ outlet_id: 'o2', outlet_nama: 'CIBINONG', qty: 3, nilai: 300 }),
      r({ vendor_id: null, vendor_nama: null, bahan_baku_id: 'b2', bahan_nama: 'AYAM', satuan: 'Kg', qty: 5, nilai: null }),
      r({ vendor_id: 'v2', vendor_nama: 'Agro', bahan_baku_id: 'b3', bahan_nama: 'KENTANG', satuan: 'Dus', qty: 1, nilai: 50 }),
    ])
    expect(hasil.total).toBe(550)
    expect(hasil.vendor.map(v => v.vendor_nama)).toEqual(['Agro', 'Djafafood', 'Belum tercatat'])
    const dj = hasil.vendor[1]
    expect(dj.nilai).toBe(500)
    expect(dj.bahan).toHaveLength(1)
    expect(dj.bahan[0]).toMatchObject({ bahan_nama: 'SAPI', qty: 5, nilai: 500 })
    expect(dj.bahan[0].outlet).toHaveLength(2)
    expect(hasil.vendor[2].nilai).toBe(0)
  })
})
