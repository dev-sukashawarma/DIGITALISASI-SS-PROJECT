import { describe, expect, it } from 'vitest'
import { nilaiBarisRp, ringkasItemSuratJalan } from './hargaSuratJalan'

describe('ringkasItemSuratJalan', () => {
  it('satu baris: vendor & harga snapshot apa adanya', () => {
    expect(
      ringkasItemSuratJalan([{ vendor: 'Sapi Warna', harga_snapshot: 95000, qty_dikirim: 5 }])
    ).toEqual({ vendor: 'Sapi Warna', hargaBesar: 95000 })
  })

  it('dipecah dua vendor: label digabung, harga rata-rata tertimbang qty', () => {
    expect(
      ringkasItemSuratJalan([
        { vendor: 'TIS FOOD', harga_snapshot: 105000, qty_dikirim: 3 },
        { vendor: 'Sapi Warna', harga_snapshot: 95000, qty_dikirim: 1 },
      ])
    ).toEqual({ vendor: 'TIS FOOD + Sapi Warna', hargaBesar: 102500 })
  })

  it('vendor yang sama tidak diulang', () => {
    expect(
      ringkasItemSuratJalan([
        { vendor: 'TIS FOOD', harga_snapshot: 105000, qty_dikirim: 2 },
        { vendor: 'TIS FOOD', harga_snapshot: 105000, qty_dikirim: 2 },
      ]).vendor
    ).toBe('TIS FOOD')
  })

  it('tanpa harga snapshot: hargaBesar null (jatuh ke harga master)', () => {
    expect(
      ringkasItemSuratJalan([{ vendor: null, harga_snapshot: null, qty_dikirim: 5 }])
    ).toEqual({ vendor: null, hargaBesar: null })
    expect(
      ringkasItemSuratJalan([{ vendor: 'X', harga_snapshot: 0, qty_dikirim: 5 }]).hargaBesar
    ).toBeNull()
  })

  it('qty kosong semua: rata-rata biasa, bukan bagi nol', () => {
    expect(
      ringkasItemSuratJalan([
        { vendor: 'A', harga_snapshot: 100, qty_dikirim: 0 },
        { vendor: 'B', harga_snapshot: 200, qty_dikirim: null },
      ]).hargaBesar
    ).toBe(150)
  })

  it('daftar kosong', () => {
    expect(ringkasItemSuratJalan([])).toEqual({ vendor: null, hargaBesar: null })
  })
})

describe('nilaiBarisRp', () => {
  // SAPI: 1 Blok = 2000 gram, master Rp 95.000/Blok -> Rp 47,5/gram
  const kemasan = 2000
  const masterKecil = 95000 / 2000

  it('pakai harga surat jalan bila ada (5 Blok TIS FOOD @105.000)', () => {
    expect(nilaiBarisRp(-10000, 105000, kemasan, masterKecil)).toBe(525000)
  })

  it('tanpa harga surat jalan: harga master', () => {
    expect(nilaiBarisRp(-10000, null, kemasan, masterKecil)).toBe(475000)
  })

  it('kemasan tidak valid: harga besar dipakai per unit', () => {
    expect(nilaiBarisRp(3, 1000, 0, 7)).toBe(3000)
  })
})
