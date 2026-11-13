import { describe, it, expect } from 'vitest'
import { tahapKasbon } from './tahapKasbon'

const dasar = { status: 'active', status_hr: 'pending', status_spv: 'pending', dicairkan_at: null, rejection_note: null }

describe('tahapKasbon', () => {
  it('menunggu HR', () => {
    expect(tahapKasbon(dasar)).toMatchObject({ label: 'Menunggu persetujuan HR', nada: 'menunggu' })
  })
  it('disetujui HR, menunggu pencairan finance', () => {
    expect(tahapKasbon({ ...dasar, status_hr: 'approved', status: 'menunggu_cair' })).toMatchObject({
      label: 'Menunggu pencairan',
      nada: 'proses',
    })
  })
  it('sudah dicairkan, dengan tanggal cair', () => {
    const t = tahapKasbon({ ...dasar, status_hr: 'approved', status: 'active', dicairkan_at: '2026-11-13T03:00:00Z' })
    expect(t).toMatchObject({ label: 'Dicairkan', nada: 'sukses' })
    expect(t.catatan).toContain('13 Nov 2026')
  })
  it('kasbon lama yang aktif tanpa tanggal cair tetap Dicairkan', () => {
    expect(tahapKasbon({ ...dasar, status_hr: 'approved', status: 'active' })).toMatchObject({ label: 'Dicairkan', catatan: null })
  })
  it('lunas', () => {
    expect(tahapKasbon({ ...dasar, status_hr: 'approved', status: 'paid_off' })).toMatchObject({ label: 'Lunas', nada: 'lunas' })
  })
  it('ditolak finance: alasan tanpa awalan', () => {
    expect(
      tahapKasbon({ ...dasar, status_hr: 'rejected', status: 'menunggu_cair', rejection_note: '[Ditolak Finance] saldo habis' }),
    ).toEqual({ label: 'Ditolak', nada: 'tolak', catatan: 'saldo habis' })
  })
  it('ditolak SPV', () => {
    expect(tahapKasbon({ ...dasar, status_spv: 'rejected' })).toMatchObject({ label: 'Ditolak', nada: 'tolak' })
  })
})
