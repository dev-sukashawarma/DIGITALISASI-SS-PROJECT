import { describe, it, expect } from 'vitest'
import { saldoAwalOutlet, gabungPosisiOutlet, type PosisiOutletBahan } from './rekonsiliasiOutlet'

const pos = (p: Partial<PosisiOutletBahan>): PosisiOutletBahan => ({
  saldoAwal: 0,
  masuk: 0,
  pakai: 0,
  waste: 0,
  mutasiLain: 0,
  fisik: null,
  ...p,
})

describe('saldoAwalOutlet', () => {
  it('hitungan fisik opname sebelumnya menang', () => {
    expect(saldoAwalOutlet(120, 999)).toBe(120)
    expect(saldoAwalOutlet(0, 999)).toBe(0)
  })

  it('opname sebelumnya ada tapi bahan ini tidak dihitung (null) -> saldo ledger, bukan 0', () => {
    expect(saldoAwalOutlet(null, 450)).toBe(450)
    expect(saldoAwalOutlet(undefined, 450)).toBe(450)
  })

  it('tanpa keduanya -> 0', () => {
    expect(saldoAwalOutlet(undefined, null)).toBe(0)
  })
})

describe('gabungPosisiOutlet', () => {
  it('outlet tunggal: rumus lama (sistem = awal + masuk - pakai - waste + lain; selisih = fisik - sistem)', () => {
    const g = gabungPosisiOutlet([pos({ saldoAwal: 100, masuk: 50.333, pakai: 30, waste: 5, mutasiLain: -2, fisik: 110 })])
    expect(g.stokSistem).toBe(113.33)
    expect(g.stokSistemTerhitung).toBe(113.33)
    expect(g.stokFisik).toBe(110)
    expect(g.selisih).toBe(-3.33)
    expect(g.outletOpname).toBe(1)
    expect(g.outletTotal).toBe(1)
  })

  it('outlet tunggal tanpa opname: fisik null, selisih 0', () => {
    const g = gabungPosisiOutlet([pos({ saldoAwal: 10, pakai: 3 })])
    expect(g.stokSistem).toBe(7)
    expect(g.stokFisik).toBeNull()
    expect(g.stokSistemTerhitung).toBeNull()
    expect(g.selisih).toBe(0)
    expect(g.outletOpname).toBe(0)
  })

  it('semua outlet: stok outlet yang tidak opname tetap terlihat di sistem, tapi TIDAK masuk selisih', () => {
    const g = gabungPosisiOutlet([
      pos({ saldoAwal: 1000, pakai: 200, fisik: 790 }), // A opname: sistem 800 -> selisih -10
      pos({ saldoAwal: 5000, pakai: 500 }), // B (mis. BNR) tidak opname: sistem 4500
      pos({ saldoAwal: 300, masuk: 100, fisik: 405 }), // C opname: sistem 400 -> selisih +5
    ])
    expect(g.stokSistem).toBe(5700)
    expect(g.stokSistemTerhitung).toBe(1200)
    expect(g.stokFisik).toBe(1195)
    expect(g.selisih).toBe(-5) // dulu: 1195 - 5700 = -4505 (stok B dianggap hilang)
    expect(g.outletOpname).toBe(2)
    expect(g.outletTotal).toBe(3)
  })

  it('kolom mutasi dijumlah dari semua outlet', () => {
    const g = gabungPosisiOutlet([
      pos({ saldoAwal: 1, masuk: 2, pakai: 3, waste: 4, mutasiLain: 5 }),
      pos({ saldoAwal: 10, masuk: 20, pakai: 30, waste: 40, mutasiLain: -50 }),
    ])
    expect(g).toMatchObject({ saldoAwal: 11, masuk: 22, pakai: 33, waste: 44, mutasiLain: -45 })
  })

  it('daftar kosong -> semua nol, tanpa opname', () => {
    const g = gabungPosisiOutlet([])
    expect(g).toMatchObject({ stokSistem: 0, stokFisik: null, selisih: 0, outletOpname: 0, outletTotal: 0 })
  })
})
