import { describe, expect, it } from 'vitest'
import { labelPengubah } from './pengubah'

describe('labelPengubah', () => {
  it('nama pelaku + tanggal WIB', () => {
    expect(labelPengubah({ nama_pengubah: 'Hesti Qodriani', diubah_oleh: 'u1', diubah_at: '2026-11-09T07:05:00Z' }))
      .toEqual({ nama: 'Hesti Qodriani', waktu: '9 Nov 2026 14.05' })
  })

  it('tanpa pelaku (perubahan otomatis sistem/migration)', () => {
    expect(labelPengubah({ nama_pengubah: null, diubah_oleh: null, diubah_at: '2026-09-23T17:00:00Z' }))
      .toEqual({ nama: 'Sistem', waktu: '24 Sep 2026 00.00' })
  })

  it('pelaku ada tapi namanya tak terbaca', () => {
    expect(labelPengubah({ nama_pengubah: null, diubah_oleh: 'u1', diubah_at: '2026-11-09T07:05:00Z' })?.nama).toBe('(tanpa nama)')
  })

  it('belum pernah diubah', () => {
    expect(labelPengubah(undefined)).toBeNull()
  })
})
