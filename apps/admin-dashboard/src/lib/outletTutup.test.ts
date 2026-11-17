import { describe, expect, it } from 'vitest'
import {
  batasTampilOutletTutup,
  keteranganTutup,
  outletSudahTutup,
  outletTampilDiPeriode,
  saringOutletPeriode,
} from './outletTutup'

// Tanggal tutup disimpan RPC tutup_outlet sebagai 23:59:59 WIB = 16:59:59 UTC.
const sukmajaya = { id: 'smj', is_active: false, status: 'inactive', nonaktif_at: '2026-10-27T16:59:59+00:00' }
const sawangan = { id: 'swg', is_active: false, status: 'inactive', nonaktif_at: '2026-11-08T16:59:59+00:00' }
const aktif = { id: 'emp', is_active: true, status: 'active', nonaktif_at: null }

describe('outletSudahTutup', () => {
  it('nonaktif lewat is_active atau status', () => {
    expect(outletSudahTutup(sukmajaya)).toBe(true)
    expect(outletSudahTutup({ is_active: true, status: 'inactive' })).toBe(true)
    expect(outletSudahTutup(aktif)).toBe(false)
    expect(outletSudahTutup({})).toBe(false)
  })

  it('outlet Persiapan bukan outlet tutup', () => {
    expect(outletSudahTutup({ is_active: false, status: 'pending' })).toBe(false)
  })
})

describe('batasTampilOutletTutup', () => {
  it('akhir bulan tanggal tutup menurut WIB', () => {
    expect(batasTampilOutletTutup('2026-10-27T16:59:59+00:00')).toBe('2026-10-31')
    expect(batasTampilOutletTutup('2026-08-13T16:59:59+00:00')).toBe('2026-08-31')
    expect(batasTampilOutletTutup('2026-02-10T00:00:00+00:00')).toBe('2026-02-28')
  })

  it('tutup 31 Okt 20:00 UTC = 1 Nov WIB, jadi batasnya akhir November', () => {
    expect(batasTampilOutletTutup('2026-10-31T20:00:00+00:00')).toBe('2026-11-30')
  })
})

describe('outletTampilDiPeriode', () => {
  it('tanpa periode, semua tampil', () => {
    expect(outletTampilDiPeriode(sukmajaya, null)).toBe(true)
    expect(outletTampilDiPeriode(sukmajaya, undefined)).toBe(true)
  })

  it('outlet aktif selalu tampil', () => {
    expect(outletTampilDiPeriode(aktif, '2027-01-01')).toBe(true)
  })

  it('outlet tutup tampil sampai akhir bulan tutupnya', () => {
    expect(outletTampilDiPeriode(sukmajaya, '2026-10-01')).toBe(true)
    expect(outletTampilDiPeriode(sukmajaya, '2026-10-31')).toBe(true)
    expect(outletTampilDiPeriode(sukmajaya, '2026-11-01')).toBe(false)
    expect(outletTampilDiPeriode(sawangan, '2026-11-01')).toBe(true)
    expect(outletTampilDiPeriode(sawangan, '2026-12-01')).toBe(false)
  })

  it('periode yang mulai sebelum tutup tetap menampilkan outlet', () => {
    expect(outletTampilDiPeriode(sukmajaya, '2026-09-15')).toBe(true)
  })

  it('outlet tutup tanpa tanggal tutup tetap tampil', () => {
    expect(outletTampilDiPeriode({ is_active: false, status: 'inactive', nonaktif_at: null }, '2027-01-01')).toBe(true)
  })
})

describe('keteranganTutup', () => {
  it('menyebut tanggal tutup (WIB) untuk outlet tutup', () => {
    expect(keteranganTutup(sawangan)).toBe('Tutup 8 Nov')
    expect(keteranganTutup(sukmajaya)).toBe('Tutup 27 Okt')
  })

  it('kosong untuk outlet aktif atau tanpa tanggal tutup', () => {
    expect(keteranganTutup(aktif)).toBeNull()
    expect(keteranganTutup({ is_active: false, status: 'inactive', nonaktif_at: null })).toBeNull()
  })
})

describe('saringOutletPeriode', () => {
  it('menyaring sesuai awal periode dan mempertahankan urutan', () => {
    const hasil = saringOutletPeriode([sukmajaya, aktif, sawangan], '2026-11-01')
    expect(hasil.map((o) => o.id)).toEqual(['emp', 'swg'])
  })
})
