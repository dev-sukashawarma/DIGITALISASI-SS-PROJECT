import { describe, it, expect } from 'vitest'
import {
  kelompokkanKatalog,
  ringkasKatalog,
  validasiBarisKatalog,
  type BarisKatalogVendor,
} from './katalogGroup'

const baris = (o: Partial<BarisKatalogVendor>): BarisKatalogVendor => ({
  id: 'row-1',
  bahan_baku_id: 'b1',
  bahan: 'FOIL',
  satuan: 'Dus',
  satuan_po: 'roll',
  faktor_po: 760,
  supplier_id: 's1',
  supplier_nama: 'Vendor A',
  termin_hari: null,
  satuan_beli: 'Dus',
  isi_satuan_kecil: 36480,
  harga: 0,
  is_active: true,
  perlu_ditinjau: true,
  sumber: 'po',
  harga_updated_at: null,
  harga_master_per_kecil: null,
  ...o,
})

describe('kelompokkanKatalog', () => {
  it('daftar kosong -> kelompok kosong', () => {
    expect(kelompokkanKatalog([])).toEqual([])
  })

  it('mengelompokkan per bahan dan mengurutkan menurut nama bahan', () => {
    const hasil = kelompokkanKatalog([
      baris({ id: 'r1', bahan_baku_id: 'b2', bahan: 'SAPI', supplier_id: 's1' }),
      baris({ id: 'r2', bahan_baku_id: 'b1', bahan: 'FOIL', supplier_id: 's1' }),
      baris({ id: 'r3', bahan_baku_id: 'b1', bahan: 'FOIL', supplier_id: 's2' }),
    ])

    expect(hasil.map((k) => k.bahan)).toEqual(['FOIL', 'SAPI'])
    expect(hasil[0].vendors).toHaveLength(2)
    expect(hasil[1].vendors).toHaveLength(1)
  })

  it('mempertahankan kolom yang tidak dikenal setarakanHargaAntarVendor', () => {
    const hasil = kelompokkanKatalog([
      baris({ id: 'r9', supplier_id: 's7', supplier_nama: 'Ekadharma', termin_hari: 21, sumber: 'manual' }),
    ])

    const v = hasil[0].vendors[0]
    expect(v.id).toBe('r9')
    expect(v.supplier_nama).toBe('Ekadharma')
    expect(v.termin_hari).toBe(21)
    expect(v.sumber).toBe('manual')
  })

  it('dua vendor berharga -> bisaDibandingkan true dan selisih terhitung', () => {
    // Ekadharma per Roll (760 cm) vs Altindo per Dus (36.480 cm), harga setara
    const hasil = kelompokkanKatalog([
      baris({ id: 'r1', supplier_id: 'eka', supplier_nama: 'Ekadharma',
              satuan_beli: 'Roll', isi_satuan_kecil: 760, harga: 8791.2, perlu_ditinjau: false }),
      baris({ id: 'r2', supplier_id: 'alt', supplier_nama: 'Altindo',
              satuan_beli: 'Dus', isi_satuan_kecil: 36480, harga: 421977.6, perlu_ditinjau: false }),
    ])

    expect(hasil[0].jumlahVendor).toBe(2)
    expect(hasil[0].jumlahBerharga).toBe(2)
    expect(hasil[0].bisaDibandingkan).toBe(true)
    for (const v of hasil[0].vendors) {
      expect(v.hargaPerSatuanKecil).toBeCloseTo(11.5674, 4)
      expect(v.selisihPersen).toBeCloseTo(0, 6)
    }
  })

  it('satu berharga satu kosong -> bisaDibandingkan false', () => {
    const hasil = kelompokkanKatalog([
      baris({ id: 'r1', bahan: 'KENTANG', supplier_id: 'agro',
              isi_satuan_kecil: 10000, harga: 250000, perlu_ditinjau: false }),
      baris({ id: 'r2', bahan: 'KENTANG', supplier_id: 'indoboga',
              isi_satuan_kecil: 10000, harga: 0 }),
    ])

    expect(hasil[0].jumlahVendor).toBe(2)
    expect(hasil[0].jumlahBerharga).toBe(1)
    expect(hasil[0].bisaDibandingkan).toBe(false)
  })

  it('membawa harga master per satuan kecil ke tingkat kelompok', () => {
    const hasil = kelompokkanKatalog([
      baris({ id: 'r1', supplier_id: 's1', harga_master_per_kecil: 11.5674 }),
      baris({ id: 'r2', supplier_id: 's2', harga_master_per_kecil: 11.5674 }),
    ])

    expect(hasil[0].hargaMasterPerKecil).toBeCloseTo(11.5674, 4)
  })

  it('harga master belum diisi -> null, bukan 0', () => {
    const hasil = kelompokkanKatalog([baris({ harga_master_per_kecil: null })])
    expect(hasil[0].hargaMasterPerKecil).toBeNull()
  })

  it('baris perlu_ditinjau tidak dihitung sebagai berharga meski harganya terisi', () => {
    const hasil = kelompokkanKatalog([
      baris({ id: 'r1', supplier_id: 's1', harga: 999, perlu_ditinjau: true }),
      baris({ id: 'r2', supplier_id: 's2', harga: 111, perlu_ditinjau: false, isi_satuan_kecil: 10 }),
    ])

    expect(hasil[0].jumlahBerharga).toBe(1)
    expect(hasil[0].bisaDibandingkan).toBe(false)
  })
})

