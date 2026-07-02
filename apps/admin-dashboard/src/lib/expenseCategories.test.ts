import { describe, it, expect } from 'vitest'
import {
  EXPENSE_CATEGORIES, OUTLET_CATEGORIES, PUSAT_CATEGORIES,
  deriveScope, CATEGORY_META,
} from './expenseCategories'

describe('expenseCategories', () => {
  it('punya 14 kategori kanonik (12 outlet + 2 pusat)', () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(14)
    expect(OUTLET_CATEGORIES).toHaveLength(12)
    expect(PUSAT_CATEGORIES).toEqual(['pengeluaran_global', 'gaji_staff_kantor'])
  })

  it('deriveScope: kategori pusat → pusat, sisanya → outlet', () => {
    expect(deriveScope('gaji_staff_kantor')).toBe('pusat')
    expect(deriveScope('pengeluaran_global')).toBe('pusat')
    expect(deriveScope('gaji_crew_outlet')).toBe('outlet')
    expect(deriveScope('pln')).toBe('outlet')
  })

  it('setiap kategori punya label, color, icon', () => {
    for (const c of EXPENSE_CATEGORIES) {
      expect(CATEGORY_META[c].label).toBeTruthy()
      expect(CATEGORY_META[c].color).toMatch(/^#/)
      expect(CATEGORY_META[c].icon).toBeTruthy()
    }
  })
})
