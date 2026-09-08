import { describe, it, expect } from 'vitest'
import { isSuspiciousZero, collectSuspiciousZeros } from './zeroGuard'

// Angka diambil dari kejadian nyata 5-7 September 2026: tiga outlet mengetik
// "0 Roll" untuk FOIL saat opname, menghapus stok yang sebenarnya masih ada
// (Pajajaran 75 Roll = 57.055 cm). Lihat CLAUDE.md sesi 2026-09-08.

describe('isSuspiciousZero — nol yang perlu dikonfirmasi ulang', () => {
  it('FOIL Pajajaran: fisik 0 sementara sistem 57.055 cm (75 Roll) -> perlu konfirmasi', () => {
    expect(isSuspiciousZero(0, 57005, 760)).toBe(true)
  })

  it('sisa di bawah 1 satuan menengah tidak mengganggu: sistem 500 cm (<1 Roll)', () => {
    expect(isSuspiciousZero(0, 500, 760)).toBe(false)
  })

  it('tepat 1 satuan menengah sudah dihitung berarti (batas ambang)', () => {
    expect(isSuspiciousZero(0, 760, 760)).toBe(true)
  })

  it('sistem minus tidak perlu konfirmasi — mengisi 0 justru memperbaiki', () => {
    expect(isSuspiciousZero(0, -2660, 760)).toBe(false)
  })

  it('sistem sudah nol: tidak ada yang terhapus', () => {
    expect(isSuspiciousZero(0, 0, 760)).toBe(false)
  })

  it('fisik terisi (bukan nol) tidak pernah diflag', () => {
    expect(isSuspiciousZero(12, 57005, 760)).toBe(false)
  })

  it('POLYBAG (2 tingkat, faktor 9): 9 Pcs diflag, 8 Pcs tidak', () => {
    expect(isSuspiciousZero(0, 9, 9)).toBe(true)
    expect(isSuspiciousZero(0, 8, 9)).toBe(false)
  })

  it('tanpa faktor konversi, ambangnya 1 satuan', () => {
    expect(isSuspiciousZero(0, 1, null)).toBe(true)
    expect(isSuspiciousZero(0, 0.5, null)).toBe(false)
    expect(isSuspiciousZero(0, 3, 0)).toBe(true)
  })
})

describe('collectSuspiciousZeros — menyaring daftar item opname', () => {
  const items = [
    { bahanId: 'foil', nama: 'FOIL', qtyFisik: 0, qtySystem: 57005, faktorKonversi: 760 },
    { bahanId: 'gas', nama: 'GAS 3Kg', qtyFisik: 0, qtySystem: 330, faktorKonversi: 3000 },
    { bahanId: 'ayam', nama: 'AYAM', qtyFisik: 4000, qtySystem: 4444, faktorKonversi: 1000 },
    { bahanId: 'tutup', nama: 'TUTUP PACK', qtyFisik: 0, qtySystem: 2280, faktorKonversi: 1000 },
  ]

  it('hanya mengembalikan item yang nol-nya mencurigakan, urutan dipertahankan', () => {
    expect(collectSuspiciousZeros(items).map((i) => i.nama)).toEqual(['FOIL', 'TUTUP PACK'])
  })

  it('daftar kosong kalau tidak ada yang mencurigakan', () => {
    expect(collectSuspiciousZeros([items[1], items[2]])).toEqual([])
  })
})