describe('ringkasKatalog', () => {
  it('menghitung baris, yang perlu diisi, dan bahan yang bisa dibandingkan', () => {
    const kelompok = kelompokkanKatalog([
      baris({ id: 'r1', bahan_baku_id: 'b1', bahan: 'FOIL', supplier_id: 's1', harga: 100, isi_satuan_kecil: 10, perlu_ditinjau: false }),
      baris({ id: 'r2', bahan_baku_id: 'b1', bahan: 'FOIL', supplier_id: 's2', harga: 120, isi_satuan_kecil: 10, perlu_ditinjau: false }),
      baris({ id: 'r3', bahan_baku_id: 'b2', bahan: 'SAPI', supplier_id: 's3', harga: 0 }),
    ])

    expect(ringkasKatalog(kelompok)).toEqual({
      totalBaris: 3,
      terpercaya: 2,
      perluDiisi: 1,
      bahanMultivendor: 1,
      bisaDibandingkan: 1,
    })
  })

  it('kelompok kosong -> semua nol', () => {
    expect(ringkasKatalog([])).toEqual({
      totalBaris: 0,
      terpercaya: 0,
      perluDiisi: 0,
      bahanMultivendor: 0,
      bisaDibandingkan: 0,
    })
  })
})

describe('validasiBarisKatalog', () => {
  it('input sehat -> null', () => {
    expect(validasiBarisKatalog({ harga: 1000, isi_satuan_kecil: 20, satuan_beli: 'Pack' })).toBeNull()
  })

  it('satuan beli kosong ditolak', () => {
    expect(validasiBarisKatalog({ harga: 1000, isi_satuan_kecil: 20, satuan_beli: '  ' }))
      .toBe('Satuan beli wajib diisi.')
  })

  it('isi satuan kecil harus lebih dari nol', () => {
    expect(validasiBarisKatalog({ harga: 1000, isi_satuan_kecil: 0, satuan_beli: 'Pack' }))
      .toBe('Isi satuan kecil harus lebih dari 0.')
  })

  it('isi satuan kecil NaN ditolak -- Postgres meloloskannya lewat CHECK', () => {
    expect(validasiBarisKatalog({ harga: 1000, isi_satuan_kecil: NaN, satuan_beli: 'Pack' }))
      .toBe('Isi satuan kecil harus lebih dari 0.')
  })

  it('harga negatif ditolak', () => {
    expect(validasiBarisKatalog({ harga: -1, isi_satuan_kecil: 20, satuan_beli: 'Pack' }))
      .toBe('Harga tidak boleh negatif.')
  })

  it('harga nol diperbolehkan -- artinya belum diisi', () => {
    expect(validasiBarisKatalog({ harga: 0, isi_satuan_kecil: 20, satuan_beli: 'Pack' })).toBeNull()
  })
})
