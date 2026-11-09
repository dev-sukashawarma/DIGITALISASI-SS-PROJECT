import { describe, it, expect } from 'vitest'
import {
  konversiKeSatuanKecil,
  bolehPrefill,
  setarakanHargaAntarVendor,
  type BarisKatalog,
} from './katalogVendor'

const baris = (o: Partial<BarisKatalog>): BarisKatalog => ({
  supplier_id: 's1',
  supplier_nama: 'Vendor A',
  satuan_beli: 'Dus',
  isi_satuan_kecil: 36480,
  harga: 421977.6,
  is_active: true,
  perlu_ditinjau: false,
  ...o,
})

describe('konversiKeSatuanKecil', () => {
  it('mengalikan qty dengan isi satuan kecil', () => {
    expect(konversiKeSatuanKecil(2, 760)).toBe(1520)
  })

  it('qty nol tetap nol', () => {
    expect(konversiKeSatuanKecil(0, 760)).toBe(0)
  })

  it('isi tidak sah -> null, bukan diam-diam qty apa adanya', () => {
    expect(konversiKeSatuanKecil(2, 0)).toBeNull()
    expect(konversiKeSatuanKecil(2, -1)).toBeNull()
  })
})

describe('bolehPrefill', () => {
  it('baris sehat boleh', () => {
    expect(bolehPrefill(baris({}))).toBe(true)
  })

  it('perlu ditinjau -> tidak boleh', () => {
    expect(bolehPrefill(baris({ perlu_ditinjau: true }))).toBe(false)
  })

  it('nonaktif -> tidak boleh', () => {
    expect(bolehPrefill(baris({ is_active: false }))).toBe(false)
  })

  it('harga nol -> tidak boleh', () => {
    expect(bolehPrefill(baris({ harga: 0 }))).toBe(false)
  })
})

describe('setarakanHargaAntarVendor', () => {
  it('menyetarakan vendor yang satuan belinya berbeda', () => {
    // Ekadharma per Roll (760 cm) vs Altindo per Dus (36.480 cm)
    const hasil = setarakanHargaAntarVendor([
      baris({ supplier_id: 'eka', supplier_nama: 'Ekadharma',
              satuan_beli: 'Roll', isi_satuan_kecil: 760, harga: 8791.2 }),
      baris({ supplier_id: 'alt', supplier_nama: 'Altindo',
              satuan_beli: 'Dus', isi_satuan_kecil: 36480, harga: 421977.6 }),
    ])

    // Sengaja TIDAK menguji urutannya: kedua harga setara secara matematis,
    // jadi mana yang dianggap termurah bergantung galat pembulatan float.
    const eka = hasil.find(h => h.supplier_id === 'eka')!
    const alt = hasil.find(h => h.supplier_id === 'alt')!

    expect(hasil).toHaveLength(2)
    expect(eka.hargaPerSatuanKecil).toBeCloseTo(11.5674, 4)
    expect(alt.hargaPerSatuanKecil).toBeCloseTo(11.5674, 4)
    expect(eka.selisihPersen).toBeCloseTo(0, 6)
    expect(alt.selisihPersen).toBeCloseTo(0, 6)
  })

  it('mengurutkan termurah lebih dulu dan menghitung selisih terhadapnya', () => {
    const hasil = setarakanHargaAntarVendor([
      baris({ supplier_id: 'mahal', harga: 110, isi_satuan_kecil: 1 }),
      baris({ supplier_id: 'murah', harga: 100, isi_satuan_kecil: 1 }),
    ])

    expect(hasil[0].supplier_id).toBe('murah')
    expect(hasil[0].selisihPersen).toBe(0)
    expect(hasil[1].selisihPersen).toBeCloseTo(10, 6)
  })

  it('baris perlu ditinjau tetap tampil tapi tidak jadi acuan termurah', () => {
    const hasil = setarakanHargaAntarVendor([
      baris({ supplier_id: 'ragu', harga: 1, isi_satuan_kecil: 1, perlu_ditinjau: true }),
      baris({ supplier_id: 'sah', harga: 100, isi_satuan_kecil: 1 }),
    ])

    expect(hasil.find(h => h.supplier_id === 'ragu')).toBeDefined()
    expect(hasil.find(h => h.supplier_id === 'sah')!.selisihPersen).toBe(0)
    expect(hasil.find(h => h.supplier_id === 'ragu')!.selisihPersen).toBeNull()
  })

  it('tidak ada baris sah -> semua selisih null, tidak melempar', () => {
    const hasil = setarakanHargaAntarVendor([
      baris({ supplier_id: 'a', perlu_ditinjau: true }),
    ])
    expect(hasil[0].selisihPersen).toBeNull()
  })

  it('daftar kosong -> array kosong', () => {
    expect(setarakanHargaAntarVendor([])).toEqual([])
  })
})
