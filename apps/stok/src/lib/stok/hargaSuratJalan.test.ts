import { describe, expect, it } from 'vitest'
import {
  hargaKecilDariNilai,
  hargaKecilWajar,
  nilaiBarisRp,
  nilaiDokumenSuratJalan,
  ringkasItemSuratJalan,
} from './hargaSuratJalan'

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

  it('tanpa harga snapshot: hargaBesar null', () => {
    expect(ringkasItemSuratJalan([{ vendor: null, harga_snapshot: null, qty_dikirim: 5 }]).hargaBesar).toBeNull()
  })
})

describe('nilaiDokumenSuratJalan', () => {
  const item = { vendor: 'X', harga_snapshot: 100, qty_dikirim: 10, qty_terima: 8 }

  it('keluar = qty dikirim x harga', () => {
    expect(nilaiDokumenSuratJalan([item], 'transfer_keluar')).toBe(1000)
  })

  it('terima = qty diterima x harga', () => {
    expect(nilaiDokumenSuratJalan([item], 'terima_kiriman')).toBe(800)
  })

  it('ditolak = selisih dikirim - diterima', () => {
    expect(nilaiDokumenSuratJalan([item], 'rejected_kiriman')).toBe(200)
  })

  it('qty_terima kosong (belum diverifikasi) = qty dikirim', () => {
    expect(nilaiDokumenSuratJalan([{ ...item, qty_terima: null }], 'terima_kiriman')).toBe(1000)
  })

  it('ada bagian tanpa harga: null (jatuh ke master)', () => {
    expect(
      nilaiDokumenSuratJalan([item, { vendor: 'Y', harga_snapshot: 0, qty_dikirim: 2, qty_terima: 2 }], 'terima_kiriman')
    ).toBeNull()
  })
})

describe('hargaKecilDariNilai — tahan terhadap ganti definisi satuan', () => {
  it('FOIL 5M dikirim saat 1 Dus = 36.480 cm @ Rp641.391,36 -> Rp17,58/cm, bukan dibagi 24.000', () => {
    const nilai = nilaiDokumenSuratJalan(
      [{ vendor: 'Altindo', harga_snapshot: 641391.36, qty_dikirim: 1, qty_terima: 1 }],
      'terima_kiriman'
    )
    const perCm = hargaKecilDariNilai(nilai, 36480)!
    expect(perCm).toBeCloseTo(17.582, 3)
    // Dinyatakan dalam Dus sekarang (24.000 cm): harga Altindo yang sebenarnya.
    expect(perCm * 24000).toBeCloseTo(421968, 0)
  })

  it('nilai/qty tak valid -> null', () => {
    expect(hargaKecilDariNilai(null, 100)).toBeNull()
    expect(hargaKecilDariNilai(500, 0)).toBeNull()
  })
})

describe('nilaiBarisRp', () => {
  const masterKecil = 95000 / 2000

  it('pakai harga per satuan kecil dokumen bila ada (5 Blok TIS @105.000)', () => {
    expect(nilaiBarisRp(-10000, 105000 / 2000, masterKecil)).toBe(525000)
  })

  it('tanpa harga dokumen: harga master', () => {
    expect(nilaiBarisRp(-10000, null, masterKecil)).toBe(475000)
  })
})

describe('hargaKecilWajar', () => {
  const master = 421977.6 / 24000 // FOIL 5M per cm

  it('harga wajar (selisih vendor biasa) dipakai', () => {
    expect(hargaKecilWajar(master * 1.4, master)).toBeCloseTo(master * 1.4, 6)
  })

  it('dokumen salah satuan (FOIL per roll vs Dus, ~1,4%) -> null, pakai master', () => {
    expect(hargaKecilWajar(master * 0.014, master)).toBeNull()
  })

  it('terlalu mahal (>3x) -> null', () => {
    expect(hargaKecilWajar(master * 3.5, master)).toBeNull()
  })

  it('BAWANG PUTIH BUBUK sachet 2,4x master tetap dipakai', () => {
    expect(hargaKecilWajar(154.32, 65)).toBeCloseTo(154.32, 6)
  })

  it('master tak ada: harga dokumen apa adanya', () => {
    expect(hargaKecilWajar(10, 0)).toBe(10)
  })
})
