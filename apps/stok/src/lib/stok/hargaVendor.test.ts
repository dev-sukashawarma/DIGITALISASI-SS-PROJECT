import { describe, it, expect } from 'vitest'
import { hitungHargaVendor, nilaiBaris, type BarisKatalogVendor } from './hargaVendor'

const base: BarisKatalogVendor = {
  id: 'a', bahan_baku_id: 'sapi', vendor_induk: 'dj', harga: 101978,
  isi_satuan_kecil: 1000, is_active: true, harga_updated_at: '2026-09-20T00:00:00Z', faktor: 1000,
}

describe('hitungHargaVendor', () => {
  it('konversi ke satuan besar: harga × faktor / isi', () => {
    // FOIL Ekadharma: 11.554 per roll isi 760 cm, 1 Dus = 36.480 cm → 554.592
    const foil = { ...base, bahan_baku_id: 'foil', vendor_induk: 'eka', harga: 11554, isi_satuan_kecil: 760, faktor: 36480 }
    expect(hitungHargaVendor([foil]).foil.eka).toBeCloseTo(554592, 6)
  })
  it('lewati baris nonaktif / harga 0 / isi kosong / faktor kosong', () => {
    const r = hitungHargaVendor([
      { ...base, is_active: false },
      { ...base, vendor_induk: 'b', harga: 0 },
      { ...base, vendor_induk: 'c', isi_satuan_kecil: null },
      { ...base, vendor_induk: 'd', faktor: 0 },
    ])
    expect(r).toEqual({})
  })
  it('satu induk dua baris: harga_updated_at terbaru menang, NULL kalah', () => {
    const r = hitungHargaVendor([
      { ...base, id: 'x', harga: 90000, harga_updated_at: null },
      { ...base, id: 'y', harga: 100000, harga_updated_at: '2026-09-01T00:00:00Z' },
      { ...base, id: 'z', harga: 105000, harga_updated_at: '2026-09-22T00:00:00Z' },
    ])
    expect(r.sapi.dj).toBe(105000)
  })
  it('tanggal sama: id terkecil menang', () => {
    const r = hitungHargaVendor([{ ...base, id: 'b', harga: 2000 }, { ...base, id: 'a', harga: 1000 }])
    expect(r.sapi.dj).toBe(1000)
  })
})

describe('nilaiBaris', () => {
  const hv = { dj: 101978, az: 100000 }
  it('tanpa alokasi → harga master', () => {
    expect(nilaiBaris(2, undefined, hv, 110000)).toBe(220000)
  })
  it('alokasi satu vendor → harga vendor', () => {
    expect(nilaiBaris(2, [{ vendor_id: 'dj', qty: 2 }], hv, 110000)).toBe(203956)
  })
  it('pecah dua vendor', () => {
    expect(nilaiBaris(3, [{ vendor_id: 'dj', qty: 1 }, { vendor_id: 'az', qty: 2 }], hv, 110000)).toBe(301978)
  })
  it('vendor tanpa harga katalog → porsinya pakai master', () => {
    expect(nilaiBaris(2, [{ vendor_id: 'lain', qty: 2 }], hv, 110000)).toBe(220000)
  })
  it('tak ada harga sama sekali → null', () => {
    expect(nilaiBaris(2, undefined, undefined, undefined)).toBeNull()
  })
})
