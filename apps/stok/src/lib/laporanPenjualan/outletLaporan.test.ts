import { describe, it, expect } from 'vitest'
import { outletDihitungLaporan, susunOutletLaporan } from './outletLaporan'

const o = (p: Partial<{ id: string; name: string; type: string | null; status: string | null; is_active: boolean | null; slug: string | null; nonaktif_at: string | null }>) => ({
  id: 'x', name: 'SUKA SHAWARMA X', type: 'internal', status: 'active', is_active: true, slug: 'x', nonaktif_at: null, ...p,
})

describe('outletDihitungLaporan', () => {
  it('internal & mitra aktif dihitung', () => {
    expect(outletDihitungLaporan(o({}))).toBe(true)
    expect(outletDihitungLaporan(o({ type: 'mitra' }))).toBe(true)
  })
  it('gudang, kantor, marketplace, test, system tidak dihitung', () => {
    for (const type of ['gudang', 'office', 'marketplace', 'test', 'system', null]) {
      expect(outletDihitungLaporan(o({ type }))).toBe(false)
    }
  })
  it('outlet Persiapan dan SS Backup tidak dihitung', () => {
    expect(outletDihitungLaporan(o({ status: 'pending' }))).toBe(false)
    expect(outletDihitungLaporan(o({ slug: 'ss-backup' }))).toBe(false)
  })
  it('outlet tutup tetap dihitung (penjualannya nyata)', () => {
    expect(outletDihitungLaporan(o({ status: 'inactive', is_active: false, nonaktif_at: '2026-08-13T14:00:00Z' }))).toBe(true)
  })
})

describe('susunOutletLaporan', () => {
  const daftar = [
    o({ id: 'a', name: 'SUKA SHAWARMA BEJI' }),
    o({ id: 'm', name: 'MITRA CIBUBUR', type: 'mitra' }),
    o({ id: 't', name: 'SUKA SHAWARMA JATIASIH', status: 'inactive', is_active: false, nonaktif_at: '2026-08-13T14:37:00Z' }),
    o({ id: 'g', name: 'GUDANG SS ONLINE', type: 'gudang' }),
    o({ id: 'p', name: 'MITRA BARU', type: 'mitra', status: 'pending', is_active: false }),
  ]

  it('himpunan hitung memuat outlet tutup, tanpa gudang/persiapan', () => {
    const r = susunOutletLaporan(daftar, '2026-11-01')
    expect([...r.idDihitung].sort()).toEqual(['a', 'm', 't'])
    expect(r.infoOutlet.get('t')?.cleanName).toBe('JATIASIH')
    expect(r.infoOutlet.get('m')?.category).toBe('mitra')
  })

  it('pemilih: outlet tutup tampil s/d akhir bulan tutupnya', () => {
    expect(susunOutletLaporan(daftar, '2026-11-01').pilihan.map((x) => x.id)).toEqual(['a', 'm'])
    expect(susunOutletLaporan(daftar, '2026-08-20').pilihan.map((x) => x.id)).toEqual(['a', 'm', 't'])
  })

  it('jumlah aktif tidak menghitung outlet tutup', () => {
    expect(susunOutletLaporan(daftar, '2026-08-20').jumlahAktif).toBe(2)
  })
})
