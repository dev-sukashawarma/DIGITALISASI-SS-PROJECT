import { describe, it, expect } from 'vitest'
import { susunRiwayatPromo, type RiwayatRow } from './promoRiwayat'

const DISKON10 = { discount_type: 'percentage', discount_value: 10, promo_name: 'Diskon 10%', start_date: null, end_date: null }
const DISKON20 = { ...DISKON10, discount_value: 20, promo_name: 'Diskon 20%' }

const ev = (over: Partial<RiwayatRow> & { promo_row_id: string; aksi: RiwayatRow['aksi']; diubah_pada: string }): RiwayatRow => ({
  outlet_id: `o-${over.promo_row_id}`,
  scope: 'global',
  menu_item_id: null,
  is_active: true,
  is_assigned: true,
  konfigurasi: DISKON10,
  diubah_oleh: null,
  ...over,
})

const NOW = Date.parse('2026-10-30T10:00:00Z')

describe('susunRiwayatPromo', () => {
  it('promo yang dinyalakan lalu dimatikan jadi satu periode selesai dengan jam pasti', () => {
    const rows = [
      ev({ promo_row_id: 'a', aksi: 'dibuat', is_active: false, diubah_pada: '2026-10-01T01:00:00Z' }),
      ev({ promo_row_id: 'a', aksi: 'dinyalakan', diubah_pada: '2026-10-02T03:00:00Z' }),
      ev({ promo_row_id: 'a', aksi: 'dimatikan', is_active: false, diubah_pada: '2026-10-05T03:00:00Z', diubah_oleh: 'u1' }),
    ]
    const [entry] = susunRiwayatPromo(rows, { a: ['2026-10-03T05:00:00Z', '2026-10-09T05:00:00Z'] }, NOW)
    expect(entry).toMatchObject({
      status: 'selesai',
      mulai: '2026-10-02T03:00:00Z',
      selesai: '2026-10-05T03:00:00Z',
      alasanSelesai: 'dimatikan',
      diubahOleh: 'u1',
      perkiraan: false,
      dipakai: 1,
    })
  })

  it('beberapa outlet yang disimpan bersamaan digabung jadi satu entri', () => {
    const rows = ['a', 'b'].flatMap(id => [
      ev({ promo_row_id: id, aksi: 'dinyalakan', diubah_pada: '2026-10-02T03:00:00Z' }),
      ev({ promo_row_id: id, aksi: 'dimatikan', is_active: false, diubah_pada: '2026-10-05T03:00:00Z' }),
    ])
    const entries = susunRiwayatPromo(rows, {}, NOW)
    expect(entries).toHaveLength(1)
    expect(entries[0].outletIds).toEqual(['o-a', 'o-b'])
  })

  it('mengubah promo yang sedang aktif menutup periode lama dan membuka periode baru', () => {
    const rows = [
      ev({ promo_row_id: 'a', aksi: 'dinyalakan', diubah_pada: '2026-10-02T03:00:00Z' }),
      ev({ promo_row_id: 'a', aksi: 'diubah', konfigurasi: DISKON20, diubah_pada: '2026-10-04T03:00:00Z' }),
    ]
    const entries = susunRiwayatPromo(rows, {}, NOW)
    expect(entries.map(e => [e.status, e.konfigurasi.discount_value, e.alasanSelesai])).toEqual([
      ['aktif', 20, null],
      ['selesai', 10, 'diubah'],
    ])
    expect(entries[0].mulai).toBe('2026-10-04T03:00:00Z')
  })

  it('promo yang masih menyala tapi jadwal selesainya lewat dihitung selesai', () => {
    const cfg = { ...DISKON10, end_date: '2026-10-20T16:59:00Z' }
    const rows = [ev({ promo_row_id: 'a', aksi: 'dinyalakan', konfigurasi: cfg, diubah_pada: '2026-10-10T03:00:00Z' })]
    const [entry] = susunRiwayatPromo(rows, {}, NOW)
    expect(entry).toMatchObject({ status: 'selesai', selesai: '2026-10-20T16:59:00Z', alasanSelesai: 'jadwal_selesai' })
  })

  it('outlet yang dilepas menutup periode dengan alasan dilepas', () => {
    const rows = [
      ev({ promo_row_id: 'a', aksi: 'dinyalakan', diubah_pada: '2026-10-02T03:00:00Z' }),
      ev({ promo_row_id: 'a', aksi: 'dilepas', is_active: false, is_assigned: false, diubah_pada: '2026-10-03T03:00:00Z' }),
    ]
    expect(susunRiwayatPromo(rows, {}, NOW)[0].alasanSelesai).toBe('dilepas')
  })

  it('promo lama yang aktif saat riwayat mulai dicatat memakai tanggal dibuat sebagai perkiraan', () => {
    const rows = [ev({ promo_row_id: 'a', aksi: 'awal', diubah_pada: '2026-09-01T01:00:00Z' })]
    const [entry] = susunRiwayatPromo(rows, { a: ['2026-09-10T01:00:00Z'] }, NOW)
    expect(entry).toMatchObject({ status: 'aktif', mulai: '2026-09-01T01:00:00Z', perkiraan: true, dipakai: 1 })
  })

  it('promo lama yang sudah mati disusun dari waktu pemakaian pertama s.d. terakhir', () => {
    const rows = [ev({ promo_row_id: 'a', aksi: 'awal', is_active: false, diubah_pada: '2026-08-01T01:00:00Z' })]
    const [entry] = susunRiwayatPromo(rows, { a: ['2026-09-12T01:00:00Z', '2026-09-03T01:00:00Z'] }, NOW)
    expect(entry).toMatchObject({
      status: 'selesai',
      mulai: '2026-09-03T01:00:00Z',
      selesai: '2026-09-12T01:00:00Z',
      perkiraan: true,
      dipakai: 2,
      pakaiPertama: '2026-09-03T01:00:00Z',
      pakaiTerakhir: '2026-09-12T01:00:00Z',
    })
  })

  it('promo lama yang mati dan tak pernah dipakai tetap tampil dengan tanggal dibuat, tanpa jam selesai', () => {
    const rows = [ev({ promo_row_id: 'a', aksi: 'awal', is_active: false, diubah_pada: '2026-08-01T01:00:00Z' })]
    const [entry] = susunRiwayatPromo(rows, {}, NOW)
    expect(entry).toMatchObject({ status: 'selesai', mulai: '2026-08-01T01:00:00Z', selesai: null, perkiraan: true, dipakai: 0 })
  })

  it('pemakaian tidak pernah terhitung dua kali walau satu baris punya beberapa periode', () => {
    const rows = [
      ev({ promo_row_id: 'a', aksi: 'awal', is_active: false, diubah_pada: '2026-08-01T01:00:00Z' }),
      ev({ promo_row_id: 'a', aksi: 'dinyalakan', diubah_pada: '2026-10-02T03:00:00Z' }),
      ev({ promo_row_id: 'a', aksi: 'dimatikan', is_active: false, diubah_pada: '2026-10-05T03:00:00Z' }),
    ]
    const pakai = { a: ['2026-09-01T01:00:00Z', '2026-10-03T01:00:00Z'] }
    const entries = susunRiwayatPromo(rows, pakai, NOW)
    expect(entries.reduce((n, e) => n + e.dipakai, 0)).toBe(2)
  })

  it('urutan: yang aktif di atas, lalu yang selesai paling akhir', () => {
    const rows = [
      ev({ promo_row_id: 'lama', aksi: 'dinyalakan', diubah_pada: '2026-10-01T03:00:00Z' }),
      ev({ promo_row_id: 'lama', aksi: 'dimatikan', is_active: false, diubah_pada: '2026-10-02T03:00:00Z' }),
      ev({ promo_row_id: 'baru', aksi: 'dinyalakan', konfigurasi: DISKON20, diubah_pada: '2026-10-03T03:00:00Z' }),
      ev({ promo_row_id: 'baru', aksi: 'dimatikan', konfigurasi: DISKON20, is_active: false, diubah_pada: '2026-10-04T03:00:00Z' }),
      ev({ promo_row_id: 'jalan', aksi: 'dinyalakan', menu_item_id: 'm1', scope: 'item', diubah_pada: '2026-09-01T03:00:00Z' }),
    ]
    expect(susunRiwayatPromo(rows, {}, NOW).map(e => e.outletIds[0])).toEqual(['o-jalan', 'o-baru', 'o-lama'])
  })
})
