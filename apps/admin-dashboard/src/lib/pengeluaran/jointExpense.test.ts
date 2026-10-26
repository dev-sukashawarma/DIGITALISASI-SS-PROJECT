import { describe, it, expect } from 'vitest'
import { adalahJointExpenseDisembunyikan } from './jointExpense'

describe('adalahJointExpenseDisembunyikan', () => {
  it('joint expense Oktober 2026 ke atas disembunyikan (dua ejaan)', () => {
    expect(adalahJointExpenseDisembunyikan({ category: 'joint_expense', expense_date: '2026-10-01' })).toBe(true)
    expect(adalahJointExpenseDisembunyikan({ category: 'joint_expanse', expense_date: '2026-11-15' })).toBe(true)
  })
  it('Agustus & September tetap dihitung', () => {
    expect(adalahJointExpenseDisembunyikan({ category: 'joint_expense', expense_date: '2026-09-30' })).toBe(false)
    expect(adalahJointExpenseDisembunyikan({ category: 'joint_expense', expense_date: '2026-08-01' })).toBe(false)
  })
  it('kategori lain tidak tersentuh', () => {
    expect(adalahJointExpenseDisembunyikan({ category: 'pengeluaran_global', expense_date: '2026-10-05' })).toBe(false)
    expect(adalahJointExpenseDisembunyikan(null)).toBe(false)
  })
})

import { adalahHppKolMarcomDisembunyikan } from './jointExpense'

describe('adalahHppKolMarcomDisembunyikan', () => {
  it('HPP Menu KOL Marcom Oktober 2026 ke atas disembunyikan', () => {
    expect(adalahHppKolMarcomDisembunyikan({
      description: '[MARCOM: HPP Menu KOL - Anya] - Menu: Suka Beef (Outlet: MITRA CIBUBUR)',
      expense_date: '2026-10-01'
    })).toBe(true)
    expect(adalahHppKolMarcomDisembunyikan({
      description: '[marcom: hpp menu kol - test]',
      expense_date: '2026-10-25'
    })).toBe(true)
  })

  it('September 2026 dan sebelumnya tetap dihitung (sudah closing)', () => {
    expect(adalahHppKolMarcomDisembunyikan({
      description: '[MARCOM: HPP Menu KOL - Budi] (Outlet: MITRA CICURUG)',
      expense_date: '2026-09-30'
    })).toBe(false)
    expect(adalahHppKolMarcomDisembunyikan({
      description: '[MARCOM: HPP Menu KOL - Budi] (Outlet: MITRA CICURUG)',
      expense_date: '2026-08-15'
    })).toBe(false)
  })

  it('Pengeluaran marcom lain (fee endorsement, ongkir sample) tidak disembunyikan', () => {
    expect(adalahHppKolMarcomDisembunyikan({
      description: '[MARCOM: Fee Endorsement KOL - Anya]',
      expense_date: '2026-10-15'
    })).toBe(false)
    expect(adalahHppKolMarcomDisembunyikan({
      description: 'Beli Bahan Baku',
      expense_date: '2026-10-10'
    })).toBe(false)
    expect(adalahHppKolMarcomDisembunyikan(null)).toBe(false)
  })
})
