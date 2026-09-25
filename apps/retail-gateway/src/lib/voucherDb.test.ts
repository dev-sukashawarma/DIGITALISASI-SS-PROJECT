import { describe, it, expect, vi } from 'vitest'
import { normalisasiVoucher, normalisasiKode, nilaiVoucher } from './voucherDb'

const baris = {
  id: 'v1', nama: 'Uji', deskripsi: null, kode: 'HEMAT', jenis: 'nominal', nilai: '5000', maks_potongan: null,
  menu_item_id: null, beli_qty: null, gratis_qty: null, harga_spesial: null, mulai: null, selesai: null,
  kuota_total: 10, batas_per_pelanggan: null, min_belanja: '20000', khusus_pesanan_pertama: false,
  outlet_ids: null, hari: null, jam_mulai: null, jam_selesai: null, menu_ids: null, kategori_ids: null, is_active: true,
}

describe('normalisasi', () => {
  it('numeric string jadi number', () => {
    const v = normalisasiVoucher(baris)
    expect(v.nilai).toBe(5000)
    expect(v.min_belanja).toBe(20000)
    expect(v.maks_potongan).toBeNull()
  })
  it('kode', () => expect(normalisasiKode('  hemat10 ')).toBe('HEMAT10'))
})

/** Klien palsu: `from(tabel)` mengembalikan rantai yang berakhir ke `hasil[tabel]`. */
function klien(hasil: Record<string, unknown>) {
  const rantai = (tabel: string): any => {
    const r: any = {}
    for (const f of ['select', 'eq', 'is', 'not', 'in', 'limit']) r[f] = vi.fn(() => r)
    r.maybeSingle = vi.fn(async () => hasil[tabel])
    r.then = (ok: (x: unknown) => unknown) => Promise.resolve(hasil[tabel + ':count'] ?? { count: 0, error: null }).then(ok)
    return r
  }
  return { from: vi.fn(rantai) } as any
}

describe('nilaiVoucher', () => {
  const dasar = { customerId: 'c1', outletId: 'o1', items: [{ menu_item_id: 'A', name: 'A', unit_price: 30000, quantity: 1 }],
    katalog: [{ id: 'A', name: 'A', description: null, price: 30000, image_url: null, is_available: true, category_id: null, sort_order: null, category_name: null, category_sort_order: null }],
    sekarang: new Date('2026-09-24T08:00:00Z') }
  it('tanpa pilihan → ada:false', async () => {
    expect(await nilaiVoucher({ retail: klien({}), pilih: {}, ...dasar })).toEqual({ ada: false })
  })
  it('kode tak dikenal → voucher null + alasan', async () => {
    const r = await nilaiVoucher({ retail: klien({ vouchers: { data: null, error: null } }), pilih: { kodeVoucher: 'x' }, ...dasar })
    expect(r).toEqual({ ada: true, voucher: null, hasil: { berlaku: false, alasan: 'Kode voucher tidak ditemukan' } })
  })
  it('voucher ditemukan → dihitung', async () => {
    const r = await nilaiVoucher({ retail: klien({ vouchers: { data: baris, error: null } }), pilih: { voucherId: 'v1' }, ...dasar })
    expect(r).toMatchObject({ ada: true, hasil: { berlaku: true, potongan: 5000 } })
  })
  it('galat DB dilempar', async () => {
    await expect(nilaiVoucher({ retail: klien({ vouchers: { data: null, error: { message: 'mati' } } }), pilih: { voucherId: 'v1' }, ...dasar }))
      .rejects.toThrow('mati')
  })
})
