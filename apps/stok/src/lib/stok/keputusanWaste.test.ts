import { describe, it, expect } from 'vitest'
import { PESAN_SUDAH_DIPUTUSKAN, nilaiKeputusan, cakupanOutletWaste } from './keputusanWaste'

describe('nilaiKeputusan', () => {
  it('satu baris berubah = berhasil', () => {
    expect(nilaiKeputusan([{ id: 'a' }])).toEqual({ ok: true })
  })
  it('nol baris berubah = sudah diputuskan orang lain', () => {
    expect(nilaiKeputusan([])).toEqual({ ok: false, error: PESAN_SUDAH_DIPUTUSKAN })
  })
  it('data null diperlakukan sebagai nol baris', () => {
    expect(nilaiKeputusan(null)).toEqual({ ok: false, error: PESAN_SUDAH_DIPUTUSKAN })
  })
})

describe('cakupanOutletWaste', () => {
  it('set kosong = tidak boleh melihat apa pun (fail-closed)', () => {
    expect(cakupanOutletWaste(new Set())).toEqual([])
  })
  it('set berisi dikembalikan sebagai daftar', () => {
    expect(cakupanOutletWaste(new Set(['a', 'b'])).sort()).toEqual(['a', 'b'])
  })
})
