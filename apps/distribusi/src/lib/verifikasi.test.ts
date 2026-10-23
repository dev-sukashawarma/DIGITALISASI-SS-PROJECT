import { describe, expect, it } from 'vitest'
import { galatVerifikasi, qtyDasar, qtyDistribusi, type IsianPenerimaan } from './verifikasi'

const baik: IsianPenerimaan = { qty_terima: 10, kondisi: 'baik', catatan: '', foto_path: 'sj/i.jpg' }

describe('penerimaan presisi dan validasi akhir', () => {
  it.each([0.91, 0.4, 1 / 24])('Sesuai Kirim mempertahankan qty dasar %s', qty => {
    const factor = 24
    const tampil = qtyDistribusi(qty, factor)
    expect(qtyDasar(tampil, qty, factor)).toBe(qty)
    expect(galatVerifikasi({ ...baik, qty_terima: tampil }, tampil)).toBeNull()
  })
  it.each(['', -1, 11, NaN, Infinity])('finalisasi menolak qty %s setelah isian berubah', qty => {
    expect(galatVerifikasi({ ...baik, qty_terima: qty as number | '' }, 10)).not.toBeNull()
  })
  it('tidak mengubah 0,91 dan 0,40 menjadi satu atau nol', () => {
    expect(qtyDistribusi(0.91, 1)).toBe(0.91)
    expect(qtyDistribusi(0.4, 1)).toBe(0.4)
  })
  it('foto dan catatan wajib, nol hanya untuk tidak sesuai', () => {
    expect(galatVerifikasi(undefined, 10)).not.toBeNull()
    expect(galatVerifikasi({ ...baik, foto_path: null }, 10)).not.toBeNull()
    expect(galatVerifikasi({ ...baik, qty_terima: 0 }, 10)).not.toBeNull()
    expect(galatVerifikasi({ ...baik, qty_terima: 0, kondisi: 'tidak_sesuai', catatan: 'tidak tiba' }, 10)).toBeNull()
    expect(galatVerifikasi({ ...baik, kondisi: 'tidak_sesuai' }, 10)).not.toBeNull()
  })
})
