import { describe, it, expect } from 'vitest'
import {
  formatTriUnitSaldoFromGram,
  formatCompositeSaldoFromGram,
  formatTriUnitSaldoAdaptive,
  formatCompositeSaldoAdaptive,
  decomposeTriUnitRaw,
} from './compositeUnit'

// Semua angka di sini diambil verbatim dari ledger_stok produksi (opname
// 2026-08-02), lihat docs/superpowers/specs/2026-08-01-satuan-kanonik-stok-design.md
// §4.5/Lampiran A. Root cause: stok_balance.saldo yang sudah "meloncat" ke
// gram (hasil opname form baru) TIDAK BOLEH didekomposisi seolah masih
// satuan besar (Math.trunc(qty) sebagai Dus) -- itu bug yang sedang ditutup.

describe('formatTriUnitSaldoFromGram — dekomposisi dari satuan kecil (gram) ke atas', () => {
  it('SAPI: 8553.755 gram -> 4 Blok + 553.75 Gram (BUKAN 8553 Blok)', () => {
    expect(formatTriUnitSaldoFromGram(8553.755, 'Blok', 'Kg', 2, 'Gram', 2000)).toBe(
      '4 Blok + 553.75 Gram'
    )
  })

  it('KENTANG (Cimanggu): 4284.545 gram -> 0 Dus + 4 Kg + 284.55 Gram (BUKAN 4284 Dus)', () => {
    expect(formatTriUnitSaldoFromGram(4284.545, 'Dus', 'Kg', 10, 'Gram', 10000)).toBe(
      '4 Kg + 284.55 Gram'
    )
  })

  it('MINYAK SAYUR (Cimanggu): 5999.875 gram -> 5 "Kg" + 999.88 ml (BUKAN 5999 kompan)', () => {
    expect(formatTriUnitSaldoFromGram(5999.875, 'kompan', 'Kg', 16, 'Gram', 16000)).toBe(
      '5 Kg + 999.88 Gram'
    )
  })

  it('KENTANG (Gudang Pusat): 202500 gram -> 20 Dus + 2 Kg + 500 Gram (BUKAN 202500 Dus)', () => {
    expect(formatTriUnitSaldoFromGram(202500, 'Dus', 'Kg', 10, 'Gram', 10000)).toBe(
      '20 Dus + 2 Kg + 500 Gram'
    )
  })

  it('SAOS TOMAT POUCH (Gudang Pusat): 156000 gram -> tepat 13 Dus, tanpa sisa', () => {
    expect(formatTriUnitSaldoFromGram(156000, 'Dus', 'Kg', 12, 'Gram', 12000)).toBe('13 Dus')
  })

  it('nilai negatif (defisit) tetap konsisten arah tandanya', () => {
    expect(formatTriUnitSaldoFromGram(-4.05, 'Pack', null, null, 'Lembar', 20)).toBe(
      '-4.05 Lembar'
    )
  })

  it('tanpa satuan_tengah (2-tingkat), delegasi ke formatCompositeSaldoFromGram', () => {
    expect(formatTriUnitSaldoFromGram(4444.635, 'Kg', null, null, 'Gram', 1000)).toBe(
      '4 Kg + 444.64 Gram'
    )
  })
})

describe('formatCompositeSaldoFromGram — dekomposisi 2 tingkat dari gram', () => {
  it('AYAM (Cimanggu): 4444.635 gram -> 4 Kg + 444.64 Gram', () => {
    expect(formatCompositeSaldoFromGram(4444.635, 'Kg', 'Gram', 1000)).toBe('4 Kg + 444.64 Gram')
  })

  it('tanpa faktor (bahan 1 tingkat), fallback apa adanya', () => {
    expect(formatCompositeSaldoFromGram(5.5, 'Bal', null, null)).toBe('5.5 Bal')
  })
})

describe('formatTriUnitSaldoAdaptive — pemilih berdasar saldo_is_gram', () => {
  it('saldo_is_gram=true -> dekomposisi dari gram (kasus SAPI)', () => {
    expect(
      formatTriUnitSaldoAdaptive(8553.755, true, 'Blok', 'Kg', 2, 'Gram', 2000)
    ).toBe('4 Blok + 553.75 Gram')
  })

  it('saldo_is_gram=false -> TETAP pakai dekomposisi besar-scale lama (kasus legacy "outlet tes" KENTANG 2.5)', () => {
    // 2.5 di sini adalah 2.5 Dus (legacy), bukan 2.5 gram -- harus lolos
    // sebagai "2 Dus 5 Kg" (gaya formatTriUnitSaldo LAMA, spasi bukan '+'),
    // BUKAN "0 Dus + 2.5 Gram" yang absurd kalau dipaksa baca sebagai gram.
    expect(
      formatTriUnitSaldoAdaptive(2.5, false, 'Dus', 'Kg', 10, 'Gram', 10000)
    ).toBe('2 Dus 5 Kg')
  })
})

describe('decomposeTriUnitRaw — versi angka mentah untuk tabel 3-kolom (SPVTable/CrewList)', () => {
  it('saldo_is_gram=true: SAPI 8553.755 gram -> {large:4, medium:0, small:553.75} (BUKAN large:8553)', () => {
    expect(decomposeTriUnitRaw(8553.755, true, 'Kg', 2, 'Gram', 2000)).toEqual({
      large: 4,
      medium: 0,
      small: 553.75,
    })
  })

  it('saldo_is_gram=true: KENTANG (Gudang Pusat) 202500 gram -> {large:20, medium:2, small:500}', () => {
    expect(decomposeTriUnitRaw(202500, true, 'Kg', 10, 'Gram', 10000)).toEqual({
      large: 20,
      medium: 2,
      small: 500,
    })
  })

  it('saldo_is_gram=false: legacy 2.5 (Dus) -> {large:2, medium:5, small:0} (tak berubah dari perilaku lama)', () => {
    expect(decomposeTriUnitRaw(2.5, false, 'Kg', 10, 'Gram', 10000)).toEqual({
      large: 2,
      medium: 5,
      small: 0,
    })
  })
})

describe('formatCompositeSaldoAdaptive — pemilih berdasar saldo_is_gram (2-tingkat)', () => {
  it('saldo_is_gram=true -> dekomposisi dari gram', () => {
    expect(formatCompositeSaldoAdaptive(4444.635, true, 'Kg', 'Gram', 1000)).toBe(
      '4 Kg + 444.64 Gram'
    )
  })

  it('saldo_is_gram=false -> dekomposisi besar-scale lama', () => {
    expect(formatCompositeSaldoAdaptive(2.5, false, 'Kg', 'Gram', 1000)).toBe('2 Kg + 500 Gram')
  })
})
