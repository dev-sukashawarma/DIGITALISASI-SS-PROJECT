import { describe, it, expect } from 'vitest'
import { filterDuplicateOrphanMenus } from './categoryHelper'

describe('filterDuplicateOrphanMenus', () => {
  it('menyaring duplikat menu yatim nonaktif (is_available: false, categories: null) saat ada menu utama dengan nama sama', () => {
    const activeShawarma = {
      id: 'active-1',
      name: 'Original Sapi Sedang',
      is_available: true,
      categories: { name: 'Shawarma' },
    }
    const orphanDuplicate = {
      id: 'orphan-1',
      name: 'Original Sapi Sedang',
      is_available: false,
      categories: null,
    }
    const legitimateInactive = {
      id: 'legit-inactive',
      name: 'Menu Musiman Spesial',
      is_available: false,
      categories: { name: 'Seasonal' },
    }
    const uniqueOrphan = {
      id: 'unique-orphan',
      name: 'Menu Unik Tanpa Duplikat',
      is_available: false,
      categories: null,
    }

    const res1 = filterDuplicateOrphanMenus([activeShawarma, orphanDuplicate, legitimateInactive, uniqueOrphan])
    expect(res1.map((m) => m.id)).toEqual(['active-1', 'legit-inactive', 'unique-orphan'])

    const res2 = filterDuplicateOrphanMenus([orphanDuplicate, activeShawarma])
    expect(res2.map((m) => m.id)).toEqual(['active-1'])
  })
})
