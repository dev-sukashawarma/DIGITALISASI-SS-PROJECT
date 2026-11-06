import { describe, it, expect } from 'vitest'
import { deskripsiPettyCash } from './deskripsiPettyCash'

const dasar = { deskripsiAwal: 'awal', nominalDiajukan: 500000 }

describe('deskripsiPettyCash', () => {
  it('reject dengan catatan menambah baris alasan tolak', () => {
    expect(deskripsiPettyCash({ ...dasar, action: 'reject', catatan: ' salah nominal ' })).toBe(
      'awal\n\n[Ditolak Finance: salah nominal]',
    )
  })
  it('reject tanpa catatan tidak mengubah deskripsi', () => {
    expect(deskripsiPettyCash({ ...dasar, action: 'reject', catatan: '  ' })).toBe('awal')
  })
  it('approve tanpa catatan & nominal sama tidak mengubah deskripsi', () => {
    expect(deskripsiPettyCash({ ...dasar, action: 'approve', nominalDisetujui: 500000 })).toBe('awal')
  })
  it('approve nominal dikurangi tanpa catatan mencatat nominalnya', () => {
    expect(deskripsiPettyCash({ ...dasar, action: 'approve', nominalDisetujui: 300000 })).toBe(
      'awal\n\n[Catatan Finance: Nominal disetujui Rp 300.000 dari diajukan Rp 500.000]',
    )
  })
  it('approve nominal dikurangi dengan catatan', () => {
    expect(deskripsiPettyCash({ ...dasar, action: 'approve', nominalDisetujui: 300000, catatan: 'sisa minggu lalu' })).toBe(
      'awal\n\n[Catatan Finance (Acc Rp 300.000 dari Diajukan Rp 500.000): sisa minggu lalu]',
    )
  })
  it('approve nominal sama dengan catatan', () => {
    expect(deskripsiPettyCash({ ...dasar, action: 'approve', catatan: 'ok' })).toBe('awal\n\n[Catatan Finance: ok]')
  })
})
