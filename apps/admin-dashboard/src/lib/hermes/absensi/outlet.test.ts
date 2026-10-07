import { describe, it, expect } from 'vitest'
import { outletTerhitungAbsensi, pilihOutlet } from './outlet'

const mentah = [
  { id: '1', name: 'SUKA SHAWARMA EMPANG', slug: 'empang', type: 'internal', is_active: true },
  { id: '2', name: 'MITRA CIBINONG', slug: 'cibinong', type: 'mitra', is_active: true },
  { id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', name: 'Kantor Pusat', slug: 'kantor-pusat', type: 'office', is_active: true },
  { id: '4', name: 'GUDANG PUSAT (HQ)', slug: 'gudang', type: 'office', is_active: true },
  { id: 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a', name: 'outlet tes', slug: 'tes', type: 'test', is_active: true },
  { id: '6', name: 'SS BACKUP', slug: 'ss-backup', type: 'internal', is_active: true },
  { id: '7', name: 'TikTok Shop', slug: 'tiktok-shop', type: 'marketplace', is_active: true },
  { id: '8', name: 'SUKA SHAWARMA LAMA', slug: 'lama', type: 'internal', is_active: false },
]

describe('cakupan outlet absensi', () => {
  it('internal/mitra/office/gudang aktif, tanpa tes, ss-backup, marketplace, nonaktif; Kantor Pusat ikut (D8)', () => {
    expect(outletTerhitungAbsensi(mentah).map((o) => o.name)).toEqual(['GUDANG PUSAT (HQ)', 'Kantor Pusat', 'MITRA CIBINONG', 'SUKA SHAWARMA EMPANG'])
  })
  it('pilihOutlet: kosong = semua; cocok sebagian nama; tak dikenal & ambigu = galat', () => {
    const o = outletTerhitungAbsensi(mentah)
    expect(pilihOutlet(o)).toEqual({ ok: true, outlets: o })
    expect(pilihOutlet(o, 'empang')).toEqual({ ok: true, outlets: [o.find((x) => x.name === 'SUKA SHAWARMA EMPANG')] })
    expect(pilihOutlet(o, 'bekasi')).toMatchObject({ ok: false })
    expect(pilihOutlet(o, 'pusat')).toMatchObject({ ok: false, pesan: expect.stringContaining('Kantor Pusat') })
  })
})
