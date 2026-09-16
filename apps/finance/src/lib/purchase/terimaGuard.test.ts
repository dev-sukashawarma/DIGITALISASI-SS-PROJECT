import { describe, it, expect } from 'vitest'
import { cekTerima, stokSetelahTerima, AMBANG_LOMPATAN_STOK } from './terimaGuard'

const jenis = (w: ReturnType<typeof cekTerima>) => w.map((x) => x.jenis)

describe('cekTerima - dua kejadian nyata 16 Sep 2026', () => {
  it('KULIT 32: stok 2 Pack, diinput 77 Pack (38x) -> lompatan_stok', () => {
    const w = cekTerima({ qtyDatang: 77, qtyPesan: 300, qtyTerimaSebelumnya: 0, stokGudangBesar: 2 })
    expect(jenis(w)).toEqual(['lompatan_stok'])
    expect(w[0]).toMatchObject({ jenis: 'lompatan_stok', rasio: 38.5 })
  })

  it('TEPUNG: stok 136 Kg, diinput 100 Kg tapi pesanan sudah penuh -> melebihi_pesanan', () => {
    const w = cekTerima({ qtyDatang: 100, qtyPesan: 100, qtyTerimaSebelumnya: 100, stokGudangBesar: 136 })
    expect(jenis(w)).toEqual(['melebihi_pesanan'])
    expect(w[0]).toMatchObject({ jenis: 'melebihi_pesanan', kelebihan: 100 })
  })
})

describe('cekTerima - jalur mayoritas tidak boleh berisik', () => {
  it('kiriman bertahap wajar (SAPI 200 dari sisa 300, stok 150) -> nol peringatan', () => {
    expect(cekTerima({ qtyDatang: 200, qtyPesan: 1000, qtyTerimaSebelumnya: 500, stokGudangBesar: 150 })).toEqual([])
  })

  it('terima pas sejumlah pesanan -> nol peringatan', () => {
    expect(cekTerima({ qtyDatang: 20, qtyPesan: 20, qtyTerimaSebelumnya: 0, stokGudangBesar: 5 })).toEqual([])
  })

  it('restock saat gudang benar-benar kosong bukan anomali', () => {
    expect(cekTerima({ qtyDatang: 500, qtyPesan: 500, qtyTerimaSebelumnya: 0, stokGudangBesar: 0 })).toEqual([])
  })

  it('stok belum termuat (null) -> aturan lompatan dilewati, bukan ditebak', () => {
    expect(cekTerima({ qtyDatang: 500, qtyPesan: 500, qtyTerimaSebelumnya: 0, stokGudangBesar: null })).toEqual([])
  })

  it('qty 0 (barang tidak datang) -> nol peringatan', () => {
    expect(cekTerima({ qtyDatang: 0, qtyPesan: 300, qtyTerimaSebelumnya: 0, stokGudangBesar: 1 })).toEqual([])
  })

  it('tepat di ambang belum memicu, sedikit di atasnya memicu', () => {
    const tepat = cekTerima({ qtyDatang: 10 * AMBANG_LOMPATAN_STOK, qtyPesan: 999, qtyTerimaSebelumnya: 0, stokGudangBesar: 10 })
    expect(jenis(tepat)).toEqual([])
    const lewat = cekTerima({ qtyDatang: 10 * AMBANG_LOMPATAN_STOK + 1, qtyPesan: 999, qtyTerimaSebelumnya: 0, stokGudangBesar: 10 })
    expect(jenis(lewat)).toEqual(['lompatan_stok'])
  })

  it('kelebihan recehan dari pembulatan float tidak dianggap melebihi pesanan', () => {
    expect(cekTerima({ qtyDatang: 0.1 + 0.2, qtyPesan: 0.3, qtyTerimaSebelumnya: 0, stokGudangBesar: 5 })).toEqual([])
  })

  it('dua aturan bisa menyala bersamaan', () => {
    const w = cekTerima({ qtyDatang: 90, qtyPesan: 10, qtyTerimaSebelumnya: 5, stokGudangBesar: 1 })
    expect(jenis(w).sort()).toEqual(['lompatan_stok', 'melebihi_pesanan'])
  })
})

describe('stokSetelahTerima', () => {
  it('menjumlahkan stok berjalan dengan qty yang datang', () => {
    expect(stokSetelahTerima(2, 77)).toBe(79)
  })

  it('stok tak diketahui tetap tak diketahui, bukan 0', () => {
    expect(stokSetelahTerima(null, 77)).toBeNull()
  })
})
