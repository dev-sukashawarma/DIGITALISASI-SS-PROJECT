import { describe, it, expect } from 'vitest'
import { filterOutlets } from './filterOutlets'
import type { Outlet } from './types'

const mockOutlets: Outlet[] = [
  {
    id: 'out-1',
    name: 'Suka Shawarma Margonda',
    slug: 'ss-margonda',
    address: 'Jl. Margonda Raya No. 100, Depok',
    lat: -6.3728,
    lng: 106.8317,
    type: 'outlet',
    is_active: true,
    marquee_warning_threshold: 10,
    open_hour: '14:00',
    close_hour: '22:00',
  },
  {
    id: 'out-2',
    name: 'Suka Shawarma Tebet',
    slug: 'ss-tebet',
    address: 'Jl. Tebet Raya No. 45, Jakarta Selatan',
    lat: -6.2255,
    lng: 106.8552,
    type: 'mitra',
    is_active: false,
    marquee_warning_threshold: 15,
  },
  {
    id: 'out-3',
    name: 'Gudang Pusat SS',
    slug: 'ss-hq',
    address: 'Kawasan Industri Sentul Blok B3',
    lat: 0,
    lng: 0,
    type: 'hq',
    is_active: true,
    marquee_warning_threshold: 5,
  },
  {
    id: 'out-4',
    name: 'Suka Shawarma Bintaro',
    slug: 'ss-bintaro',
    address: null,
    lat: NaN,
    lng: NaN,
    type: 'mitra',
    is_active: true,
    marquee_warning_threshold: 10,
  },
]

describe('filterOutlets', () => {
  it('mengembalikan semua outlet jika filter kosong', () => {
    const result = filterOutlets(mockOutlets, { search: '', status: '' })
    expect(result).toHaveLength(4)
  })

  it('memfilter berdasarkan nama (case-insensitive)', () => {
    const result = filterOutlets(mockOutlets, { search: 'tebet', status: '' })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('ss-tebet')
  })

  it('memfilter berdasarkan slug', () => {
    const result = filterOutlets(mockOutlets, { search: 'ss-hq', status: '' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('out-3')
  })

  it('memfilter berdasarkan alamat', () => {
    const result = filterOutlets(mockOutlets, { search: 'sentul', status: '' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('out-3')
  })

  it('memfilter berdasarkan status aktif', () => {
    const result = filterOutlets(mockOutlets, { search: '', status: 'active' })
    expect(result).toHaveLength(3)
    expect(result.every((o) => o.is_active)).toBe(true)
  })

  it('memfilter berdasarkan status nonaktif', () => {
    const result = filterOutlets(mockOutlets, { search: '', status: 'inactive' })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('ss-tebet')
  })

  it('memfilter outlet yang belum memiliki koordinat GPS valid (missing_coords)', () => {
    const result = filterOutlets(mockOutlets, { search: '', status: 'missing_coords' })
    // out-3 has 0,0 and out-4 has NaN,NaN
    expect(result).toHaveLength(2)
    const ids = result.map((r) => r.id)
    expect(ids).toContain('out-3')
    expect(ids).toContain('out-4')
  })

  it('memfilter berdasarkan tipe outlet', () => {
    const result = filterOutlets(mockOutlets, { search: '', status: '', type: 'mitra' })
    expect(result).toHaveLength(2)
    expect(result.every((o) => o.type === 'mitra')).toBe(true)
  })

  it('mengabaikan filter tipe jika bernilai "all" atau kosong', () => {
    const resAll = filterOutlets(mockOutlets, { search: '', status: '', type: 'all' })
    expect(resAll).toHaveLength(4)

    const resEmpty = filterOutlets(mockOutlets, { search: '', status: '', type: '' })
    expect(resEmpty).toHaveLength(4)
  })

  it('menggabungkan pencarian, status, dan tipe secara bersamaan', () => {
    const result = filterOutlets(mockOutlets, {
      search: 'shawarma',
      status: 'active',
      type: 'mitra',
    })
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('ss-bintaro')
  })
})
