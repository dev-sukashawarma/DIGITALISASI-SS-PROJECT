import { describe, it, expect } from 'vitest'
import { totalSubVendor, singleVendorBesar, filterResumableInputs, type SubVendorInput } from './opnameVendor'

// Angka FOIL nyata (CLAUDE.md sesi 2026-09-08/2026-09-10): 1 Dus = 48 Roll,
// 1 Roll = 760 cm -> faktor_tengah=48, faktor_tampilan=36.480 (48*760).
const foil = { satuan_tengah: 'Roll', faktor_tengah: 48, satuan_kecil: 'cm', faktor_tampilan: 36480 }

// Bahan tanpa tingkat satuan lain (cuma satuan besar) -- kasus paling sederhana.
const sederhana = { satuan_tengah: null, faktor_tengah: null, satuan_kecil: null, faktor_tampilan: null }

describe('singleVendorBesar — total satu vendor, satuan besar', () => {
  it('bahan satuan tunggal: besar saja', () => {
    expect(singleVendorBesar({ besar: '5' }, sederhana)).toBe(5)
  })

  it('bahan tri-unit FOIL: 2 Dus + 3 Roll = (2*36480 + 3*760) / 36480', () => {
    // 72960 + 2280 = 75240 -> 75240/36480
    expect(singleVendorBesar({ besar: '2', tengah: '3' }, foil)).toBeCloseTo(75240 / 36480, 6)
  })

  it('cuma kecil: 5000 cm -> 5000/36480 Dus', () => {
    expect(singleVendorBesar({ kecil: '5000' }, foil)).toBeCloseTo(5000 / 36480, 6)
  })

  it('input kosong -> 0', () => {
    expect(singleVendorBesar({}, foil)).toBe(0)
  })
})

describe('totalSubVendor — kosong/sebagian/lengkap', () => {
  it('kosong semua (tiap vendor tak diisi) -> total null, sebagian false', () => {
    const sub: Record<string, SubVendorInput> = { v1: {}, v2: {} }
    expect(totalSubVendor(sub, foil)).toEqual({ total: null, sebagian: false })
  })

  it('tidak ada vendor sama sekali (map kosong) -> total null, sebagian false', () => {
    expect(totalSubVendor({}, foil)).toEqual({ total: null, sebagian: false })
  })

  it('sebagian terisi (v1 diisi, v2 belum) -> sebagian true, total null', () => {
    const sub: Record<string, SubVendorInput> = { v1: { besar: '2' }, v2: {} }
    expect(totalSubVendor(sub, foil)).toEqual({ total: null, sebagian: true })
  })

  it('sebagian terisi (3 vendor, cuma 1 diisi) -> sebagian true', () => {
    const sub: Record<string, SubVendorInput> = { v1: { kecil: '100' }, v2: {}, v3: {} }
    expect(totalSubVendor(sub, foil).sebagian).toBe(true)
    expect(totalSubVendor(sub, foil).total).toBeNull()
  })

  it('lengkap (semua vendor diisi) -> total memakai faktor_tengah/faktor_tampilan bahan', () => {
    // v1: 2 Dus + 3 Roll = 75240 cm; v2: 5000 cm -> total 80240 cm -> /36480 Dus
    const sub: Record<string, SubVendorInput> = {
      v1: { besar: '2', tengah: '3' },
      v2: { kecil: '5000' },
    }
    const res = totalSubVendor(sub, foil)
    expect(res.sebagian).toBe(false)
    expect(res.total).toBeCloseTo(80240 / 36480, 6)
  })

  it('lengkap dengan isian 0 di salah satu vendor tetap dianggap terisi (fisik habis)', () => {
    // Diisi '0' bukan dikosongkan -- harus tetap dihitung "terisi", bukan sebagian.
    const sub: Record<string, SubVendorInput> = {
      v1: { besar: '0' },
      v2: { besar: '4' },
    }
    const res = totalSubVendor(sub, foil)
    expect(res.sebagian).toBe(false)
    expect(res.total).toBeCloseTo(4, 6)
  })

  it('bahan satuan tunggal, lengkap 2 vendor -> total sum langsung', () => {
    const sub: Record<string, SubVendorInput> = { v1: { besar: '3' }, v2: { besar: '4' } }
    expect(totalSubVendor(sub, sederhana)).toEqual({ total: 7, sebagian: false })
  })
})

// Fix round 1 (review): resume draft server-side (`fetchTodayDraft`) tak boleh
// menyeed `inputs` untuk bahan yang (ternyata) multi-vendor -- total lama itu
// tak punya rincian per vendor di baliknya, dan `simpan_hitung_vendor` akan
// dikirim TANPA baris untuk bahan itu (kosong-semua di subInputs), padahal
// badge "Terisi" sudah menyala. Dipanggil HANYA setelah daftar vendor
// multi-vendor bahan (vendorsByBahan) diketahui pasti -- lihat OpnameForm.tsx.
describe('filterResumableInputs — cegah resume seed bahan multi-vendor', () => {
  it('tidak ada bahan multi-vendor -> semua resumed input lolos apa adanya', () => {
    const resumed = { sapi: { besar: '5' }, ayam: { besar: '2' } }
    expect(filterResumableInputs(resumed, [])).toEqual(resumed)
  })

  it('bahan multi-vendor di-strip, bahan biasa tetap lolos', () => {
    const resumed = { sapi: { besar: '5' }, ayam: { besar: '2' }, gula: { besar: '1' } }
    // SAPI & AYAM multi-vendor (Task 1 fixtures); GULA bukan.
    expect(filterResumableInputs(resumed, ['sapi', 'ayam'])).toEqual({ gula: { besar: '1' } })
  })

  it('semua bahan resumed multi-vendor -> hasil kosong', () => {
    const resumed = { sapi: { besar: '5' } }
    expect(filterResumableInputs(resumed, ['sapi'])).toEqual({})
  })

  it('resumed kosong -> tetap kosong, apa pun daftar multi-vendornya', () => {
    expect(filterResumableInputs({}, ['sapi'])).toEqual({})
  })

  it('id multi-vendor yang tak ada di resumed tidak memunculkan apa-apa', () => {
    const resumed = { gula: { besar: '1' } }
    expect(filterResumableInputs(resumed, ['sapi', 'ayam'])).toEqual({ gula: { besar: '1' } })
  })

  it('menerima Set maupun array sebagai daftar id multi-vendor', () => {
    const resumed = { sapi: { besar: '5' }, gula: { besar: '1' } }
    expect(filterResumableInputs(resumed, new Set(['sapi']))).toEqual({ gula: { besar: '1' } })
  })
})
