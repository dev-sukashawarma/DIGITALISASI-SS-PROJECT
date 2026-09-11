import { describe, it, expect } from 'vitest'
import { keSatuanBesar, perluKonfirmasiJumlah, hitungSelisihNota, BATAS_SELISIH_PERSEN } from './dropShip'

const sayur = { faktor_tengah: null, faktor_tampilan: 1000 } // kg, kecil = gram

describe('keSatuanBesar', () => {
  it('gram ke kg', () => expect(keSatuanBesar(2496, 'kecil', sayur)).toBeCloseTo(2.496, 6))
  it('besar tetap', () => expect(keSatuanBesar(5, 'besar', sayur)).toBe(5))
  it('tengah dibagi faktor_tengah', () => expect(keSatuanBesar(24, 'tengah', { faktor_tengah: 48, faktor_tampilan: 36480 })).toBe(0.5))
  it('tingkat tanpa faktor jatuh ke besar, bukan salah 1000x diam-diam', () =>
    expect(() => keSatuanBesar(3, 'tengah', sayur)).toThrow())
})

// Laporan waste Sayur Beji: 8x "2.496 kg" -> crew memilih kg lalu mengetik gram.
describe('perluKonfirmasiJumlah', () => {
  it('2.496 kg sayur (Rp 54,9 jt) wajib konfirmasi', () =>
    expect(perluKonfirmasiJumlah({ qtyBesar: 2496, hargaSnapshot: 22000, rataPakaiHarian: 4.4 })).toBe(true))
  it('5 kg normal tidak mengganggu', () =>
    expect(perluKonfirmasiJumlah({ qtyBesar: 5, hargaSnapshot: 22000, rataPakaiHarian: 4.4 })).toBe(false))
  it('> 5x rata-rata harian wajib konfirmasi', () =>
    expect(perluKonfirmasiJumlah({ qtyBesar: 25, hargaSnapshot: 22000, rataPakaiHarian: 4.4 })).toBe(true))
  it('tanpa riwayat: hanya ambang rupiah', () => {
    expect(perluKonfirmasiJumlah({ qtyBesar: 20, hargaSnapshot: 22000, rataPakaiHarian: null })).toBe(false)
    expect(perluKonfirmasiJumlah({ qtyBesar: 100, hargaSnapshot: 22000, rataPakaiHarian: null })).toBe(true)
  })
})

describe('hitungSelisihNota', () => {
  it('cocok persis', () => expect(hitungSelisihNota(42, 42)).toEqual({ selisih: 0, persen: 0, perluCatatan: false }))
  it('crew 50 vs nota 42 -> wajib catatan', () => {
    const r = hitungSelisihNota(50, 42)
    expect(r.selisih).toBe(8)
    expect(r.perluCatatan).toBe(true)
  })
  it('di bawah ambang tidak wajib', () => expect(hitungSelisihNota(100.3, 100).perluCatatan).toBe(false))
  it('ambang sama dengan SQL', () => expect(BATAS_SELISIH_PERSEN).toBe(0.5))
})
